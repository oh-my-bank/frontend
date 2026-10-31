import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ApiError, request } from '../lib/api'
import { rate, won } from '../lib/format'
import { loanDate, loanBadgeClass, loanStatusLabel } from '../lib/loans'
import {
  staffLoanFilter,
  staffLoanLoadMessage,
  staffLoanStatuses,
  staffLoansPath,
  type StaffLoanSummary,
} from '../lib/staffLoans'
import { useAuth } from '../stores/auth'
import AppIcon from '../components/AppIcon'
import ErrorNotice from '../components/ErrorNotice'
import '../styles/banking-records.css'
import '../styles/banking-admin.css'
import '../styles/staff-reviews.css'

export default function StaffLoansPage() {
  const { refresh } = useAuth()
  const [params, setParams] = useSearchParams()
  const status = staffLoanFilter(params.get('status'))
  const [items, setItems] = useState<StaffLoanSummary[]>([])
  const [pending, setPending] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [reload, setReload] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setPending(true)
    setError(null)
    void request<{ items: StaffLoanSummary[] }>(staffLoansPath(status), {
      signal: controller.signal,
    })
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
  const filterLabel = staffLoanStatuses.find((item) => item.value === status)?.label ?? '전체'
  return (
    <>
      <section className="page-title bank-title-actions">
        <div>
          <h1>대출 계정 조회</h1>
          <p>실행된 가상 대출의 남은 원금, 납부 회차와 거래원장 대사 결과를 조회합니다.</p>
        </div>
        <Link to="/staff" className="button button-outline">
          직원 업무
          <AppIcon name="chevron" size={15} />
        </Link>
      </section>
      <div className="notice bank-admin-scope">
        대출 계정을 조회합니다. 운영 관리자는 상세 화면에서 가장 최근 납부를 반대 거래로 취소할 수
        있습니다. 모든 금액과 날짜는 교육용 시뮬레이션의 가상 데이터입니다.
      </div>
      <section className="bank-record-section" aria-labelledby="staff-loan-list-title">
        <div className="section-heading bank-admin-list-heading">
          <div>
            <h2 id="staff-loan-list-title">
              대출 계정
              <span className="count-tag">{pending || error ? '—' : items.length}</span>
            </h2>
            <p>최근 실행한 대출부터 표시합니다. 고객 이름은 첫 글자만 표시합니다.</p>
          </div>
          <div className="bank-admin-filter" role="group" aria-label="대출 상태로 보기">
            {staffLoanStatuses.map((item) => (
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
        </div>
        <ErrorNotice error={error} message={staffLoanLoadMessage(error)} />
        {pending ? (
          <div className="empty-state" role="status">
            대출 계정을 불러오고 있습니다.
          </div>
        ) : error ? (
          <div className="empty-state">
            <h3>대출 계정을 불러오지 못했습니다.</h3>
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
            <h3>{status ? `${filterLabel} 상태인 대출이 없습니다.` : '실행된 대출이 없습니다.'}</h3>
            {status ? (
              <button className="text-button" onClick={() => choose(null)}>
                전체 대출 보기
              </button>
            ) : (
              <p>고객이 약정 후 대출을 실행하면 이곳에 표시됩니다.</p>
            )}
          </div>
        ) : (
          <div className="bank-application-table-wrap">
            <table className="bank-application-table bank-admin-table">
              <caption className="bank-sr-only">대출 계정 목록, {filterLabel}</caption>
              <thead>
                <tr>
                  <th scope="col">실행일 (가상)</th>
                  <th scope="col">고객</th>
                  <th scope="col">상품명</th>
                  <th scope="col" className="bank-amount-cell">
                    대출 원금
                  </th>
                  <th scope="col" className="bank-amount-cell">
                    남은 원금
                  </th>
                  <th scope="col">납부·금리</th>
                  <th scope="col">상태</th>
                  <th scope="col">
                    <span className="bank-sr-only">상세 조회</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map(({ customer, loan }) => (
                  <tr key={loan.id}>
                    <td className="bank-date-cell" data-label="실행일 (가상)">
                      {loanDate(loan.executedOn)}
                    </td>
                    <td data-label="고객">{customer.maskedName}</td>
                    <td className="bank-product-cell" data-label="상품명">
                      <Link to={`/staff/loans/${loan.id}`}>{loan.productName}</Link>
                    </td>
                    <td className="bank-amount-cell" data-label="대출 원금">
                      {won(loan.principal)}
                    </td>
                    <td className="bank-amount-cell" data-label="남은 원금">
                      {won(loan.outstandingPrincipal)}
                    </td>
                    <td data-label="납부·금리">
                      {loan.paidInstallments}/{loan.termMonths}회 · 연{' '}
                      {rate(loan.annualInterestRate)}%
                    </td>
                    <td data-label="상태">
                      <span className={`status-badge ${loanBadgeClass(loan.status)}`}>
                        {loanStatusLabel(loan.status)}
                      </span>
                    </td>
                    <td className="bank-detail-cell">
                      <Link
                        to={`/staff/loans/${loan.id}`}
                        aria-label={`${customer.maskedName} 고객 ${loan.productName} 대출 상세`}
                      >
                        상세 보기
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
