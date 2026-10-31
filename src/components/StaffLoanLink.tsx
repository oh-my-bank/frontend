import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { request } from '../lib/api'
import { won } from '../lib/format'
import { loanStatusLabel } from '../lib/loans'
import { staffLoansPath, type StaffLoanSummary } from '../lib/staffLoans'
import AppIcon from './AppIcon'

const EXECUTED = ['EXECUTED', 'REPAYING', 'PAID_OFF']

/** On a review whose application was executed, links staff to the loan account. Shows nothing before execution or on failure. */
export default function StaffLoanLink({
  applicationId,
  status,
}: {
  applicationId: string
  status: string
}) {
  const [item, setItem] = useState<StaffLoanSummary | null>(null)
  const executed = EXECUTED.includes(status)
  useEffect(() => {
    setItem(null)
    if (!executed) return
    const controller = new AbortController()
    void request<{ items: StaffLoanSummary[] }>(staffLoansPath(null, applicationId), {
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted) setItem(result.items[0] ?? null)
      })
      .catch(() => null)
    return () => controller.abort()
  }, [applicationId, executed])
  if (!item) return null
  return (
    <div className="notice bank-admin-scope" role="status">
      이 신청은 대출로 실행되었습니다({loanStatusLabel(item.loan.status)}, 남은 원금{' '}
      {won(item.loan.outstandingPrincipal)}).{' '}
      <Link to={`/staff/loans/${item.loan.id}`} className="text-button">
        대출 계정 보기
        <AppIcon name="arrow" size={15} />
      </Link>
    </div>
  )
}
