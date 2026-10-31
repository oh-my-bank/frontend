import { request } from './api'
import type { Source } from './learning'

/** Bank operations simulator BANK_OPS_V1 (docs/domain/banking-rules.md section 7). */
export interface BankOpsShock {
  baseRateChange: string
  loanPassThroughPercent: number
  depositPassThroughPercent: number
  extraCreditLossRate: string
}
export interface BankOpsInput {
  cash: number
  securities: number
  mortgageLoans: number
  householdLoans: number
  corporateLoans: number
  deposits: number
  capital: number
  securitiesYield: string
  mortgageRate: string
  householdRate: string
  corporateRate: string
  depositRate: string
  borrowingRate: string
  creditLossRate: string
  nonInterestIncome: number
  operatingExpense: number
  shock: BankOpsShock | null
}
export interface BankOpsRules {
  ruleVersion: string
  note: string
  riskWeights: Record<'cash' | 'securities' | 'mortgage' | 'household' | 'corporate', string>
  lcrRunoff: Record<'deposits' | 'borrowings', string>
  loanToDepositWeights: Record<'household' | 'corporate', string>
  borrowingPassThroughPercent: number
  thresholds: {
    bisMinimumPercent: string
    bisWithBufferPercent: string
    lcrMinimumPercent: string
    loanToDepositMaxPercent: string
  }
  example: BankOpsInput
  sources: Source[]
}
export interface BankOpsCheck {
  code: string
  label: string
  valuePercent: string | null
  thresholdPercent: string
  comparison: 'MIN' | 'MAX'
  basis: 'REGULATION' | 'ASSUMPTION'
  met: boolean | null
}
export interface BankOpsScenario {
  rates: Record<
    'mortgage' | 'household' | 'corporate' | 'securities' | 'deposit' | 'borrowing',
    string
  >
  creditLossRate: string
  interestIncome: number
  interestExpense: number
  netInterestIncome: number
  nonInterestIncome: number
  operatingExpense: number
  creditCost: number
  preTaxProfit: number
  averageLoanRate: string
  loanDepositSpread: string
  nimPercent: string
  roaPercent: string
  roePercent: string
  capitalAfterOneYear: number
  bisRatioAfterPercent: string
  checks: BankOpsCheck[]
}
export interface BankOpsResult {
  ruleVersion: string
  balanceSheet: {
    cash: number
    securities: number
    mortgageLoans: number
    householdLoans: number
    corporateLoans: number
    totalLoans: number
    totalAssets: number
    deposits: number
    borrowings: number
    capital: number
  }
  structure: {
    riskWeightedAssets: number
    bisRatioPercent: string
    hqla: number
    netCashOutflows: number
    lcrPercent: string | null
    loanToDepositPercent: string
    weightedLoanToDepositPercent: string
  }
  baseline: BankOpsScenario
  shock: BankOpsShock | null
  shocked: BankOpsScenario | null
  checks: BankOpsCheck[]
  notices: string[]
}

export const fetchBankOpsRules = (signal?: AbortSignal) =>
  request<BankOpsRules>('/bank-ops/rules', { signal })
export const simulateBankOps = (body: BankOpsInput, signal?: AbortSignal) =>
  request<BankOpsResult>('/bank-ops/simulate', { method: 'POST', body, signal })

const EOK = 100_000_000
const JO = 1_000_000_000_000

/**
 * Reads an amount typed in 억원 (commas allowed, up to four decimals so the smallest step is
 * 1만원) and returns whole won without floating point; null when it cannot be read.
 */
export function eokToWon(input: string): number | null {
  const match = /^(\d*)(?:\.(\d{0,4}))?$/.exec(input.replace(/[,\s]/g, ''))
  if (!match || (!match[1] && !match[2])) return null
  const whole = Number(match[1] || '0')
  const fraction = Number((match[2] ?? '').padEnd(4, '0'))
  const value = whole * EOK + fraction * 10_000
  return Number.isSafeInteger(value) ? value : null
}

/** Whole won shown as an 억원 input value, e.g. 50000000000000 → "500,000". */
export function wonToEok(won: number): string {
  const whole = Math.floor(won / EOK)
  const rest = String(Math.floor((won % EOK) / 10_000))
    .padStart(4, '0')
    .replace(/0+$/, '')
  return `${new Intl.NumberFormat('ko-KR').format(whole)}${rest ? `.${rest}` : ''}`
}

/** Signed rate change such as "+1", "-0.25" or "−1.5"; returns the API string or null. */
export function normalizeSignedRate(input: string): string | null {
  const text = input.trim().replace(/%p?$/, '').trim().replace(/^[−–]/, '-')
  const match = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(text)
  if (!match || (!match[2] && !match[3])) return null
  const fraction = match[3] ?? ''
  if (fraction.length > 3) return null
  const whole = (match[2] || '0').replace(/^0+(?=\d)/, '')
  const sign = match[1] === '-' ? '-' : ''
  return `${sign}${whole}${fraction ? `.${fraction}` : ''}`
}

/** Bank-scale amount: 1조 4,600억원, 855억원, or whole won below 1억원; negatives keep the sign. */
export function bankAmount(won: number): string {
  if (won < 0) return `−${bankAmount(-won)}`
  const group = new Intl.NumberFormat('ko-KR')
  if (won >= JO) {
    const jo = Math.floor(won / JO)
    const eok = Math.floor((won % JO) / EOK)
    return eok ? `${group.format(jo)}조 ${group.format(eok)}억원` : `${group.format(jo)}조원`
  }
  if (won >= EOK)
    return `${new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 }).format(won / EOK)}억원`
  return `${group.format(won)}원`
}

/** Short Korean reading of a check's result, null-safe for an LCR that cannot be computed. */
export function checkStatus(check: BankOpsCheck): {
  label: string
  tone: 'approved' | 'rejected' | 'pending'
} {
  if (check.met === null) return { label: '산출 불가', tone: 'pending' }
  if (check.met) return { label: '충족', tone: 'approved' }
  return { label: check.comparison === 'MIN' ? '기준 미달' : '기준 초과', tone: 'rejected' }
}

/** What each indicator means, shown next to the server value. */
export const metricInfo = {
  nim: {
    title: '순이자마진(NIM)',
    text: '순이자이익을 이자를 낳는 자산(대출+유가증권)으로 나눈 값입니다. 은행이 돈을 빌리고 빌려주는 장사로 얼마나 남기는지 보여 줍니다.',
  },
  spread: {
    title: '예대금리차',
    text: '평균 대출금리에서 예금금리를 뺀 값입니다. NIM과 달리 잔액 크기와 차입금·유가증권을 반영하지 않습니다.',
  },
  roe: {
    title: '자기자본이익률(ROE)',
    text: '세전이익을 자기자본으로 나눈 값입니다. 주주가 맡긴 돈으로 얼마를 벌었는지 보여 줍니다.',
  },
  bis: {
    title: 'BIS 총자본비율',
    text: '자기자본을 위험가중자산으로 나눈 값입니다. 손실이 나도 예금자에게 돌려줄 힘이 있는지 보는 대표 건전성 지표입니다.',
  },
  lcr: {
    title: '유동성커버리지비율(LCR)',
    text: '고유동성자산을 30일 동안 빠져나갈 것으로 보는 자금으로 나눈 값입니다. 예금이 한꺼번에 빠질 때 버틸 수 있는지 봅니다.',
  },
  ltd: {
    title: '예대율',
    text: '대출을 예금으로 나눈 값입니다. 100%를 넘으면 예금보다 대출이 많아 시장 차입에 더 의존한다는 뜻입니다.',
  },
} as const
