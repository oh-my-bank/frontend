import { describe, expect, it } from 'vitest'
import {
  actionStatus,
  actionTypeLabel,
  buildStrategyRequest,
  monthlyAllocation,
  stepOfField,
  strategyFieldId,
  strategyFieldLabel,
  type StrategyAction,
  type StrategyDraft,
  type StrategyPlan,
} from './strategy'

const draft: StrategyDraft = {
  monthlyIncome: '3,200,000',
  monthlyExpense: '2000000',
  liquidAssets: '15000000',
  emergencyMonths: '6',
  taxFree: false,
  goals: [{ key: 'g1', name: ' 여행 자금 ', targetAmount: '3000000', months: '5' }],
  loans: [{ key: 'l1', name: '신용대출', balance: '3000000', annualRate: '7.50' }],
}

describe('strategy request', () => {
  it('builds the API body from the form text', () => {
    const { request, errors } = buildStrategyRequest(draft)
    expect(errors).toEqual({})
    expect(request).toEqual({
      monthlyIncome: 3200000,
      monthlyExpense: 2000000,
      liquidAssets: 15000000,
      emergencyMonths: 6,
      taxFree: false,
      goals: [{ name: '여행 자금', targetAmount: 3000000, months: 5 }],
      loans: [{ name: '신용대출', balance: 3000000, annualRate: '7.50' }],
    })
  })
  it('reports range problems under the server field paths and sends nothing', () => {
    const { request, errors } = buildStrategyRequest({
      ...draft,
      emergencyMonths: '2',
      goals: [{ key: 'g1', name: '', targetAmount: '50000', months: '37' }],
      loans: [{ key: 'l1', name: '대출', balance: '0', annualRate: '30.5' }],
    })
    expect(request).toBeNull()
    expect(Object.keys(errors).sort()).toEqual([
      'emergencyMonths',
      'goals[0].months',
      'goals[0].name',
      'goals[0].targetAmount',
      'loans[0].annualRate',
      'loans[0].balance',
    ])
  })
  it('rejects a rate with more than three decimal places', () => {
    const { errors } = buildStrategyRequest({
      ...draft,
      loans: [{ key: 'l1', name: '대출', balance: '1000', annualRate: '1.2345' }],
    })
    expect(errors['loans[0].annualRate']).toBeTruthy()
  })
})

describe('strategy form fields', () => {
  it('sends each server field error to the step that shows the input', () => {
    expect(stepOfField('monthlyExpense')).toBe(0)
    expect(stepOfField('emergencyMonths')).toBe(1)
    expect(stepOfField('goals[2].months')).toBe(2)
    expect(stepOfField('loans')).toBe(3)
  })
  it('names nested paths for the error summary and gives them input ids', () => {
    expect(strategyFieldLabel('loans[1].annualRate')).toBe('대출 2 연 금리')
    expect(strategyFieldLabel('unknownField')).toBe('unknownField')
    expect(strategyFieldId('goals[0].targetAmount')).toBe('strategy-goals-0-targetAmount')
  })
})

describe('action labels', () => {
  it('shows unknown types and statuses as their codes', () => {
    expect(actionTypeLabel('NEW_TYPE')).toBe('NEW_TYPE')
    expect(actionStatus('LATER')).toEqual({ label: 'LATER', tone: 'info' })
    expect(actionStatus('PARTIAL').tone).toBe('partial')
  })
})

describe('monthly allocation bar', () => {
  const action = (patch: Partial<StrategyAction>): StrategyAction => ({
    order: 1,
    type: 'EMERGENCY_FUND',
    status: 'OK',
    productCode: null,
    goalName: null,
    loanName: null,
    amount: null,
    monthlyAmount: null,
    allocatedMonthly: null,
    shortfallMonthly: null,
    termMonths: null,
    annualRate: null,
    expectedMaturityAfterTax: null,
    interestSavedPerYear: null,
    title: '',
    reason: '',
    conceptSlug: null,
    ...patch,
  })
  const plan = (actions: StrategyAction[], unallocatedMonthly: number): StrategyPlan => ({
    ruleVersion: 'BANK_STRATEGY_V1',
    ratesVersion: 'BANK_RULES_V1',
    summary: {
      monthlyIncome: 3200000,
      monthlyExpense: 2000000,
      monthlySurplus: 1200000,
      savingsRatePercent: '37.5',
      emergencyTarget: 12000000,
      emergencyCoverageMonths: '7.5',
      benchmarkRate: '2.538',
      allocatedMonthly: 1200000,
      unallocatedMonthly,
    },
    actions,
    warnings: [],
    notice: '',
  })

  it('splits the G17 plan into allocations and the shortfall', () => {
    const segments = monthlyAllocation(
      plan(
        [
          action({ order: 1, amount: 12000000 }),
          action({
            order: 4,
            type: 'PARKING_GOAL',
            goalName: '여행 자금',
            monthlyAmount: 600000,
            allocatedMonthly: 600000,
          }),
          action({
            order: 5,
            type: 'INSTALLMENT_SAVINGS',
            status: 'PARTIAL',
            goalName: '전세 보증금 보탬',
            monthlyAmount: 810000,
            allocatedMonthly: 600000,
            shortfallMonthly: 210000,
          }),
        ],
        0,
      ),
    )
    expect(segments.map(({ kind, amount }) => [kind, amount])).toEqual([
      ['allocated', 600000],
      ['allocated', 600000],
      ['shortfall', 210000],
    ])
  })
  it('uses the monthly amount when a top-up carries no separate allocation', () => {
    const segments = monthlyAllocation(
      plan([action({ order: 2, type: 'EMERGENCY_TOPUP', monthlyAmount: 167000 })], 33000),
    )
    expect(segments.map(({ kind, amount }) => [kind, amount])).toEqual([
      ['allocated', 167000],
      ['unallocated', 33000],
    ])
  })
})
