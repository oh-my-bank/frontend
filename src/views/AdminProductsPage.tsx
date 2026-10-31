import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ApiError, request } from '../lib/api'
import {
  MAX_SEARCH_LENGTH,
  listPath,
  listState,
  loadMessage,
  type StatusFilter,
} from '../lib/adminProducts'
import { koreanWon, rate } from '../lib/format'
import { useAuth } from '../stores/auth'
import type { AdminProduct } from '../types'
import AppIcon from '../components/AppIcon'
import ErrorNotice from '../components/ErrorNotice'
import '../styles/banking-records.css'
import '../styles/banking-admin.css'

const filters: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'active', label: '판매 중' },
  { value: 'inactive', label: '판매 중지' },
]

export default function AdminProductsPage() {
  const { refresh } = useAuth()
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [pending, setPending] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [reload, setReload] = useState(0)
  // Status and search live in the URL; the server searches names and the status buttons count the result.
  const [params, setParams] = useSearchParams()
  const { status: filter, q } = listState(params)
  const [search, setSearch] = useState(q)
  useEffect(() => setSearch(q), [q])
  function update(next: { status?: StatusFilter; q?: string }) {
    const state = { status: filter, q, ...next }
    const query = new URLSearchParams()
    if (state.status !== 'all') query.set('status', state.status)
    if (state.q.trim()) query.set('q', state.q.trim())
    setParams(query, { replace: true })
  }
  const setFilter = (status: StatusFilter) => update({ status })
  function submitSearch(event: FormEvent) {
    event.preventDefault()
    update({ q: search })
  }
  useEffect(() => {
    const controller = new AbortController()
    setPending(true)
    setError(null)
    void request<{ items: AdminProduct[] }>(listPath(q), { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setProducts(result.items)
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
  }, [reload, q])
  const counts = {
    all: products.length,
    active: products.filter((product) => product.active).length,
    inactive: products.filter((product) => !product.active).length,
  }
  const visible = products.filter(
    (product) => filter === 'all' || product.active === (filter === 'active'),
  )
  return (
    <>
      <section className="page-title bank-title-actions">
        <div>
          <h1>상품 관리</h1>
          <p>가상 대출상품을 등록하고 정책 버전과 판매 상태를 관리합니다.</p>
        </div>
        <Link to="/admin/products/new" className="button button-primary">
          <AppIcon name="plus" size={17} />
          상품 등록
        </Link>
      </section>
      <div className="notice bank-admin-scope">
        등록·정책 발행·판매 중지는 즉시 고객 화면에 반영됩니다. 정책은 버전으로 보존되며 이미 접수된
        신청의 조건은 바뀌지 않습니다. 상품명·설명 수정은 정보 이력으로 남고, 판매 중지한 상품은
        현재 정책 그대로 판매를 재개할 수 있습니다.
      </div>
      <section className="bank-record-section" aria-labelledby="bank-admin-list-title">
        <div className="section-heading bank-admin-list-heading">
          <div>
            <h2 id="bank-admin-list-title">
              등록 상품
              <span className="count-tag">{pending || error ? '—' : counts.all}</span>
            </h2>
            <p>상품명을 선택하면 정책 버전 이력과 변경 업무를 확인할 수 있습니다.</p>
          </div>
          <div className="bank-admin-filter" role="group" aria-label="판매 상태로 보기">
            {filters.map((item) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={filter === item.value}
                disabled={pending || !!error}
                onClick={() => setFilter(item.value)}
              >
                {item.label}
                <span>{pending || error ? '—' : counts[item.value]}</span>
              </button>
            ))}
          </div>
        </div>
        <form className="bank-admin-search" role="search" onSubmit={submitSearch}>
          <label htmlFor="admin-product-search">상품명 검색</label>
          <div>
            <input
              id="admin-product-search"
              type="search"
              value={search}
              maxLength={MAX_SEARCH_LENGTH}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="상품명 일부를 입력하세요"
              autoComplete="off"
            />
            <button type="submit" className="button button-primary small">
              검색
            </button>
            {q && (
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setSearch('')
                  update({ q: '' })
                }}
              >
                검색 초기화
              </button>
            )}
          </div>
          {q && !pending && !error && (
            <p className="bank-application-help" role="status">
              ‘{q}’ 검색 결과 {counts.all}개
            </p>
          )}
        </form>
        <ErrorNotice error={error} message={loadMessage(error)} />
        {pending ? (
          <div className="empty-state" role="status">
            상품 목록을 불러오고 있습니다.
          </div>
        ) : error ? (
          <div className="empty-state">
            <h3>상품 목록을 불러오지 못했습니다.</h3>
            <p>연결 상태와 계정 권한을 확인한 뒤 다시 시도해 주세요.</p>
            <button
              className="button button-outline small"
              onClick={() => setReload((value) => value + 1)}
            >
              다시 불러오기
            </button>
          </div>
        ) : !products.length && q ? (
          <div className="empty-state">
            <h3>‘{q}’ 이름의 상품이 없습니다.</h3>
            <button
              className="text-button"
              onClick={() => {
                setSearch('')
                update({ q: '' })
              }}
            >
              전체 상품 보기
            </button>
          </div>
        ) : !products.length ? (
          <div className="empty-state bank-empty-records">
            <AppIcon name="layers" size={30} />
            <h3>등록된 상품이 없습니다.</h3>
            <p>상품과 첫 번째 정책 버전을 등록하면 고객 상품 목록에 바로 공개됩니다.</p>
            <Link to="/admin/products/new" className="button button-outline">
              상품 등록
            </Link>
          </div>
        ) : !visible.length ? (
          <div className="empty-state">
            <h3>{filter === 'active' ? '판매 중인' : '판매 중지된'} 상품이 없습니다.</h3>
            <button className="text-button" onClick={() => setFilter('all')}>
              전체 상품 보기
            </button>
          </div>
        ) : (
          <div className="bank-application-table-wrap">
            <table className="bank-application-table bank-admin-table">
              <caption className="bank-sr-only">
                관리자 상품 목록, {filters.find((item) => item.value === filter)?.label}
              </caption>
              <thead>
                <tr>
                  <th scope="col">상품명</th>
                  <th scope="col">판매 상태</th>
                  <th scope="col">현재 정책</th>
                  <th scope="col">연이율</th>
                  <th scope="col">신청 가능 금액</th>
                  <th scope="col">대출 기간</th>
                  <th scope="col">
                    <span className="bank-sr-only">상세 조회</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((product) => (
                  <tr key={product.id} className={product.active ? '' : 'bank-admin-inactive-row'}>
                    <td className="bank-product-cell" data-label="상품명">
                      <Link to={`/admin/products/${product.id}`}>{product.name}</Link>
                    </td>
                    <td data-label="판매 상태">
                      <span className={`status-badge ${product.active ? 'active' : 'inactive'}`}>
                        {product.active ? '판매 중' : '판매 중지'}
                      </span>
                    </td>
                    <td data-label="현재 정책">버전 {product.currentPolicy.version}</td>
                    <td data-label="연이율">
                      연 {rate(product.currentPolicy.annualInterestRate)}%
                    </td>
                    <td data-label="신청 가능 금액">
                      {koreanWon(product.currentPolicy.minAmount)} ~{' '}
                      {koreanWon(product.currentPolicy.maxAmount)}
                    </td>
                    <td data-label="대출 기간">
                      {product.currentPolicy.minTermMonths}~{product.currentPolicy.maxTermMonths}
                      개월
                    </td>
                    <td className="bank-detail-cell">
                      <Link
                        to={`/admin/products/${product.id}`}
                        aria-label={`${product.name} 상세 관리`}
                      >
                        관리
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
