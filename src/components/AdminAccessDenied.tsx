import { Link, useLocation } from 'react-router-dom'
import type { Role } from '../types'
import AppIcon from './AppIcon'
import '../styles/banking-admin.css'

/** Shown instead of an administrator screen; the server rejects these APIs for the role as well. */
export default function AdminAccessDenied({ role }: { role: Role }) {
  const customer = role === 'CUSTOMER'
  const audit = useLocation().pathname.startsWith('/admin/audit')
  return (
    <>
      <section className="page-title">
        <h1>{audit ? '감사 로그' : '상품 관리'}</h1>
        <p>운영 관리자 전용 업무입니다.</p>
      </section>
      <section className="empty-state bank-admin-denied" aria-labelledby="bank-admin-denied-title">
        <AppIcon name="shield" size={32} />
        <h2 id="bank-admin-denied-title">이 화면을 이용할 권한이 없습니다.</h2>
        <p>
          {audit
            ? '감사 로그 조회는 운영 관리자 계정에서만 이용할 수 있습니다.'
            : '상품 등록·정책 발행·판매 중지는 운영 관리자 계정에서만 이용할 수 있습니다.'}
          {customer
            ? ' 고객 계정은 상품 조회와 대출 신청을 이용해 주세요.'
            : ' 심사 담당자 업무는 직원 업무에서 확인해 주세요.'}
        </p>
        <Link to={customer ? '/my' : '/staff'} className="button button-outline">
          {customer ? '나의 대출로 이동' : '직원 업무로 이동'}
        </Link>
      </section>
    </>
  )
}
