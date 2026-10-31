import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError } from '../lib/api'
import { dateTime, won } from '../lib/format'
import {
  comparePath,
  deleteSavedStrategy,
  listSavedStrategies,
  type SavedStrategyList,
  type SavedStrategySummary,
} from '../lib/strategySaves'
import AppIcon from '../components/AppIcon'
import ConfirmDialog from '../components/ConfirmDialog'
import ErrorNotice from '../components/ErrorNotice'
import '../styles/simulation.css'
import '../styles/strategy-saves.css'

type View =
  | { kind: 'loading' }
  | { kind: 'error'; error: unknown }
  | { kind: 'ready'; list: SavedStrategyList }

export default function StrategySavesPage() {
  const navigate = useNavigate()
  const [view, setView] = useState<View>({ kind: 'loading' })
  const [reload, setReload] = useState(0)
  const [selected, setSelected] = useState<string[]>([])
  const [deleting, setDeleting] = useState<SavedStrategySummary | null>(null)
  const [deletePending, setDeletePending] = useState(false)
  const [deleteError, setDeleteError] = useState<unknown>(null)
  const [deleted, setDeleted] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    setView({ kind: 'loading' })
    listSavedStrategies(controller.signal)
      .then((list) => {
        if (controller.signal.aborted) return
        setView({ kind: 'ready', list })
        const ids = new Set(list.items.map((item) => item.id))
        setSelected((current) => current.filter((id) => ids.has(id)))
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setView({ kind: 'error', error: cause })
      })
    return () => controller.abort()
  }, [reload])

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : current.length < 2
          ? [...current, id]
          : current,
    )
  }

  async function confirmDelete() {
    if (!deleting || deletePending) return
    setDeletePending(true)
    setDeleteError(null)
    try {
      await deleteSavedStrategy(deleting.id)
      setDeleted(deleting.name)
      setDeleting(null)
      setReload((value) => value + 1)
    } catch (cause) {
      // A save that is already gone (another tab, or a reply lost after the delete) needs no retry.
      if (cause instanceof ApiError && cause.status === 404) {
        setDeleted(deleting.name)
        setDeleting(null)
      } else setDeleteError(cause)
      // Deleting is not idempotent; a lost reply is checked by reloading the list instead of resending.
      setReload((value) => value + 1)
    } finally {
      setDeletePending(false)
    }
  }

  return (
    <>
      <Link className="back-link" to="/strategy">
        <AppIcon name="chevron" size={14} /> 나의 전략으로 돌아가기
      </Link>
      <section className="page-title">
        <div>
          <h1>내 전략</h1>
          <p>
            저장한 전략은 저장 시점의 규칙 버전으로 계산한 결과입니다. 두 개를 골라 나란히 비교할 수
            있습니다.
          </p>
        </div>
        <Link className="button button-primary" to="/strategy">
          새 전략 계산 <AppIcon name="arrow" size={16} />
        </Link>
      </section>
      <p className="notice sim-lead-notice">
        <AppIcon name="info" size={16} /> 교육용 규칙의 계산 결과이며 투자 자문이나 실제 금융상품
        추천이 아닙니다. 저장한 전략은 본인만 볼 수 있고 언제든 삭제할 수 있습니다.
      </p>
      {deleted && (
        <p className="strategy-saves-status" role="status">
          ‘{deleted}’ 전략을 삭제했습니다.
        </p>
      )}

      {view.kind === 'loading' ? (
        <div className="empty-state" role="status">
          저장한 전략을 불러오고 있습니다.
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
      ) : view.list.items.length === 0 ? (
        <div className="empty-state">
          아직 저장한 전략이 없습니다. <Link to="/strategy">나의 전략</Link>에서 계산한 뒤 결과
          아래에서 저장해 보세요.
        </div>
      ) : (
        <>
          <div className="strategy-saves-toolbar">
            <p>
              저장 {view.list.items.length} / {view.list.limit}개 · 비교할 전략 {selected.length}
              /2개 선택
            </p>
            <button
              type="button"
              className="button button-primary"
              disabled={selected.length !== 2}
              onClick={() => void navigate(comparePath(selected[0], selected[1]))}
            >
              선택한 두 전략 비교
            </button>
          </div>
          <ul className="strategy-saves-list" aria-label="저장한 전략">
            {view.list.items.map((item) => {
              const checked = selected.includes(item.id)
              return (
                <li key={item.id} className={checked ? 'selected' : undefined}>
                  <label className="strategy-saves-pick">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!checked && selected.length >= 2}
                      onChange={() => toggle(item.id)}
                    />
                    <span className="sim-sr-only">{item.name} 비교 대상으로 선택</span>
                  </label>
                  <div className="strategy-saves-body">
                    <h2>
                      <Link to={`/strategy/saves/${item.id}`}>{item.name}</Link>
                    </h2>
                    <p className="strategy-saves-meta">
                      {dateTime(item.createdAt)} 저장 · 규칙 {item.ruleVersion} · 금리표{' '}
                      {item.ratesVersion}
                    </p>
                    <dl className="sim-facts">
                      <div>
                        <dt>월 여유자금</dt>
                        <dd>{won(item.monthlySurplus)}</dd>
                      </div>
                      <div>
                        <dt>월 배분 / 미배분</dt>
                        <dd>
                          {won(item.allocatedMonthly)} / {won(item.unallocatedMonthly)}
                        </dd>
                      </div>
                      <div>
                        <dt>실행 항목</dt>
                        <dd>{item.actionCount}개</dd>
                      </div>
                      <div>
                        <dt>경고</dt>
                        <dd>{item.warningCount}개</dd>
                      </div>
                    </dl>
                  </div>
                  <button
                    type="button"
                    className="button button-outline small"
                    onClick={() => {
                      setDeleteError(null)
                      setDeleting(item)
                    }}
                  >
                    <AppIcon name="close" size={14} /> 삭제
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}

      <ConfirmDialog
        open={!!deleting}
        title="저장한 전략 삭제"
        confirmLabel="삭제"
        pendingLabel="삭제 중…"
        pending={deletePending}
        danger
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleting(null)}
      >
        <p>
          ‘{deleting?.name}’ 전략을 삭제합니다. 삭제한 전략은 되돌릴 수 없으며 같은 입력으로 다시
          계산해 저장할 수 있습니다.
        </p>
        <ErrorNotice error={deleteError} />
      </ConfirmDialog>
    </>
  )
}
