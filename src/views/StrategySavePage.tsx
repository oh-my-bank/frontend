import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../lib/api'
import { dateTime, rate, won } from '../lib/format'
import { deleteSavedStrategy, getSavedStrategy, type SavedStrategy } from '../lib/strategySaves'
import type { StrategyRequest } from '../lib/strategy'
import AppIcon from '../components/AppIcon'
import ConfirmDialog from '../components/ConfirmDialog'
import ErrorNotice from '../components/ErrorNotice'
import { ActionItem, warningLabels } from './StrategyPage'
import '../styles/simulation.css'
import '../styles/strategy-saves.css'

type View =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'error'; error: unknown }
  | { kind: 'ready'; saved: SavedStrategy }

export default function StrategySavePage() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [view, setView] = useState<View>({ kind: 'loading' })
  const [reload, setReload] = useState(0)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [deleteError, setDeleteError] = useState<unknown>(null)

  useEffect(() => {
    const controller = new AbortController()
    setView({ kind: 'loading' })
    getSavedStrategy(id, controller.signal)
      .then((saved) => {
        if (!controller.signal.aborted) setView({ kind: 'ready', saved })
      })
      .catch((cause) => {
        if (controller.signal.aborted) return
        setView(
          cause instanceof ApiError && (cause.status === 404 || cause.status === 400)
            ? { kind: 'missing' }
            : { kind: 'error', error: cause },
        )
      })
    return () => controller.abort()
  }, [id, reload])

  async function remove() {
    if (pending) return
    setPending(true)
    setDeleteError(null)
    try {
      await deleteSavedStrategy(id)
      await navigate('/strategy/saves', { replace: true })
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 404) {
        await navigate('/strategy/saves', { replace: true })
        return
      }
      setDeleteError(cause)
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <Link className="back-link" to="/strategy/saves">
        <AppIcon name="chevron" size={14} /> 내 전략 목록으로
      </Link>
      {view.kind === 'loading' ? (
        <div className="empty-state" role="status">
          저장한 전략을 불러오고 있습니다.
        </div>
      ) : view.kind === 'missing' ? (
        <div className="empty-state">
          저장한 전략을 찾을 수 없습니다. 삭제했거나 다른 계정의 전략일 수 있습니다.{' '}
          <Link to="/strategy/saves">내 전략 목록</Link>
        </div>
      ) : view.kind === 'error' ? (
        <>
          <ErrorNotice error={view.error} />
          <button
            type="button"
            className="button button-outline"
            onClick={() => setReload((v) => v + 1)}
          >
            다시 불러오기
          </button>
        </>
      ) : (
        <SavedDetail
          saved={view.saved}
          onRecalculate={() => void navigate('/strategy', { state: { prefill: view.saved.input } })}
          onDelete={() => {
            setDeleteError(null)
            setConfirmOpen(true)
          }}
        />
      )}
      <ConfirmDialog
        open={confirmOpen}
        title="저장한 전략 삭제"
        confirmLabel="삭제"
        pendingLabel="삭제 중…"
        pending={pending}
        danger
        onConfirm={() => void remove()}
        onClose={() => setConfirmOpen(false)}
      >
        <p>
          ‘{view.kind === 'ready' ? view.saved.name : ''}’ 전략을 삭제합니다. 삭제한 전략은 되돌릴
          수 없습니다.
        </p>
        <ErrorNotice error={deleteError} />
      </ConfirmDialog>
    </>
  )
}

function SavedDetail({
  saved,
  onRecalculate,
  onDelete,
}: {
  saved: SavedStrategy
  onRecalculate: () => void
  onDelete: () => void
}) {
  const { plan } = saved
  return (
    <>
      <section className="page-title">
        <div>
          <h1>{saved.name}</h1>
          <p>
            {dateTime(saved.createdAt)} 저장 · 규칙 {saved.ruleVersion} · 금리표{' '}
            {saved.ratesVersion}
            (교육용 가정값)
          </p>
        </div>
        <div className="strategy-save-links">
          <button type="button" className="button button-primary" onClick={onRecalculate}>
            이 입력으로 다시 계산
          </button>
          <button type="button" className="button button-outline" onClick={onDelete}>
            <AppIcon name="close" size={14} /> 삭제
          </button>
        </div>
      </section>
      <p className="notice sim-lead-notice">
        <AppIcon name="info" size={16} /> 저장 시점의 규칙으로 계산한 결과를 그대로 보여 줍니다.
        다시 계산하면 현재 규칙으로 새로 계산합니다. 투자 자문이나 실제 금융상품 추천이 아닙니다.
      </p>

      <section className="sim-panel strategy-saved-input" aria-labelledby="saved-input-title">
        <h2 id="saved-input-title" className="sim-section-title">
          저장한 입력
        </h2>
        <InputFacts input={saved.input} />
      </section>

      <section className="sim-result" aria-labelledby="saved-result-title">
        <h2 id="saved-result-title" className="sim-section-title">
          저장한 결과
        </h2>
        {plan.warnings.length > 0 && (
          <ul className="sim-warnings" aria-label="경고">
            {plan.warnings.map((warning) => (
              <li key={warning.code}>
                <strong>{warningLabels[warning.code] ?? '확인 필요'}</strong>
                <span>{warning.message}</span>
              </li>
            ))}
          </ul>
        )}
        <dl className="sim-summary">
          <div>
            <dt>월 여유자금</dt>
            <dd>{won(plan.summary.monthlySurplus)}</dd>
          </div>
          <div>
            <dt>저축률</dt>
            <dd>
              {plan.summary.savingsRatePercent === null
                ? '-'
                : `${plan.summary.savingsRatePercent}%`}
            </dd>
          </div>
          <div>
            <dt>비상금 목표</dt>
            <dd>{won(plan.summary.emergencyTarget)}</dd>
          </div>
          <div>
            <dt>기준 금리(12개월 정기예금 세후)</dt>
            <dd>연 {rate(plan.summary.benchmarkRate)}%</dd>
          </div>
          <div>
            <dt>월 배분 / 미배분</dt>
            <dd>
              {won(plan.summary.allocatedMonthly)} / {won(plan.summary.unallocatedMonthly)}
            </dd>
          </div>
        </dl>
        <h3 className="sim-subheading">실행 순서</h3>
        <ol className="sim-action-list">
          {plan.actions.map((action) => (
            <ActionItem key={action.order} action={action} />
          ))}
        </ol>
        <p className="notice">{plan.notice}</p>
      </section>
    </>
  )
}

export function InputFacts({ input }: { input: StrategyRequest }) {
  return (
    <>
      <dl className="sim-facts">
        <div>
          <dt>월 실수령 소득</dt>
          <dd>{won(input.monthlyIncome)}</dd>
        </div>
        <div>
          <dt>월 지출</dt>
          <dd>{won(input.monthlyExpense)}</dd>
        </div>
        <div>
          <dt>현금성 자산</dt>
          <dd>{won(input.liquidAssets)}</dd>
        </div>
        <div>
          <dt>비상금 개월 수</dt>
          <dd>{input.emergencyMonths}개월</dd>
        </div>
        <div>
          <dt>과세</dt>
          <dd>{input.taxFree ? '비과세로 계산' : '이자소득세 15.4% 반영'}</dd>
        </div>
      </dl>
      <p className="sim-help">
        목표{' '}
        {input.goals.length === 0
          ? '없음'
          : input.goals
              .map((goal) => `${goal.name} ${won(goal.targetAmount)}·${goal.months}개월`)
              .join(', ')}
        {' · '}보유 대출{' '}
        {input.loans.length === 0
          ? '없음'
          : input.loans
              .map((loan) => `${loan.name} ${won(loan.balance)}·연 ${rate(loan.annualRate)}%`)
              .join(', ')}
      </p>
    </>
  )
}
