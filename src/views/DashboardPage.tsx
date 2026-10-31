import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../stores/auth'
import { request } from '../lib/api'
import { dateTime, statusLabel, won } from '../lib/format'
import type { LoanApplication, Product } from '../types'
import AppIcon from '../components/AppIcon'
import ErrorNotice from '../components/ErrorNotice'
import ProductCard from '../components/ProductCard'
import MyLearningSection from '../components/MyLearningSection'
import MyLoansSection from '../components/MyLoansSection'
import '../styles/banking-records.css'

export default function DashboardPage() {
  const { user } = useAuth()
  const [applications, setApplications] = useState<LoanApplication[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [pending, setPending] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [productError, setProductError] = useState<unknown>(null)
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
    setProductError(null)
    void Promise.allSettled([
      request<{ items: Product[] }>('/loan-products', { signal: controller.signal }),
      request<{ items: LoanApplication[] }>('/loan-applications', { signal: controller.signal }),
    ]).then(([productResult, applicationResult]) => {
      if (!active) return
      if (productResult.status === 'fulfilled') setProducts(productResult.value.items)
      else setProductError(productResult.reason)
      if (applicationResult.status === 'fulfilled') setApplications(applicationResult.value.items)
      else setError(applicationResult.reason)
      setPending(false)
    })
    return () => {
      active = false
      controller.abort()
    }
  }, [user?.id, reload])

  return (
    <>
      <section className="page-title bank-title-actions">
        <div>
          <h1>나의 대출</h1>
          <p>{user?.name}님의 대출 신청 내역과 진행 상태를 확인하세요.</p>
        </div>
        <Link to="/products" className="button button-primary">
          대출상품 알아보기
          <AppIcon name="arrow" size={17} />
        </Link>
      </section>

      <section className="bank-overview" aria-labelledby="bank-overview-title" aria-busy={pending}>
        <div className="bank-overview-heading">
          <h2 id="bank-overview-title">대출 신청 현황</h2>
          <span>내가 신청한 내역을 기준으로 표시합니다.</span>
        </div>
        <div className="bank-overview-counts">
          <div>
            <span>전체 신청</span>
            <strong>
              {pending || error ? '—' : applications.length}
              <small>건</small>
            </strong>
          </div>
          <div>
            <span>접수 · 심사 진행</span>
            <strong>
              {pending || error ? '—' : inReview}
              <small>건</small>
            </strong>
          </div>
          <div>
            <span>심사 승인</span>
            <strong>
              {pending || error ? '—' : approved}
              <small>건</small>
            </strong>
          </div>
        </div>
      </section>

      <section className="bank-record-section" aria-labelledby="bank-application-list-title">
        <div className="section-heading">
          <div>
            <h2 id="bank-application-list-title">
              신청 내역
              <span className="count-tag">{pending || error ? '—' : applications.length}</span>
            </h2>
            <p>상품을 선택하면 접수 당시의 신청 조건을 확인할 수 있습니다.</p>
          </div>
        </div>
        <ErrorNotice error={error} />
        {pending ? (
          <div className="empty-state" role="status">
            신청 내역을 불러오고 있습니다.
          </div>
        ) : error ? (
          <div className="empty-state">
            <h3>신청 내역을 불러오지 못했습니다.</h3>
            <p>연결 상태를 확인하고 다시 시도해 주세요.</p>
            <button
              className="button button-outline small"
              onClick={() => setReload((value) => value + 1)}
            >
              다시 불러오기
            </button>
          </div>
        ) : applications.length === 0 ? (
          <div className="empty-state bank-empty-records">
            <AppIcon name="document" size={30} />
            <h3>아직 신청한 대출이 없습니다.</h3>
            <p>상품별 금리와 한도를 확인하고 대출을 신청해 보세요.</p>
            <Link to="/products" className="button button-outline">
              대출상품 조회
            </Link>
          </div>
        ) : (
          <div className="bank-application-table-wrap">
            <table className="bank-application-table">
              <caption className="bank-sr-only">나의 대출 신청 내역</caption>
              <thead>
                <tr>
                  <th scope="col">상품명</th>
                  <th scope="col" className="bank-amount-cell">
                    신청금액
                  </th>
                  <th scope="col">기간</th>
                  <th scope="col">신청일시</th>
                  <th scope="col">진행상태</th>
                  <th scope="col">
                    <span className="bank-sr-only">상세 조회</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {applications.map((item) => (
                  <tr key={item.id}>
                    <td className="bank-product-cell" data-label="상품명">
                      <Link to={`/applications/${item.id}`}>{item.productName}</Link>
                    </td>
                    <td className="bank-amount-cell" data-label="신청금액">
                      {won(item.requestedAmount)}
                    </td>
                    <td data-label="기간">{item.termMonths}개월</td>
                    <td className="bank-date-cell" data-label="신청일시">
                      {dateTime(item.createdAt)}
                    </td>
                    <td data-label="진행상태">
                      <span className={`status-badge ${item.status.toLowerCase()}`}>
                        {statusLabel(item.status)}
                      </span>
                    </td>
                    <td className="bank-detail-cell">
                      <Link
                        to={`/applications/${item.id}`}
                        aria-label={`${item.productName} 신청 상세 조회`}
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
        <p className="bank-section-help">
          신청 접수·내역 조회와 모의 심사 결과(승인 시 확정 조건, 거절 시 안내)를 제공합니다. 승인된
          신청은 상세 화면에서 약정과 대출 실행을 진행할 수 있습니다.
        </p>
      </section>

      <MyLoansSection reload={reload} />

      <section
        className="bank-record-section bank-products-section"
        aria-labelledby="bank-dashboard-products-title"
      >
        <div className="section-heading">
          <div>
            <h2 id="bank-dashboard-products-title">대출상품 안내</h2>
            <p>금리, 한도, 기간을 비교하고 원하는 상품을 선택하세요.</p>
          </div>
          <Link to="/products" className="text-button">
            전체 상품
            <AppIcon name="chevron" size={15} />
          </Link>
        </div>
        {pending ? (
          <div className="empty-state" role="status">
            상품 정보를 불러오고 있습니다.
          </div>
        ) : productError ? (
          <div className="notice">
            <p>상품 정보를 불러오지 못했습니다.</p>
            <button className="text-button" onClick={() => setReload((value) => value + 1)}>
              다시 불러오기
            </button>
          </div>
        ) : products.length ? (
          <div className="product-grid">
            {products.slice(0, 3).map((product, index) => (
              <ProductCard key={product.id} product={product} index={index} />
            ))}
          </div>
        ) : (
          <div className="empty-state">현재 조회할 수 있는 상품이 없습니다.</div>
        )}
      </section>

      <MyLearningSection />
    </>
  )
}
