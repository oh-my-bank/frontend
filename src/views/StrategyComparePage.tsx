import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ApiError } from '../lib/api'
import { dateTime, won } from '../lib/format'
import { actionStatus, actionTypeLabel } from '../lib/strategy'
import {
  compareSavedStrategies,
  deltaText,
  metricUnit,
  type SavedStrategy,
  type StrategyComparison,
} from '../lib/strategySaves'
import AppIcon from '../components/AppIcon'
import ErrorNotice from '../components/ErrorNotice'
import { InputFacts } from './StrategySavePage'
import '../styles/simulation.css'
import '../styles/strategy-saves.css'

type View =
  | { kind: 'loading' }
  | { kind: 'invalid'; message: string }
  | { kind: 'error'; error: unknown }
  | { kind: 'ready'; comparison: StrategyComparison }

export default function StrategyComparePage() {
  const [params] = useSearchParams()
  const left = params.get('left') ?? ''
  const right = params.get('right') ?? ''
  const [view, setView] = useState<View>({ kind: 'loading' })
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (!left || !right) {
      setView({ kind: 'invalid', message: '비교할 두 전략을 목록에서 골라 주세요.' })
      return
    }
    const controller = new AbortController()
    setView({ kind: 'loading' })
    compareSavedStrategies(left, right, controller.signal)
      .then((comparison) => {
        if (!controller.signal.aborted) setView({ kind: 'ready', comparison })
      })
      .catch((cause) => {
        if (controller.signal.aborted) return
        if (cause instanceof ApiError && (cause.status === 404 || cause.status === 400))
          setView({
            kind: 'invalid',
            message:
              cause.status === 404
                ? '비교할 전략을 찾을 수 없습니다. 삭제했거나 다른 계정의 전략일 수 있습니다.'
                : cause.message,
          })
        else setView({ kind: 'error', error: cause })
      })
    return () => controller.abort()
  }, [left, right, reload])

  return (
    <>
      <Link className="back-link" to="/strategy/saves">
        <AppIcon name="chevron" size={14} /> 내 전략 목록으로
      </Link>
      <section className="page-title">
        <div>
          <h1>전략 비교</h1>
          <p>왼쪽(A)과 오른쪽(B) 전략을 같은 항목으로 비교합니다. 차이는 B에서 A를 뺀 값입니다.</p>
        </div>
      </section>
      {view.kind === 'loading' ? (
        <div className="empty-state" role="status">
          두 전략을 비교하고 있습니다.
        </div>
      ) : view.kind === 'invalid' ? (
        <div className="empty-state">
          {view.message} <Link to="/strategy/saves">내 전략 목록</Link>
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
        <ComparisonView comparison={view.comparison} />
      )}
    </>
  )
}

function ComparisonView({ comparison }: { comparison: StrategyComparison }) {
  const { left, right } = comparison
  return (
    <>
      {!comparison.sameRuleVersion && (
        <p className="sim-stale" role="status">
          두 전략의 규칙 버전이 달라 같은 기준의 비교가 아닙니다. 필요하면 각 전략을 다시 계산해
          저장한 뒤 비교하세요.
        </p>
      )}
      <div className="sim-table-wrap">
        <table className="sim-table strategy-compare-table">
          <caption>
            A ‘{left.name}’ 와 B ‘{right.name}’ 의 주요 수치
          </caption>
          <thead>
            <tr>
              <th scope="col">항목</th>
              <th scope="col" className="sim-number">
                A {left.name}
              </th>
              <th scope="col" className="sim-number">
                B {right.name}
              </th>
              <th scope="col" className="sim-number">
                차이(B − A)
              </th>
            </tr>
          </thead>
          <tbody>
            {comparison.metrics.map((metric) => {
              const unit = metricUnit(metric.key)
              const show = (value: number) => (unit === 'won' ? won(value) : `${value}개`)
              return (
                <tr key={metric.key}>
                  <th scope="row" data-label="항목">
                    {metric.label}
                  </th>
                  <td data-label={`A ${left.name}`} className="sim-number">
                    {show(metric.left)}
                  </td>
                  <td data-label={`B ${right.name}`} className="sim-number">
                    {show(metric.right)}
                  </td>
                  <td
                    data-label="차이(B − A)"
                    className={`sim-number strategy-delta ${metric.delta > 0 ? 'up' : metric.delta < 0 ? 'down' : ''}`}
                  >
                    {deltaText(metric.delta, unit)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="strategy-compare-columns">
        <PlanColumn label="A" saved={left} />
        <PlanColumn label="B" saved={right} />
      </div>
      <p className="notice">{comparison.notice}</p>
    </>
  )
}

function PlanColumn({ label, saved }: { label: string; saved: SavedStrategy }) {
  return (
    <section className="sim-panel" aria-labelledby={`compare-${label}`}>
      <h2 id={`compare-${label}`} className="sim-section-title">
        {label}. <Link to={`/strategy/saves/${saved.id}`}>{saved.name}</Link>
      </h2>
      <p className="strategy-saves-meta">
        {dateTime(saved.createdAt)} 저장 · 규칙 {saved.ruleVersion} · 금리표 {saved.ratesVersion}
      </p>
      <InputFacts input={saved.input} />
      <h3 className="sim-subheading">실행 순서</h3>
      <ol className="strategy-compare-actions">
        {saved.plan.actions.map((action) => {
          const status = actionStatus(action.status)
          return (
            <li key={action.order}>
              <span>
                {action.order}. {action.title}
                <small> · {actionTypeLabel(action.type)}</small>
              </span>
              <span className={`sim-badge tone-${status.tone}`}>{status.label}</span>
            </li>
          )
        })}
      </ol>
      {saved.plan.warnings.length > 0 && (
        <p className="sim-help">경고 {saved.plan.warnings.length}개: 상세 화면에서 확인하세요.</p>
      )}
    </section>
  )
}
