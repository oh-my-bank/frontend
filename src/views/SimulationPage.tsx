import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ApiError, request } from '../lib/api'
import { rate, won } from '../lib/format'
import { fetchRules, parseWholeNumber, type RuleProduct, type Rules } from '../lib/learning'
import {
  accountKindLabel,
  accountStatus,
  advanceBody,
  advanceSteps,
  eventTypeLabel,
  preciseWon,
  sandboxLimits,
  signedWon,
  simDate,
  simulationErrorMessage,
  simulationPrefill,
  subscribableProducts,
  transactionTypeLabel,
  upcomingTypeLabel,
  type AdvanceResult,
  type AdvanceStep,
  type CreateSandboxRequest,
  type OpenAccountRequest,
  type Processed,
  type Sandbox,
  type SimulationDraft,
} from '../lib/simulation'
import AppIcon from '../components/AppIcon'
import ConfirmDialog from '../components/ConfirmDialog'
import ErrorNotice from '../components/ErrorNotice'
import SimField from '../components/sim/SimField'
import { useSimCommand, type SimCommand, type SimOutcome } from '../components/sim/useSimCommand'
import '../styles/simulation.css'

type View =
  | { kind: 'loading' }
  | { kind: 'error'; error: unknown }
  | { kind: 'missing'; closed: Sandbox | null }
  | { kind: 'active'; sandbox: Sandbox }

const isCode = (error: unknown, code: string) => error instanceof ApiError && error.code === code

/** Message from the account screen after an early close, if any. */
function closedAccountNotice(state: unknown): string | null {
  if (!state || typeof state !== 'object' || !('closedAccountName' in state)) return null
  return typeof state.closedAccountName === 'string' ? state.closedAccountName : null
}

export default function SimulationPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [view, setView] = useState<View>({ kind: 'loading' })
  const [reload, setReload] = useState(0)
  const [closedAccount] = useState(() => closedAccountNotice(location.state))

  useEffect(() => {
    // Show the early-close message once; a page reload should not repeat it. Runs on arrival only.
    if (closedAccount) void navigate(location.pathname, { replace: true, state: null })
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    setView({ kind: 'loading' })
    request<Sandbox>('/simulation', { signal: controller.signal })
      .then((sandbox) => {
        if (!controller.signal.aborted) setView({ kind: 'active', sandbox })
      })
      .catch((cause) => {
        if (controller.signal.aborted) return
        setView(
          isCode(cause, 'SANDBOX_NOT_FOUND')
            ? { kind: 'missing', closed: null }
            : { kind: 'error', error: cause },
        )
      })
    return () => controller.abort()
  }, [reload])

  /** Reloads without the loading screen, e.g. after a resent command whose reply may be old. */
  const refresh = useCallback(async () => {
    try {
      const sandbox = await request<Sandbox>('/simulation')
      setView({ kind: 'active', sandbox })
    } catch (cause) {
      if (isCode(cause, 'SANDBOX_NOT_FOUND')) setView({ kind: 'missing', closed: null })
    }
  }, [])

  return (
    <>
      <section className="page-title">
        <div>
          <h1>모의 운용</h1>
          <p>
            가상 자금과 가상 날짜로 파킹통장·정기예금·적금을 운용하며 이자·세금·만기·중도해지를 겪어
            봅니다.
          </p>
        </div>
      </section>
      <p className="notice sim-lead-notice">
        <AppIcon name="shield" size={16} /> 실제 계좌·이체가 아닌 학습용 가상 자금입니다. 금리와
        중도해지이율은 교육용 가정값(BANK_RULES_V1)이며 계산은 모두 서버가 합니다.
      </p>
      {closedAccount && view.kind === 'active' && (
        <p className="sim-flash" role="status">
          <AppIcon name="check" size={16} /> {closedAccount} 계좌를 중도해지했습니다. 수령액은
          파킹통장에 입금되었습니다.
        </p>
      )}
      {view.kind === 'loading' ? (
        <div className="empty-state" role="status">
          모의 운용 정보를 불러오고 있습니다.
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
      ) : view.kind === 'missing' ? (
        <CreateSandbox
          closed={view.closed}
          onCreated={(sandbox) => setView({ kind: 'active', sandbox })}
          onAlreadyActive={() => void refresh()}
        />
      ) : (
        <Dashboard
          sandbox={view.sandbox}
          onSandbox={(sandbox) => setView({ kind: 'active', sandbox })}
          onClosed={(sandbox) => setView({ kind: 'missing', closed: sandbox })}
          refresh={refresh}
        />
      )}
    </>
  )
}

function CreateSandbox({
  closed,
  onCreated,
  onAlreadyActive,
}: {
  closed: Sandbox | null
  onCreated: (sandbox: Sandbox) => void
  onAlreadyActive: () => void
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const [prefill] = useState(() => simulationPrefill(location.state, location.search))
  const [draft, setDraft] = useState<SimulationDraft>(prefill.draft)
  const [checked, setChecked] = useState(false)
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<unknown>(null)
  const { run, pending } = useSimCommand()
  const initialCash = parseWholeNumber(draft.initialCash)
  const monthlyIncome = parseWholeNumber(draft.monthlyIncome)
  const payday = parseWholeNumber(draft.payday)
  const errors: Record<keyof SimulationDraft, string> = {
    initialCash:
      initialCash === null || initialCash > sandboxLimits.initialCash
        ? '0원부터 10억 원까지 원 단위 정수로 입력해 주세요.'
        : '',
    monthlyIncome:
      monthlyIncome === null || monthlyIncome > sandboxLimits.monthlyIncome
        ? '0원부터 1억 원까지 원 단위 정수로 입력해 주세요.'
        : '',
    payday: payday === null || payday < 1 || payday > 28 ? '1일부터 28일까지 입력해 주세요.' : '',
  }
  const shown = (field: keyof SimulationDraft) =>
    (checked && errors[field]) || serverErrors[field] || undefined
  const change = (field: keyof SimulationDraft) => (value: string) => {
    setDraft((current) => ({ ...current, [field]: value }))
    setServerErrors((current) => ({ ...current, [field]: '' }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setChecked(true)
    if (initialCash === null || monthlyIncome === null || payday === null) return
    if (errors.initialCash || errors.monthlyIncome || errors.payday) return
    const body: CreateSandboxRequest = { initialCash, monthlyIncome, payday }
    setError(null)
    const outcome = await run('create', body, (key) =>
      request<Sandbox>('/simulation', { method: 'POST', body, idempotencyKey: key }),
    )
    if (!outcome) return
    if (!outcome.ok) {
      if (isCode(outcome.error, 'SANDBOX_ALREADY_ACTIVE')) {
        onAlreadyActive()
        return
      }
      setError(outcome.error)
      if (outcome.error instanceof ApiError) setServerErrors(outcome.error.fieldErrors)
      return
    }
    // Drop the strategy hand-off so a reload does not offer it again.
    if (location.search || location.state) void navigate('/simulation', { replace: true })
    onCreated(outcome.value)
  }

  return (
    <div className="sim-create-layout">
      {closed && (
        <section className="sim-panel sim-closed" aria-labelledby="sim-closed-title">
          <h2 id="sim-closed-title">모의 운용을 종료했습니다</h2>
          <p>
            {simDate(closed.startDate)} ~ {simDate(closed.currentDate)} ({closed.elapsedDays}일)
            동안의 기록은 지워지지 않고 보관됩니다.
          </p>
          <dl className="sim-summary compact">
            <div>
              <dt>종료 시 총자산</dt>
              <dd>{won(closed.summary.totalAssets)}</dd>
            </div>
            <div>
              <dt>받은 이자(세전)</dt>
              <dd>{won(closed.summary.interestReceived)}</dd>
            </div>
            <div>
              <dt>낸 세금</dt>
              <dd>{won(closed.summary.taxPaid)}</dd>
            </div>
            <div>
              <dt>받은 급여 누계</dt>
              <dd>{won(closed.summary.salaryReceived)}</dd>
            </div>
          </dl>
        </section>
      )}
      <form className="sim-panel" onSubmit={submit} noValidate aria-labelledby="sim-create-title">
        <div className="sim-panel-heading">
          <h2 id="sim-create-title">{closed ? '새 모의 운용 시작' : '모의 운용 시작'}</h2>
          <p>
            시작하면 가상 파킹통장이 열리고 초기 가상 자금이 입금됩니다. 시작일은 오늘 날짜이며
            이후에는 버튼으로 가상 날짜를 진행합니다.
          </p>
        </div>
        {prefill.prefilled && (
          <p className="sim-flash" role="status">
            <AppIcon name="info" size={16} /> 나의 전략에 입력한 현금성 자산과 월 소득으로
            채웠습니다. 바꿔서 시작해도 됩니다.
            {prefill.adjusted.length > 0 && ' 모의 운용 한도를 넘는 금액은 한도로 맞췄습니다.'}
          </p>
        )}
        <ErrorNotice error={error} message={simulationErrorMessage(error)} />
        <fieldset className="sim-fieldset" disabled={pending === 'create'}>
          <legend className="sim-sr-only">모의 운용 시작 조건</legend>
          <div className="sim-form-grid three">
            <SimField
              id="sim-initial-cash"
              label="초기 가상 자금"
              unit="원"
              money
              value={draft.initialCash}
              onChange={change('initialCash')}
              error={shown('initialCash')}
              help="0원부터 10억 원까지. 실제 돈이 아닙니다."
            />
            <SimField
              id="sim-monthly-income"
              label="월 가상 급여"
              unit="원"
              money
              value={draft.monthlyIncome}
              onChange={change('monthlyIncome')}
              error={shown('monthlyIncome')}
              help="급여일마다 파킹통장에 들어옵니다. 0원부터 1억 원까지."
            />
            <SimField
              id="sim-payday"
              label="급여일"
              unit="일"
              value={draft.payday}
              onChange={change('payday')}
              error={shown('payday')}
              help="매월 1일부터 28일 중 하루."
            />
          </div>
        </fieldset>
        <div className="sim-form-actions">
          <Link className="text-button" to="/strategy">
            나의 전략 먼저 세우기
          </Link>
          <button type="submit" className="button button-primary" disabled={pending === 'create'}>
            {pending === 'create' ? '시작하는 중…' : '가상 자금으로 시작'}
            <AppIcon name="arrow" size={16} />
          </button>
        </div>
      </form>
    </div>
  )
}

function Dashboard({
  sandbox,
  onSandbox,
  onClosed,
  refresh,
}: {
  sandbox: Sandbox
  onSandbox: (sandbox: Sandbox) => void
  onClosed: (sandbox: Sandbox) => void
  refresh: () => Promise<void>
}) {
  const { run, pending } = useSimCommand()
  const [processed, setProcessed] = useState<Processed | null>(null)
  const [advanceError, setAdvanceError] = useState<unknown>(null)
  const [closeOpen, setCloseOpen] = useState(false)
  const [closeChecked, setCloseChecked] = useState(false)
  const [closeError, setCloseError] = useState<unknown>(null)
  const { summary } = sandbox

  /** Applies a command's reply; a resent command's reply may predate the latest state. */
  async function command<T>(
    name: SimCommand,
    payload: unknown,
    send: (key: string) => Promise<T>,
    setError: (error: unknown) => void,
  ): Promise<T | null> {
    setError(null)
    const outcome: SimOutcome<T> | undefined = await run(name, payload, send)
    if (!outcome) return null
    if (!outcome.ok) {
      setError(outcome.error)
      if (isCode(outcome.error, 'SANDBOX_NOT_FOUND')) await refresh()
      return null
    }
    if (outcome.replayed) void refresh()
    return outcome.value
  }

  async function advance(step: AdvanceStep) {
    const body = advanceBody(step)
    if (!body) return
    const result = await command(
      'advance',
      { sandboxId: sandbox.id, ...body },
      (key) =>
        request<AdvanceResult>('/simulation/advance', {
          method: 'POST',
          body,
          idempotencyKey: key,
        }),
      setAdvanceError,
    )
    if (!result) return
    onSandbox(result.sandbox)
    setProcessed(result.processed)
  }

  async function closeSandbox() {
    const result = await command(
      'close',
      { sandboxId: sandbox.id },
      (key) => request<Sandbox>('/simulation/close', { method: 'POST', idempotencyKey: key }),
      setCloseError,
    )
    if (!result) return
    setCloseOpen(false)
    onClosed(result)
  }

  const busy = pending !== null
  return (
    <div className="sim-dashboard">
      <section className="sim-clock" aria-labelledby="sim-clock-title">
        <div className="sim-clock-date">
          <span id="sim-clock-title">가상 날짜</span>
          <strong>{simDate(sandbox.currentDate)}</strong>
        </div>
        <dl className="sim-clock-facts">
          <div>
            <dt>시작일</dt>
            <dd>{simDate(sandbox.startDate)}</dd>
          </div>
          <div>
            <dt>경과</dt>
            <dd>{sandbox.elapsedDays}일</dd>
          </div>
          <div>
            <dt>월 가상 급여</dt>
            <dd>
              {won(sandbox.monthlyIncome)} · 매월 {sandbox.payday}일
            </dd>
          </div>
          <div>
            <dt>규칙</dt>
            <dd>{sandbox.ruleVersion}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="sim-summary-title">
        <h2 className="sim-section-title" id="sim-summary-title">
          자산 요약
        </h2>
        <dl className="sim-summary">
          <div className="emphasis">
            <dt>총자산</dt>
            <dd>{won(summary.totalAssets)}</dd>
          </div>
          <div>
            <dt>파킹통장</dt>
            <dd>{won(summary.parkingBalance)}</dd>
          </div>
          <div>
            <dt>정기예금·적금</dt>
            <dd>{won(summary.savingsBalance)}</dd>
          </div>
          <div>
            <dt>받은 이자(세전)</dt>
            <dd>{won(summary.interestReceived)}</dd>
          </div>
          <div>
            <dt>낸 세금</dt>
            <dd>{won(summary.taxPaid)}</dd>
          </div>
          <div>
            <dt>순이자(세후)</dt>
            <dd>{won(summary.netInterest)}</dd>
          </div>
          <div>
            <dt>받은 급여 누계</dt>
            <dd>{won(summary.salaryReceived)}</dd>
          </div>
          <div>
            <dt>쌓인 파킹 이자(미지급)</dt>
            <dd>{preciseWon(summary.accruedParkingInterest)}</dd>
          </div>
        </dl>
        <p className="sim-help">
          파킹통장 이자는 날마다 쌓이고 월말에 원 단위로 결산되어 세금을 뺀 뒤 입금됩니다.
        </p>
      </section>

      <div className="sim-columns">
        <section className="sim-panel" aria-labelledby="sim-advance-title">
          <div className="sim-panel-heading">
            <h2 id="sim-advance-title">시간 진행</h2>
            <p id="sim-advance-help">
              진행하는 동안 급여·적금 자동이체·만기 지급·이자 결산이 날짜 순서대로 처리됩니다.
              진행한 날짜는 되돌릴 수 없습니다.
            </p>
          </div>
          <div className="sim-advance" role="group" aria-labelledby="sim-advance-title">
            {advanceSteps.map((option) => (
              <button
                key={option.step}
                type="button"
                className="button button-outline"
                // aria-disabled keeps keyboard focus on the pressed button while the day runs.
                aria-disabled={busy}
                aria-describedby="sim-advance-help"
                onClick={() => {
                  if (!busy) void advance(option.step)
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
          {pending === 'advance' && (
            <p className="sim-help" role="status">
              가상 날짜를 진행하고 있습니다.
            </p>
          )}
          <ErrorNotice error={advanceError} message={simulationErrorMessage(advanceError)} />
          {processed && (
            <ProcessedPanel processed={processed} onDismiss={() => setProcessed(null)} />
          )}
          <h3 className="sim-subheading">다가오는 일정</h3>
          {sandbox.upcoming.length ? (
            <ul className="sim-upcoming">
              {sandbox.upcoming.map((item, index) => (
                <li key={`${item.date}-${item.type}-${item.accountId ?? ''}-${index}`}>
                  <time dateTime={item.date}>{simDate(item.date)}</time>
                  <span className="sim-badge tone-info">{upcomingTypeLabel(item.type)}</span>
                  <span>
                    {item.accountId ? (
                      <Link to={`/simulation/accounts/${encodeURIComponent(item.accountId)}`}>
                        {item.description}
                      </Link>
                    ) : (
                      item.description
                    )}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="sim-empty-note">예정된 일정이 없습니다.</p>
          )}
        </section>

        <OpenAccountPanel
          sandbox={sandbox}
          busy={busy}
          pending={pending === 'open'}
          onOpen={async (body, setError) => {
            const result = await command(
              'open',
              { sandboxId: sandbox.id, ...body },
              (key) =>
                request<Sandbox>('/simulation/accounts', {
                  method: 'POST',
                  body,
                  idempotencyKey: key,
                }),
              setError,
            )
            if (result) onSandbox(result)
            return !!result
          }}
        />
      </div>

      <section aria-labelledby="sim-accounts-title">
        <h2 className="sim-section-title" id="sim-accounts-title">
          계좌 <span className="count-tag">{sandbox.accounts.length}</span>
        </h2>
        <div className="sim-table-wrap">
          <table className="sim-table">
            <caption className="sim-sr-only">
              모의 계좌 목록(가입 순, 만기·해지된 계좌 포함)
            </caption>
            <thead>
              <tr>
                <th scope="col">상품</th>
                <th scope="col">연 금리</th>
                <th scope="col">가입일</th>
                <th scope="col">만기일</th>
                <th scope="col" className="sim-number">
                  잔액
                </th>
                <th scope="col">회차</th>
                <th scope="col">상태</th>
                <th scope="col">
                  <span className="sim-sr-only">상세</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sandbox.accounts.map((account) => {
                const status = accountStatus(account.status)
                return (
                  <tr key={account.id}>
                    <th scope="row" data-label="상품" className="sim-account-name">
                      <span className="sim-kind">{accountKindLabel(account.kind)}</span>
                      {account.name}
                      {account.monthlyAmount !== null && (
                        <small>월 {won(account.monthlyAmount)}</small>
                      )}
                    </th>
                    <td data-label="연 금리">{rate(account.annualRate)}%</td>
                    <td data-label="가입일">{simDate(account.openedOn)}</td>
                    <td data-label="만기일">
                      {account.maturityDate ? simDate(account.maturityDate) : '-'}
                    </td>
                    <td data-label="잔액" className="sim-number">
                      {won(account.balance)}
                    </td>
                    <td data-label="회차">
                      {account.paidCount === null ? (
                        '-'
                      ) : (
                        <>
                          납입 {account.paidCount}회
                          {(account.missedCount ?? 0) > 0 ? (
                            <strong className="sim-missed"> · 미납 {account.missedCount}회</strong>
                          ) : (
                            ' · 미납 0회'
                          )}
                        </>
                      )}
                    </td>
                    <td data-label="상태">
                      <span className={`sim-badge tone-${status.tone}`}>{status.label}</span>
                      {account.closedOn && (
                        <small className="sim-cell-note">{simDate(account.closedOn)}</small>
                      )}
                    </td>
                    <td data-label="상세">
                      <Link
                        className="text-button"
                        to={`/simulation/accounts/${encodeURIComponent(account.id)}`}
                      >
                        상세
                        <span className="sim-sr-only">
                          {' '}
                          {account.name} {simDate(account.openedOn)} 가입
                        </span>
                        <AppIcon name="chevron" size={14} />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="sim-transactions-title">
        <h2 className="sim-section-title" id="sim-transactions-title">
          최근 거래 <small>최신 30건</small>
        </h2>
        {sandbox.recentTransactions.length ? (
          <div className="sim-table-wrap">
            <table className="sim-table">
              <caption className="sim-sr-only">최근 거래, 최신순</caption>
              <thead>
                <tr>
                  <th scope="col">일자</th>
                  <th scope="col">계좌</th>
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
                {sandbox.recentTransactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td data-label="일자">{simDate(transaction.date)}</td>
                    <td data-label="계좌">{transaction.accountName}</td>
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
          <p className="sim-empty-note">아직 거래가 없습니다.</p>
        )}
      </section>

      <section aria-labelledby="sim-events-title">
        <h2 className="sim-section-title" id="sim-events-title">
          이벤트 <small>최신 30건</small>
        </h2>
        {sandbox.events.length ? (
          <ul className="sim-events">
            {sandbox.events.map((event) => {
              const missed = event.type === 'MISSED_TRANSFER'
              return (
                <li key={event.seq} className={missed ? 'is-warning' : undefined}>
                  <time dateTime={event.date}>{simDate(event.date)}</time>
                  <span className={`sim-badge tone-${missed ? 'warn' : 'info'}`}>
                    {missed && <AppIcon name="info" size={13} />}
                    {eventTypeLabel(event.type)}
                  </span>
                  <span>{event.message}</span>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="sim-empty-note">아직 이벤트가 없습니다.</p>
        )}
      </section>

      <section className="sim-danger-zone" aria-labelledby="sim-close-title">
        <div>
          <h2 id="sim-close-title">모의 운용 종료</h2>
          <p>
            종료하면 이 샌드박스로는 더 진행하거나 가입할 수 없습니다. 기록은 지워지지 않으며 새
            모의 운용을 시작할 수 있습니다.
          </p>
        </div>
        <button
          type="button"
          className="button button-danger-outline"
          disabled={busy}
          onClick={() => {
            setCloseChecked(false)
            setCloseError(null)
            setCloseOpen(true)
          }}
        >
          모의 운용 종료
        </button>
      </section>

      <ConfirmDialog
        open={closeOpen}
        title="모의 운용을 종료할까요?"
        confirmLabel="종료"
        pendingLabel="종료하는 중…"
        danger
        pending={pending === 'close'}
        confirmDisabled={!closeChecked}
        onConfirm={() => void closeSandbox()}
        onClose={() => setCloseOpen(false)}
      >
        <ErrorNotice error={closeError} message={simulationErrorMessage(closeError)} />
        <dl className="bank-confirm-summary">
          <div>
            <dt>가상 날짜</dt>
            <dd>{simDate(sandbox.currentDate)}</dd>
          </div>
          <div>
            <dt>총자산</dt>
            <dd>{won(summary.totalAssets)}</dd>
          </div>
          <div>
            <dt>운용 중 계좌</dt>
            <dd>{sandbox.accounts.filter((account) => account.status === 'ACTIVE').length}개</dd>
          </div>
        </dl>
        <label className="sim-check sim-confirm-check">
          <input
            type="checkbox"
            checked={closeChecked}
            onChange={(event) => setCloseChecked(event.target.checked)}
          />
          <span>종료하면 되돌릴 수 없음을 확인했습니다.</span>
        </label>
      </ConfirmDialog>
    </div>
  )
}

function ProcessedPanel({ processed, onDismiss }: { processed: Processed; onDismiss: () => void }) {
  const items: [string, number, boolean][] = [
    ['급여 입금', processed.salaryCount, false],
    ['적금 자동이체', processed.transferCount, false],
    ['적금 미납', processed.missedTransferCount, processed.missedTransferCount > 0],
    ['만기 지급', processed.maturityCount, false],
    ['파킹 이자 결산', processed.interestSettlementCount, false],
  ]
  return (
    <div className="sim-processed" role="status">
      <div className="sim-processed-head">
        <strong>
          {simDate(processed.fromDate)} → {simDate(processed.toDate)} ({processed.days}일 진행)
        </strong>
        <button type="button" className="sim-icon-button" onClick={onDismiss}>
          <AppIcon name="close" size={14} />
          <span className="sim-sr-only">진행 결과 닫기</span>
        </button>
      </div>
      <ul>
        {items.map(([label, count, warning]) => (
          <li key={label} className={warning ? 'is-warning' : undefined}>
            <span>{label}</span>
            <strong>{count}회</strong>
          </li>
        ))}
      </ul>
      {processed.missedTransferCount > 0 && (
        <p className="sim-missed">
          파킹통장 잔액이 모자라 적금 회차가 미납되었습니다. 미납 회차는 이자 대상이 아닙니다.
        </p>
      )}
    </div>
  )
}

function OpenAccountPanel({
  sandbox,
  busy,
  pending,
  onOpen,
}: {
  sandbox: Sandbox
  busy: boolean
  pending: boolean
  onOpen: (body: OpenAccountRequest, setError: (error: unknown) => void) => Promise<boolean>
}) {
  const [rules, setRules] = useState<Rules | null>(null)
  const [rulesError, setRulesError] = useState<unknown>(null)
  const [rulesReload, setRulesReload] = useState(0)
  const [productCode, setProductCode] = useState('')
  const [amount, setAmount] = useState('')
  const [checked, setChecked] = useState(false)
  const [confirming, setConfirming] = useState<OpenAccountRequest | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [opened, setOpened] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    setRulesError(null)
    fetchRules(controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return
        setRules(result)
        setProductCode((current) => current || subscribableProducts(result.products)[0]?.code || '')
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setRulesError(cause)
      })
    return () => controller.abort()
  }, [rulesReload])

  const products = rules ? subscribableProducts(rules.products) : []
  const product: RuleProduct | undefined = products.find((item) => item.code === productCode)
  const installment = product?.kind === 'INSTALLMENT_SAVINGS'
  const value = parseWholeNumber(amount)
  const parking = sandbox.summary.parkingBalance
  const amountError = !product
    ? ''
    : value === null
      ? '금액을 원 단위 정수로 입력해 주세요.'
      : value < product.minAmount || value > product.maxAmount
        ? `${won(product.minAmount)}부터 ${won(product.maxAmount)}까지 입력해 주세요.`
        : value > parking
          ? `파킹통장 잔액(${won(parking)})보다 많습니다. ${installment ? '1회차 납입액' : '예치 원금'}은 파킹통장에서 이체됩니다.`
          : ''

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setChecked(true)
    setOpened('')
    if (!product || value === null || amountError) return
    setError(null)
    setConfirming({ productCode: product.code, amount: value })
  }

  return (
    <section className="sim-panel" aria-labelledby="sim-open-title">
      <div className="sim-panel-heading">
        <h2 id="sim-open-title">상품 가입</h2>
        <p>
          모의 금리표의 정기예금·적금에 가입합니다. 금리는 교육용 가정값이며 가입 금액은
          파킹통장에서 이체됩니다.
        </p>
      </div>
      {rulesError ? (
        <div className="sim-load-error">
          <ErrorNotice error={rulesError} message="모의 상품 금리표를 불러오지 못했습니다." />
          <button
            type="button"
            className="button button-outline small"
            onClick={() => setRulesReload((count) => count + 1)}
          >
            다시 불러오기
          </button>
        </div>
      ) : !rules ? (
        <p className="sim-empty-note" role="status">
          모의 상품 금리표를 불러오고 있습니다.
        </p>
      ) : (
        <form onSubmit={submit} noValidate>
          <fieldset className="sim-products">
            <legend>상품 선택</legend>
            {products.map((item) => (
              <label
                key={item.code}
                className={item.code === productCode ? 'sim-product selected' : 'sim-product'}
              >
                <input
                  type="radio"
                  name="sim-product"
                  value={item.code}
                  checked={item.code === productCode}
                  onChange={() => {
                    setProductCode(item.code)
                    setChecked(false)
                  }}
                />
                <span className="sim-product-name">{item.name}</span>
                <span className="sim-product-rate">연 {rate(item.annualRate)}%</span>
                <span className="sim-product-range">
                  {item.kind === 'INSTALLMENT_SAVINGS' ? '월 ' : ''}
                  {won(item.minAmount)} ~ {won(item.maxAmount)}
                </span>
              </label>
            ))}
          </fieldset>
          {product && (
            <SimField
              id="sim-open-amount"
              label={installment ? '월 납입액' : '예치 원금'}
              unit="원"
              money
              value={amount}
              onChange={(text) => {
                setAmount(text)
                setOpened('')
              }}
              error={checked ? amountError || undefined : undefined}
              help={
                <>
                  {won(product.minAmount)} ~ {won(product.maxAmount)} · 현재 파킹통장 잔액{' '}
                  {won(parking)}
                </>
              }
            />
          )}
          {opened && (
            <p className="sim-flash" role="status">
              <AppIcon name="check" size={16} /> {opened}에 가입했습니다.
            </p>
          )}
          <div className="sim-form-actions">
            <button type="submit" className="button button-primary" disabled={busy || !product}>
              가입 내용 확인
            </button>
          </div>
        </form>
      )}
      <ConfirmDialog
        open={!!confirming}
        title="이 조건으로 가입할까요?"
        confirmLabel="가입"
        pendingLabel="가입하는 중…"
        pending={pending}
        onConfirm={() => {
          if (!confirming || !product) return
          const name = product.name
          void onOpen(confirming, setError).then((ok) => {
            if (!ok) return
            setConfirming(null)
            setAmount('')
            setChecked(false)
            setOpened(name)
          })
        }}
        onClose={() => setConfirming(null)}
      >
        <ErrorNotice error={error} message={simulationErrorMessage(error)} />
        {confirming && product && (
          <>
            <dl className="bank-confirm-summary">
              <div>
                <dt>상품</dt>
                <dd>{product.name}</dd>
              </div>
              <div>
                <dt>기간</dt>
                <dd>{product.termMonths}개월</dd>
              </div>
              <div>
                <dt>연 금리</dt>
                <dd>{rate(product.annualRate)}% (교육용 가정값, 단리)</dd>
              </div>
              <div>
                <dt>{installment ? '월 납입액' : '예치 원금'}</dt>
                <dd>{won(confirming.amount)}</dd>
              </div>
              <div>
                <dt>가입일</dt>
                <dd>{simDate(sandbox.currentDate)} (가상 날짜)</dd>
              </div>
              <div>
                <dt>출금 계좌</dt>
                <dd>파킹통장 (잔액 {won(parking)})</dd>
              </div>
            </dl>
            <p className="sim-help">
              {installment
                ? '가입일에 1회차를 이체하고, 매월 같은 날 파킹통장에서 자동이체합니다. 그날 잔액이 모자라면 그 회차는 미납으로 남고 다시 시도하지 않습니다.'
                : '만기일에 원금과 세후 이자가 파킹통장으로 자동 입금됩니다. 만기 전에 해지하면 낮은 중도해지이율이 적용됩니다.'}
            </p>
          </>
        )}
      </ConfirmDialog>
    </section>
  )
}
