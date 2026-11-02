import { describe, expect, it } from 'vitest'
import { ApiError } from './api'
import { createRequestIdentity } from './idempotency'
import {
  canWithdraw,
  ledgerAccountLabel,
  ledgerKindLabel,
  ledgerRecordedAt,
  loanCommandMessage,
  prepaymentPoint,
  reversalTarget,
  type Installment,
  type LoanDetail,
} from './loans'
import {
  PREPAYMENT_MINIMUM,
  canPrepay,
  feeRateLabel,
  isAmountConflict,
  isStateChanged,
  parseWon,
  prepaymentApplied,
  prepaymentNotice,
  prepaymentPreviewPath,
  prepaymentRequest,
  prepaymentTypeLabel,
  withPreviewState,
  type Prepayment,
} from './prepayments'

// Golden L4 (LOAN_PREPAY_V1): L1 loan after three installments, 3,000,000 won prepaid on 2026-04-30 with a 33,073 won fee.
const l4: Prepayment = {
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
}
function installment(index: number, paid: boolean): Installment {
  return {
    installment: index,
    dueDate: '2026-02-28',
    payment: index <= 3 ? 888488 : 538267,
    principal: 1,
    interest: 1,
    balanceAfter: 1,
    paid,
    paidOn: paid ? '2026-02-28' : null,
  }
}
function loan(
  paid: number,
  prepayments: Prepayment[],
  status: LoanDetail['status'] = 'ACTIVE',
): LoanDetail {
  const schedule = Array.from({ length: 12 }, (_, index) => installment(index + 1, index < paid))
  return {
    id: 'loan-1',
    applicationId: 'app-1',
    agreementId: 'agreement-1',
    productName: '가상 신용대출',
    principal: 10000000,
    annualInterestRate: '12.000',
    termMonths: 12,
    repaymentMethod: 'EQUAL_PRINCIPAL_AND_INTEREST',
    executedOn: '2026-01-31',
    maturityOn: '2027-01-31',
    status,
    outstandingPrincipal: 4610802,
    paidInstallments: paid,
    nextInstallment: schedule.find((item) => !item.paid) ?? null,
    totals: { totalPayment: 0, totalInterest: 0, paidPrincipal: 0, paidInterest: 0, paidTotal: 0 },
    schedule,
    notice: '교육용',
    prepaidPrincipal: prepayments.reduce((sum, item) => sum + item.principal, 0),
    prepaymentFees: prepayments.reduce((sum, item) => sum + item.fee, 0),
    prepayments,
  }
}

describe('prepayment request', () => {
  it('sends a full prepayment without an amount', () => {
    expect(prepaymentRequest('FULL', '123', 4610802)).toEqual({ body: { type: 'FULL' } })
  })
  it('accepts a partial amount from 10,000 won up to just below the balance', () => {
    expect(prepaymentRequest('PARTIAL', '3,000,000', 7610802)).toEqual({
      body: { type: 'PARTIAL', amount: 3000000 },
    })
    expect(prepaymentRequest('PARTIAL', String(PREPAYMENT_MINIMUM), 7610802)).toEqual({
      body: { type: 'PARTIAL', amount: 10000 },
    })
    expect(prepaymentRequest('PARTIAL', '7610801', 7610802)).toEqual({
      body: { type: 'PARTIAL', amount: 7610801 },
    })
  })
  it('explains amounts it will not send', () => {
    expect(prepaymentRequest('PARTIAL', '', 7610802)).toEqual({
      error: '부분상환 금액을 원 단위 숫자로 입력해 주세요.',
    })
    expect('error' in prepaymentRequest('PARTIAL', '9,999', 7610802)).toBe(true)
    expect('error' in prepaymentRequest('PARTIAL', '7610802', 7610802)).toBe(true)
    expect('error' in prepaymentRequest('PARTIAL', '1.5', 7610802)).toBe(true)
    expect('error' in prepaymentRequest('PARTIAL', '-10000', 7610802)).toBe(true)
  })
  it('parses whole won amounts only', () => {
    expect(parseWon(' 1,234,567 ')).toBe(1234567)
    expect(parseWon('0')).toBeNull()
    expect(parseWon('1e6')).toBeNull()
    expect(parseWon('123456789012')).toBeNull()
  })
  it('builds the preview query for the same body', () => {
    expect(prepaymentPreviewPath('/loans/loan-1', { type: 'PARTIAL', amount: 3000000 })).toBe(
      '/loans/loan-1/prepayments/preview?type=PARTIAL&amount=3000000',
    )
    expect(prepaymentPreviewPath('/loans/loan-1', { type: 'FULL' })).toBe(
      '/loans/loan-1/prepayments/preview?type=FULL',
    )
  })
})

describe('prepayment state', () => {
  it('is offered only for an active loan', () => {
    expect(canPrepay(loan(3, []))).toBe(true)
    expect(canPrepay(loan(12, [], 'PAID_OFF'))).toBe(false)
    expect(canPrepay(loan(0, [], 'WITHDRAWN'))).toBe(false)
  })
  it('detects an uncertain prepayment by a new record', () => {
    expect(prepaymentApplied(0, loan(3, [l4]))).toBe(true)
    expect(prepaymentApplied(1, loan(3, [l4]))).toBe(false)
    expect(prepaymentApplied(0, loan(3, []))).toBe(false)
  })
  it('keeps the form for amount conflicts and labels the rule values', () => {
    expect(isAmountConflict(new ApiError('PREPAYMENT_EXCEEDS_BALANCE', 'x', 409))).toBe(true)
    expect(isAmountConflict(new ApiError('PREPAYMENT_TERMS_UNSUPPORTED', 'x', 409))).toBe(true)
    expect(isAmountConflict(new ApiError('LOAN_PAID_OFF', 'x', 409))).toBe(false)
    expect(feeRateLabel('1.200')).toBe('1.2%')
    expect(prepaymentTypeLabel('PARTIAL')).toBe('부분상환')
    expect(prepaymentTypeLabel('FULL')).toBe('전액상환')
  })
  it('summarizes the recorded prepayment', () => {
    expect(prepaymentNotice({ prepayment: l4, loan: loan(3, [l4]) })).toBe(
      '부분상환이 기록되었습니다. 상환 원금 3,000,000원, 중도상환수수료 33,073원. 남은 원금은 4,610,802원입니다.',
    )
    const full = { ...l4, type: 'FULL' as const, fee: 0 }
    expect(prepaymentNotice({ prepayment: full, loan: loan(6, [full], 'PAID_OFF') })).toBe(
      '전액상환으로 대출을 완납했습니다. 상환 원금 3,000,000원, 수수료 없음.',
    )
  })
})

describe('loan commands after a prepayment', () => {
  it('blocks withdrawal and reversals reaching back before the latest prepayment', () => {
    expect(canWithdraw(loan(0, []))).toBe(true)
    expect(canWithdraw(loan(0, [{ ...l4, paidInstallmentsBefore: 0 }]))).toBe(false)
    expect(prepaymentPoint(loan(3, []))).toBe(-1)
    expect(prepaymentPoint(loan(4, [l4]))).toBe(3)
    expect(reversalTarget(loan(3, [l4]))).toBeNull()
    expect(reversalTarget(loan(4, [l4]))?.installment).toBe(4)
    expect(reversalTarget(loan(3, []))?.installment).toBe(3)
  })
  it('labels the prepayment ledger and its errors', () => {
    expect(ledgerKindLabel('PREPAYMENT')).toBe('조기상환 원금')
    expect(ledgerKindLabel('PREPAYMENT_FEE')).toBe('중도상환수수료')
    expect(ledgerAccountLabel('FEE_INCOME')).toBe('수수료수익')
    expect(loanCommandMessage(new ApiError('LOAN_HAS_PREPAYMENT', 'x', 409), 'withdraw')).toContain(
      '조기상환한 대출은 철회할 수 없습니다',
    )
    expect(
      loanCommandMessage(new ApiError('REPAYMENT_BEFORE_PREPAYMENT', 'x', 409), 'reverse'),
    ).toContain('조기상환 이전')
    expect(loanCommandMessage(new ApiError('VALIDATION_ERROR', 'x', 400), 'prepay')).toContain(
      '10,000원 이상',
    )
    expect(loanCommandMessage(new TypeError('network'), 'prepay')).toContain('조기상환 결과를')
  })
})

describe('previewed state in the request', () => {
  it('sends the previewed paid count and balance with the body', () => {
    expect(
      withPreviewState(
        { type: 'PARTIAL', amount: 3000000 },
        { paidInstallments: 3, outstandingBefore: 7610802 },
      ),
    ).toEqual({
      type: 'PARTIAL',
      amount: 3000000,
      expectedPaidInstallments: 3,
      expectedOutstandingPrincipal: 7610802,
    })
    expect(
      withPreviewState({ type: 'FULL' }, { paidInstallments: 6, outstandingBefore: 5149209 }),
    ).toEqual({
      type: 'FULL',
      expectedPaidInstallments: 6,
      expectedOutstandingPrincipal: 5149209,
    })
  })
  it('gives a second identical prepayment a new key because the previewed balance moved', () => {
    const identity = createRequestIdentity(
      (() => {
        let n = 0
        return () => `key-${++n}`
      })(),
    )
    const body = { type: 'PARTIAL' as const, amount: 1000000 }
    const first = identity.keyFor(
      withPreviewState(body, { paidInstallments: 0, outstandingBefore: 10000000 }),
    )
    // An uncertain retry of the same preview reuses the key.
    expect(
      identity.keyFor(withPreviewState(body, { paidInstallments: 0, outstandingBefore: 10000000 })),
    ).toBe(first)
    expect(
      identity.keyFor(withPreviewState(body, { paidInstallments: 0, outstandingBefore: 9000000 })),
    ).not.toBe(first)
  })
  it('recognizes a changed loan and explains it', () => {
    const changed = new ApiError('PREPAYMENT_STATE_CHANGED', 'x', 409)
    expect(isStateChanged(changed)).toBe(true)
    expect(isAmountConflict(changed)).toBe(false)
    expect(isStateChanged(new ApiError('LOAN_PAID_OFF', 'x', 409))).toBe(false)
    expect(loanCommandMessage(changed, 'prepay')).toContain('미리보기를 다시 계산')
  })
  it('shows when a ledger transaction was recorded, to the second in Seoul time', () => {
    expect(ledgerRecordedAt('2026-11-02T05:30:15Z')).toMatch(/2:30:15/)
    expect(ledgerRecordedAt('not-a-date')).toBe('not-a-date')
  })
})
