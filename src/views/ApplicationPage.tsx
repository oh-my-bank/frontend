import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { request } from '../lib/api'
import { dateTime, rate, statusLabel, won } from '../lib/format'
import type { LoanApplication } from '../types'
import AppIcon from '../components/AppIcon'
import ErrorNotice from '../components/ErrorNotice'
import ApplicationDecisionPanel from '../components/ApplicationDecisionPanel'
import LoanLifecyclePanel, { type LifecycleReport } from '../components/LoanLifecyclePanel'
import ProgressSteps from '../components/ProgressSteps'
import '../styles/banking-records.css'

export default function ApplicationPage() {
  const { id } = useParams()
  const [application, setApplication] = useState<LoanApplication | null>(null)
  const [pending, setPending] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [reload, setReload] = useState(0)
  // Set by an agreement or execution step; kept across the reload that step triggers.
  const [lifecycleMessage, setLifecycleMessage] = useState<Parameters<LifecycleReport>[0] | null>(
    null,
  )
  const lifecycleChanged: LifecycleReport = (message) => {
    setLifecycleMessage(message)
    setReload((value) => value + 1)
  }
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
      <section className="page-title bank-title-actions">
        <div>
          <h1>대출 신청 내역</h1>
          <p>접수한 신청의 조건과 현재 진행 상태를 확인하세요.</p>
        </div>
        <Link to="/my" className="button button-outline">
          나의 대출
          <AppIcon name="chevron" size={15} />
        </Link>
      </section>
      {application && !pending && <ProgressSteps current={3} />}
      {lifecycleMessage && (
        <div
          className={lifecycleMessage.tone === 'success' ? 'bank-admin-success' : 'notice'}
          role={lifecycleMessage.tone === 'success' ? 'status' : 'alert'}
        >
          {lifecycleMessage.tone === 'success' && <AppIcon name="check" size={19} />}
          <p>{lifecycleMessage.text}</p>
        </div>
      )}
      <ErrorNotice error={error} />
      {error && (
        <div className="bank-record-retry">
          <button className="button button-outline" onClick={() => setReload((value) => value + 1)}>
            다시 불러오기
          </button>
        </div>
      )}
      {pending && (
        <div className="empty-state" role="status">
          신청 정보를 불러오고 있습니다.
        </div>
      )}
      {application && !pending && (
        <>
          <section className="bank-statement" aria-labelledby="bank-statement-title">
            <div className="bank-statement-heading">
              <div>
                <span>신청 상품</span>
                <h2 id="bank-statement-title">{application.productName}</h2>
              </div>
              <span className={`status-badge ${application.status.toLowerCase()}`}>
                {statusLabel(application.status)}
              </span>
            </div>
            <dl className="bank-statement-summary">
              <div>
                <dt>신청금액</dt>
                <dd className="bank-statement-principal">{won(application.requestedAmount)}</dd>
              </div>
              <div>
                <dt>신청 당시 금리</dt>
                <dd>
                  연 {rate(application.annualInterestRate)}
                  <small>%</small>
                </dd>
              </div>
              <div>
                <dt>신청기간</dt>
                <dd>
                  {application.termMonths}
                  <small>개월</small>
                </dd>
              </div>
            </dl>
            <div className="bank-statement-body">
              <h3>신청 정보</h3>
              <dl className="details-list">
                <div>
                  <dt>신청번호</dt>
                  <dd className="monospace">{application.id}</dd>
                </div>
                <div>
                  <dt>접수일시</dt>
                  <dd>{dateTime(application.createdAt)}</dd>
                </div>
                <div>
                  <dt>상환방식</dt>
                  <dd>원리금균등분할상환</dd>
                </div>
                <div>
                  <dt>적용 상품 조건</dt>
                  <dd>버전 {application.policyVersion}</dd>
                </div>
              </dl>
              <p className="bank-section-help">
                표시된 금리와 상품 조건은 신청 시점에 보관한 내용입니다. 모의 심사에서 승인되면 확정
                조건이 아래에 표시됩니다.
              </p>
            </div>
          </section>
          <ApplicationDecisionPanel application={application} />
          <LoanLifecyclePanel application={application} onChanged={lifecycleChanged} />
          <section className="bank-record-notice" aria-labelledby="bank-application-notice-title">
            <AppIcon name="info" size={21} />
            <div>
              <h2 id="bank-application-notice-title">확인해 주세요</h2>
              <p>
                신청 접수 → 모의 심사 → 약정 → 대출 실행 → 회차 상환까지 이용할 수 있습니다. 모든
                금액은 가상 자금이고 날짜는 가상 날짜이며 실제 자금 이동은 발생하지 않습니다.
              </p>
            </div>
          </section>
          <div className="bank-bottom-action">
            <Link to="/my" className="button button-primary">
              신청 내역 목록
            </Link>
            <Link to="/products" className="button button-outline">
              다른 상품 보기
            </Link>
          </div>
        </>
      )}
    </>
  )
}
