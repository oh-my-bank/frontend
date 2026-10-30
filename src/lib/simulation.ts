import { ApiError } from './api'
import { won } from './format'
import { parseWholeNumber, type ProductKind, type RuleProduct } from './learning'

export interface SimAccount {
  id: string
  kind: ProductKind
  productCode: string
  name: string
  annualRate: string
  termMonths: number | null
  openedOn: string
  maturityDate: string | null
  monthlyAmount: number | null
  paidCount: number | null
  missedCount: number | null
  balance: number
  status: 'ACTIVE' | 'MATURED' | 'CLOSED_EARLY'
  closedOn: string | null
}
export interface SimTransaction {
  id: string
  seq: number
  accountId: string
  accountName: string
  date: string
  type: string
  amount: number
  balanceAfter: number
  memo: string
}
export interface SimEvent {
  seq: number
  date: string
  type: string
  message: string
}
export interface SimUpcoming {
  date: string
  type: string
  accountId: string | null
  description: string
}
export interface Sandbox {
  id: string
  status: 'ACTIVE' | 'CLOSED'
  ruleVersion: string
  startDate: string
  currentDate: string
  elapsedDays: number
  monthlyIncome: number
  payday: number
  summary: {
    totalAssets: number
    parkingBalance: number
    savingsBalance: number
    interestReceived: number
    taxPaid: number
    netInterest: number
    salaryReceived: number
    accruedParkingInterest: string
  }
  accounts: SimAccount[]
  recentTransactions: SimTransaction[]
  events: SimEvent[]
  upcoming: SimUpcoming[]
}
export interface Processed {
  fromDate: string
  toDate: string
  days: number
  salaryCount: number
  transferCount: number
  missedTransferCount: number
  maturityCount: number
  interestSettlementCount: number
}
export interface AdvanceResult {
  sandbox: Sandbox
  processed: Processed
}
export interface SimInstallment {
  number: number
  scheduledDate: string
  paidDate: string | null
  amount: number
  status: 'PAID' | 'MISSED' | 'SCHEDULED'
}
export interface AccountDetail {
  account: SimAccount
  transactions: SimTransaction[]
  installments: SimInstallment[] | null
  quote: {
    maturity: { interest: number; tax: number; payout: number } | null
    earlyClose: {
      elapsedMonths: number
      elapsedDays: number
      appliedRate: string
      interest: number
      tax: number
      payout: number
    } | null
  } | null
}

export interface CreateSandboxRequest {
  initialCash: number
  monthlyIncome: number
  payday: number
}
export interface AdvanceRequest {
  unit: 'DAY' | 'MONTH'
  count: number
}
export interface OpenAccountRequest {
  productCode: string
  amount: number
}

export type Tone = 'ok' | 'partial' | 'info' | 'warn' | 'done'
export interface Labeled {
  label: string
  tone: Tone
}

/** Shows a code the screen does not know as itself instead of hiding it. */
const pick = (labels: Record<string, string>, code: string | null | undefined) =>
  code == null ? '' : (labels[code] ?? code)

export const accountKindLabel = (kind: string) =>
  pick({ PARKING: '파킹통장', TIME_DEPOSIT: '정기예금', INSTALLMENT_SAVINGS: '적금' }, kind)

const accountStatuses: Record<string, Labeled> = {
  ACTIVE: { label: '운용 중', tone: 'ok' },
  MATURED: { label: '만기 지급', tone: 'done' },
  CLOSED_EARLY: { label: '중도해지', tone: 'warn' },
}
export const accountStatus = (status: string): Labeled =>
  accountStatuses[status] ?? { label: status, tone: 'info' }

const installmentStatuses: Record<string, Labeled> = {
  PAID: { label: '납입', tone: 'ok' },
  MISSED: { label: '미납', tone: 'warn' },
  SCHEDULED: { label: '예정', tone: 'info' },
}
export const installmentStatus = (status: string): Labeled =>
  installmentStatuses[status] ?? { label: status, tone: 'info' }

export const transactionTypeLabel = (type: string) =>
  pick(
    {
      INITIAL_FUNDING: '초기 자금',
      SALARY: '급여 입금',
      TRANSFER_OUT: '이체 출금',
      TRANSFER_IN: '이체 입금',
      INTEREST: '이자 입금',
      TAX: '세금 출금',
      MATURITY_PAYOUT: '만기 지급',
      EARLY_CLOSE_PAYOUT: '중도해지 지급',
      ACCOUNT_CLOSE: '계좌 해지',
    },
    type,
  )

export const eventTypeLabel = (type: string) =>
  pick(
    {
      OPENED: '가입',
      MATURED: '만기',
      EARLY_CLOSED: '중도해지',
      MISSED_TRANSFER: '적금 미납',
      INTEREST_SETTLED: '이자 결산',
      SANDBOX_CLOSED: '운용 종료',
    },
    type,
  )

export const upcomingTypeLabel = (type: string) =>
  pick(
    {
      SALARY: '급여 입금',
      INSTALLMENT_TRANSFER: '적금 자동이체',
      MATURITY: '만기 지급',
      INTEREST_SETTLEMENT: '파킹 이자 결산',
    },
    type,
  )

/** `TD_12` → 정기예금 12개월. Codes outside the rate table stay as they are. */
export function productLabel(code: string | null | undefined): string {
  if (!code) return ''
  if (code === 'PARKING') return '파킹통장'
  if (code === 'LOAN') return '대출'
  const match = /^(TD|IS)_(\d+)$/.exec(code)
  if (!match) return code
  return `${match[1] === 'TD' ? '정기예금' : '적금'} ${match[2]}개월`
}

/** Products a sandbox can open; the parking account comes with the sandbox itself. */
export const subscribableProducts = (products: RuleProduct[]) =>
  products.filter(
    (product) =>
      /^(TD|IS)_\d+$/.test(product.code) &&
      (product.kind === 'TIME_DEPOSIT' || product.kind === 'INSTALLMENT_SAVINGS'),
  )

export const advanceSteps = [
  { step: '1D', label: '1일', unit: 'DAY', count: 1 },
  { step: '7D', label: '7일', unit: 'DAY', count: 7 },
  { step: '1M', label: '1개월', unit: 'MONTH', count: 1 },
  { step: '3M', label: '3개월', unit: 'MONTH', count: 3 },
  { step: '12M', label: '12개월', unit: 'MONTH', count: 12 },
] as const
export type AdvanceStep = (typeof advanceSteps)[number]['step']

export function advanceBody(step: string): AdvanceRequest | null {
  const option = advanceSteps.find((item) => item.step === step)
  return option ? { unit: option.unit, count: option.count } : null
}

/** Ledger amounts carry their sign: `+₩1,000` for money in, `−₩1,000` for money out. */
export const signedWon = (amount: number) =>
  `${amount > 0 ? '+' : amount < 0 ? '−' : ''}${won(Math.abs(amount))}`

/** `2026-01-05` → `2026.01.05`. */
export const simDate = (value: string | null | undefined) => {
  if (!value) return '-'
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  return match ? `${match[1]}.${match[2]}.${match[3]}` : value
}

/** The server keeps the parking accrual to six decimal places; show it without rounding. */
export const preciseWon = (value: string) => {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return `${value}원`
  return `${amount.toLocaleString('ko-KR', { maximumFractionDigits: 6 })}원`
}

export interface SimulationDraft {
  initialCash: string
  monthlyIncome: string
  payday: string
}
export const sandboxLimits = {
  initialCash: 1000000000,
  monthlyIncome: 100000000,
  defaultPayday: 25,
} as const

function prefillAmount(value: unknown, max: number) {
  const amount =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? (parseWholeNumber(value) ?? NaN)
        : NaN
  if (!Number.isSafeInteger(amount) || amount < 0) return { text: '', adjusted: false }
  return amount > max
    ? { text: String(max), adjusted: true }
    : { text: String(amount), adjusted: false }
}

/**
 * Reads the strategy hand-off from router state, or from the query when a sign-in in between
 * dropped the state, and fits it into the sandbox input ranges.
 */
export function simulationPrefill(
  state: unknown,
  search = '',
): { draft: SimulationDraft; adjusted: ('initialCash' | 'monthlyIncome')[]; prefilled: boolean } {
  const handOff =
    state && typeof state === 'object' && 'simulationPrefill' in state
      ? state.simulationPrefill
      : null
  const query = new URLSearchParams(search)
  const read = (key: keyof SimulationDraft): unknown =>
    handOff && typeof handOff === 'object'
      ? Reflect.get(handOff, key)
      : (query.get(key) ?? undefined)
  const cash = prefillAmount(read('initialCash'), sandboxLimits.initialCash)
  const income = prefillAmount(read('monthlyIncome'), sandboxLimits.monthlyIncome)
  const paydayValue = Number(read('payday'))
  const payday =
    Number.isInteger(paydayValue) && paydayValue >= 1 && paydayValue <= 28
      ? paydayValue
      : sandboxLimits.defaultPayday
  const adjusted: ('initialCash' | 'monthlyIncome')[] = []
  if (cash.adjusted) adjusted.push('initialCash')
  if (income.adjusted) adjusted.push('monthlyIncome')
  return {
    draft: { initialCash: cash.text, monthlyIncome: income.text, payday: String(payday) },
    adjusted,
    prefilled: cash.text !== '' || income.text !== '',
  }
}

/** Where the strategy screen sends a plan: state for the normal case, query to survive a sign-in. */
export function simulationPrefillLocation(initialCash: number, monthlyIncome: number) {
  const prefill = { initialCash, monthlyIncome, payday: sandboxLimits.defaultPayday }
  const query = new URLSearchParams({
    initialCash: String(initialCash),
    monthlyIncome: String(monthlyIncome),
  })
  return { to: `/simulation?${query.toString()}`, state: { simulationPrefill: prefill } }
}

/**
 * An answer from the server is final, so the next attempt needs a new key; otherwise a 409 for a
 * short balance would be replayed after the balance recovers. A lost or failed response may have
 * been processed, so the same content is resent with the same key.
 */
export function reusesRequestKey(error: unknown) {
  if (!(error instanceof ApiError)) return true
  return error.code === 'NETWORK_ERROR' || error.status === 0 || error.status >= 500
}

const guidance: Record<string, string> = {
  SANDBOX_NOT_FOUND: '진행 중인 모의 운용이 없습니다. 새로 시작해 주세요.',
  SANDBOX_ALREADY_ACTIVE: '이미 진행 중인 모의 운용이 있습니다. 화면을 새로 불러왔습니다.',
  INSUFFICIENT_BALANCE:
    '파킹통장 잔액이 부족합니다. 금액을 줄이거나 시간을 진행해 급여를 받은 뒤 다시 가입해 주세요.',
  ACCOUNT_LIMIT_EXCEEDED: '운용 중인 정기예금·적금은 합계 20개까지 가입할 수 있습니다.',
  AMOUNT_OUT_OF_RANGE: '상품별 가입 금액 범위 안에서 입력해 주세요.',
  UNKNOWN_PRODUCT: '모의 금리표에 없는 상품입니다. 상품을 다시 선택해 주세요.',
  ADVANCE_TOO_LONG: '한 번에 400일을 넘겨 진행할 수 없습니다. 더 짧은 단위로 진행해 주세요.',
  ACCOUNT_NOT_CLOSABLE: '파킹통장은 해지할 수 없습니다.',
  ACCOUNT_NOT_ACTIVE: '이미 만기 지급되었거나 해지된 계좌입니다.',
  SIM_ACCOUNT_NOT_FOUND: '계좌를 찾을 수 없습니다.',
  IDEMPOTENCY_CONFLICT:
    '같은 요청 키로 다른 내용이 접수되었습니다. 화면을 새로 불러온 뒤 다시 시도해 주세요.',
}

/** A clearer message for simulation errors; `undefined` keeps the server message. */
export function simulationErrorMessage(error: unknown): string | undefined {
  return error instanceof ApiError ? guidance[error.code] : undefined
}
