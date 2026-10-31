import { Link } from 'react-router-dom'
import { useAuth } from '../stores/auth'
import AppIcon from '../components/AppIcon'
import '../styles/banking-records.css'

export default function StaffPage() {
  const { user } = useAuth()
  const admin = user?.role === 'ADMIN'
  const roleName = admin ? '운영 관리자' : '심사 담당자'
  return (
    <>
      <section className="page-title bank-title-actions">
        <div>
          <h1>직원 업무</h1>
          <p>로그인한 직원의 권한과 현재 이용 가능한 업무를 안내합니다.</p>
        </div>
        <span className="bank-staff-role">{roleName}</span>
      </section>
      <section className="bank-staff-account panel" aria-labelledby="bank-staff-account-title">
        <div className="bank-staff-account-title">
          <AppIcon name="shield" size={23} />
          <h2 id="bank-staff-account-title">직원 계정 정보</h2>
        </div>
        <dl className="details-list">
          <div>
            <dt>사용자</dt>
            <dd>{user?.name}</dd>
          </div>
          <div>
            <dt>이메일</dt>
            <dd>{user?.email}</dd>
          </div>
          <div>
            <dt>업무 권한</dt>
            <dd>{roleName}</dd>
          </div>
        </dl>
      </section>
      <section className="bank-record-section" aria-labelledby="bank-staff-scope-title">
        <div className="section-heading">
          <div>
            <h2 id="bank-staff-scope-title">업무 서비스 안내</h2>
            <p>현재 제공하는 기능과 준비 중인 업무를 확인하세요.</p>
          </div>
        </div>
        <div className="bank-staff-scope-grid bank-staff-scope-grid-wide">
          <section className="bank-staff-scope">
            <span className="bank-scope-state">이용 가능</span>
            <h3>대출 심사</h3>
            <p>
              접수된 신청의 모의 심사를 시작하고 규칙 근거를 확인해 승인·거절하며 처리 이력을
              조회합니다.
            </p>
            <Link to="/staff/reviews" className="text-button">
              심사하기
              <AppIcon name="arrow" size={16} />
            </Link>
          </section>
          <section className="bank-staff-scope">
            <span className="bank-scope-state">이용 가능</span>
            <h3>대출상품 조회</h3>
            <p>등록된 상품의 금리·한도·기간과 상품 조건 버전을 확인할 수 있습니다.</p>
            <Link to="/products" className="text-button">
              상품 조회하기
              <AppIcon name="arrow" size={16} />
            </Link>
          </section>
          <section className="bank-staff-scope">
            <span className="bank-scope-state">이용 가능</span>
            <h3>운영 현황</h3>
            <p>
              저장된 가상 신청·심사 기록의 상태별·상품별 건수, 승인율과 일별 추이를 확인할 수
              있습니다.
            </p>
            <Link to="/staff/dashboard" className="text-button">
              운영 현황 보기
              <AppIcon name="arrow" size={16} />
            </Link>
          </section>
          {admin && (
            <section className="bank-staff-scope">
              <span className="bank-scope-state">이용 가능</span>
              <h3>상품 관리</h3>
              <p>
                상품 등록, 새 정책 버전 발행, 판매 중지와 정책 버전 이력 조회를 이용할 수 있습니다.
              </p>
              <Link to="/admin/products" className="text-button">
                상품 관리하기
                <AppIcon name="arrow" size={16} />
              </Link>
            </section>
          )}
          <section className="bank-staff-scope bank-staff-pending">
            <span className="bank-scope-state">준비 중</span>
            <h3>운영 관리</h3>
            <ul>
              <li>거래 모니터링 및 감사 로그 조회</li>
            </ul>
            <p className="bank-section-help">
              업무 기능과 권한 검증을 구현한 후 제공합니다.
              {!admin && ' 상품 등록·정책 관리는 운영 관리자 계정에서 이용할 수 있습니다.'}
            </p>
          </section>
        </div>
      </section>
      <div className="notice bank-staff-notice">
        대출 신청은 고객 계정에서만 이용할 수 있습니다. 이 서비스는 가상 금융거래를 학습하는
        시뮬레이션입니다.
      </div>
    </>
  )
}
