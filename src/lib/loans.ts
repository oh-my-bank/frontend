import { ApiError } from './api'
import { isUncertain } from './reviews'

/** Customer loan lifecycle after a mock approval: agreement, execution, ledger and repayment (R02~R04). */
export interface LoanTerms {
  amount: number
  termMonths: number
  annualInterestRate: string
  repaymentMethod: string
}
export interface AcknowledgementItem {
  code: string
  label: string
}
export interface AgreementDraft {
  applicationId: string
  productName: string
  policyVersion: number
  terms: LoanTerms
  repayment: {
    firstPayment: number
    lastPayment: number
    totalInterest: number
    totalPayment: number
  }
  explanation: { version: string; items: { title: string; body: string }[] }
  requiredAcknowledgements: AcknowledgementItem[]
  notice: string
}
export interface Agreement {
  id: string
  applicationId: string
  productName: string
  policyVersion: number
  terms: LoanTerms
  explanationVersion: string
  acknowledgements: string[]
  agreedAt: string
  notice: string
}
export interface Installment {
  installment: number
  dueDate: string
  payment: number
  principal: number
  interest: number
  balanceAfter: number
  paid: boolean
  paidOn: string | null
}
export type LoanStatus = 'ACTIVE' | 'PAID_OFF'
export interface LoanSummary {
  id: string
  applicationId: string
  productName: string
  principal: number
  annualInterestRate: string
  termMonths: number
  executedOn: string
  maturityOn: string
  status: LoanStatus
  outstandingPrincipal: number
  paidInstallments: number
  nextInstallment: Installment | null
}
export interface LoanDetail extends LoanSummary {
  agreementId: string
  repaymentMethod: string
  totals: {
    totalPayment: number
    totalInterest: number
    paidPrincipal: number
    paidInterest: number
    paidTotal: number
  }
  schedule: Installment[]
  notice: string
}
export interface RepaymentResult {
  repayment: {
    id: string
    loanId: string
    installment: number
    amount: number
    principal: number
    interest: number
    paidOn: string
    transactionId: string
  }
  loan: LoanDetail
}
export interface LedgerAccount {
  code: string
  name: string
  normalSide: 'DEBIT' | 'CREDIT'
  debitTotal: number
  creditTotal: number
  balance: number
}
export interface LedgerTransaction {
  id: string
  kind: 'DISBURSEMENT' | 'REPAYMENT' | string
  installment: number | null
  businessDate: string
  createdAt: string
  entries: { line: number; account: string; side: 'DEBIT' | 'CREDIT'; amount: number }[]
}
export interface Ledger {
  loanId: string
  accounts: LedgerAccount[]
  transactions: LedgerTransaction[]
  reconciliation: {
    loanReceivableBalance: number
    outstandingPrincipal: number
    debitTotal: number
    creditTotal: number
    balanced: boolean
  }
  notice: string
}

export type LoanCommand = 'agree' | 'execute' | 'repay'

/** Which lifecycle panel the application page shows for a status; null before approval or after rejection. */
export function lifecycleStage(status: string): 'agree' | 'execute' | 'loan' | null {
  if (status === 'APPROVED') return 'agree'
  if (status === 'AGREED') return 'execute'
  if (['EXECUTED', 'REPAYING', 'PAID_OFF'].includes(status)) return 'loan'
  return null
}

/** The agreement body is sent only once every acknowledgement the server requires is checked. */
export function agreementBody(draft: AgreementDraft, checked: ReadonlySet<string>) {
  const codes = draft.requiredAcknowledgements.map((item) => item.code)
  if (!codes.length || codes.some((code) => !checked.has(code))) return null
  return { explanationVersion: draft.explanation.version, acknowledgements: codes }
}

/** Repayment is always the next installment for exactly its scheduled amount. */
export function repaymentBody(loan: Pick<LoanSummary, 'status' | 'nextInstallment'>) {
  const next = loan.nextInstallment
  if (loan.status !== 'ACTIVE' || !next) return null
  return { installment: next.installment, amount: next.payment }
}

/** Whether an uncertain repayment already took effect, judged from a fresh loan detail. */
export function repaymentApplied(installment: number, latest: LoanDetail) {
  return latest.schedule.some((item) => item.installment === installment && item.paid)
}

const commandNames: Record<LoanCommand, string> = {
  agree: '약정',
  execute: '대출 실행',
  repay: '상환',
}

export function loanCommandMessage(error: unknown, command: LoanCommand) {
  if (!error) return undefined
  if (isUncertain(error))
    return `${commandNames[command]} 결과를 확인하지 못했습니다. 이미 반영되었을 수 있으니 반영 여부를 먼저 확인하고, 필요하면 같은 요청으로 다시 시도해 주세요.`
  if (!(error instanceof ApiError)) return undefined
  return (
    {
      APPLICATION_STATE_CONFLICT:
        '현재 신청 상태에서 할 수 없는 요청이거나 이미 처리되었습니다. 최신 정보를 다시 불러왔습니다.',
      EXPLANATION_VERSION_MISMATCH:
        '상품설명서가 바뀌었습니다. 최신 설명서를 다시 불러왔으니 내용을 확인하고 다시 동의해 주세요.',
      LOAN_TERMS_UNSUPPORTED:
        '이 조건은 회차 납입액이 0원이 되어 모의 약정을 진행할 수 없습니다. 다른 조건으로 다시 신청해 주세요.',
      IDEMPOTENCY_CONFLICT:
        '같은 요청 키에 다른 내용이 전송되었습니다. 최신 정보를 다시 불러왔으니 내용을 확인해 주세요.',
      LOAN_PAID_OFF: '이미 완납된 대출입니다. 최신 대출 정보를 다시 불러왔습니다.',
      INSTALLMENT_ALREADY_PAID: '이미 납부한 회차입니다. 최신 상환 일정을 다시 불러왔습니다.',
      INSTALLMENT_OUT_OF_ORDER:
        '회차 순서대로만 납부할 수 있습니다. 최신 상환 일정을 다시 불러왔습니다.',
      REPAYMENT_AMOUNT_MISMATCH:
        '납부 금액이 회차 납입액과 다릅니다. 최신 상환 일정을 다시 불러왔습니다.',
      APPLICATION_NOT_FOUND: '신청 내역을 찾을 수 없습니다.',
      AGREEMENT_NOT_FOUND: '약정 내역을 찾을 수 없습니다.',
      LOAN_NOT_FOUND: '대출 내역을 찾을 수 없습니다.',
      VALIDATION_ERROR: '필수 확인 항목을 모두 확인해 주세요.',
    } as Record<string, string>
  )[error.code]
}

/** A 409 or a missing record means the state moved on; the page reloads the latest data. */
export const needsLoanReload = (error: unknown): error is ApiError =>
  error instanceof ApiError && (error.status === 409 || error.status === 404)

export const loanStatusLabel = (status: string) =>
  ({ ACTIVE: '상환 중', PAID_OFF: '완납' })[status] ?? status
export const ledgerKindLabel = (kind: string) =>
  ({ DISBURSEMENT: '대출 실행', REPAYMENT: '회차 상환' })[kind] ?? kind
export const sideLabel = (side: string) => ({ DEBIT: '차변', CREDIT: '대변' })[side] ?? side
export const ledgerAccountLabel = (code: string) =>
  ({
    LOAN_RECEIVABLE: '대출채권',
    VIRTUAL_CASH: '가상 결제 자금',
    INTEREST_INCOME: '이자수익',
  })[code] ?? code

/** `2026-01-31` → `2026.01.31`; lifecycle dates are virtual calendar dates without a time zone. */
export const loanDate = (value: string | null | undefined) => {
  if (!value) return '-'
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  return match ? `${match[1]}.${match[2]}.${match[3]}` : value
}
export const acknowledgementLabel = (code: string) =>
  ({
    TERMS_CONFIRMED: '확정 조건 확인',
    EXPLANATION_READ: '상품설명서 확인',
    SIMULATION_ONLY: '모의 시뮬레이션 이해',
  })[code] ?? code
