import { describe, expect, it } from 'vitest'
import { ApiError } from './api'
import { staffLoanFilter, staffLoanLoadMessage, staffLoansPath } from './staffLoans'

describe('staff loan list', () => {
  it('sends only the server loan statuses as a filter', () => {
    expect(staffLoanFilter('ACTIVE')).toBe('ACTIVE')
    expect(staffLoanFilter('PAID_OFF')).toBe('PAID_OFF')
    expect(staffLoanFilter('WITHDRAWN')).toBe('WITHDRAWN')
    expect(staffLoanFilter('REPAYING')).toBeNull()
    expect(staffLoanFilter(null)).toBeNull()
  })
  it('builds the list path with optional filters', () => {
    expect(staffLoansPath(null)).toBe('/staff/loans')
    expect(staffLoansPath('ACTIVE')).toBe('/staff/loans?status=ACTIVE')
    expect(staffLoansPath(null, 'a-1')).toBe('/staff/loans?applicationId=a-1')
  })
  it('explains missing permission and records', () => {
    expect(staffLoanLoadMessage(new ApiError('ACCESS_DENIED', 'x', 403))).toContain('권한')
    expect(staffLoanLoadMessage(new ApiError('LOAN_NOT_FOUND', 'x', 404))).toContain('찾을 수')
    expect(staffLoanLoadMessage(new Error('x'))).toBeUndefined()
  })
})
