import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError, request } from '../lib/api'
import { staffLoanLoadMessage, type StaffLoanDetail } from '../lib/staffLoans'
import { useAuth } from '../stores/auth'
import AppIcon from '../components/AppIcon'
import ErrorNotice from '../components/ErrorNotice'
import { LoanRecordTabs, LoanStatement } from '../components/LoanRecords'
import '../styles/banking-records.css'
import '../styles/banking-admin.css'

export default function StaffLoanPage() {
  const { id } = useParams()
  const { refresh } = useAuth()
  const path = `/staff/loans/${encodeURIComponent(id ?? '')}`
  const [detail, setDetail] = useState<StaffLoanDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [reload, setReload] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    void request<StaffLoanDetail>(path, { signal: controller.signal })
      .then(setDetail)
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        setError(cause)
        if (cause instanceof ApiError && cause.status === 403) void refresh().catch(() => null)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [path, reload])
  const loan = detail?.loan
  return (
    <>
      <section className="page-title bank-title-actions">
        <div>
          <h1>대출 계정 상세</h1>
          <p>고객의 모의 대출 상환 일정과 거래원장·대사 결과를 조회합니다. 변경할 수 없습니다.</p>
        </div>
        <Link to="/staff/loans" className="button button-outline">
          대출 계정 목록
          <AppIcon name="chevron" size={15} />
        </Link>
      </section>
      {loading && !detail ? (
        <div className="empty-state" role="status">
          대출 정보를 불러오고 있습니다.
        </div>
      ) : error || !detail || !loan ? (
        <>
          <ErrorNotice error={error} message={staffLoanLoadMessage(error)} />
          <div className="bank-record-retry">
            <button
              className="button button-outline"
              onClick={() => setReload((value) => value + 1)}
            >
              다시 불러오기
            </button>
          </div>
        </>
      ) : (
        <>
          <LoanStatement
            loan={loan}
            loading={loading}
            extra={
              <>
                <div>
                  <dt>고객</dt>
                  <dd>
                    {detail.customer.maskedName}{' '}
                    <span className="bank-section-help">(고객 ID {detail.customer.id})</span>
                  </dd>
                </div>
                <div>
                  <dt>심사·신청</dt>
                  <dd>
                    <Link to={`/staff/reviews/${loan.applicationId}`}>심사 상세 보기</Link>
                  </dd>
                </div>
              </>
            }
          />
          <LoanRecordTabs loan={loan} ledgerPath={`${path}/ledger`} />
          <section className="bank-record-notice" aria-labelledby="staff-loan-notice-title">
            <AppIcon name="info" size={21} />
            <div>
              <h2 id="staff-loan-notice-title">확인해 주세요</h2>
              <p>
                {loan.notice} 직원 화면은 조회 전용이며 고객 이메일·연소득 등 개인정보를 표시하지
                않습니다.
              </p>
            </div>
          </section>
        </>
      )}
    </>
  )
}
