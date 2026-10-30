import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError, request } from '../lib/api'
import { rate, won } from '../lib/format'
import {
  accountKindLabel,
  accountStatus,
  installmentStatus,
  signedWon,
  simDate,
  simulationErrorMessage,
  transactionTypeLabel,
  type AccountDetail,
  type Sandbox,
} from '../lib/simulation'
import AppIcon from '../components/AppIcon'
import ConfirmDialog from '../components/ConfirmDialog'
import ErrorNotice from '../components/ErrorNotice'
import { useSimCommand } from '../components/sim/useSimCommand'
import '../styles/simulation.css'

type View =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'error'; error: unknown }
  | { kind: 'ready'; detail: AccountDetail }

export default function SimulationAccountPage() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [view, setView] = useState<View>({ kind: 'loading' })
  const [reload, setReload] = useState(0)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [closeError, setCloseError] = useState<unknown>(null)
  const { run, pending } = useSimCommand()

  useEffect(() => {
    const controller = new AbortController()
    setView({ kind: 'loading' })
    request<AccountDetail>(`/simulation/accounts/${encodeURIComponent(id)}`, {
      signal: controller.signal,
    })
      .then((detail) => {
        if (!controller.signal.aborted) setView({ kind: 'ready', detail })
      })
      .catch((cause) => {
        if (controller.signal.aborted) return
        setView(
          cause instanceof ApiError && cause.status === 404
            ? { kind: 'missing' }
            : { kind: 'error', error: cause },
        )
      })
    return () => controller.abort()
  }, [id, reload])

  async function closeAccount(name: string) {
    setCloseError(null)
    const outcome = await run('closeAccount', { accountId: id }, (key) =>
      request<Sandbox>(`/simulation/accounts/${encodeURIComponent(id)}/close`, {
        method: 'POST',
        idempotencyKey: key,
      }),
    )
    if (!outcome) return
    if (!outcome.ok) {
      setCloseError(outcome.error)
      return
    }
    setConfirmOpen(false)
    await navigate('/simulation', { state: { closedAccountName: name } })
  }

  return (
    <>
      <Link className="back-link" to="/simulation">
        <AppIcon name="chevron" size={14} /> 모의 운용으로 돌아가기
      </Link>
      {view.kind === 'loading' ? (
        <div className="empty-state" role="status">
          계좌 정보를 불러오고 있습니다.
        </div>
      ) : view.kind === 'missing' ? (
        <div className="empty-state">
          <h2>계좌를 찾을 수 없습니다</h2>
          <p>
            진행 중인 모의 운용에 없는 계좌이거나 주소가 잘못되었습니다. 다른 고객의 계좌도 조회할
            수 없습니다.
          </p>
          <Link className="button button-outline" to="/simulation">
            모의 운용으로 이동
          </Link>
        </div>
      ) : view.kind === 'error' ? (
        <div className="sim-load-error">
          <ErrorNotice error={view.error} />
          <button
            type="button"
            className="button button-outline"
            onClick={() => setReload((value) => value + 1)}
          >
            다시 불러오기
          </button>
        </div>
      ) : (
        <AccountView
          detail={view.detail}
          onClose={() => {
            setCloseError(null)
            setConfirmOpen(true)
          }}
        />
      )}
      {view.kind === 'ready' && view.detail.quote?.earlyClose && (
        <ConfirmDialog
          open={confirmOpen}
          title="오늘 중도해지할까요?"
          confirmLabel="중도해지"
          pendingLabel="해지하는 중…"
          danger
          pending={pending === 'closeAccount'}
          onConfirm={() => void closeAccount(view.detail.account.name)}
          onClose={() => setConfirmOpen(false)}
        >
          <ErrorNotice error={closeError} message={simulationErrorMessage(closeError)} />
          <p className="notice">
            해지 금액은 파킹통장으로 입금되고 계좌는 중도해지 상태가 됩니다. 되돌릴 수 없습니다.
          </p>
          <QuoteTable detail={view.detail} />
        </ConfirmDialog>
      )}
    </>
  )
}

function AccountView({ detail, onClose }: { detail: AccountDetail; onClose: () => void }) {
  const { account, installments, transactions, quote } = detail
  const status = accountStatus(account.status)
  const closable = account.status === 'ACTIVE' && account.kind !== 'PARKING' && !!quote?.earlyClose
  return (
    <>
      <section className="page-title">
        <div>
          <span className="sim-kind">{accountKindLabel(account.kind)}</span>
          <h1>{account.name}</h1>
          <p>
            <span className={`sim-badge tone-${status.tone}`}>{status.label}</span> 연{' '}
            {rate(account.annualRate)}% · 교육용 가정값
          </p>
        </div>
      </section>

      <section className="sim-account-info" aria-labelledby="sim-account-info-title">
        <h2 className="sim-section-title" id="sim-account-info-title">
          계좌 정보
        </h2>
        <dl className="sim-summary">
          <div className="emphasis">
            <dt>잔액</dt>
            <dd>{won(account.balance)}</dd>
          </div>
          <div>
            <dt>상품 코드</dt>
            <dd>{account.productCode}</dd>
          </div>
          <div>
            <dt>기간</dt>
            <dd>{account.termMonths === null ? '수시입출금' : `${account.termMonths}개월`}</dd>
          </div>
          <div>
            <dt>가입일</dt>
            <dd>{simDate(account.openedOn)}</dd>
          </div>
          <div>
            <dt>만기일</dt>
            <dd>{account.maturityDate ? simDate(account.maturityDate) : '-'}</dd>
          </div>
          {account.monthlyAmount !== null && (
            <div>
              <dt>월 납입액</dt>
              <dd>{won(account.monthlyAmount)}</dd>
            </div>
          )}
          {account.paidCount !== null && (
            <div>
              <dt>납입 / 미납</dt>
              <dd>
                {account.paidCount}회 /{' '}
                <span className={(account.missedCount ?? 0) > 0 ? 'sim-missed' : undefined}>
                  {account.missedCount ?? 0}회
                </span>
              </dd>
            </div>
          )}
          {account.closedOn && (
            <div>
              <dt>종료일</dt>
              <dd>{simDate(account.closedOn)}</dd>
            </div>
          )}
        </dl>
      </section>

      {quote && (quote.maturity || quote.earlyClose) && (
        <section aria-labelledby="sim-quote-title">
          <h2 className="sim-section-title" id="sim-quote-title">
            만기까지 유지 vs 오늘 해지
          </h2>
          <QuoteTable detail={detail} />
          {closable && (
            <div className="sim-form-actions">
              <button type="button" className="button button-danger-outline" onClick={onClose}>
                오늘 중도해지
              </button>
            </div>
          )}
        </section>
      )}

      {installments && (
        <section aria-labelledby="sim-installments-title">
          <h2 className="sim-section-title" id="sim-installments-title">
            적금 회차
          </h2>
          <div className="sim-table-wrap">
            <table className="sim-table">
              <caption className="sim-sr-only">적금 회차표</caption>
              <thead>
                <tr>
                  <th scope="col">회차</th>
                  <th scope="col">예정일</th>
                  <th scope="col">납입일</th>
                  <th scope="col" className="sim-number">
                    금액
                  </th>
                  <th scope="col">상태</th>
                </tr>
              </thead>
              <tbody>
                {installments.map((installment) => {
                  const state = installmentStatus(installment.status)
                  return (
                    <tr
                      key={installment.number}
                      className={installment.status === 'MISSED' ? 'is-warning' : undefined}
                    >
                      <th scope="row" data-label="회차">
                        {installment.number}회
                      </th>
                      <td data-label="예정일">{simDate(installment.scheduledDate)}</td>
                      <td data-label="납입일">{simDate(installment.paidDate)}</td>
                      <td data-label="금액" className="sim-number">
                        {won(installment.amount)}
                      </td>
                      <td data-label="상태">
                        <span className={`sim-badge tone-${state.tone}`}>{state.label}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section aria-labelledby="sim-account-transactions-title">
        <h2 className="sim-section-title" id="sim-account-transactions-title">
          거래 내역 <small>오래된 순</small>
        </h2>
        {transactions.length ? (
          <div className="sim-table-wrap">
            <table className="sim-table">
              <caption className="sim-sr-only">계좌 거래 내역, 오래된 순</caption>
              <thead>
                <tr>
                  <th scope="col">일자</th>
                  <th scope="col">유형</th>
                  <th scope="col" className="sim-number">
                    금액
                  </th>
                  <th scope="col" className="sim-number">
                    거래 후 잔액
                  </th>
                  <th scope="col">메모</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td data-label="일자">{simDate(transaction.date)}</td>
                    <td data-label="유형">{transactionTypeLabel(transaction.type)}</td>
                    <td
                      data-label="금액"
                      className={`sim-number ${transaction.amount < 0 ? 'sim-out' : 'sim-in'}`}
                    >
                      {signedWon(transaction.amount)}
                    </td>
                    <td data-label="거래 후 잔액" className="sim-number">
                      {won(transaction.balanceAfter)}
                    </td>
                    <td data-label="메모">{transaction.memo || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="sim-empty-note">거래 내역이 없습니다.</p>
        )}
      </section>
    </>
  )
}

/** Maturity estimate next to today's early-close quote; both come from the server. */
function QuoteTable({ detail }: { detail: AccountDetail }) {
  const { account, quote } = detail
  const maturity = quote?.maturity ?? null
  const early = quote?.earlyClose ?? null
  if (!maturity && !early) return null
  const gap = maturity && early ? maturity.payout - early.payout : null
  return (
    <div className="sim-compare">
      <div className="sim-table-wrap">
        <table className="sim-table sim-compare-table">
          <caption className="sim-sr-only">만기 예상과 오늘 해지 시 수령액 비교</caption>
          <thead>
            <tr>
              <th scope="col">항목</th>
              {maturity && <th scope="col">만기까지 유지(예상)</th>}
              {early && <th scope="col">오늘 해지하면</th>}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">기간</th>
              {maturity && (
                <td data-label="만기까지 유지(예상)">
                  {account.termMonths}개월 · 만기 {simDate(account.maturityDate)}
                </td>
              )}
              {early && (
                <td data-label="오늘 해지하면">
                  {early.elapsedMonths}개월 경과 · {early.elapsedDays}일
                </td>
              )}
            </tr>
            <tr>
              <th scope="row">적용 금리</th>
              {maturity && <td data-label="만기까지 유지(예상)">연 {rate(account.annualRate)}%</td>}
              {early && (
                <td data-label="오늘 해지하면">연 {rate(early.appliedRate)}% (중도해지이율)</td>
              )}
            </tr>
            <tr>
              <th scope="row">이자(세전)</th>
              {maturity && (
                <td data-label="만기까지 유지(예상)" className="sim-number">
                  {won(maturity.interest)}
                </td>
              )}
              {early && (
                <td data-label="오늘 해지하면" className="sim-number">
                  {won(early.interest)}
                </td>
              )}
            </tr>
            <tr>
              <th scope="row">세금</th>
              {maturity && (
                <td data-label="만기까지 유지(예상)" className="sim-number">
                  {won(maturity.tax)}
                </td>
              )}
              {early && (
                <td data-label="오늘 해지하면" className="sim-number">
                  {won(early.tax)}
                </td>
              )}
            </tr>
            <tr className="sim-compare-total">
              <th scope="row">수령액</th>
              {maturity && (
                <td data-label="만기까지 유지(예상)" className="sim-number">
                  {won(maturity.payout)}
                </td>
              )}
              {early && (
                <td data-label="오늘 해지하면" className="sim-number">
                  {won(early.payout)}
                </td>
              )}
            </tr>
          </tbody>
        </table>
      </div>
      {gap !== null && (
        <p className={gap > 0 ? 'sim-gap is-warning' : 'sim-gap'}>
          {gap > 0
            ? `오늘 해지하면 만기 예상보다 ${won(gap)} 적게 받습니다.`
            : gap < 0
              ? `오늘 해지하면 만기 예상보다 ${won(-gap)} 더 받습니다.`
              : '오늘 해지해도 만기 예상과 수령액이 같습니다.'}
        </p>
      )}
      {maturity && (
        <p className="sim-help">
          만기 예상은 남은 회차를 모두 납입한다고 가정한 값입니다. 중도해지이율과 금리는 교육용
          가정값입니다.
        </p>
      )}
    </div>
  )
}
