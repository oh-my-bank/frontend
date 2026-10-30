import { request } from './api'

/** Contract: docs/api/banking-learning.md 1장(학습)·2장(계산기). */
export type CategoryCode =
  'BANKING_BASICS' | 'DEPOSITS' | 'LOANS' | 'RATES_REGULATION' | 'PROTECTION' | 'PLANNING'
export type Level = 'BASIC' | 'INTERMEDIATE'
export type RelatedTool =
  'deposit' | 'savings' | 'loan' | 'dsr' | 'goal' | 'strategy' | 'simulation' | 'products'

export interface Category {
  code: CategoryCode
  label: string
  description: string
}
export interface ConceptSummary {
  slug: string
  order: number
  category: CategoryCode
  categoryLabel: string
  level: Level
  title: string
  summary: string
  readMinutes: number
  questionCount: number
}
export interface Source {
  title: string
  publisher: string
  url: string
  checkedOn: string
}
export interface ConceptLink {
  slug: string
  title: string
}
export interface QuizQuestion {
  id: string
  question: string
  options: string[]
}
export interface ConceptDetail extends ConceptSummary {
  contentVersion: number
  sections: { heading: string; body: string }[]
  example: { title: string; body: string; rows: { label: string; value: string }[] } | null
  misconceptions: { myth: string; fact: string }[]
  checklist: string[]
  relatedTerms: { slug: string; term: string }[]
  relatedTools: RelatedTool[]
  sources: Source[]
  quiz: QuizQuestion[]
  previous: ConceptLink | null
  next: ConceptLink | null
}
export interface QuizAnswer {
  questionId: string
  optionIndex: number
}
export interface QuizResult {
  slug: string
  total: number
  correct: number
  results: {
    questionId: string
    selectedIndex: number | null
    correct: boolean
    answerIndex: number
    explanation: string
  }[]
}
export interface Term {
  slug: string
  term: string
  english: string | null
  category: CategoryCode
  definition: string
  example: string | null
  relatedConcept: string | null
}

export type CalculatorKind = 'deposit' | 'savings' | 'loan' | 'dsr' | 'goal'
export type InterestType = 'SIMPLE' | 'MONTHLY_COMPOUND'
export type TaxType = 'GENERAL' | 'TAX_FREE'
export type RepaymentMethod = 'EQUAL_PAYMENT' | 'EQUAL_PRINCIPAL' | 'BULLET'
export type ProductKind = 'PARKING' | 'TIME_DEPOSIT' | 'INSTALLMENT_SAVINGS'

export interface RuleProduct {
  code: string
  kind: ProductKind
  name: string
  termMonths: number | null
  annualRate: string
  minAmount: number
  maxAmount: number
  assumption: boolean
}
export interface EarlyTerminationRule {
  minMonths: number
  fixedRate: string | null
  ratioOfContractRate: string | null
}
export interface Rules {
  ruleVersion: string
  incomeTaxPercent: string
  localTaxPercentOfIncomeTax: string
  totalTaxPercent: string
  depositProtectionLimit: number
  dsrThresholdPercent: number
  products: RuleProduct[]
  earlyTermination: EarlyTerminationRule[]
  sources: Source[]
}
export interface DepositInput {
  principal: number
  termMonths: number
  annualRate: string
  interestType: InterestType
  taxType: TaxType
}
export interface DepositResult extends DepositInput {
  ruleVersion: string
  interest: number
  incomeTax: number
  localTax: number
  totalTax: number
  interestAfterTax: number
  maturityAmount: number
  effectiveAnnualRateAfterTax: string
}
export interface SavingsInput {
  monthlyDeposit: number
  termMonths: number
  annualRate: string
  interestType: InterestType
  taxType: TaxType
}
export interface SavingsResult extends SavingsInput {
  ruleVersion: string
  totalDeposit: number
  interest: number
  incomeTax: number
  localTax: number
  totalTax: number
  interestAfterTax: number
  maturityAmount: number
  depositEquivalentRate: string
  averageHoldingMonths: string
}
export interface LoanInput {
  principal: number
  termMonths: number
  annualRate: string
  method: RepaymentMethod
}
export interface Installment {
  installment: number
  payment: number
  principal: number
  interest: number
  balance: number
}
export interface LoanResult extends LoanInput {
  ruleVersion: string
  firstPayment: number
  maxPayment: number
  totalPayment: number
  totalInterest: number
  schedule: Installment[]
}
export interface DsrLoanInput extends LoanInput {
  name: string | null
}
export interface DsrCandidateInput {
  principal: number | null
  termMonths: number
  annualRate: string
  method: RepaymentMethod
}
export interface DsrInput {
  annualIncome: number
  loans: DsrLoanInput[]
  candidate: DsrCandidateInput | null
}
export interface DsrResult {
  ruleVersion: string
  annualIncome: number
  thresholdPercent: number
  limitAnnualRepayment: number
  loans: { name: string | null; firstPayment: number; annualRepayment: number }[]
  existingAnnualRepayment: number
  candidate: {
    principal: number | null
    firstPayment: number | null
    annualRepayment: number | null
    maxPrincipal: number
  } | null
  totalAnnualRepayment: number
  dsrPercent: string
  result: 'MET' | 'NOT_MET'
  notice: string
}
export interface GoalInput {
  targetAmount: number
  termMonths: number
  annualRate: string
  taxType: TaxType
}
export interface GoalResult extends GoalInput {
  ruleVersion: string
  monthlyDeposit: number
  totalDeposit: number
  interestAfterTax: number
  maturityAmount: number
  surplus: number
}
interface Calculation {
  deposit: [DepositInput, DepositResult]
  savings: [SavingsInput, SavingsResult]
  loan: [LoanInput, LoanResult]
  dsr: [DsrInput, DsrResult]
  goal: [GoalInput, GoalResult]
}
export type CalculationInput<K extends CalculatorKind> = Calculation[K][0]
export type CalculationResult<K extends CalculatorKind> = Calculation[K][1]

export const fetchConcepts = (signal?: AbortSignal) =>
  request<{ categories: Category[]; items: ConceptSummary[] }>('/learning/concepts', { signal })
export const fetchConcept = (slug: string, signal?: AbortSignal) =>
  request<ConceptDetail>(`/learning/concepts/${encodeURIComponent(slug)}`, { signal })
export const gradeQuiz = (slug: string, answers: QuizAnswer[]) =>
  request<QuizResult>(`/learning/concepts/${encodeURIComponent(slug)}/quiz`, {
    method: 'POST',
    body: { answers },
  })
export const fetchGlossary = (q: string, category: string, signal?: AbortSignal) =>
  request<{ categories: CategoryCode[]; items: Term[] }>(
    `/learning/glossary${glossarySearch(q.trim(), category)}`,
    { signal },
  )
export const fetchRules = (signal?: AbortSignal) => request<Rules>('/calculators/rules', { signal })
export const calculate = <K extends CalculatorKind>(
  kind: K,
  body: CalculationInput<K>,
  signal?: AbortSignal,
) => request<CalculationResult<K>>(`/calculators/${kind}`, { method: 'POST', body, signal })

/** Labels for the six category codes; the glossary response carries codes only. */
export const categoryLabels: Record<CategoryCode, string> = {
  BANKING_BASICS: '은행업 이해',
  DEPOSITS: '예금·적금',
  LOANS: '대출',
  RATES_REGULATION: '금리·규제',
  PROTECTION: '소비자 보호',
  PLANNING: '자산 관리 전략',
}
export const categoryLabel = (code: string) => categoryLabels[code as CategoryCode] ?? code
export const levelLabel = (level: Level) => (level === 'BASIC' ? '기초' : '심화')

export const calculatorKinds: CalculatorKind[] = ['deposit', 'savings', 'loan', 'dsr', 'goal']
export const isCalculatorKind = (value: string | undefined): value is CalculatorKind =>
  calculatorKinds.includes(value as CalculatorKind)
/** Hub, menu and page titles for each calculator, with the concepts that explain it. */
export const calculatorInfo: Record<
  CalculatorKind,
  { title: string; summary: string; concepts: { slug: string; label: string }[] }
> = {
  deposit: {
    title: '정기예금 계산기',
    summary: '목돈을 맡겼을 때 세전·세후 이자와 만기 수령액을 계산합니다.',
    concepts: [
      { slug: 'time-deposits', label: '정기예금' },
      { slug: 'interest-tax', label: '이자에 붙는 세금' },
    ],
  },
  savings: {
    title: '적금 계산기',
    summary: '매달 같은 금액을 넣을 때의 이자와 예금으로 환산한 금리를 계산합니다.',
    concepts: [
      { slug: 'installment-savings', label: '적금' },
      { slug: 'interest-tax', label: '이자에 붙는 세금' },
    ],
  },
  loan: {
    title: '대출 상환 계산기',
    summary: '원리금균등·원금균등·만기일시 방식의 회차별 납입액과 잔액을 계산합니다.',
    concepts: [
      { slug: 'repayment-methods', label: '대출을 갚는 세 가지 방법' },
      { slug: 'loan-types', label: '대출의 종류' },
    ],
  },
  dsr: {
    title: 'DSR 계산기',
    summary: '연소득 대비 연간 원리금 비율과 40% 안에서 빌릴 수 있는 신규 대출 원금을 계산합니다.',
    concepts: [
      { slug: 'dsr-ltv-dti', label: 'DSR·LTV·DTI' },
      { slug: 'repayment-methods', label: '대출을 갚는 세 가지 방법' },
    ],
  },
  goal: {
    title: '목표 저축 계산기',
    summary: '목표 금액을 기간 안에 모으는 데 필요한 월 적금 납입액을 계산합니다.',
    concepts: [
      { slug: 'saving-strategy', label: '나에게 맞는 은행 활용 전략' },
      { slug: 'installment-savings', label: '적금' },
    ],
  },
}

/** Where each related tool of a concept lives, with the label shown on its link. */
export const relatedToolLinks: Record<RelatedTool, { to: string; label: string }> = {
  deposit: { to: '/tools/deposit', label: '정기예금 계산기' },
  savings: { to: '/tools/savings', label: '적금 계산기' },
  loan: { to: '/tools/loan', label: '대출 상환 계산기' },
  dsr: { to: '/tools/dsr', label: 'DSR 계산기' },
  goal: { to: '/tools/goal', label: '목표 저축 계산기' },
  strategy: { to: '/strategy', label: '나의 전략 세우기' },
  simulation: { to: '/simulation', label: '모의 운용' },
  products: { to: '/products', label: '대출 업무 체험' },
}

export const interestTypeLabels: Record<InterestType, string> = {
  SIMPLE: '단리',
  MONTHLY_COMPOUND: '월복리',
}
export const taxTypeLabels: Record<TaxType, string> = {
  GENERAL: '일반과세(15.4%)',
  TAX_FREE: '비과세',
}
export const methodLabels: Record<RepaymentMethod, string> = {
  EQUAL_PAYMENT: '원리금균등',
  EQUAL_PRINCIPAL: '원금균등',
  BULLET: '만기일시',
}
export const productKindLabels: Record<ProductKind, string> = {
  PARKING: '수시입출금(파킹통장)',
  TIME_DEPOSIT: '정기예금',
  INSTALLMENT_SAVINGS: '정액 적립식 적금',
}

/**
 * Query string for the glossary page URL and API; a blank search and the "all" category are
 * left out. The typed text is kept as is so a space can be typed mid-word.
 */
export function glossarySearch(q: string, category: string) {
  const params = new URLSearchParams()
  if (q.trim()) params.set('q', q)
  if (category) params.set('category', category)
  const text = params.toString()
  return text ? `?${text}` : ''
}

/** Splits a content body into paragraphs at blank lines. */
export const paragraphs = (body: string) =>
  body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)

/**
 * Turns a typed annual rate into the decimal string the API expects (at most three
 * decimal places). Returns null when the text is not a non-negative decimal.
 */
export function normalizeRate(input: string): string | null {
  const text = input.trim().replace(/%$/, '').trim()
  const match = /^(\d*)(?:\.(\d*))?$/.exec(text)
  if (!match || (!match[1] && !match[2])) return null
  const fraction = match[2] ?? ''
  if (fraction.length > 3) return null
  const whole = (match[1] || '0').replace(/^0+(?=\d)/, '')
  return fraction ? `${whole}.${fraction}` : whole
}

/** Reads a whole-won or whole-month number typed with optional commas; null when invalid. */
export function parseWholeNumber(input: string): number | null {
  const text = input.replace(/[,\s]/g, '')
  if (!/^\d+$/.test(text)) return null
  const value = Number(text)
  return Number.isSafeInteger(value) ? value : null
}

/**
 * Indexes of the schedule rows to show. A long schedule shows the first twelve
 * installments and the last one until the full view is requested.
 */
export function visibleScheduleIndexes(length: number, expanded: boolean): number[] {
  const all = Array.from({ length }, (_, index) => index)
  if (expanded || length <= 13) return all
  return [...all.slice(0, 12), length - 1]
}
