import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../stores/auth'
import { request } from '../lib/api'
import { dateTime, statusLabel, won } from '../lib/format'
import type { LoanApplication, Product } from '../types'
import AppIcon from '../components/AppIcon'
import ErrorNotice from '../components/ErrorNotice'
import ProductCard from '../components/ProductCard'

export default function DashboardPage() {
  const { user } = useAuth()
  const [applications, setApplications] = useState<LoanApplication[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [pending, setPending] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [reload, setReload] = useState(0)
  const inReview = applications.filter((item) =>
    ['APPLIED', 'UNDER_REVIEW'].includes(item.status),
  ).length
  const approved = applications.filter((item) => item.status === 'APPROVED').length

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    setPending(true)
    setError(null)
    void Promise.all([
      request<{ items: Product[] }>('/loan-products', { signal: controller.signal }),
      user?.role === 'CUSTOMER'
        ? request<{ items: LoanApplication[] }>('/loan-applications', { signal: controller.signal })
        : Promise.resolve({ items: [] as LoanApplication[] }),
    ])
      .then(([productResult, applicationResult]) => {
        if (!active) return
        setProducts(productResult.items)
        setApplications(applicationResult.items)
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
  }, [user?.id, user?.role, reload])

  return (
    <>
      <section className="page-heading">
        <div>
          <span className="eyebrow">MY OVERVIEW</span>
          <h1>
            {user?.name}님, 반가워요<span className="heading-dot">.</span>
          </h1>
          <p>오늘도 차근차근, 나의 금융 흐름을 알아가요.</p>
        </div>
        <span className="simulation-pill">
          <span className="live-dot" />
          SIMULATION MODE
        </span>
      </section>
      <ErrorNotice error={error} />
      {error ? (
        <button
          className="text-button retry-button"
          onClick={() => setReload((value) => value + 1)}
        >
          다시 불러오기
        </button>
      ) : null}
      {user?.role !== 'CUSTOMER' && (
        <div className="info-banner">
          직원 계정으로 로그인했습니다. 현재 고객 신청 기능까지 제공하며, 심사·상품 관리 기능은 다음
          단계에서 연결합니다. <Link to="/staff">직원 업무 범위 확인 →</Link>
        </div>
      )}
      <section className="journey-banner">
        <div>
          <span className="tiny-label">ONE STEP AT A TIME</span>
          <h2>
            나에게 맞는 상품부터,
            <br />첫 금융 여정을 시작해 보세요.
          </h2>
          <p>실제 돈은 움직이지 않아요. 경험과 이해만 쌓이죠.</p>
          <Link className="button button-lime" to="/products">
            금융상품 둘러보기
            <AppIcon name="arrow" size={18} />
          </Link>
        </div>
        <div className="journey-illustration" aria-hidden="true">
          <div className="mini-card card-back">
            <span>
              FINANCIAL
              <br />
              CONFIDENCE
            </span>
          </div>
          <div className="mini-card card-front">
            <span>oh my bank.</span>
            <div className="mini-card-chip" />
            <strong>나의 첫 금융 경험</strong>
            <small>EVERY STEP COUNTS</small>
          </div>
          <div className="spark">✳</div>
        </div>
      </section>
      <section className="stats-grid" aria-label="나의 신청 현황" aria-busy={pending}>
        <div className="stat-card">
          <div className="stat-top">
            <span>전체 신청</span>
            <AppIcon name="document" />
          </div>
          <strong>
            {pending || error ? '—' : applications.length}
            <small>건</small>
          </strong>
          <p>접수된 나의 대출 신청</p>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            <span>심사 대기·진행</span>
            <AppIcon name="clock" />
          </div>
          <strong>
            {pending || error ? '—' : inReview}
            <small>건</small>
          </strong>
          <p>신청 완료 및 심사 중인 건</p>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            <span>심사 승인</span>
            <AppIcon name="check" />
          </div>
          <strong>
            {pending || error ? '—' : approved}
            <small>건</small>
          </strong>
          <p>승인 결과가 등록된 건</p>
        </div>
      </section>
      <section className="section-block">
        <div className="section-heading">
          <div>
            <h2>
              나의 신청 내역
              <span className="count-tag">{pending || error ? '—' : applications.length}</span>
            </h2>
            <p>접수부터 결과까지, 진행 상황을 확인하세요.</p>
          </div>
        </div>
        {pending ? (
          <div className="empty-state" role="status">
            신청 내역을 불러오고 있어요…
          </div>
        ) : error ? (
          <div className="empty-state">서버에 연결되면 나의 신청 내역이 표시됩니다.</div>
        ) : applications.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">
              <AppIcon name="document" size={27} />
            </span>
            <h3>아직 신청한 대출이 없어요.</h3>
            <p>상품의 조건을 확인하고 첫 신청을 시작해 보세요.</p>
            <Link to="/products" className="text-button">
              상품 살펴보기 <AppIcon name="arrow" size={16} />
            </Link>
          </div>
        ) : (
          <div className="application-list">
            {applications.map((item) => (
              <Link key={item.id} to={`/applications/${item.id}`} className="application-row">
                <span className="application-row-icon">
                  <AppIcon name="document" />
                </span>
                <div className="application-row-name">
                  <strong>{item.productName}</strong>
                  <small>
                    {dateTime(item.createdAt)} · {item.termMonths}개월
                  </small>
                </div>
                <strong className="application-amount">{won(item.requestedAmount)}</strong>
                <span className={`status-badge ${item.status.toLowerCase()}`}>
                  {statusLabel(item.status)}
                </span>
                <AppIcon name="chevron" size={18} />
              </Link>
            ))}
          </div>
        )}
      </section>
      {products.length > 0 && (
        <section className="section-block">
          <div className="section-heading">
            <div>
              <span className="eyebrow">FIND YOUR NEXT STEP</span>
              <h2>이런 금융상품은 어때요?</h2>
            </div>
            <Link to="/products" className="text-button">
              전체 보기 <AppIcon name="arrow" size={16} />
            </Link>
          </div>
          <div className="product-grid">
            {products.slice(0, 3).map((product, index) => (
              <ProductCard key={product.id} product={product} index={index} />
            ))}
          </div>
        </section>
      )}
      <div className="learning-note">
        <AppIcon name="shield" size={20} />
        <p>
          Oh My Bank는 금융 업무를 배우기 위한 시뮬레이션이에요.
          <br />
          <span>상품 조건과 심사 결과는 가상의 규칙이며, 실제 대출 가능 여부와 관계없습니다.</span>
        </p>
      </div>
    </>
  )
}
