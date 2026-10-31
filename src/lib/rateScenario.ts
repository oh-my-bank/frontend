import type { TaxType } from './learning'

/** Grace periods and rate paths work only with amortizing loans; a bullet loan already pays interest only. */
export type AmortizingMethod = 'EQUAL_PAYMENT' | 'EQUAL_PRINCIPAL'
export type LoanPhase = 'GRACE' | 'REPAYMENT'

export interface RateChangeInput {
  fromInstallment: number
  annualRate: string
}
export interface VariableLoanInput {
  principal: number
  termMonths: number
  graceMonths: number
  annualRate: string
  method: AmortizingMethod
  rateChanges: RateChangeInput[]
}
export interface VariableInstallment {
  installment: number
  payment: number
  principal: number
  interest: number
  balance: number
  annualRate: string
  phase: LoanPhase
}
export interface VariableSegment {
  fromInstallment: number
  toInstallment: number
  annualRate: string
  phase: LoanPhase
  payment: number
}
export interface VariableLoanResult extends VariableLoanInput {
  ruleVersion: string
  firstPayment: number
  firstRepaymentPayment: number
  maxPayment: number
  totalPayment: number
  totalInterest: number
  graceInterest: number
  fixedRateTotalInterest: number
  interestDifference: number
  segments: VariableSegment[]
  schedule: VariableInstallment[]
  notice: string
}

export interface ScenarioChangeInput {
  fromMonth: number
  deltaPercentPoint: string
}
export interface ScenarioInput {
  name: string
  changes: ScenarioChangeInput[]
}
export interface ScenarioLoanInput {
  principal: number
  termMonths: number
  annualRate: string
  method: AmortizingMethod
}
export interface ScenarioDepositInput {
  principal: number
  termMonths: number
  annualRate: string
  taxType: TaxType
}
export interface RateScenarioInput {
  loan: ScenarioLoanInput
  deposit: ScenarioDepositInput | null
  scenarios: ScenarioInput[]
}
export interface ScenarioResult {
  name: string
  baseline: boolean
  changes: ScenarioChangeInput[]
  loan: {
    firstPayment: number
    maxPayment: number
    lastPayment: number
    totalPayment: number
    totalInterest: number
    interestDifference: number
    maxPaymentDifference: number
    rates: { fromInstallment: number; toInstallment: number; annualRate: string }[]
    payments: number[]
  }
  deposit: {
    interest: number
    incomeTax: number
    localTax: number
    totalTax: number
    interestAfterTax: number
    averageAnnualRate: string
    interestAfterTaxDifference: number
  } | null
}
export interface RateScenarioResult {
  ruleVersion: string
  loan: ScenarioLoanInput
  deposit: ScenarioDepositInput | null
  scenarios: ScenarioResult[]
  notice: string
}

export const amortizingLabels: Record<AmortizingMethod, string> = {
  EQUAL_PAYMENT: '원리금균등',
  EQUAL_PRINCIPAL: '원금균등',
}
export const phaseLabels: Record<LoanPhase, string> = {
  GRACE: '거치(이자만)',
  REPAYMENT: '원금 상환',
}

/**
 * Turns a typed rate change in percentage points into the signed decimal string the API
 * expects ("+1.5", "-0.25", "2"). Returns null unless it is a number with at most three
 * decimal places; the ±5%p range is checked by the server.
 */
export function normalizeDelta(input: string): string | null {
  const text = input.trim().replace(/%p$/i, '').trim().replace(/^[−–]/, '-')
  const match = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(text)
  if (!match || (!match[2] && !match[3])) return null
  const fraction = match[3] ?? ''
  if (fraction.length > 3) return null
  const whole = (match[2] || '0').replace(/^0+(?=\d)/, '')
  return `${match[1]}${whole}${fraction ? `.${fraction}` : ''}`
}

/** Signed won difference for comparisons, e.g. +423,000원, −56,797,902원 or 0원. */
export function signedWon(value: number) {
  const amount = `${new Intl.NumberFormat('ko-KR').format(Math.abs(value))}원`
  if (value > 0) return `+${amount}`
  if (value < 0) return `−${amount}`
  return amount
}

/** Rate path as text, e.g. "1~12회 4%, 13~360회 5%". */
export function ratePathText(
  rates: { fromInstallment: number; toInstallment: number; annualRate: string }[],
  format: (rate: string) => string,
) {
  return rates
    .map((segment) =>
      segment.fromInstallment === segment.toInstallment
        ? `${segment.fromInstallment}회 ${format(segment.annualRate)}%`
        : `${segment.fromInstallment}~${segment.toInstallment}회 ${format(segment.annualRate)}%`,
    )
    .join(', ')
}

/**
 * [installment, payment] points for a light polyline: every `step`-th payment, the last one,
 * and the installments in `keep` with the one before each (where a rate change starts), so a
 * 600-installment path stays small without hiding a jump.
 */
export function samplePayments(
  payments: number[],
  keep: number[] = [],
  maxPoints = 120,
): [number, number][] {
  const length = payments.length
  const chosen = new Set<number>()
  const step = Math.max(1, Math.ceil(length / maxPoints))
  for (let installment = 1; installment <= length; installment += step) chosen.add(installment)
  if (length > 0) chosen.add(length)
  for (const installment of keep) {
    if (installment >= 1 && installment <= length) chosen.add(installment)
    if (installment - 1 >= 1 && installment - 1 <= length) chosen.add(installment - 1)
  }
  return [...chosen]
    .sort((a, b) => a - b)
    .map((installment) => [installment, payments[installment - 1]])
}
