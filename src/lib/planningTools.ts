/** Contract: docs/api/banking-learning.md 2장 `account-plan`·`real-rate`, rules 3.8·3.9 (L02). */

export type AccountRole = 'SALARY_FIXED' | 'LIVING' | 'EMERGENCY_PARKING' | 'SAVINGS'
export type AccountPlanWarningCode = 'NEGATIVE_CASHFLOW' | 'EMERGENCY_TOPUP_PARTIAL'

export interface AccountPlanInput {
  monthlyIncome: number
  fixedExpense: number
  livingExpense: number
  emergencyMonths?: number
  currentEmergencyFund: number
}
export interface PlannedAccount {
  role: AccountRole
  name: string
  productCode: string | null
  monthlyAmount: number
  afterTargetMonthlyAmount: number
  purpose: string
}
export interface AccountPlanResult {
  ruleVersion: string
  emergencyRuleVersion: string
  monthlyIncome: number
  fixedExpense: number
  livingExpense: number
  totalExpense: number
  /** Negative when spending exceeds income. */
  monthlySurplus: number
  monthlyShortfall: number
  savingsRatePercent: string | null
  emergencyMonths: number
  emergencyTarget: number
  currentEmergencyFund: number
  emergencyGap: number
  emergencyExcess: number
  emergencyMonthlyNeed: number
  /** 0 when the target is already met, null when there is no surplus to reach it. */
  monthsToTarget: number | null
  finalMonthTopup: number | null
  accounts: PlannedAccount[]
  warnings: { code: AccountPlanWarningCode; message: string }[]
  notice: string
}

export type RealRateInterpretation = 'POSITIVE' | 'ZERO' | 'NEGATIVE'
export type RealRateTaxMethod = 'GENERAL' | 'TAX_FREE' | 'FLAT'

export interface RealRateInput {
  nominalRate: string
  inflationRate: string
  taxRatePercent?: string
  principal?: number
  termMonths?: number
}
export interface RealRateAmount {
  principal: number
  termMonths: number
  taxMethod: RealRateTaxMethod
  interest: number
  incomeTax: number
  localTax: number
  totalTax: number
  interestAfterTax: number
  maturityAmount: number
  priceLevelFactor: string
  maturityInTodayWon: number
  realGain: number
  breakEvenAmount: number
}
export interface RealRateResult {
  ruleVersion: string
  nominalRate: string
  inflationRate: string
  taxRatePercent: string
  afterTaxNominalRate: string
  realRateBeforeTax: string
  realRate: string
  approximateRealRate: string
  approximationGap: string
  interpretation: RealRateInterpretation
  interpretationMessage: string
  amount: RealRateAmount | null
  notice: string
}

export const accountRoleTones: Record<AccountRole, 'principal' | 'interest' | 'extra' | 'tax'> = {
  SALARY_FIXED: 'extra',
  LIVING: 'tax',
  EMERGENCY_PARKING: 'interest',
  SAVINGS: 'principal',
}
export const accountPlanWarningLabels: Record<AccountPlanWarningCode, string> = {
  NEGATIVE_CASHFLOW: '지출이 소득 이상',
  EMERGENCY_TOPUP_PARTIAL: '비상금 적립 기간 12개월 초과',
}
export const interpretationLabels: Record<RealRateInterpretation, string> = {
  POSITIVE: '구매력 증가',
  ZERO: '구매력 유지',
  NEGATIVE: '구매력 감소',
}
export const taxMethodLabels: Record<RealRateTaxMethod, string> = {
  GENERAL: '일반과세 15.4%(소득세 14% + 지방소득세 1.4%)',
  TAX_FREE: '비과세',
  FLAT: '입력한 단일 세율',
}

/**
 * A rate that may be negative, such as deflation, as the decimal string the API accepts:
 * at most three decimals, a leading minus kept, a plus sign and a trailing % dropped.
 */
export function normalizeSignedRate(input: string): string | null {
  const text = input.trim().replace(/%$/, '').trim().replace(/^[−–]/, '-')
  const match = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(text)
  if (!match || (!match[2] && !match[3])) return null
  const fraction = match[3] ?? ''
  if (fraction.length > 3) return null
  const whole = (match[2] || '0').replace(/^0+(?=\d)/, '')
  return `${match[1] === '-' ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`
}

/** Server percentage strings with a typographic minus, e.g. "-1.270" → "−1.270". */
export const signedPercent = (value: string) => value.replace(/^-/, '−')

/** Optional amount and term: both blank is fine, one without the other is a local error. */
export function pairedAmount(principal: number | null, months: number | null) {
  if (principal === null && months === null) return {}
  if (principal === null) return { error: 'principal' as const }
  if (months === null) return { error: 'termMonths' as const }
  return { principal, termMonths: months }
}
