import { useEffect, useMemo, useState } from 'react'
import { request } from '../lib/api'
import type { Product } from '../types'
import ProductCard from '../components/ProductCard'
import ErrorNotice from '../components/ErrorNotice'
import AppIcon from '../components/AppIcon'
import '../styles/banking-products.css'

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [pending, setPending] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [reload, setReload] = useState(0)
  const [query, setQuery] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    setPending(true)
    setError(null)
    void request<{ items: Product[] }>('/loan-products', { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setProducts(result.items)
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause)
      })
      .finally(() => {
        if (!controller.signal.aborted) setPending(false)
      })
    return () => controller.abort()
  }, [reload])
  const visibleProducts = useMemo(
    () =>
      products.filter((product) =>
        product.name.toLocaleLowerCase('ko-KR').includes(query.trim().toLocaleLowerCase('ko-KR')),
      ),
    [products, query],
  )

  return (
    <>
      <section className="page-title">
        <h1>대출상품</h1>
        <p>상품별 금리와 한도를 비교하고, 필요한 조건으로 신청하세요.</p>
      </section>
      <div className="bank-product-intro">
        <div>
          <span>조건을 확인하는 것부터</span>
          <h2>나에게 맞는 대출을 찾아보세요.</h2>
        </div>
        <p>
          고정금리 · 원리금균등분할상환
          <br />
          가상 데이터로 이용하는 금융 시뮬레이션
        </p>
      </div>
      <section aria-labelledby="bank-products-title" className="bank-product-catalog">
        <div className="bank-product-toolbar">
          <h2 id="bank-products-title">
            전체 대출상품 <span>{pending || error ? '—' : products.length}</span>
          </h2>
          <label className="bank-product-search">
            <span className="bank-product-sr-only">상품명 검색</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="상품명으로 검색"
              disabled={pending || !!error}
            />
            <AppIcon name="search" size={19} />
          </label>
        </div>
        <ErrorNotice error={error} />
        {pending ? (
          <div className="empty-state" role="status">
            상품 정보를 불러오고 있습니다.
          </div>
        ) : error ? (
          <div className="bank-product-load-error">
            <p>상품 정보를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.</p>
            <button
              className="button button-outline"
              onClick={() => setReload((value) => value + 1)}
            >
              다시 불러오기
            </button>
          </div>
        ) : !products.length ? (
          <div className="empty-state">
            <h3>현재 신청 가능한 상품이 없습니다.</h3>
            <p>상품이 등록되면 이곳에서 확인하실 수 있습니다.</p>
          </div>
        ) : (
          <>
            {query.trim() && (
              <p className="bank-product-search-result" role="status">
                검색 결과 <strong>{visibleProducts.length}</strong>건
              </p>
            )}
            {visibleProducts.length ? (
              <div className="bank-product-list">
                {visibleProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <h3>검색한 상품이 없습니다.</h3>
                <p>상품명이나 검색어를 다시 확인해 주세요.</p>
                <button className="text-button" onClick={() => setQuery('')}>
                  전체 상품 보기
                </button>
              </div>
            )}
          </>
        )}
      </section>
      <aside className="bank-product-notice">
        <AppIcon name="info" size={20} />
        <div>
          <h2>신청 전 확인해 주세요</h2>
          <ul>
            <li>상품 상세에서 신청 가능한 금액과 기간을 확인하실 수 있습니다.</li>
            <li>대출 신청과 신청 내역 조회는 고객 계정으로 로그인한 후 이용할 수 있습니다.</li>
            <li>학습용 가상 상품입니다. 실제 대출이나 자금 이동은 발생하지 않습니다.</li>
          </ul>
        </div>
      </aside>
    </>
  )
}
