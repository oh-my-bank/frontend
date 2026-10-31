import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { dateTime, statusLabel } from '../lib/format'
import {
  countText,
  dayLabel,
  durationText,
  fetchOpsSummary,
  OPS_WINDOWS,
  opsWindow,
  rejectReasonLabel,
  type OpsSummary,
} from '../lib/ops'
import AppIcon from '../components/AppIcon'
import ErrorNotice from '../components/ErrorNotice'
import { StackedBars } from './tools/ToolChart'
import '../styles/banking-records.css'
import '../styles/tools.css'
import '../styles/ops.css'

// The review stages always show, even at zero; later stages appear only once stored applications reach them.
const REVIEW_STAGES = ['APPLIED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED']

export default function OpsDashboardPage() {
  const [params, setParams] = useSearchParams()
  const days = opsWindow(params.get('days'))
  const [summary, setSummary] = useState<OpsSummary | null>(null)
  const [pending, setPending] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    setPending(true)
    setError(null)
    fetchOpsSummary(days, controller.signal).then(
      (value) => {
        if (!active) return
        setSummary(value)
        setPending(false)
      },
      (reason: unknown) => {
        if (!active) return
        setError(reason)
        setPending(false)
      },
    )
    return () => {
      active = false
      controller.abort()
    }
  }, [days, reload])

  const shown = error ? null : summary
  const statuses = shown?.applications.byStatus.filter(
    (item) => REVIEW_STAGES.includes(item.status) || item.count > 0,
  )
  const count = (status: string) =>
    shown?.applications.byStatus.find((item) => item.status === status)?.count ?? 0
  const topProduct = Math.max(0, ...(shown?.applications.byProduct.map((item) => item.count) ?? []))
  const busiestDay = Math.max(
    0,
    ...(shown?.daily.flatMap((day) => [day.received, day.decided]) ?? []),
  )
  const reviews = shown?.reviews

  return (
    <>
      <section className="page-title bank-title-actions">
        <div>
          <h1>운영 현황</h1>
          <p>저장된 가상 대출 신청과 모의 심사 기록을 실시간으로 집계합니다.</p>
        </div>
        <Link to="/staff" className="button button-outline">
          직원 업무로
          <AppIcon name="arrow" size={17} />
        </Link>
      </section>

      <div className="ops-toolbar">
        <div className="bank-application-field tool-field">
          <label htmlFor="ops-window">일별 추이 기간</label>
          <select
            id="ops-window"
            value={days}
            onChange={(event) => setParams({ days: event.target.value }, { replace: true })}
          >
            {OPS_WINDOWS.map((value) => (
              <option key={value} value={value}>
                최근 {value}일
              </option>
            ))}
          </select>
        </div>
        <p className="bank-section-help">
          {shown
            ? `집계 시각 ${dateTime(shown.generatedAt)} · 날짜는 한국 시간(${shown.timeZone}) 기준입니다.`
            : '날짜는 한국 시간 기준입니다.'}
        </p>
      </div>

      {error ? (
        <div className="ops-error">
          <ErrorNotice error={error} />
          <button
            type="button"
            className="button button-outline"
            onClick={() => setReload((n) => n + 1)}
          >
            다시 조회
          </button>
        </div>
      ) : null}

      <section className="bank-overview" aria-labelledby="ops-overview-title" aria-busy={pending}>
        <div className="bank-overview-heading">
          <h2 id="ops-overview-title">신청 현황</h2>
          <span>전체 기간 누적</span>
        </div>
        <div className="bank-overview-counts ops-overview-counts">
          {[
            ['전체 신청', shown?.applications.total],
            ['심사 대기', shown ? count('APPLIED') : undefined],
            ['심사 중', shown ? count('UNDER_REVIEW') : undefined],
          ].map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>
                {pending || value === undefined ? '—' : value}
                <small>건</small>
              </strong>
            </div>
          ))}
        </div>
      </section>

      {shown && shown.applications.total === 0 && (
        <div className="notice ops-empty">
          아직 접수된 신청이 없어 집계할 데이터가 없습니다. 고객 계정으로 대출을 신청하면 이곳에
          반영됩니다.
        </div>
      )}

      {shown && shown.applications.total > 0 && (
        <div className="ops-grid">
          <section className="bank-record-section" aria-labelledby="ops-status-title">
            <div className="section-heading">
              <div>
                <h2 id="ops-status-title">상태별 신청</h2>
                <p>현재 진행 상태 기준입니다.</p>
              </div>
            </div>
            <div className="bank-application-table-wrap">
              <table className="bank-application-table">
                <caption className="bank-sr-only">진행 상태별 신청 건수</caption>
                <thead>
                  <tr>
                    <th scope="col">진행상태</th>
                    <th scope="col" className="bank-amount-cell">
                      건수
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {statuses?.map((item) => (
                    <tr key={item.status}>
                      <td data-label="진행상태">
                        <span className={`status-badge ${item.status.toLowerCase()}`}>
                          {statusLabel(item.status)}
                        </span>
                      </td>
                      <td className="bank-amount-cell" data-label="건수">
                        {countText(item.count)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bank-record-section" aria-labelledby="ops-product-title">
            <div className="section-heading">
              <div>
                <h2 id="ops-product-title">상품별 신청</h2>
                <p>신청이 많은 상품부터 표시합니다.</p>
              </div>
            </div>
            <StackedBars
              title="상품별 신청 건수"
              format={countText}
              rows={shown.applications.byProduct.map((item) => ({
                label: `${item.productName} · ${countText(item.count)}`,
                max: topProduct,
                segments: [{ label: '신청', value: item.count, tone: 'principal' }],
              }))}
              note="상품명은 가장 최근 신청 당시의 이름입니다."
            />
          </section>
        </div>
      )}

      {shown && reviews && shown.applications.total > 0 && (
        <section className="bank-record-section" aria-labelledby="ops-review-title">
          <div className="section-heading">
            <div>
              <h2 id="ops-review-title">모의 심사 처리</h2>
              <p>심사 시작 이후의 기록을 전체 기간 누적으로 집계합니다.</p>
            </div>
            <Link to="/staff" className="text-button">
              직원 업무 안내
              <AppIcon name="arrow" size={16} />
            </Link>
          </div>
          {reviews.started === 0 ? (
            <div className="notice ops-empty">아직 시작된 심사가 없습니다.</div>
          ) : (
            <dl className="details-list ops-review-list">
              <div>
                <dt>심사 시작</dt>
                <dd>
                  {countText(reviews.started)} (진행 중 {countText(reviews.inReview)})
                </dd>
              </div>
              <div>
                <dt>결정 완료</dt>
                <dd>
                  {countText(reviews.decided)} · 승인 {countText(reviews.approved)} · 거절{' '}
                  {countText(reviews.rejected)}
                </dd>
              </div>
              <div>
                <dt>승인율</dt>
                <dd>
                  {reviews.approvalRatePercent === null
                    ? '결정된 심사 없음'
                    : `${reviews.approvalRatePercent}%`}
                </dd>
              </div>
              <div>
                <dt>평균 처리 시간</dt>
                <dd>
                  {reviews.averageDecisionSeconds === null
                    ? '결정된 심사 없음'
                    : `${durationText(reviews.averageDecisionSeconds)} (심사 시작 → 결정)`}
                </dd>
              </div>
              <div>
                <dt>모의 DSR 기준</dt>
                <dd>
                  충족 {countText(reviews.ruleMet)} · 미충족 {countText(reviews.ruleNotMet)}
                </dd>
              </div>
              <div>
                <dt>거절 사유</dt>
                <dd>
                  {reviews.rejectReasons
                    .map((item) => `${rejectReasonLabel(item.reasonCode)} ${countText(item.count)}`)
                    .join(' · ')}
                </dd>
              </div>
            </dl>
          )}
        </section>
      )}

      {shown && (
        <section className="bank-record-section" aria-labelledby="ops-daily-title">
          <div className="section-heading">
            <div>
              <h2 id="ops-daily-title">일별 접수·심사 결정</h2>
              <p>
                {dayLabel(shown.from)} ~ {dayLabel(shown.to)} · 최근 {shown.days}일
              </p>
            </div>
          </div>
          <DailyChart daily={shown.daily} max={busiestDay} />
          <details className="ops-daily-details">
            <summary>일별 수치 보기</summary>
            <div className="bank-application-table-wrap">
              <table className="bank-application-table">
                <caption className="bank-sr-only">일별 접수 건수와 심사 결정 건수</caption>
                <thead>
                  <tr>
                    <th scope="col">날짜</th>
                    <th scope="col" className="bank-amount-cell">
                      접수
                    </th>
                    <th scope="col" className="bank-amount-cell">
                      심사 결정
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...shown.daily].reverse().map((day) => (
                    <tr key={day.date}>
                      <td data-label="날짜">{day.date}</td>
                      <td className="bank-amount-cell" data-label="접수">
                        {countText(day.received)}
                      </td>
                      <td className="bank-amount-cell" data-label="심사 결정">
                        {countText(day.decided)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>
      )}

      <div className="notice bank-staff-notice">
        이 화면의 수치는 학습용 시뮬레이션에 저장된 가상 데이터의 집계이며 실제 은행의 운영 지표가
        아닙니다. 고객 이름·연소득 등 개인별 정보는 표시하지 않습니다.
      </div>
    </>
  )
}

/** Paired columns per day (received, decided) scaled to the busiest day; the table below holds the same numbers. */
function DailyChart({ daily, max }: { daily: OpsSummary['daily']; max: number }) {
  const slot = 12
  const height = 120
  const width = daily.length * slot
  const scale = (value: number) => (max > 0 ? (value / max) * height : 0)
  const received = daily.reduce((sum, day) => sum + day.received, 0)
  const decided = daily.reduce((sum, day) => sum + day.decided, 0)
  const first = daily[0]
  const last = daily[daily.length - 1]
  return (
    <figure className="tool-chart ops-daily-chart">
      <svg
        className="tool-schedule-chart"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${daily.length}일 동안 접수 ${countText(received)}, 심사 결정 ${countText(decided)}. 하루 최대 ${countText(max)}. 날짜별 수치는 아래 표에 있습니다.`}
      >
        <rect width={width} height={height} fill="#f2f6f4" />
        {daily.map((day, index) => (
          <g key={day.date}>
            <rect
              x={index * slot + 1}
              y={height - scale(day.received)}
              width={slot / 2 - 1}
              height={scale(day.received)}
              fill="#008577"
            />
            <rect
              x={index * slot + slot / 2}
              y={height - scale(day.decided)}
              width={slot / 2 - 1}
              height={scale(day.decided)}
              fill="#7fc7b6"
            />
          </g>
        ))}
      </svg>
      <div className="tool-schedule-axis" aria-hidden="true">
        {first && <span>{dayLabel(first.date)}</span>}
        {last && <span>{dayLabel(last.date)}</span>}
      </div>
      <ul className="tool-chart-legend">
        <li>
          <span className="tool-swatch principal" aria-hidden="true" />
          접수(왼쪽 막대)
        </li>
        <li>
          <span className="tool-swatch interest" aria-hidden="true" />
          심사 결정(오른쪽 막대)
        </li>
      </ul>
    </figure>
  )
}
