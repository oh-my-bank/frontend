import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../stores/auth'
import { request } from '../lib/api'
import { createApplicationRequest } from '../lib/idempotency'
import { compactWon, rate, won } from '../lib/format'
import type { ApplicationInput, LoanApplication, Product } from '../types'
import AppIcon from '../components/AppIcon'
import ErrorNotice from '../components/ErrorNotice'

export default function ProductPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [product, setProduct] = useState<Product | null>(null)
  const [pending, setPending] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [submitError, setSubmitError] = useState<unknown>(null)
  const [amount, setAmount] = useState('')
  const [months, setMonths] = useState('')
  const [income, setIncome] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const identity = useRef(createApplicationRequest())
  const load = useCallback(async () => {
    setPending(true)
    setError(null)
    try {
      const result = await request<Product>(`/loan-products/${encodeURIComponent(id ?? '')}`)
      setProduct(result)
      setMonths(String(result.minTermMonths))
    } catch (cause) {
      setError(cause)
    } finally {
      setPending(false)
    }
  }, [id])
  useEffect(() => {
    setProduct(null)
    setAmount('')
    setIncome('')
    setAcknowledged(false)
    setSubmitError(null)
    identity.current.clear()
    void load()
  }, [load])
  const valid =
    !!product &&
    amount !== '' &&
    Number.isSafeInteger(Number(amount)) &&
    Number(amount) >= product.minAmount &&
    Number(amount) <= product.maxAmount &&
    months !== '' &&
    Number.isSafeInteger(Number(months)) &&
    Number(months) >= product.minTermMonths &&
    Number(months) <= product.maxTermMonths &&
    income !== '' &&
    Number.isSafeInteger(Number(income)) &&
    Number(income) >= 0 &&
    Number(income) <= 100000000000 &&
    acknowledged

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!valid || !product || submitting || user?.role !== 'CUSTOMER') return
    setSubmitting(true)
    setSubmitError(null)
    const body: ApplicationInput = {
      productId: product.id,
      requestedAmount: Number(amount),
      termMonths: Number(months),
      annualIncome: Number(income),
    }
    try {
      const result = await request<LoanApplication>('/loan-applications', {
        method: 'POST',
        body,
        idempotencyKey: identity.current.keyFor(body),
      })
      identity.current.clear()
      await navigate(`/applications/${result.id}`)
    } catch (cause) {
      setSubmitError(cause)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Link to="/products" className="back-link">
        ← 금융상품 목록
      </Link>
      <ErrorNotice error={error} />
      {error ? (
        <button className="text-button" onClick={() => void load()}>
          다시 불러오기
        </button>
      ) : null}
      {pending && (
        <div className="empty-state" role="status">
          상품 정보를 불러오고 있어요…
        </div>
      )}
      {product && !pending && (
        <>
          <section className="page-heading">
            <div>
              <span className="eyebrow">A STEP TOWARD UNDERSTANDING</span>
              <h1>
                {product.name}
                <span className="heading-dot">.</span>
              </h1>
              <p>{product.description}</p>
            </div>
            <span className="outline-tag">정책 v{product.policyVersion}</span>
          </section>
          <div className="detail-grid">
            <section className="product-detail">
              <div className="detail-hero">
                <span className="pill pill-outline">가상 금융상품 · 고정금리</span>
                <p>연 이자율</p>
                <div className="detail-rate">
                  {rate(product.annualInterestRate)}
                  <span>%</span>
                </div>
                <span>나에게 맞는 조건을 천천히 확인해 보세요.</span>
              </div>
              <dl className="details-list">
                <div>
                  <dt>대출 한도</dt>
                  <dd>
                    {compactWon(product.minAmount)} ~ {compactWon(product.maxAmount)}
                  </dd>
                </div>
                <div>
                  <dt>대출 기간</dt>
                  <dd>
                    {product.minTermMonths} ~ {product.maxTermMonths}개월
                  </dd>
                </div>
                <div>
                  <dt>상환 방식</dt>
                  <dd>원리금균등분할상환</dd>
                </div>
                <div>
                  <dt>적용 금리</dt>
                  <dd>연 {rate(product.annualInterestRate)}% · 고정금리</dd>
                </div>
              </dl>
              <div className="detail-notice">
                <AppIcon name="shield" size={20} />
                <p>
                  본 상품은 학습용 가상 상품입니다. 입력된 소득정보는 모의 심사에만 사용하며, 실제
                  대출 가능 여부를 판단하지 않습니다.
                </p>
              </div>
            </section>
            <section className="form-card">
              <span className="eyebrow">YOUR APPLICATION</span>
              <h2>대출 신청하기</h2>
              <p className="muted">희망하는 조건을 입력해 주세요.</p>
              {!user ? (
                <div className="empty-state compact">
                  <h3>로그인 후 신청할 수 있어요.</h3>
                  <Link
                    to={`/login?redirect=${encodeURIComponent(`/products/${id}`)}`}
                    className="button button-dark"
                  >
                    로그인하기 <AppIcon name="arrow" size={16} />
                  </Link>
                </div>
              ) : user.role !== 'CUSTOMER' ? (
                <div className="info-banner">대출 신청은 고객 계정으로 이용해 주세요.</div>
              ) : (
                <form onSubmit={submit} className="stack-form">
                  <ErrorNotice error={submitError} />
                  <fieldset disabled={submitting} className="form-fieldset">
                    <label>
                      신청 금액
                      <span className="input-unit">
                        <input
                          value={amount}
                          onChange={(event) => setAmount(event.target.value)}
                          type="number"
                          min={product.minAmount}
                          max={product.maxAmount}
                          step="1"
                          required
                          placeholder="희망 금액 입력"
                          inputMode="numeric"
                        />
                        <span>원</span>
                      </span>
                      <small>
                        {won(product.minAmount)} ~ {won(product.maxAmount)}
                      </small>
                    </label>
                    <label>
                      대출 기간
                      <span className="input-unit">
                        <input
                          value={months}
                          onChange={(event) => setMonths(event.target.value)}
                          type="number"
                          min={product.minTermMonths}
                          max={product.maxTermMonths}
                          step="1"
                          required
                          inputMode="numeric"
                        />
                        <span>개월</span>
                      </span>
                      <small>
                        {product.minTermMonths} ~ {product.maxTermMonths}개월 중 선택
                      </small>
                    </label>
                    <label>
                      가상 연 소득
                      <span className="input-unit">
                        <input
                          value={income}
                          onChange={(event) => setIncome(event.target.value)}
                          type="number"
                          min="0"
                          max="100000000000"
                          step="1"
                          required
                          placeholder="테스트용 연 소득 입력"
                          inputMode="numeric"
                        />
                        <span>원</span>
                      </span>
                      <small>실제 소득 대신 가상의 금액을 입력해 주세요.</small>
                    </label>
                    <label className="checkbox-label">
                      <input
                        checked={acknowledged}
                        onChange={(event) => setAcknowledged(event.target.checked)}
                        type="checkbox"
                        required
                      />
                      <span>
                        학습용 가상 신청이며, 입력한 상품 조건과 시뮬레이션 안내를 확인했습니다.
                      </span>
                    </label>
                    <button className="button button-dark full" disabled={!valid || submitting}>
                      {submitting ? '신청 접수 중…' : '이 조건으로 신청하기'}
                      <AppIcon name="arrow" size={18} />
                    </button>
                  </fieldset>
                  <p className="form-help">
                    신청 이후 심사 결과에 따라 최종 조건이 달라질 수 있습니다. 재시도는 동일한 요청
                    키로 처리합니다.
                  </p>
                </form>
              )}
            </section>
          </div>
        </>
      )}
    </>
  )
}
