import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { request } from '../lib/api'
import { dateTime, won } from '../lib/format'
import { simDate } from '../lib/simulation'
import {
  historyPath,
  sandboxStatusLabel,
  type SandboxListItem,
  type SandboxPage,
} from '../lib/simulationHistory'
import AppIcon from '../components/AppIcon'
import ErrorNotice from '../components/ErrorNotice'
import '../styles/simulation.css'
import '../styles/simulation-history.css'

type View =
  | { kind: 'loading' }
  | { kind: 'error'; error: unknown }
  | { kind: 'ready'; items: SandboxListItem[]; nextBefore: number | null }

export default function SimulationHistoryPage() {
  const [view, setView] = useState<View>({ kind: 'loading' })
  const [reload, setReload] = useState(0)
  const [more, setMore] = useState<{ pending: boolean; error: unknown }>({
    pending: false,
    error: null,
  })

  useEffect(() => {
    const controller = new AbortController()
    setView({ kind: 'loading' })
    request<SandboxPage>(historyPath(null), { signal: controller.signal })
      .then((page) => {
        if (!controller.signal.aborted)
          setView({ kind: 'ready', items: page.items, nextBefore: page.nextBefore })
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setView({ kind: 'error', error: cause })
      })
    return () => controller.abort()
  }, [reload])

  async function loadMore(before: number) {
    setMore({ pending: true, error: null })
    try {
      const page = await request<SandboxPage>(historyPath(before))
      setView((current) =>
        current.kind === 'ready'
          ? { kind: 'ready', items: [...current.items, ...page.items], nextBefore: page.nextBefore }
          : current,
      )
      setMore({ pending: false, error: null })
    } catch (cause) {
      setMore({ pending: false, error: cause })
    }
  }

  return (
    <>
      <Link className="back-link" to="/simulation">
        <AppIcon name="chevron" size={14} /> 모의 운용으로 돌아가기
      </Link>
      <section className="page-title">
        <div>
          <h1>지난 모의 운용</h1>
          <p>
            종료한 샌드박스와 진행 중인 샌드박스의 기록입니다. 거래 원장은 지워지지 않으며 각 운용의
            성과 리포트를 다시 볼 수 있습니다.
          </p>
        </div>
      </section>
      <p className="notice sim-lead-notice">
        <AppIcon name="shield" size={16} /> 실제 계좌가 아닌 학습용 가상 자금의 기록입니다. 금액은
        모두 서버가 원장에서 계산합니다.
      </p>
      {view.kind === 'loading' ? (
        <div className="empty-state" role="status">
          모의 운용 기록을 불러오고 있습니다.
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
      ) : view.items.length === 0 ? (
        <div className="empty-state">
          <h2>아직 모의 운용 기록이 없습니다</h2>
          <p>모의 운용을 시작하면 이곳에서 운용 기록과 성과 리포트를 볼 수 있습니다.</p>
          <Link className="button button-primary" to="/simulation">
            모의 운용 시작하기
          </Link>
        </div>
      ) : (
        <section aria-labelledby="sim-history-title">
          <h2 className="sim-section-title" id="sim-history-title">
            운용 기록 <small>최신순</small>
          </h2>
          <ul className="sim-history-list">
            {view.items.map((item) => (
              <li key={item.id}>
                <Link
                  className="sim-history-card"
                  to={`/simulation/history/${encodeURIComponent(item.id)}`}
                >
                  <span className="sim-history-head">
                    <strong>{item.number}번째 모의 운용</strong>
                    <span className={`sim-badge tone-${item.status === 'ACTIVE' ? 'ok' : 'done'}`}>
                      {sandboxStatusLabel(item.status)}
                    </span>
                  </span>
                  <span className="sim-history-period">
                    {simDate(item.startDate)} ~ {simDate(item.currentDate)} · {item.elapsedDays}일
                    {item.closedAt && <> · 종료 {dateTime(item.closedAt)}</>}
                  </span>
                  <dl className="sim-history-facts">
                    <div>
                      <dt>{item.status === 'ACTIVE' ? '현재 총자산' : '종료 시 총자산'}</dt>
                      <dd>{won(item.totalAssets)}</dd>
                    </div>
                    <div>
                      <dt>초기 자금</dt>
                      <dd>{won(item.initialCash)}</dd>
                    </div>
                    <div>
                      <dt>받은 급여</dt>
                      <dd>{won(item.salaryReceived)}</dd>
                    </div>
                    <div>
                      <dt>순이자(세후)</dt>
                      <dd>{won(item.netInterest)}</dd>
                    </div>
                    <div>
                      <dt>계좌</dt>
                      <dd>{item.accountCount}개</dd>
                    </div>
                  </dl>
                  <span className="sim-history-more">
                    성과 리포트 보기 <AppIcon name="chevron" size={14} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {view.nextBefore !== null && (
            <div className="sim-history-pager">
              <ErrorNotice error={more.error} />
              <button
                type="button"
                className="button button-outline"
                disabled={more.pending}
                onClick={() => view.nextBefore !== null && void loadMore(view.nextBefore)}
              >
                {more.pending ? '불러오는 중…' : '이전 기록 더 보기'}
              </button>
            </div>
          )}
        </section>
      )}
    </>
  )
}
