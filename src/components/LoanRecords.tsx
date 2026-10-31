import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react'
import { request } from '../lib/api'
import { rate, repaymentLabel, won } from '../lib/format'
import {
  ledgerAccountLabel,
  ledgerKindLabel,
  loanDate,
  loanStatusLabel,
  sideLabel,
  type Ledger,
  type LoanDetail,
} from '../lib/loans'
import AppIcon from './AppIcon'
import ErrorNotice from './ErrorNotice'
import '../styles/banking-records.css'
import '../styles/simulation.css'
import '../styles/loans.css'

type Tab = 'schedule' | 'ledger'

/**
 * The loan account summary shared by the customer and staff loan screens. `extra` adds rows such as the application link,
 * which points to a different screen for each role.
 */
export function LoanStatement({
  loan,
  loading = false,
  extra,
}: {
  loan: LoanDetail
  loading?: boolean
  extra?: ReactNode
}) {
  return (
    <section className="bank-statement" aria-labelledby="loan-title" aria-busy={loading}>
      <div className="bank-statement-heading">
        <div>
          <span>모의 대출 계정</span>
          <h2 id="loan-title">{loan.productName}</h2>
        </div>
        <span className={`status-badge ${loan.status === 'PAID_OFF' ? 'paid_off' : 'repaying'}`}>
          {loanStatusLabel(loan.status)}
        </span>
      </div>
      <dl className="bank-statement-summary">
        <div>
          <dt>남은 원금</dt>
          <dd className="bank-statement-principal">{won(loan.outstandingPrincipal)}</dd>
        </div>
        <div>
          <dt>대출 원금</dt>
          <dd>{won(loan.principal)}</dd>
        </div>
        <div>
          <dt>납부 회차</dt>
          <dd>
            {loan.paidInstallments}
            <small>/{loan.termMonths}회</small>
          </dd>
        </div>
      </dl>
      <div className="bank-statement-body">
        <dl className="details-list">
          <div>
            <dt>금리</dt>
            <dd>연 {rate(loan.annualInterestRate)}% (고정, 교육용 가정값)</dd>
          </div>
          <div>
            <dt>상환방식</dt>
            <dd>{repaymentLabel(loan.repaymentMethod)}</dd>
          </div>
          <div>
            <dt>실행일 (가상)</dt>
            <dd>{loanDate(loan.executedOn)}</dd>
          </div>
          <div>
            <dt>만기일 (가상)</dt>
            <dd>{loanDate(loan.maturityOn)}</dd>
          </div>
          <div>
            <dt>총 납입 예정</dt>
            <dd>
              {won(loan.totals.totalPayment)} (이자 {won(loan.totals.totalInterest)})
            </dd>
          </div>
          <div>
            <dt>지금까지 납부</dt>
            <dd>
              {won(loan.totals.paidTotal)} (원금 {won(loan.totals.paidPrincipal)} · 이자{' '}
              {won(loan.totals.paidInterest)})
            </dd>
          </div>
          {extra}
        </dl>
      </div>
    </section>
  )
}

/**
 * Schedule and ledger tabs. The ledger is read from `ledgerPath` when its tab opens and again after the loan records a
 * repayment, so a customer's payment and a staff view both show the current journal.
 */
export function LoanRecordTabs({ loan, ledgerPath }: { loan: LoanDetail; ledgerPath: string }) {
  const [tab, setTab] = useState<Tab>('schedule')
  const [ledger, setLedger] = useState<Ledger | null>(null)
  const [ledgerError, setLedgerError] = useState<unknown>(null)
  const [ledgerReload, setLedgerReload] = useState(0)
  const paid = loan.paidInstallments
  useEffect(() => {
    setLedger(null)
  }, [ledgerPath, paid])
  useEffect(() => {
    if (tab !== 'ledger' || ledger) return
    const controller = new AbortController()
    setLedgerError(null)
    void request<Ledger>(ledgerPath, { signal: controller.signal })
      .then(setLedger)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setLedgerError(cause)
      })
    return () => controller.abort()
  }, [ledgerPath, tab, ledger, ledgerReload])
  function tabKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const target: Tab = tab === 'schedule' ? 'ledger' : 'schedule'
    setTab(target)
    document.getElementById(`loan-tab-${target}`)?.focus()
  }
  return (
    <>
      <div className="loan-tabs" role="tablist" aria-label="대출 상세 정보">
        {(
          [
            ['schedule', '상환 일정'],
            ['ledger', '거래원장·대사'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            id={`loan-tab-${value}`}
            role="tab"
            aria-selected={tab === value}
            aria-controls="loan-tab-panel"
            tabIndex={tab === value ? 0 : -1}
            onKeyDown={tabKey}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <section
        id="loan-tab-panel"
        className="loan-tab-panel"
        role="tabpanel"
        aria-labelledby={`loan-tab-${tab}`}
      >
        {tab === 'schedule' ? (
          <div className="sim-table-wrap">
            <table className="sim-table">
              <caption className="bank-sr-only">회차별 상환 일정</caption>
              <thead>
                <tr>
                  <th scope="col">회차</th>
                  <th scope="col">납부일 (가상)</th>
                  <th scope="col" className="sim-number">
                    납입액
                  </th>
                  <th scope="col" className="sim-number">
                    원금
                  </th>
                  <th scope="col" className="sim-number">
                    이자
                  </th>
                  <th scope="col" className="sim-number">
                    납부 후 잔액
                  </th>
                  <th scope="col">상태</th>
                </tr>
              </thead>
              <tbody>
                {loan.schedule.map((item) => (
                  <tr key={item.installment}>
                    <th scope="row">{item.installment}</th>
                    <td>{loanDate(item.dueDate)}</td>
                    <td className="sim-number">{won(item.payment)}</td>
                    <td className="sim-number">{won(item.principal)}</td>
                    <td className="sim-number">{won(item.interest)}</td>
                    <td className="sim-number">{won(item.balanceAfter)}</td>
                    <td>{item.paid ? `납부 (${loanDate(item.paidOn)})` : '예정'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : ledgerError ? (
          <>
            <ErrorNotice error={ledgerError} />
            <button
              className="button button-outline"
              onClick={() => setLedgerReload((value) => value + 1)}
            >
              다시 불러오기
            </button>
          </>
        ) : !ledger ? (
          <div className="empty-state" role="status">
            거래원장을 불러오고 있습니다.
          </div>
        ) : (
          <LedgerView ledger={ledger} />
        )}
      </section>
    </>
  )
}

function LedgerView({ ledger }: { ledger: Ledger }) {
  const check = ledger.reconciliation
  return (
    <>
      <div className={`loan-reconciliation ${check.balanced ? 'is-balanced' : 'is-unbalanced'}`}>
        <AppIcon name={check.balanced ? 'check' : 'info'} size={18} />
        <div>
          <strong>{check.balanced ? '대사 일치' : '대사 불일치'}</strong>
          <p>
            대출채권 잔액 {won(check.loanReceivableBalance)} · 대출 계정 남은 원금{' '}
            {won(check.outstandingPrincipal)} · 차변 합계 {won(check.debitTotal)} · 대변 합계{' '}
            {won(check.creditTotal)}
          </p>
        </div>
      </div>
      <h3 className="sim-subheading">계정별 잔액</h3>
      <div className="sim-table-wrap">
        <table className="sim-table">
          <caption className="bank-sr-only">원장 계정별 잔액</caption>
          <thead>
            <tr>
              <th scope="col">계정</th>
              <th scope="col">정상 잔액</th>
              <th scope="col" className="sim-number">
                차변 합계
              </th>
              <th scope="col" className="sim-number">
                대변 합계
              </th>
              <th scope="col" className="sim-number">
                잔액
              </th>
            </tr>
          </thead>
          <tbody>
            {ledger.accounts.map((account) => (
              <tr key={account.code}>
                <th scope="row">{account.name || ledgerAccountLabel(account.code)}</th>
                <td>{sideLabel(account.normalSide)}</td>
                <td className="sim-number">{won(account.debitTotal)}</td>
                <td className="sim-number">{won(account.creditTotal)}</td>
                <td className="sim-number">{won(account.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3 className="sim-subheading">거래·분개</h3>
      <div className="sim-table-wrap">
        <table className="sim-table loan-journal">
          <caption className="bank-sr-only">원장 거래와 분개</caption>
          <thead>
            <tr>
              <th scope="col">거래일 (가상)</th>
              <th scope="col">거래</th>
              <th scope="col">계정</th>
              <th scope="col">구분</th>
              <th scope="col" className="sim-number">
                금액
              </th>
            </tr>
          </thead>
          <tbody>
            {ledger.transactions.flatMap((transaction) =>
              transaction.entries.map((entry, index) => (
                <tr
                  key={`${transaction.id}-${entry.line}`}
                  className={index === 0 ? 'loan-journal-start' : ''}
                >
                  <td>{index === 0 ? loanDate(transaction.businessDate) : ''}</td>
                  <td>
                    {index === 0
                      ? `${ledgerKindLabel(transaction.kind)}${transaction.installment ? ` ${transaction.installment}회차` : ''}`
                      : ''}
                  </td>
                  <td>{ledgerAccountLabel(entry.account)}</td>
                  <td>{sideLabel(entry.side)}</td>
                  <td className="sim-number">{won(entry.amount)}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
      <p className="bank-section-help">
        <AppIcon name="info" size={14} /> {ledger.notice} 원장은 추가 전용이며 기존 거래를
        수정·삭제하지 않습니다.
      </p>
    </>
  )
}
