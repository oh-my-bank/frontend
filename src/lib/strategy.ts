import { normalizeRate, parseWholeNumber } from './learning'
import type { Labeled } from './simulation'

export interface StrategyRequest {
  monthlyIncome: number
  monthlyExpense: number
  liquidAssets: number
  emergencyMonths: number
  taxFree: boolean
  goals: { name: string; targetAmount: number; months: number }[]
  loans: { name: string; balance: number; annualRate: string }[]
}
export interface StrategyAction {
  order: number
  type: string
  status: string
  productCode: string | null
  goalName: string | null
  loanName: string | null
  amount: number | null
  monthlyAmount: number | null
  allocatedMonthly: number | null
  shortfallMonthly: number | null
  termMonths: number | null
  annualRate: string | null
  expectedMaturityAfterTax: number | null
  interestSavedPerYear: number | null
  title: string
  reason: string
  conceptSlug: string | null
}
export interface StrategyPlan {
  ruleVersion: string
  ratesVersion: string
  summary: {
    monthlyIncome: number
    monthlyExpense: number
    monthlySurplus: number
    savingsRatePercent: string | null
    emergencyTarget: number
    emergencyCoverageMonths: string | null
    benchmarkRate: string
    allocatedMonthly: number
    unallocatedMonthly: number
  }
  actions: StrategyAction[]
  warnings: { code: string; message: string }[]
  notice: string
}

export interface GoalDraft {
  key: string
  name: string
  targetAmount: string
  months: string
}
export interface LoanDraft {
  key: string
  name: string
  balance: string
  annualRate: string
}
export interface StrategyDraft {
  monthlyIncome: string
  monthlyExpense: string
  liquidAssets: string
  emergencyMonths: string
  taxFree: boolean
  goals: GoalDraft[]
  loans: LoanDraft[]
}

export const strategyLimits = {
  maxGoals: 3,
  maxLoans: 5,
  maxNameLength: 30,
  maxCashflow: 1000000000,
  maxAssets: 10000000000,
  minGoalAmount: 100000,
  maxGoalAmount: 10000000000,
  maxGoalMonths: 36,
  maxLoanBalance: 10000000000,
  maxLoanRate: 30,
} as const

export const strategySteps = ['소득과 지출', '자산과 비상금', '목표', '보유 대출'] as const

const actionTypeLabels: Record<string, string> = {
  EMERGENCY_FUND: '비상금 확보',
  EMERGENCY_TOPUP: '비상금 월 적립',
  LOAN_PREPAY: '고금리 대출 상환',
  LOAN_KEEP: '대출 유지',
  EXPENSE_REVIEW: '지출 점검',
  TIME_DEPOSIT: '목표 목돈 예치',
  INSTALLMENT_SAVINGS: '목표 적금',
  PARKING_LUMP: '단기 목표 목돈',
  PARKING_GOAL: '단기 목표 월 적립',
  SURPLUS_PARKING: '남는 여유자금',
  IDLE_CASH_DEPOSIT: '남는 목돈 예치',
}
export const actionTypeLabel = (type: string) => actionTypeLabels[type] ?? type

const actionStatuses: Record<string, Labeled> = {
  OK: { label: '충족', tone: 'ok' },
  PARTIAL: { label: '일부 배분', tone: 'partial' },
  INFO: { label: '안내', tone: 'info' },
}
export const actionStatus = (status: string): Labeled =>
  actionStatuses[status] ?? { label: status, tone: 'info' }

/** Server field paths such as `goals[1].targetAmount` decide which step shows the problem. */
export function stepOfField(path: string): number {
  if (path.startsWith('goals')) return 2
  if (path.startsWith('loans')) return 3
  if (path === 'monthlyIncome' || path === 'monthlyExpense') return 0
  return 1
}

const fieldNames: Record<string, string> = {
  monthlyIncome: '월 실수령 소득',
  monthlyExpense: '월 지출',
  liquidAssets: '현금성 자산',
  emergencyMonths: '비상금 개월 수',
  taxFree: '비과세 여부',
  name: '이름',
  targetAmount: '목표액',
  months: '기간',
  balance: '잔액',
  annualRate: '연 금리',
}
export function strategyFieldLabel(path: string): string {
  const nested = /^(goals|loans)\[(\d+)\]\.(\w+)$/.exec(path)
  if (nested)
    return `${nested[1] === 'goals' ? '목표' : '대출'} ${Number(nested[2]) + 1} ${fieldNames[nested[3]] ?? nested[3]}`
  if (path === 'goals') return '목표'
  if (path === 'loans') return '보유 대출'
  return fieldNames[path] ?? path
}
/** DOM id of the input for a field path, so an error summary can move focus to it. */
export const strategyFieldId = (path: string) =>
  `strategy-${path.replace(/[[\].]+/g, '-').replace(/-$/, '')}`

function wholeNumber(
  errors: Record<string, string>,
  path: string,
  text: string,
  min: number,
  max: number,
  rangeMessage: string,
) {
  const value = parseWholeNumber(text)
  if (text.trim() === '') errors[path] = '값을 입력해 주세요.'
  else if (value === null || value < min || value > max) errors[path] = rangeMessage
  return value ?? 0
}

function itemName(errors: Record<string, string>, path: string, text: string) {
  const value = text.trim()
  if (!value) errors[path] = '이름을 입력해 주세요.'
  else if (value.length > strategyLimits.maxNameLength)
    errors[path] = `${strategyLimits.maxNameLength}자 이내로 입력해 주세요.`
  return value
}

/** Validates the draft against the API ranges and builds the request body. */
export function buildStrategyRequest(draft: StrategyDraft): {
  request: StrategyRequest | null
  errors: Record<string, string>
} {
  const errors: Record<string, string> = {}
  const cashflow = '0원부터 10억 원까지 원 단위 정수로 입력해 주세요.'
  const request: StrategyRequest = {
    monthlyIncome: wholeNumber(
      errors,
      'monthlyIncome',
      draft.monthlyIncome,
      0,
      strategyLimits.maxCashflow,
      cashflow,
    ),
    monthlyExpense: wholeNumber(
      errors,
      'monthlyExpense',
      draft.monthlyExpense,
      0,
      strategyLimits.maxCashflow,
      cashflow,
    ),
    liquidAssets: wholeNumber(
      errors,
      'liquidAssets',
      draft.liquidAssets,
      0,
      strategyLimits.maxAssets,
      '0원부터 100억 원까지 원 단위 정수로 입력해 주세요.',
    ),
    emergencyMonths: wholeNumber(
      errors,
      'emergencyMonths',
      draft.emergencyMonths,
      3,
      12,
      '3개월부터 12개월까지 정수로 입력해 주세요.',
    ),
    taxFree: draft.taxFree,
    goals: draft.goals.slice(0, strategyLimits.maxGoals).map((goal, index) => ({
      name: itemName(errors, `goals[${index}].name`, goal.name),
      targetAmount: wholeNumber(
        errors,
        `goals[${index}].targetAmount`,
        goal.targetAmount,
        strategyLimits.minGoalAmount,
        strategyLimits.maxGoalAmount,
        '10만 원부터 100억 원까지 원 단위 정수로 입력해 주세요.',
      ),
      months: wholeNumber(
        errors,
        `goals[${index}].months`,
        goal.months,
        1,
        strategyLimits.maxGoalMonths,
        '1개월부터 36개월까지 정수로 입력해 주세요.',
      ),
    })),
    loans: draft.loans.slice(0, strategyLimits.maxLoans).map((loan, index) => {
      const loanName = itemName(errors, `loans[${index}].name`, loan.name)
      const balance = wholeNumber(
        errors,
        `loans[${index}].balance`,
        loan.balance,
        1,
        strategyLimits.maxLoanBalance,
        '1원부터 100억 원까지 원 단위 정수로 입력해 주세요.',
      )
      const ratePath = `loans[${index}].annualRate`
      const annualRate = normalizeRate(loan.annualRate)
      if (loan.annualRate.trim() === '') errors[ratePath] = '값을 입력해 주세요.'
      else if (annualRate === null || Number(annualRate) > strategyLimits.maxLoanRate)
        errors[ratePath] = '연 0%부터 30%까지, 소수 셋째 자리까지 입력해 주세요.'
      return { name: loanName, balance, annualRate: annualRate ?? '' }
    }),
  }
  return { request: Object.keys(errors).length ? null : request, errors }
}

export type SegmentKind = 'allocated' | 'unallocated' | 'shortfall'
export interface AllocationSegment {
  key: string
  label: string
  amount: number
  kind: SegmentKind
}

const monthlyTypes: Record<string, true> = {
  EMERGENCY_TOPUP: true,
  INSTALLMENT_SAVINGS: true,
  PARKING_GOAL: true,
}

/**
 * Splits the monthly plan into what the server allocated, what stays unallocated and what
 * the goals still lack. Amounts are the server's; only their order and labels are added.
 */
export function monthlyAllocation(plan: StrategyPlan): AllocationSegment[] {
  const label = (action: StrategyAction) =>
    action.goalName
      ? `${action.goalName} · ${actionTypeLabel(action.type)}`
      : actionTypeLabel(action.type)
  const allocated: AllocationSegment[] = plan.actions
    .filter((action) => monthlyTypes[action.type])
    .map((action) => ({
      key: `allocated-${action.order}`,
      label: label(action),
      amount: action.allocatedMonthly ?? action.monthlyAmount ?? 0,
      kind: 'allocated' as const,
    }))
  const unallocated: AllocationSegment = {
    key: 'unallocated',
    label: '미배분(파킹통장)',
    amount: plan.summary.unallocatedMonthly,
    kind: 'unallocated',
  }
  const shortfall: AllocationSegment[] = plan.actions
    .filter((action) => (action.shortfallMonthly ?? 0) > 0)
    .map((action) => ({
      key: `shortfall-${action.order}`,
      label: `${label(action)} 부족`,
      amount: action.shortfallMonthly ?? 0,
      kind: 'shortfall' as const,
    }))
  return [...allocated, unallocated, ...shortfall].filter((segment) => segment.amount > 0)
}
