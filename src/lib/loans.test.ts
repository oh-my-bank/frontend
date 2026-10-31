import { describe, expect, it } from 'vitest'
import { ApiError } from './api'
import {
  acknowledgementLabel,
  agreementBody,
  ledgerAccountLabel,
  lifecycleStage,
  loanCommandMessage,
  loanDate,
  needsLoanReload,
  repaymentApplied,
  repaymentBody,
  type AgreementDraft,
  type Installment,
  type LoanDetail,
} from './loans'

const draft: AgreementDraft = {
  applicationId: 'app-1',
  productName: '가상 신용대출',
  policyVersion: 1,
  terms: {
    amount: 10000000,
    termMonths: 12,
    annualInterestRate: '12.000',
    repaymentMethod: 'EQUAL_PRINCIPAL_AND_INTEREST',
  },
  repayment: {
    firstPayment: 888488,
    lastPayment: 888483,
    totalInterest: 661851,
    totalPayment: 10661851,
  },
  explanation: { version: 'EXP-1', items: [{ title: '금리', body: '고정금리' }] },
  requiredAcknowledgements: [
    { code: 'TERMS_CONFIRMED', label: '확정 조건을 확인했습니다' },
    { code: 'EXPLANATION_READ', label: '상품설명서를 읽었습니다' },
    { code: 'SIMULATION_ONLY', label: '모의 시뮬레이션임을 이해했습니다' },
  ],
  notice: '교육용',
}

// Golden L1 (banking-rules G7): 10,000,000원 · 12개월 · 12%.
function installment(index: number, paid: boolean): Installment {
  return {
    installment: index,
    dueDate: index === 1 ? '2026-02-28' : '2026-03-31',
    payment: index === 12 ? 888483 : 888488,
    principal: index === 1 ? 788488 : 796373,
    interest: index === 1 ? 100000 : 92115,
    balanceAfter: index === 1 ? 9211512 : 8415139,
    paid,
    paidOn: paid ? '2026-02-28' : null,
  }
}
function loan(paidUpTo: number, status: LoanDetail['status'] = 'ACTIVE'): LoanDetail {
  const schedule = Array.from({ length: 12 }, (_, index) =>
    installment(index + 1, index + 1 <= paidUpTo),
  )
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
    outstandingPrincipal: 9211512,
    paidInstallments: paidUpTo,
    nextInstallment: schedule.find((item) => !item.paid) ?? null,
    totals: {
      totalPayment: 10661851,
      totalInterest: 661851,
      paidPrincipal: 0,
      paidInterest: 0,
      paidTotal: 0,
    },
    schedule,
    notice: '교육용',
  }
}

describe('loan lifecycle stage', () => {
  it('offers agreement only after approval and execution only after agreement', () => {
    expect(lifecycleStage('APPLIED')).toBeNull()
    expect(lifecycleStage('UNDER_REVIEW')).toBeNull()
    expect(lifecycleStage('REJECTED')).toBeNull()
    expect(lifecycleStage('APPROVED')).toBe('agree')
    expect(lifecycleStage('AGREED')).toBe('execute')
    expect(lifecycleStage('EXECUTED')).toBe('loan')
    expect(lifecycleStage('REPAYING')).toBe('loan')
    expect(lifecycleStage('PAID_OFF')).toBe('loan')
  })
})

describe('agreement body', () => {
  it('is withheld until every required acknowledgement is checked', () => {
    expect(agreementBody(draft, new Set())).toBeNull()
    expect(agreementBody(draft, new Set(['TERMS_CONFIRMED', 'EXPLANATION_READ']))).toBeNull()
  })
  it('sends the shown explanation version with the server codes in order', () => {
    const body = agreementBody(
      draft,
      new Set(['SIMULATION_ONLY', 'TERMS_CONFIRMED', 'EXPLANATION_READ', 'EXTRA']),
    )
    expect(body).toEqual({
      explanationVersion: 'EXP-1',
      acknowledgements: ['TERMS_CONFIRMED', 'EXPLANATION_READ', 'SIMULATION_ONLY'],
    })
  })
  it('never agrees to a draft without acknowledgements', () => {
    expect(agreementBody({ ...draft, requiredAcknowledgements: [] }, new Set())).toBeNull()
  })
})

describe('repayment body', () => {
  it('pays the next installment for exactly its scheduled amount', () => {
    expect(repaymentBody(loan(0))).toEqual({ installment: 1, amount: 888488 })
    expect(repaymentBody(loan(11))).toEqual({ installment: 12, amount: 888483 })
  })
  it('offers nothing once the loan is paid off', () => {
    expect(repaymentBody(loan(12, 'PAID_OFF'))).toBeNull()
    expect(repaymentBody({ status: 'ACTIVE', nextInstallment: null })).toBeNull()
  })
  it('judges an uncertain repayment from the fresh schedule', () => {
    expect(repaymentApplied(1, loan(0))).toBe(false)
    expect(repaymentApplied(1, loan(1))).toBe(true)
    expect(repaymentApplied(2, loan(1))).toBe(false)
  })
})

describe('loan command messages', () => {
  it('asks to check before retrying an uncertain result', () => {
    const network = new ApiError('NETWORK_ERROR', 'offline')
    expect(loanCommandMessage(network, 'execute')).toContain('대출 실행 결과를 확인하지 못했습니다')
    expect(loanCommandMessage(new ApiError('INTERNAL', 'x', 500), 'repay')).toContain(
      '같은 요청으로 다시 시도',
    )
    expect(needsLoanReload(network)).toBe(false)
  })
  it('explains each conflict and reloads the latest state', () => {
    const codes = [
      'APPLICATION_STATE_CONFLICT',
      'EXPLANATION_VERSION_MISMATCH',
      'IDEMPOTENCY_CONFLICT',
      'LOAN_PAID_OFF',
      'INSTALLMENT_ALREADY_PAID',
      'INSTALLMENT_OUT_OF_ORDER',
      'REPAYMENT_AMOUNT_MISMATCH',
    ]
    for (const code of codes) {
      const error = new ApiError(code, 'conflict', 409)
      expect(loanCommandMessage(error, 'repay')).toBeTruthy()
      expect(needsLoanReload(error)).toBe(true)
    }
    expect(loanCommandMessage(new ApiError('LOAN_TERMS_UNSUPPORTED', 'x', 409), 'agree')).toContain(
      '0원',
    )
    expect(needsLoanReload(new ApiError('VALIDATION_ERROR', 'x', 400))).toBe(false)
  })
  it('shows nothing without an error', () => {
    expect(loanCommandMessage(null, 'agree')).toBeUndefined()
  })
})

describe('loan labels', () => {
  it('formats virtual dates without a time zone shift', () => {
    expect(loanDate('2026-02-28')).toBe('2026.02.28')
    expect(loanDate(null)).toBe('-')
  })
  it('names ledger accounts and acknowledgements', () => {
    expect(ledgerAccountLabel('LOAN_RECEIVABLE')).toBe('대출채권')
    expect(ledgerAccountLabel('OTHER')).toBe('OTHER')
    expect(acknowledgementLabel('EXPLANATION_READ')).toBe('상품설명서 확인')
  })
})
