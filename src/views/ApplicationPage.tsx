import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { request } from '../lib/api'
import { dateTime, rate, statusLabel, won } from '../lib/format'
import type { LoanApplication } from '../types'
import AppIcon from '../components/AppIcon'
import ErrorNotice from '../components/ErrorNotice'

export default function ApplicationPage() {
  const { id } = useParams()
  const [application, setApplication] = useState<LoanApplication | null>(null)
  const [pending, setPending] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    setPending(true)
    setError(null)
    setApplication(null)
    void request<LoanApplication>(`/loan-applications/${encodeURIComponent(id ?? '')}`, {
      signal: controller.signal,
    })
      .then((result) => {
        if (active) setApplication(result)
      })
      .catch((cause: unknown) => {
        if (active && !controller.signal.aborted) setError(cause)
      })
      .finally(() => {
        if (active) setPending(false)
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [id, reload])

  return (
    <>
      <Link to="/" className="back-link">
        ← 내 대시보드
      </Link>
      <ErrorNotice error={error} />
      {error ? (
        <button className="text-button" onClick={() => setReload((value) => value + 1)}>
          다시 불러오기
        </button>
      ) : null}
      {pending && (
        <div className="empty-state" role="status">
          신청 정보를 불러오고 있어요…
        </div>
      )}
      {application && !pending && (
        <>
          <section className="confirmation-heading">
            <span className="success-mark">
              <AppIcon name="check" size={30} />
            </span>
            <span className="eyebrow">YOUR FINANCIAL JOURNEY</span>
            <h1>
              신청 내역을 확인하세요<span className="heading-dot">.</span>
            </h1>
            <p>신청 조건과 현재 진행 상태를 한곳에서 확인할 수 있어요.</p>
          </section>
          <section className="application-detail-card">
            <div className="section-heading">
              <div>
                <span className="eyebrow">APPLICATION DETAILS</span>
                <h2>{application.productName}</h2>
              </div>
              <span className={`status-badge ${application.status.toLowerCase()}`}>
                {statusLabel(application.status)}
              </span>
            </div>
            <div className="application-principal">
              <small>신청 금액</small>
              <strong>{won(application.requestedAmount)}</strong>
            </div>
            <dl className="details-list">
              <div>
                <dt>신청 번호</dt>
                <dd className="monospace">{application.id}</dd>
              </div>
              <div>
                <dt>신청 시각</dt>
                <dd>{dateTime(application.createdAt)}</dd>
              </div>
              <div>
                <dt>신청 기간</dt>
                <dd>{application.termMonths}개월</dd>
              </div>
              <div>
                <dt>신청 당시 금리</dt>
                <dd>연 {rate(application.annualInterestRate)}%</dd>
              </div>
              <div>
                <dt>상품 정책</dt>
                <dd>v{application.policyVersion} · 신청 당시 조건 보존</dd>
              </div>
              <div>
                <dt>상환 방식</dt>
                <dd>원리금균등분할상환</dd>
              </div>
            </dl>
            <div className="info-banner">
              현재 단계에서는 신청 접수와 내역 조회를 제공합니다. 모의 심사, 약정, 대출 실행·상환은
              다음 단계에서 순차적으로 연결합니다.
            </div>
            <Link to="/" className="button button-dark">
              대시보드로 돌아가기 <AppIcon name="arrow" size={18} />
            </Link>
          </section>
        </>
      )}
    </>
  )
}
