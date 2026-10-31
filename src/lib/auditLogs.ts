import { ApiError } from './api'
import type { Role } from '../types'

export interface AuditActor {
  id: string
  role: Role | null
  /** Staff names as stored; customer names masked by the server, e.g. "가****". */
  displayName: string | null
}
export interface AuditEntry {
  id: string
  occurredAt: string
  action: string
  targetType: string
  targetId: string
  beforeState: string | null
  afterState: string | null
  actor: AuditActor
}
export interface AuditPage {
  items: AuditEntry[]
  nextCursor: string | null
  limit: number
}

/** Filter form values; dates are `YYYY-MM-DD` in Asia/Seoul and both ends are inclusive days. */
export interface AuditFilter {
  fromDate: string
  toDate: string
  action: string
  targetType: string
  actorId: string
  targetId: string
}
export type AuditFilterField = keyof AuditFilter

export const PAGE_SIZE = 50
export const emptyFilter: AuditFilter = {
  fromDate: '',
  toDate: '',
  action: '',
  targetType: '',
  actorId: '',
  targetId: '',
}

/** Actions recorded by the current modules. Codes added later still show as their raw code. */
export const actionLabels: Record<string, string> = {
  CUSTOMER_REGISTERED: '고객 가입',
  APPLICATION_CREATED: '대출 신청 접수',
  REVIEW_STARTED: '심사 시작',
  REVIEW_APPROVED: '심사 승인',
  REVIEW_REJECTED: '심사 거절',
  PRODUCT_CREATED: '상품 등록',
  PRODUCT_POLICY_PUBLISHED: '정책 버전 발행',
  PRODUCT_DEACTIVATED: '판매 중지',
}
export const targetTypeLabels: Record<string, string> = {
  USER: '사용자 계정',
  LOAN_APPLICATION: '대출 신청',
  LOAN_PRODUCT: '대출상품',
}
const roleLabels: Record<Role, string> = {
  CUSTOMER: '고객',
  REVIEWER: '심사 담당자',
  ADMIN: '운영 관리자',
}

export const actionLabel = (code: string) => actionLabels[code] ?? code
export const targetTypeLabel = (code: string) => targetTypeLabels[code] ?? code
export const roleLabel = (role: Role | null) => (role ? roleLabels[role] : '알 수 없음')

const dateFormat = /^\d{4}-\d{2}-\d{2}$/
const uuidFormat = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Midnight of a Seoul calendar day as an ISO instant; Korea has no daylight saving time. */
function seoulMidnight(date: string, plusDays = 0) {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + plusDays) - 9 * 60 * 60 * 1000).toISOString()
}

/** Messages keyed by filter field; an empty object means the filter can be sent. */
export function validateFilter(filter: AuditFilter): Partial<Record<AuditFilterField, string>> {
  const errors: Partial<Record<AuditFilterField, string>> = {}
  if (filter.fromDate && !dateFormat.test(filter.fromDate))
    errors.fromDate = '시작일을 날짜 형식으로 입력해 주세요.'
  if (filter.toDate && !dateFormat.test(filter.toDate))
    errors.toDate = '종료일을 날짜 형식으로 입력해 주세요.'
  // ISO dates compare correctly as strings.
  if (!errors.fromDate && !errors.toDate && filter.fromDate > filter.toDate && filter.toDate)
    errors.toDate = '종료일은 시작일과 같거나 뒤여야 합니다.'
  if (filter.actorId.trim() && !uuidFormat.test(filter.actorId.trim()))
    errors.actorId = '수행자 ID는 UUID 형식(예: 10000000-0000-0000-0000-000000000003)입니다.'
  if (filter.targetId.trim() && !uuidFormat.test(filter.targetId.trim()))
    errors.targetId = '대상 ID는 UUID 형식입니다.'
  return errors
}

/** Query string for `GET /admin/audit-logs`; the end date covers its whole Seoul day (`to` is exclusive). */
export function auditQuery(filter: AuditFilter, cursor?: string | null, limit = PAGE_SIZE) {
  const params = new URLSearchParams()
  if (filter.fromDate) params.set('from', seoulMidnight(filter.fromDate))
  if (filter.toDate) params.set('to', seoulMidnight(filter.toDate, 1))
  if (filter.action) params.set('action', filter.action)
  if (filter.targetType) params.set('targetType', filter.targetType)
  if (filter.actorId.trim()) params.set('actorId', filter.actorId.trim().toLowerCase())
  if (filter.targetId.trim()) params.set('targetId', filter.targetId.trim().toLowerCase())
  if (cursor) params.set('cursor', cursor)
  params.set('limit', String(limit))
  return `?${params.toString()}`
}

/** The applied filter lives in the address so a reload or shared link shows the same records. */
export function filterFromParams(params: URLSearchParams): AuditFilter {
  return {
    fromDate: params.get('from') ?? '',
    toDate: params.get('to') ?? '',
    action: params.get('action') ?? '',
    targetType: params.get('targetType') ?? '',
    actorId: params.get('actorId') ?? '',
    targetId: params.get('targetId') ?? '',
  }
}
export function filterToParams(filter: AuditFilter) {
  const params = new URLSearchParams()
  const keys: [AuditFilterField, string][] = [
    ['fromDate', 'from'],
    ['toDate', 'to'],
    ['action', 'action'],
    ['targetType', 'targetType'],
    ['actorId', 'actorId'],
    ['targetId', 'targetId'],
  ]
  for (const [field, name] of keys) if (filter[field].trim()) params.set(name, filter[field].trim())
  return params
}
export const hasFilter = (filter: AuditFilter) =>
  Object.values(filter).some((value) => value.trim() !== '')

/** `status=ACTIVE;policyVersion=1` → ['status=ACTIVE', 'policyVersion=1']. */
export const stateParts = (state: string | null) =>
  state ? state.split(';').filter((part) => part !== '') : []

/** Where an administrator can open the audited record; other targets have no ADMIN screen. */
export function targetLink(entry: Pick<AuditEntry, 'targetType' | 'targetId'>) {
  return entry.targetType === 'LOAN_PRODUCT' ? `/admin/products/${entry.targetId}` : null
}

export function auditLoadMessage(error: unknown) {
  if (!(error instanceof ApiError)) return undefined
  if (error.status === 403)
    return '운영 관리자 권한이 필요합니다. 로그인한 계정의 권한을 확인해 주세요.'
  if (error.fieldErrors.cursor)
    return '조회 위치가 만료되었거나 올바르지 않습니다. 조건을 유지한 채 처음부터 다시 조회해 주세요.'
  if (error.code === 'VALIDATION_ERROR' || error.code === 'INVALID_REQUEST')
    return '조회 조건을 확인해 주세요. 날짜와 ID 형식이 올바른지 확인한 뒤 다시 조회해 주세요.'
  return undefined
}
