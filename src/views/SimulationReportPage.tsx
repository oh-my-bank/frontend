import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { request } from '../lib/api'
import { rate, won, wonText } from '../lib/format'
import {
  accountKindLabel,
  accountStatus,
  eventTypeLabel,
  preciseWon,
  simDate,
  type Sandbox,
} from '../lib/simulation'
import {
  isNotFound,
  postMaturitySummary,
  postMaturityTierLabel,
  sandboxStatusLabel,
  sharePercent,
  type SimulationReport,
} from '../lib/simulationHistory'
import AppIcon from '../components/AppIcon'
import ErrorNotice from '../components/ErrorNotice'
import '../styles/simulation.css'
import '../styles/simulation-history.css'

type View =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'error'; error: unknown }
  | { kind: 'ready'; report: SimulationReport; sandbox: Sandbox }

export default function SimulationReportPage() {
  const { id = '' } = useParams<{ id: string }>()
  const [view, setView] = useState<View>({ kind: 'loading' })
  const [reload, setReload] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    const path = `/simulation/sandboxes/${encodeURIComponent(id)}`
    setView({ kind: 'loading' })
    Promise.all([
      request<SimulationReport>(`${path}/report`, { signal: controller.signal }),
      request<Sandbox>(path, { signal: controller.signal }),
    ])
      .then(([report, sandbox]) => {
        if (!controller.signal.aborted) setView({ kind: 'ready', report, sandbox })
      })
      .catch((cause) => {
        if (controller.signal.aborted) return
        setView(isNotFound(cause) ? { kind: 'missing' } : { kind: 'error', error: cause })
      })
    return () => controller.abort()
  }, [id, reload])

  return (
    <>
      <Link className="back-link" to="/simulation/history">
        <AppIcon name="chevron" size={14} /> 지난 모의 운용으로 돌아가기
      </Link>
      {view.kind === 'loading' ? (
        <div className="empty-state" role="status">
          성과 리포트를 불러오고 있습니다.
        </div>
      ) : view.kind === 'missing' ? (
        <div className="empty-state">
          <h2>모의 운용 기록을 찾을 수 없습니다</h2>
          <p>주소가 잘못되었거나 다른 고객의 기록입니다. 다른 고객의 기록은 조회할 수 없습니다.</p>
          <Link className="button button-outline" to="/simulation/history">
            지난 모의 운용으로 이동
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
        <Report report={view.report} sandbox={view.sandbox} />
      )}
    </>
  )
}

function Report({ report, sandbox }: { report: SimulationReport; sandbox: Sandbox }) {
  const { totals } = report
  const active = report.status === 'ACTIVE'
  const early = report.contributions.filter((item) => item.earlyClose)
  const matured = report.contributions.filter((item) => item.postMaturity)
  return (
    <div className="sim-report">
      <section className="page-title">
        <div>
          <h1>
            {report.number}번째 모의 운용 리포트{' '}
            <span className={`sim-badge tone-${active ? 'ok' : 'done'}`}>
              {sandboxStatusLabel(report.status)}
            </span>
          </h1>
          <p>
            {simDate(report.startDate)} ~ {simDate(report.endDate)} ({report.elapsedDays}일) 동안의
            가상 운용 결과입니다.{' '}
            {active
              ? '진행 중인 운용은 현재 가상 날짜 기준입니다.'
              : '종료한 날의 가상 날짜 기준입니다.'}
          </p>
        </div>
        {active && (
          <Link className="button button-outline" to="/simulation">
            진행 중인 운용으로 이동
          </Link>
        )}
      </section>
      <p className="notice sim-lead-notice">
        <AppIcon name="shield" size={16} /> 실제 계좌가 아닌 학습용 가상 자금입니다. 리포트는 추가
        전용 원장을 서버가 합산한 결과이며({report.ruleVersion} · {report.reportRuleVersion}),
        중도해지 손실·만기후이율 비교는 원장에 반영되지 않는 교육용 가정 비교입니다. 투자 자문이나
        상품 추천이 아닙니다.
      </p>

      <section aria-labelledby="sim-report-totals">
        <h2 className="sim-section-title" id="sim-report-totals">
          운용 성과
        </h2>
        <dl className="sim-summary">
          <div className="emphasis">
            <dt>{active ? '현재 총자산' : '최종 총자산'}</dt>
            <dd>{won(totals.finalAssets)}</dd>
          </div>
          <div>
            <dt>넣은 돈(초기 자금+급여)</dt>
            <dd>{won(totals.contributed)}</dd>
          </div>
          <div>
            <dt>초기 자금</dt>
            <dd>{won(totals.initialCash)}</dd>
          </div>
          <div>
            <dt>받은 급여 누계</dt>
            <dd>{won(totals.salaryReceived)}</dd>
          </div>
          <div>
            <dt>받은 이자(세전)</dt>
            <dd>{won(totals.grossInterest)}</dd>
          </div>
          <div>
            <dt>낸 세금</dt>
            <dd>{won(totals.tax)}</dd>
          </div>
          <div>
            <dt>순이자(세후)</dt>
            <dd>{won(totals.netInterest)}</dd>
          </div>
          <div>
            <dt>쌓인 파킹 이자(미지급)</dt>
            <dd>{preciseWon(totals.accruedParkingInterest)}</dd>
          </div>
        </dl>
        <p className="sim-help">
          넣은 돈 {wonText(totals.contributed)} + 세후 이자 {wonText(totals.netInterest)} = 총자산{' '}
          {wonText(totals.finalAssets)}. 가입·이체·만기 지급은 내 계좌끼리 돈을 옮긴 것이라 총자산을
          바꾸지 않습니다. 아직 결산되지 않은 파킹 이자는 총자산에 들어가지 않습니다.
        </p>
      </section>

      <section aria-labelledby="sim-report-contributions">
        <h2 className="sim-section-title" id="sim-report-contributions">
          상품별 기여 <small>세후 이자 기준</small>
        </h2>
        <div className="sim-table-wrap">
          <table className="sim-table">
            <caption className="sim-sr-only">
              계좌별 원금·이자·세금과 세후 이자 비중(가입 순)
            </caption>
            <thead>
              <tr>
                <th scope="col">계좌</th>
                <th scope="col">상태</th>
                <th scope="col">연 금리</th>
                <th scope="col" className="sim-number">
                  넣은 원금
                </th>
                <th scope="col" className="sim-number">
                  이자(세전)
                </th>
                <th scope="col" className="sim-number">
                  세금
                </th>
                <th scope="col" className="sim-number">
                  세후 이자
                </th>
                <th scope="col" className="sim-number">
                  비중
                </th>
              </tr>
            </thead>
            <tbody>
              {report.contributions.map((item) => {
                const status = accountStatus(item.status)
                return (
                  <tr key={item.accountId}>
                    <th scope="row" data-label="계좌" className="sim-account-name">
                      <span className="sim-kind">{accountKindLabel(item.kind)}</span>
                      <Link to={`/simulation/accounts/${encodeURIComponent(item.accountId)}`}>
                        {item.name}
                      </Link>
                    </th>
                    <td data-label="상태">
                      <span className={`sim-badge tone-${status.tone}`}>{status.label}</span>
                    </td>
                    <td data-label="연 금리">{rate(item.annualRate)}%</td>
                    <td data-label="넣은 원금" className="sim-number">
                      {item.principal === null ? '수시입출금' : won(item.principal)}
                    </td>
                    <td data-label="이자(세전)" className="sim-number">
                      {won(item.grossInterest)}
                    </td>
                    <td data-label="세금" className="sim-number">
                      {won(item.tax)}
                    </td>
                    <td data-label="세후 이자" className="sim-number">
                      {won(item.netInterest)}
                    </td>
                    <td data-label="비중" className="sim-number">
                      {sharePercent(item.sharePercent)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="sim-help">
          비중은 계좌마다 소수 둘째 자리에서 반올림해 합이 100%와 조금 다를 수 있습니다.
        </p>
      </section>

      <section aria-labelledby="sim-report-early">
        <h2 className="sim-section-title" id="sim-report-early">
          중도해지 손실
        </h2>
        {early.length === 0 ? (
          <p className="sim-empty-note">중도해지한 계좌가 없습니다.</p>
        ) : (
          <>
            <p className="sim-help">
              같은 기간을 약정 금리로 계산한 이자와 실제로 받은 중도해지 이자의 차이입니다.{' '}
              {`중도해지 ${early.length}건에서 세전 ${wonText(report.earlyClose.forgoneInterest)}, 세후 ${wonText(report.earlyClose.forgoneNetInterest)}을 덜 받았습니다.`}
            </p>
            <div className="sim-table-wrap">
              <table className="sim-table">
                <caption className="sim-sr-only">
                  중도해지 계좌별 약정 금리 이자와 실제 이자 비교
                </caption>
                <thead>
                  <tr>
                    <th scope="col">계좌</th>
                    <th scope="col">보유 기간</th>
                    <th scope="col">적용 이율</th>
                    <th scope="col" className="sim-number">
                      받은 이자(세전)
                    </th>
                    <th scope="col" className="sim-number">
                      약정 금리였다면
                    </th>
                    <th scope="col" className="sim-number">
                      덜 받은 이자(세전/세후)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {early.map((item) => {
                    const loss = item.earlyClose!
                    return (
                      <tr key={item.accountId}>
                        <th scope="row" data-label="계좌">
                          {item.name}
                        </th>
                        <td data-label="보유 기간">
                          {loss.elapsedMonths}개월 ({loss.elapsedDays}일) · {simDate(item.closedOn)}{' '}
                          해지
                        </td>
                        <td data-label="적용 이율">
                          연 {rate(loss.appliedRate)}%{' '}
                          <small>(약정 {rate(item.annualRate)}%)</small>
                        </td>
                        <td data-label="받은 이자(세전)" className="sim-number">
                          {won(loss.actualInterest)}
                        </td>
                        <td data-label="약정 금리였다면" className="sim-number">
                          {won(loss.contractRateInterest)}
                        </td>
                        <td data-label="덜 받은 이자(세전/세후)" className="sim-number sim-out">
                          {won(loss.forgoneInterest)} / {won(loss.forgoneNetInterest)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section aria-labelledby="sim-report-post">
        <h2 className="sim-section-title" id="sim-report-post">
          만기 후 경과 이율 비교 <small>교육용 가정값</small>
        </h2>
        <p className="sim-help">
          OMB 모의 운용은 만기일에 원리금을 자동으로 파킹통장에 넣습니다. 실제 은행에서는 만기 후
          찾지 않은 돈에 약정 금리보다 낮은 만기후이율을 주는 경우가 많습니다. 아래는 만기 지급액을
          그대로 두었다고 가정한 비교이며 실제 원장에는 반영되지 않습니다.
        </p>
        <div className="sim-report-tiers">
          <table className="sim-table">
            <caption>만기후이율 가정({report.reportRuleVersion}, 소수 셋째 자리 미만 절사)</caption>
            <thead>
              <tr>
                <th scope="col">만기 후 경과</th>
                <th scope="col">만기후이율</th>
              </tr>
            </thead>
            <tbody>
              {report.postMaturityRule.map((tier, index) => {
                const label = postMaturityTierLabel(tier, report.postMaturityRule[index + 1])
                return (
                  <tr key={tier.minMonths}>
                    <td data-label="만기 후 경과">{label.range}</td>
                    <td data-label="만기후이율">{label.rate}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {matured.length === 0 ? (
          <p className="sim-empty-note">만기 지급된 계좌가 없습니다.</p>
        ) : (
          <ul className="sim-report-post">
            {matured.map((item) => {
              const post = item.postMaturity!
              return (
                <li key={item.accountId}>
                  <h3>
                    {item.name}{' '}
                    <small>
                      만기 {simDate(post.maturityDate)} · 지급액 {won(post.payout)}
                    </small>
                  </h3>
                  <p>{postMaturitySummary(post, report.parkingRate)}</p>
                  <dl className="sim-summary compact">
                    <div>
                      <dt>만기 후 경과</dt>
                      <dd>
                        {post.monthsAfterMaturity}개월 ({post.daysAfterMaturity}일)
                      </dd>
                    </div>
                    <div>
                      <dt>만기후이율 가정</dt>
                      <dd>
                        연 {rate(post.appliedRate)}% · 세후 {won(post.netInterest)}
                      </dd>
                    </div>
                    <div>
                      <dt>파킹통장 금리 추정</dt>
                      <dd>
                        연 {rate(report.parkingRate)}% · 세후 {won(post.parkingNetInterest)}
                      </dd>
                    </div>
                  </dl>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="sim-report-events">
        <h2 className="sim-section-title" id="sim-report-events">
          운용 이벤트 <small>최신 30건</small>
        </h2>
        {sandbox.events.length ? (
          <ul className="sim-events">
            {sandbox.events.map((event) => (
              <li
                key={event.seq}
                className={event.type === 'MISSED_TRANSFER' ? 'is-warning' : undefined}
              >
                <time dateTime={event.date}>{simDate(event.date)}</time>
                <span
                  className={`sim-badge tone-${event.type === 'MISSED_TRANSFER' ? 'warn' : 'info'}`}
                >
                  {eventTypeLabel(event.type)}
                </span>
                <span>{event.message}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="sim-empty-note">이벤트가 없습니다.</p>
        )}
      </section>
    </div>
  )
}
