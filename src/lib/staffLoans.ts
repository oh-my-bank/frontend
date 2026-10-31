import { ApiError } from './api'
import type { LoanDetail, LoanStatus, LoanSummary } from './loans'

/** Staff see the customer only by customer ID and a masked name, like the review screens. */
export interface StaffCustomer {
  id: string
  maskedName: string
}
export interface StaffLoanSummary {
  customer: StaffCustomer
  loan: LoanSummary
}
export interface StaffLoanDetail {
  customer: StaffCustomer
  loan: LoanDetail
}

export const staffLoanStatuses: { value: LoanStatus | null; label: string }[] = [
  { value: null, label: '전체' },
  { value: 'ACTIVE', label: '상환 중' },
  { value: 'PAID_OFF', label: '완납' },
  { value: 'WITHDRAWN', label: '철회' },
]

/** Only the server's loan statuses are sent as a filter; anything else shows every loan. */
export function staffLoanFilter(value: string | null): LoanStatus | null {
  return staffLoanStatuses.some((item) => item.value === value) ? (value as LoanStatus) : null
}

export function staffLoansPath(status: LoanStatus | null, applicationId?: string) {
  const query = new URLSearchParams()
  if (status) query.set('status', status)
  if (applicationId) query.set('applicationId', applicationId)
  const text = query.toString()
  return `/staff/loans${text ? `?${text}` : ''}`
}

export function staffLoanLoadMessage(error: unknown) {
  if (!(error instanceof ApiError)) return undefined
  if (error.status === 403)
    return '심사 담당자 또는 운영 관리자 권한이 필요합니다. 로그인한 계정의 권한을 확인해 주세요.'
  if (error.status === 404 || error.code === 'INVALID_REQUEST')
    return '대출 계정을 찾을 수 없습니다. 목록에서 다시 선택해 주세요.'
  return undefined
}
