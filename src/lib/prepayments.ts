import { ApiError } from './api'
import { wonText } from './format'
import type { Installment, LoanDetail } from './loans'

/** Partial and full prepayment with an early repayment fee (launch requirement L03, rule set LOAN_PREPAY_V1). */
export type PrepaymentType = 'PARTIAL' | 'FULL'
export interface Prepayment {
  id: string
  loanId: string
  sequence: number
  type: PrepaymentType
  principal: number
  fee: number
  totalAmount: number
  businessDate: string
  elapsedDays: number
  feeRate: string
  exemptionDays: number
  paidInstallmentsBefore: number
  outstandingBefore: number
  outstandingAfter: number
  principalTransactionId: string
  feeTransactionId: string | null
  ruleVersion: string
  createdAt: string
}
export interface PrepaymentPreview {
  loanId: string
  type: PrepaymentType
  ruleVersion: string
  businessDate: string
  elapsedDays: number
  exemptionDays: number
  feeRate: string
  minimumAmount: number
  outstandingBefore: number
  principal: number
  fee: number
  totalAmount: number
  outstandingAfter: number
  paidInstallments: number
  remainingInstallments: number
  currentPayment: number | null
  newPayment: number | null
  newLastPayment: number | null
  interestBefore: number
  interestAfter: number
  interestSaved: number
  schedule: Installment[]
  assumptionNotice: string
  notice: string
}
export interface PrepaymentResult {
  prepayment: Prepayment
  loan: LoanDetail
}
export type PrepaymentBody = { type: 'FULL' } | { type: 'PARTIAL'; amount: number }

/** Educational assumption of LOAN_PREPAY_V1; the server checks it again. */
export const PREPAYMENT_MINIMUM = 10000

export const prepaymentTypeLabel = (type: string) =>
  ({ PARTIAL: '부분상환', FULL: '전액상환' })[type] ?? type

/** `1.200` → `1.2%`: the fee rate is a percent of the prepaid principal, not an annual rate. */
export const feeRateLabel = (rate: string) => {
  const value = Number(rate)
  return Number.isFinite(value)
    ? `${value.toLocaleString('ko-KR', { maximumFractionDigits: 3 })}%`
    : rate
}

/** A won amount typed with optional commas or spaces; null unless it is a whole positive number. */
export function parseWon(text: string): number | null {
  const normalized = text.replace(/[\s,]/g, '')
  if (!/^\d{1,11}$/.test(normalized)) return null
  const value = Number(normalized)
  return value > 0 ? value : null
}

/** The request body, or the reason it cannot be sent yet. Partial amounts are at least 10,000 won and below the balance. */
export function prepaymentRequest(
  type: PrepaymentType,
  amountText: string,
  outstanding: number,
): { body: PrepaymentBody } | { error: string } {
  if (type === 'FULL') return { body: { type: 'FULL' } }
  const amount = parseWon(amountText)
  if (amount === null) return { error: '부분상환 금액을 원 단위 숫자로 입력해 주세요.' }
  if (amount < PREPAYMENT_MINIMUM)
    return { error: `부분상환 금액은 ${wonText(PREPAYMENT_MINIMUM)} 이상이어야 합니다.` }
  if (amount >= outstanding)
    return {
      error: '부분상환 금액은 남은 원금보다 적어야 합니다. 모두 갚으려면 전액상환을 선택해 주세요.',
    }
  return { body: { type: 'PARTIAL', amount } }
}

/** GET path of the preview for one body, relative to the API base. */
export function prepaymentPreviewPath(loanPath: string, body: PrepaymentBody) {
  const query = new URLSearchParams({ type: body.type })
  if (body.type === 'PARTIAL') query.set('amount', String(body.amount))
  return `${loanPath}/prepayments/preview?${query.toString()}`
}

/** The previewed loan state the server checks before it prepays (409 PREPAYMENT_STATE_CHANGED when the loan moved on). */
export const withPreviewState = (
  body: PrepaymentBody,
  preview: Pick<PrepaymentPreview, 'paidInstallments' | 'outstandingBefore'>,
) => ({
  ...body,
  expectedPaidInstallments: preview.paidInstallments,
  expectedOutstandingPrincipal: preview.outstandingBefore,
})

/** The loan changed after the preview; the screen previews the same request again. */
export const isStateChanged = (error: unknown) =>
  error instanceof ApiError && error.code === 'PREPAYMENT_STATE_CHANGED'

/** Only an active loan can be prepaid. */
export const canPrepay = (loan: Pick<LoanDetail, 'status'>) => loan.status === 'ACTIVE'

/** Whether an uncertain prepayment already took effect: the latest detail holds more prepayments than before sending. */
export const prepaymentApplied = (before: number, latest: Pick<LoanDetail, 'prepayments'>) =>
  (latest.prepayments?.length ?? 0) > before

/** Server answers that concern the entered amount rather than a changed loan; the form stays as it is. */
export const isAmountConflict = (error: unknown) =>
  error instanceof ApiError &&
  (error.code === 'PREPAYMENT_EXCEEDS_BALANCE' || error.code === 'PREPAYMENT_TERMS_UNSUPPORTED')

/** The notice after a recorded prepayment. */
export function prepaymentNotice(result: Pick<PrepaymentResult, 'prepayment' | 'loan'>) {
  const { prepayment, loan } = result
  const fee = prepayment.fee > 0 ? `중도상환수수료 ${wonText(prepayment.fee)}` : '수수료 없음'
  return prepayment.type === 'FULL' || loan.status === 'PAID_OFF'
    ? `전액상환으로 대출을 완납했습니다. 상환 원금 ${wonText(prepayment.principal)}, ${fee}.`
    : `부분상환이 기록되었습니다. 상환 원금 ${wonText(prepayment.principal)}, ${fee}. 남은 원금은 ${wonText(loan.outstandingPrincipal)}입니다.`
}
