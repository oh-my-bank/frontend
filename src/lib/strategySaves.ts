import { request } from './api'
import type { StrategyDraft, StrategyPlan, StrategyRequest } from './strategy'

/** A saved plan is the server's snapshot: the normalized input and the plan computed with its rule version. */
export interface SavedStrategy {
  id: string
  name: string
  ruleVersion: string
  ratesVersion: string
  createdAt: string
  input: StrategyRequest
  plan: StrategyPlan
}
export interface SavedStrategySummary {
  id: string
  name: string
  ruleVersion: string
  ratesVersion: string
  createdAt: string
  monthlySurplus: number
  allocatedMonthly: number
  unallocatedMonthly: number
  actionCount: number
  warningCount: number
}
export interface SavedStrategyList {
  items: SavedStrategySummary[]
  limit: number
}
export interface ComparisonMetric {
  key: string
  label: string
  left: number
  right: number
  delta: number
}
export interface StrategyComparison {
  left: SavedStrategy
  right: SavedStrategy
  sameRuleVersion: boolean
  metrics: ComparisonMetric[]
  notice: string
}

export const saveNameMaxLength = 40
const savesPath = '/strategy/saves'

export const listSavedStrategies = (signal?: AbortSignal) =>
  request<SavedStrategyList>(savesPath, { signal })
export const getSavedStrategy = (id: string, signal?: AbortSignal) =>
  request<SavedStrategy>(`${savesPath}/${encodeURIComponent(id)}`, { signal })
export const saveStrategy = (name: string, input: StrategyRequest, idempotencyKey: string) =>
  request<SavedStrategy>(savesPath, { method: 'POST', body: { name, input }, idempotencyKey })
export const deleteSavedStrategy = (id: string) =>
  request<void>(`${savesPath}/${encodeURIComponent(id)}`, { method: 'DELETE' })
export const compareSavedStrategies = (left: string, right: string, signal?: AbortSignal) =>
  request<StrategyComparison>(
    `${savesPath}/compare?${new URLSearchParams({ left, right }).toString()}`,
    { signal },
  )
export const comparePath = (left: string, right: string) =>
  `/strategy/saves/compare?${new URLSearchParams({ left, right }).toString()}`

/** The same rule as the server: 1 to 40 characters after trimming. */
export function saveNameError(name: string): string | null {
  const value = name.trim()
  if (!value) return '전략 이름을 입력해 주세요.'
  if (value.length > saveNameMaxLength)
    return `전략 이름은 ${saveNameMaxLength}자 이하로 입력해 주세요.`
  return null
}

/** Turns a saved input back into form text, so the planner can recalculate it with current rules. */
export function draftFromRequest(input: StrategyRequest): StrategyDraft {
  return {
    monthlyIncome: String(input.monthlyIncome),
    monthlyExpense: String(input.monthlyExpense),
    liquidAssets: String(input.liquidAssets),
    emergencyMonths: String(input.emergencyMonths ?? 6),
    taxFree: !!input.taxFree,
    goals: (input.goals ?? []).map((goal, index) => ({
      key: `prefill-goal-${index}`,
      name: goal.name,
      targetAmount: String(goal.targetAmount),
      months: String(goal.months),
    })),
    loans: (input.loans ?? []).map((loan, index) => ({
      key: `prefill-loan-${index}`,
      name: loan.name,
      balance: String(loan.balance),
      annualRate: loan.annualRate,
    })),
  }
}

/** Signed amount of a comparison delta; the right plan minus the left one. */
export function deltaText(delta: number, unit: 'won' | 'count'): string {
  const amount = new Intl.NumberFormat('ko-KR').format(Math.abs(delta))
  const suffix = unit === 'won' ? '원' : '개'
  if (delta === 0) return `차이 없음`
  return `${delta > 0 ? '+' : '−'}${amount}${suffix}`
}
export const metricUnit = (key: string): 'won' | 'count' =>
  key === 'warningCount' ? 'count' : 'won'

const pendingKey = 'omb:strategy-pending-input'
/** Keeps the computed input across the login detour; storage can be unavailable, so failures are ignored. */
export function stashPendingInput(input: StrategyRequest) {
  try {
    window.sessionStorage.setItem(pendingKey, JSON.stringify(input))
  } catch {
    // Without storage the customer simply enters the values again after logging in.
  }
}
/** Reads without removing, so a render that runs twice still sees the value; clear it once applied. */
export function peekPendingInput(): StrategyRequest | null {
  try {
    const value = window.sessionStorage.getItem(pendingKey)
    return value ? (JSON.parse(value) as StrategyRequest) : null
  } catch {
    return null
  }
}
export function clearPendingInput() {
  try {
    window.sessionStorage.removeItem(pendingKey)
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}
