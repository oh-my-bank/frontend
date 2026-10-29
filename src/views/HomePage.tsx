import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../stores/auth'
import { request } from '../lib/api'
import type { Product } from '../types'
import ProductCard from '../components/ProductCard'
import AppIcon from '../components/AppIcon'

function BankingIllustration() {
  return (
    <svg className="banking-illustration" viewBox="0 0 380 300" fill="none" aria-hidden="true">
      <ellipse cx="192" cy="263" rx="147" ry="17" fill="#daeae3" />
      <path d="M76 241V123L179 65l103 58v118H76Z" fill="#fff" stroke="#b9d5c8" strokeWidth="2" />
      <path
        d="m63 125 116-67 117 67"
        stroke="#198577"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M98 139h162v20H98z" fill="#dfede6" />
      <path d="M114 172v64m42-64v64m46-64v64m43-64v64" stroke="#60a28f" strokeWidth="15" />
      <path d="M68 245h223v10H68z" fill="#248878" />
      <path
        d="m167 107 10 9 19-23"
        stroke="#258977"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M285 216c-6-35-1-62 18-87 17 34 17 62-7 87" fill="#84b19b" />
      <path d="M292 229c-29-5-47-19-50-42 31-1 49 11 53 35" fill="#b7cdb0" />
      <path d="M293 198v48" stroke="#4b8771" strokeWidth="3" strokeLinecap="round" />
      <path d="M271 230h47l-6 29h-35l-6-29Z" fill="#f0d48e" />
      <circle cx="86" cy="72" r="22" fill="#f6d36e" />
      <path
        d="M75 72h22m-18-6 4 14 4-13 5 13 4-14"
        stroke="#a4802c"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M319 88h14m-7-7v14M51 170h11m-5-5v10"
        stroke="#9ec4af"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
export default function HomePage() {
  const { user } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [pending, setPending] = useState(true)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    void request<{ items: Product[] }>('/loan-products', { signal: controller.signal })
      .then((result) => setProducts(result.items))
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true)
      })
      .finally(() => {
        if (!controller.signal.aborted) setPending(false)
      })
    return () => controller.abort()
  }, [])
  const staff = !!user && user.role !== 'CUSTOMER'
  return (
    <>
      <section className="bank-home-top">
        <div className="bank-welcome-banner">
          <div className="welcome-copy">
            <span className="home-kicker">Oh My Bank · 개인금융</span>
            <h1>
              대출의 첫걸음,
              <br />
              <strong>조건 확인부터 시작하세요.</strong>
            </h1>
            <p>
              상품별 금리와 한도를 비교하고
              <br />
              나에게 필요한 조건으로 신청해 보세요.
            </p>
            <Link to="/products" className="banner-link">
              대출상품 알아보기
              <AppIcon name="arrow" size={18} />
            </Link>
          </div>
          <BankingIllustration />
          <span className="banner-footnote">가상의 금융상품으로 진행하는 학습용 서비스입니다.</span>
        </div>
        <aside className="bank-quick-panel" aria-labelledby="quick-title">
          <div className="quick-panel-title">
            <h2 id="quick-title">빠른 서비스</h2>
            <span>자주 찾는 업무</span>
          </div>
          <div className="quick-primary">
            <Link to="/products">
              <AppIcon name="document" size={27} />
              <strong>대출신청</strong>
              <span>상품 선택부터 접수까지</span>
            </Link>
            <Link to={staff ? '/staff' : '/my'}>
              <AppIcon name="search" size={27} />
              <strong>{staff ? '직원업무' : '신청조회'}</strong>
              <span>{staff ? '업무 범위 확인' : '나의 신청 내역 확인'}</span>
            </Link>
          </div>
          <div className="quick-secondary">
            <Link to="/products">
              <AppIcon name="layers" size={25} />
              <span>상품안내</span>
            </Link>
            <Link to="/guide">
              <AppIcon name="info" size={25} />
              <span>이용안내</span>
            </Link>
            <Link to={user ? (staff ? '/staff' : '/my') : '/login'}>
              <AppIcon name="shield" size={25} />
              <span>{user ? (staff ? '직원업무' : '나의 대출') : '로그인'}</span>
            </Link>
          </div>
        </aside>
      </section>
      <nav className="home-shortcuts" aria-label="금융 업무 바로가기">
        <Link to="/products">
          <strong>금융상품</strong>
          <span>금리·한도·기간 비교</span>
          <AppIcon name="chevron" size={19} />
        </Link>
        <Link to={staff ? '/staff' : '/my'}>
          <strong>{staff ? '직원 업무' : '나의 대출'}</strong>
          <span>{staff ? '이용 가능한 업무 확인' : '접수 내역과 상태 확인'}</span>
          <AppIcon name="chevron" size={19} />
        </Link>
        <Link to="/guide#application">
          <strong>신청 절차</strong>
          <span>상품 선택부터 접수까지</span>
          <AppIcon name="chevron" size={19} />
        </Link>
        <Link to="/guide#notice">
          <strong>이용 전 확인</strong>
          <span>가상 금융거래 안내</span>
          <AppIcon name="chevron" size={19} />
        </Link>
      </nav>
      <section className="home-product-section" aria-labelledby="home-products-title">
        <div className="section-heading">
          <div>
            <span className="section-caption">필요한 조건에 맞춰 선택하세요</span>
            <h2 id="home-products-title">OMB 대출상품</h2>
          </div>
          <Link to="/products" className="text-button">
            전체 상품 보기
            <AppIcon name="plus" size={17} />
          </Link>
        </div>
        {pending ? (
          <div className="empty-state" role="status">
            상품을 불러오고 있습니다.
          </div>
        ) : failed ? (
          <div className="notice">
            상품 정보를 불러오지 못했습니다. <Link to="/products">상품 조회에서 다시 확인하기</Link>
          </div>
        ) : products.length ? (
          <div className="product-grid">
            {products.slice(0, 3).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="empty-state">현재 신청 가능한 상품이 없습니다.</div>
        )}
      </section>
      <section className="home-bottom-grid">
        <div className="bank-notice-board">
          <div className="section-heading">
            <h2>이용 안내</h2>
            <Link to="/guide" className="text-button" aria-label="이용 안내 더 보기">
              <AppIcon name="plus" size={20} />
            </Link>
          </div>
          <ul>
            <li>
              <Link to="/guide#notice">
                <span>실제 개인정보와 금융정보를 입력하지 마세요.</span>
                <AppIcon name="chevron" size={15} />
              </Link>
            </li>
            <li>
              <Link to="/guide#application">
                <span>대출 신청 및 진행 상태 확인 방법</span>
                <AppIcon name="chevron" size={15} />
              </Link>
            </li>
            <li>
              <Link to="/guide#scope">
                <span>현재 이용 가능한 서비스 안내</span>
                <AppIcon name="chevron" size={15} />
              </Link>
            </li>
          </ul>
        </div>
        <div className="home-help-panel">
          <AppIcon name="shield" size={35} />
          <div>
            <h2>금융을 배우는 안전한 방법</h2>
            <p>
              실제 자금 이동 없이 가상 정보로
              <br />
              금융업무의 흐름을 경험하세요.
            </p>
            <Link to="/guide#notice" className="text-button">
              시뮬레이션 안내
              <AppIcon name="arrow" size={16} />
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
