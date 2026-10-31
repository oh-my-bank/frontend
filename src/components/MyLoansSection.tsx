import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { request } from '../lib/api'
import { won } from '../lib/format'
import { loanDate, loanBadgeClass, loanStatusLabel, type LoanSummary } from '../lib/loans'
import AppIcon from './AppIcon'
import ErrorNotice from './ErrorNotice'
import '../styles/loans.css'

/** The customer's executed mock loans on `/my`; only server records, never a projected balance. */
export default function MyLoansSection({ reload }: { reload: number }) {
  const [loans, setLoans] = useState<LoanSummary[]>([])
  const [pending, setPending] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setPending(true)
    setError(null)
    void request<{ items: LoanSummary[] }>('/loans', { signal: controller.signal })
      .then((result) => setLoans(result.items))
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(cause)
      })
      .finally(() => {
        if (!controller.signal.aborted) setPending(false)
      })
    return () => controller.abort()
  }, [reload, retry])

  return (
    <section className="bank-record-section" aria-labelledby="bank-loan-list-title">
      <div className="section-heading">
        <div>
          <h2 id="bank-loan-list-title">
            나의 모의 대출
            <span className="count-tag">{pending || error ? '—' : loans.length}</span>
          </h2>
          <p>약정 후 실행한 대출의 남은 원금과 다음 납부 회차입니다. 모두 가상 자금입니다.</p>
        </div>
      </div>
      <ErrorNotice error={error} />
      {pending ? (
        <div className="empty-state" role="status">
          대출 내역을 불러오고 있습니다.
        </div>
      ) : error ? (
        <div className="empty-state">
          <h3>대출 내역을 불러오지 못했습니다.</h3>
          <button
            className="button button-outline small"
            onClick={() => setRetry((value) => value + 1)}
          >
            다시 불러오기
          </button>
        </div>
      ) : loans.length === 0 ? (
        <div className="empty-state">
          <h3>실행한 대출이 없습니다.</h3>
          <p>모의 심사에서 승인된 신청을 약정하고 실행하면 이곳에 표시됩니다.</p>
        </div>
      ) : (
        <div className="bank-application-table-wrap bank-loan-table-wrap">
          <table className="bank-application-table">
            <caption className="bank-sr-only">나의 모의 대출 목록</caption>
            <thead>
              <tr>
                <th scope="col">상품명</th>
                <th scope="col" className="bank-amount-cell">
                  남은 원금
                </th>
                <th scope="col">납부</th>
                <th scope="col">다음 납부일 (가상)</th>
                <th scope="col">상태</th>
                <th scope="col">
                  <span className="bank-sr-only">상세 조회</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loans.map((loan) => (
                <tr key={loan.id}>
                  <td className="bank-product-cell" data-label="상품명">
                    <Link to={`/loans/${loan.id}`}>{loan.productName}</Link>
                  </td>
                  <td className="bank-amount-cell" data-label="남은 원금">
                    {won(loan.outstandingPrincipal)}
                  </td>
                  <td data-label="납부">
                    {loan.paidInstallments}/{loan.termMonths}회
                  </td>
                  <td className="bank-date-cell" data-label="다음 납부일">
                    {loan.nextInstallment
                      ? loanDate(loan.nextInstallment.dueDate)
                      : loanStatusLabel(loan.status)}
                  </td>
                  <td data-label="상태">
                    <span className={`status-badge ${loanBadgeClass(loan.status)}`}>
                      {loanStatusLabel(loan.status)}
                    </span>
                  </td>
                  <td className="bank-detail-cell">
                    <Link
                      to={`/loans/${loan.id}`}
                      aria-label={`${loan.productName} 대출 상세 조회`}
                    >
                      상세보기
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
  )
}
