import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import LoanPrepaymentHistory from './LoanPrepaymentHistory'
import type { LoanDetail } from '../lib/loans'

const loan = {
  id: 'loan-1',
  status: 'ACTIVE',
  outstandingPrincipal: 4610802,
  paidInstallments: 3,
  schedule: [],
  prepaidPrincipal: 3000000,
  prepaymentFees: 33073,
  prepayments: [
    {
      id: 'prepay-1',
      loanId: 'loan-1',
      sequence: 1,
      type: 'PARTIAL',
      principal: 3000000,
      fee: 33073,
      totalAmount: 3033073,
      businessDate: '2026-04-30',
      elapsedDays: 89,
      feeRate: '1.200',
      exemptionDays: 1095,
      paidInstallmentsBefore: 3,
      outstandingBefore: 7610802,
      outstandingAfter: 4610802,
      principalTransactionId: 'tx-1',
      feeTransactionId: 'tx-2',
      ruleVersion: 'LOAN_PREPAY_V1',
      createdAt: '2026-11-02T00:00:00Z',
    },
  ],
} as unknown as LoanDetail

describe('prepayment history', () => {
  it('shows the golden L4 record with the educational assumptions', () => {
    const html = renderToStaticMarkup(<LoanPrepaymentHistory loan={loan} />)
    expect(html).toContain('조기상환 내역')
    expect(html).toContain('2026.04.30')
    expect(html).toContain('3회차 납부 후')
    expect(html).toContain('33,073')
    expect(html).toContain('LOAN_PREPAY_V1')
    expect(html).toContain('교육용')
    expect(html).toContain('1.2%')
  })
  it('renders nothing before the first prepayment', () => {
    expect(
      renderToStaticMarkup(<LoanPrepaymentHistory loan={{ ...loan, prepayments: [] }} />),
    ).toBe('')
  })
})
