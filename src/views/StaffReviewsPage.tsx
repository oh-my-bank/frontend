import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ApiError, request } from '../lib/api'
import { dateTime, rate, statusLabel, won } from '../lib/format'
import {
  reviewLoadMessage,
  reviewStatuses,
  ruleResultLabel,
  statusFilter,
  type ReviewSummary,
} from '../lib/reviews'
import { useAuth } from '../stores/auth'
import AppIcon from '../components/AppIcon'
import ErrorNotice from '../components/ErrorNotice'
import '../styles/banking-records.css'
import '../styles/banking-admin.css'
import '../styles/staff-reviews.css'

export default function StaffReviewsPage() {
  const { refresh } = useAuth()
  const [params, setParams] = useSearchParams()
  const status = statusFilter(params.get('status'))
  const [items, setItems] = useState<ReviewSummary[]>([])
  const [pending, setPending] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [reload, setReload] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setPending(true)
    setError(null)
    const query = status ? `?status=${status}` : ''
    void request<{ items: ReviewSummary[] }>(`/reviews${query}`, { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setItems(result.items)
      })
      .catch((cause) => {
        if (controller.signal.aborted) return
        setError(cause)
        if (cause instanceof ApiError && cause.status === 403) void refresh().catch(() => null)
      })
      .finally(() => {
        if (!controller.signal.aborted) setPending(false)
      })
    return () => controller.abort()
  }, [status, reload])
  function choose(value: string | null) {
    setParams(value ? { status: value } : {}, { replace: true, state: { keepScroll: true } })
  }
  const filterLabel = reviewStatuses.find((item) => item.value === status)?.label ?? '전체'
  return (
    <>
      <section className="page-title bank-title-actions">
        <div>
          <h1>대출 심사</h1>
          <p>접수된 가상 대출 신청을 접수 순서대로 확인하고 모의 심사를 진행합니다.</p>
        </div>
        <Link to="/staff" className="button button-outline">
          직원 업무
          <AppIcon name="chevron" size={15} />
        </Link>
      </section>
      <div className="notice bank-admin-scope">
        교육용 모의 심사입니다. 규칙 MOCK_DSR_V1(이번 신청의 연간 원리금 ÷ 가상 연소득 ≤ 40%)은 심사
        시작 때 한 번 평가되며 실제 신용평가나 금융기관의 심사 기준이 아닙니다.
      </div>
      <section className="bank-record-section" aria-labelledby="staff-review-list-title">
        <div className="section-heading bank-admin-list-heading">
          <div>
            <h2 id="staff-review-list-title">
              심사 대상
              <span className="count-tag">{pending || error ? '—' : items.length}</span>
            </h2>
            <p>
              고객 이름은 첫 글자만 표시합니다. 신청을 선택하면 규칙 근거와 처리 이력을 확인할 수
              있습니다.
            </p>
          </div>
          <div className="staff-review-filters">
            {(
              [
                ['review', '심사 상태로 보기'],
                ['afterApproval', '승인 이후 진행 상태로 보기'],
              ] as const
            ).map(([stage, label]) => (
              <div key={stage} className="bank-admin-filter" role="group" aria-label={label}>
                {reviewStatuses
                  .filter((item) => item.stage === stage)
                  .map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      aria-pressed={status === item.value}
                      disabled={pending}
                      onClick={() => choose(item.value)}
                    >
                      {item.label}
                    </button>
                  ))}
              </div>
            ))}
          </div>
        </div>
        <ErrorNotice error={error} message={reviewLoadMessage(error)} />
        {pending ? (
          <div className="empty-state" role="status">
            심사 대상을 불러오고 있습니다.
          </div>
        ) : error ? (
          <div className="empty-state">
            <h3>심사 대상을 불러오지 못했습니다.</h3>
            <p>연결 상태와 계정 권한을 확인한 뒤 다시 시도해 주세요.</p>
            <button
              className="button button-outline small"
              onClick={() => setReload((value) => value + 1)}
            >
              다시 불러오기
            </button>
          </div>
        ) : !items.length ? (
          <div className="empty-state bank-empty-records">
            <AppIcon name="document" size={30} />
            <h3>
              {status ? `${filterLabel} 상태인 신청이 없습니다.` : '접수된 대출 신청이 없습니다.'}
            </h3>
            {status ? (
              <button className="text-button" onClick={() => choose(null)}>
                전체 신청 보기
              </button>
            ) : (
              <p>고객이 대출을 신청하면 이곳에 접수 순서대로 표시됩니다.</p>
            )}
          </div>
        ) : (
          <div className="bank-application-table-wrap">
            <table className="bank-application-table bank-admin-table">
              <caption className="bank-sr-only">심사 대상 신청 목록, {filterLabel}</caption>
              <thead>
                <tr>
                  <th scope="col">접수일시</th>
                  <th scope="col">고객</th>
                  <th scope="col">상품명</th>
                  <th scope="col" className="bank-amount-cell">
                    신청금액
                  </th>
                  <th scope="col">기간·금리</th>
                  <th scope="col">진행상태</th>
                  <th scope="col">규칙 결과</th>
                  <th scope="col">
                    <span className="bank-sr-only">상세 조회</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.applicationId}>
                    <td className="bank-date-cell" data-label="접수일시">
                      {dateTime(item.appliedAt)}
                    </td>
                    <td data-label="고객">{item.customer.maskedName}</td>
                    <td className="bank-product-cell" data-label="상품명">
                      <Link to={`/staff/reviews/${item.applicationId}`}>{item.productName}</Link>
                    </td>
                    <td className="bank-amount-cell" data-label="신청금액">
                      {won(item.requestedAmount)}
                    </td>
                    <td data-label="기간·금리">
                      {item.termMonths}개월 · 연 {rate(item.annualInterestRate)}%
                    </td>
                    <td data-label="진행상태">
                      <span className={`status-badge ${item.status.toLowerCase()}`}>
                        {statusLabel(item.status)}
                      </span>
                    </td>
                    <td data-label="규칙 결과">
                      <span
                        className={`staff-rule-tag ${item.ruleResult?.toLowerCase() ?? 'none'}`}
                      >
                        {ruleResultLabel(item.ruleResult)}
                      </span>
                    </td>
                    <td className="bank-detail-cell">
                      <Link
                        to={`/staff/reviews/${item.applicationId}`}
                        aria-label={`${item.customer.maskedName} 고객 ${item.productName} 심사 상세`}
                      >
                        {item.status === 'APPLIED' || item.status === 'UNDER_REVIEW'
                          ? '심사하기'
                          : '결과 보기'}
                        <AppIcon name="chevron" size={14} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
