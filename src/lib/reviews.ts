import type { ApplicationDecision } from '../types'
import { ApiError } from './api'

/** Staff views of decision 0005; customers only see `ApplicationDecision` on their own application. */
export type ReviewStatus = 'APPLIED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED'
export type RuleResult = 'MET' | 'NOT_MET'
export type RejectReasonCode = 'DSR_LIMIT_EXCEEDED' | 'STAFF_DECISION'
export type ReviewCommand = 'start' | 'approve' | 'reject'

export interface StaffMember {
  id: string
  name: string
}
export interface ReviewCustomer {
  id: string
  maskedName: string
}
export interface ReviewSummary {
  applicationId: string
  status: ReviewStatus
  customer: ReviewCustomer
  productName: string
  policyVersion: number
  requestedAmount: number
  termMonths: number
  annualInterestRate: string
  appliedAt: string
  ruleResult: RuleResult | null
  startedAt: string | null
  decidedAt: string | null
}
export interface ReviewEvaluation {
  ruleVersion: string
  thresholdPercent: number
  inputs: {
    requestedAmount: number
    termMonths: number
    annualInterestRate: string
    annualIncome: number
  }
  monthlyPayment: number
  annualRepayment: number
  repaymentRatio: string | null
  result: RuleResult
}
export interface ReviewDecision {
  result: 'APPROVED' | 'REJECTED'
  decidedBy: StaffMember
  decidedAt: string
  approvedTerms: { amount: number; termMonths: number; annualInterestRate: string } | null
  reasonCode: RejectReasonCode | null
  reasonMessage: string | null
  staffNote: string | null
}
export interface ReviewDetail {
  applicationId: string
  status: ReviewStatus
  customer: ReviewCustomer
  application: {
    productId: string
    productName: string
    policyVersion: number
    requestedAmount: number
    termMonths: number
    annualInterestRate: string
    annualIncome: number
    appliedAt: string
  }
  review: {
    startedBy: StaffMember
    startedAt: string
    evaluation: ReviewEvaluation
    decision: ReviewDecision | null
  } | null
  history: { event: string; at: string; actor: StaffMember | null }[]
  notice: string
}

export const NOTE_LIMIT = 200
export const reviewStatuses: { value: ReviewStatus | null; label: string }[] = [
  { value: null, label: '전체' },
  { value: 'APPLIED', label: '접수' },
  { value: 'UNDER_REVIEW', label: '심사 중' },
  { value: 'APPROVED', label: '승인' },
  { value: 'REJECTED', label: '거절' },
]

/** Only the four server statuses are sent as a filter; anything else shows every application. */
export function statusFilter(value: string | null): ReviewStatus | null {
  return reviewStatuses.some((item) => item.value === value) ? (value as ReviewStatus) : null
}

export const ruleResultLabel = (result: RuleResult | null) =>
  result === 'MET' ? '기준 충족' : result === 'NOT_MET' ? '기준 미충족' : '평가 전'

export const rejectReasonLabels: Record<RejectReasonCode, string> = {
  DSR_LIMIT_EXCEEDED: '모의 심사 기준 미충족',
  STAFF_DECISION: '담당자 종합 판단',
}

export const historyLabel = (event: string) =>
  ({
    APPLICATION_CREATED: '신청 접수',
    REVIEW_STARTED: '심사 시작 · 규칙 평가',
    REVIEW_APPROVED: '승인',
    REVIEW_REJECTED: '거절',
  })[event] ?? event

/** Which commands the current state allows; the server still checks the state under a row lock. */
export function reviewActions(detail: ReviewDetail) {
  const underReview = detail.status === 'UNDER_REVIEW' && !detail.review?.decision
  const met = detail.review?.evaluation.result === 'MET'
  return {
    canStart: detail.status === 'APPLIED',
    canApprove: underReview && met,
    canReject: underReview,
    approvalBlocked: underReview && !met,
  }
}

export const codePoints = (value: string) => [...value].length

/** The same checks as the reject command, so the reviewer sees them before sending. */
export function readRejection(
  reasonCode: RejectReasonCode | '',
  note: string,
  ruleResult: RuleResult | undefined,
): {
  body?: { reasonCode: RejectReasonCode; staffNote: string | null }
  errors: Record<string, string>
} {
  const errors: Record<string, string> = {}
  const staffNote = note.trim() || null
  if (!reasonCode) errors.reasonCode = '거절 사유를 선택해 주세요.'
  else if (reasonCode === 'DSR_LIMIT_EXCEEDED' && ruleResult === 'MET')
    errors.reasonCode = '모의 심사 기준을 충족한 신청에는 기준 미충족 사유를 쓸 수 없습니다.'
  if (staffNote && codePoints(staffNote) > NOTE_LIMIT)
    errors.staffNote = '직원 메모는 앞뒤 공백을 제외하고 200자 이하로 입력해 주세요.'
  else if (reasonCode === 'STAFF_DECISION' && !staffNote)
    errors.staffNote = '종합 판단으로 거절할 때는 직원 메모를 입력해 주세요.'
  if (Object.keys(errors).length || !reasonCode) return { errors }
  return { body: { reasonCode, staffNote }, errors }
}

export function isUncertain(error: unknown) {
  return !(error instanceof ApiError) || error.code === 'NETWORK_ERROR' || error.status >= 500
}

const commandNames: Record<ReviewCommand, string> = {
  start: '심사 시작',
  approve: '승인',
  reject: '거절',
}

export function reviewCommandMessage(error: unknown, command: ReviewCommand) {
  if (!error) return undefined
  if (isUncertain(error))
    return `${commandNames[command]} 결과를 확인하지 못했습니다. 이미 반영되었을 수 있으니 반영 여부를 먼저 확인하고, 필요하면 같은 요청으로 다시 시도해 주세요.`
  if (!(error instanceof ApiError)) return undefined
  return (
    {
      APPLICATION_STATE_CONFLICT:
        '다른 담당자가 먼저 처리했거나 현재 상태에서 할 수 없는 명령입니다. 최신 심사 정보를 다시 불러왔습니다.',
      REVIEW_RULE_NOT_MET:
        '모의 심사 기준을 충족하지 않은 신청은 승인할 수 없습니다. 최신 심사 정보를 다시 불러왔습니다.',
      IDEMPOTENCY_CONFLICT:
        '같은 요청 키에 다른 내용이 전송되었습니다. 최신 심사 정보를 다시 불러왔으니 내용을 확인해 주세요.',
      APPLICATION_NOT_FOUND: '신청 내역을 찾을 수 없습니다.',
      VALIDATION_ERROR: '입력 내용을 확인해 주세요.',
    } as Record<string, string>
  )[error.code]
}

/** 409 means the state moved on (or the rule forbids it); the page reloads the latest detail. */
export const needsReload = (error: unknown) =>
  error instanceof ApiError && (error.status === 409 || error.code === 'APPLICATION_NOT_FOUND')

export function reviewLoadMessage(error: unknown) {
  if (!(error instanceof ApiError)) return undefined
  if (error.status === 403)
    return '심사 담당자 또는 운영 관리자 권한이 필요합니다. 로그인한 계정의 권한을 확인해 주세요.'
  if (error.status === 404 || error.code === 'INVALID_REQUEST')
    return '신청 내역을 찾을 수 없습니다. 목록에서 다시 선택해 주세요.'
  return undefined
}

/** Whether an uncertain command already took effect, judged from a fresh detail. */
export function commandApplied(command: ReviewCommand, latest: ReviewDetail) {
  if (command === 'start') return latest.status !== 'APPLIED'
  return latest.status === (command === 'approve' ? 'APPROVED' : 'REJECTED')
}

/** What a customer sees about the review of their own application; no rule evidence or staff. */
export function customerReviewStage(status: string, decision?: ApplicationDecision | null) {
  if (decision?.result === 'APPROVED')
    return {
      tone: 'approved',
      title: '모의 심사에서 승인되었습니다.',
      description:
        '아래 확정 조건으로 승인되었습니다. 약정·실행 기능은 아직 제공하지 않으므로 대출금이 지급되거나 대출 잔액이 생기지 않습니다.',
    } as const
  if (decision?.result === 'REJECTED')
    return {
      tone: 'rejected',
      title: '모의 심사에서 승인되지 않았습니다.',
      description: decision.reasonMessage ?? '모의 심사 결과 승인되지 않았습니다.',
    } as const
  if (status === 'UNDER_REVIEW')
    return {
      tone: 'pending',
      title: '모의 심사가 진행 중입니다.',
      description:
        '심사 담당자가 신청 조건을 검토하고 있습니다. 결과가 나오면 이 화면에 표시됩니다.',
    } as const
  if (status === 'APPLIED')
    return {
      tone: 'pending',
      title: '심사 대기 중입니다.',
      description:
        '신청이 접수되었습니다. 심사 담당자가 모의 심사를 시작하면 심사 중으로 바뀝니다.',
    } as const
  return null
}
