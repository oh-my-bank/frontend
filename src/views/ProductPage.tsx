import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../stores/auth'
import { request } from '../lib/api'
import { createRequestIdentity } from '../lib/idempotency'
import { compactWon, rate } from '../lib/format'
import type { ApplicationInput, LoanApplication, Product } from '../types'
import AppIcon from '../components/AppIcon'
import ErrorNotice from '../components/ErrorNotice'
import ProgressSteps from '../components/ProgressSteps'
import '../styles/banking-products.css'

type Field = 'amount' | 'months' | 'income' | 'acknowledged'
const untouched: Record<Field, boolean> = {
  amount: false,
  months: false,
  income: false,
  acknowledged: false,
}

export default function ProductPage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [product, setProduct] = useState<Product | null>(null)
  const [pending, setPending] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [reload, setReload] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<unknown>(null)
  const [amount, setAmount] = useState('')
  const [months, setMonths] = useState('')
  const [income, setIncome] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [touched, setTouched] = useState<Record<Field, boolean>>(untouched)
  const identity = useRef(createRequestIdentity())
  const applicationPanel = useRef<HTMLElement>(null)
  useEffect(() => {
    setAmount('')
    setMonths('')
    setIncome('')
    setAcknowledged(false)
    setSubmitError(null)
    setTouched(untouched)
    identity.current.clear()
  }, [id])
  useEffect(() => {
    const controller = new AbortController()
    setPending(true)
    setError(null)
    setProduct(null)
    void request<Product>(`/loan-products/${encodeURIComponent(id ?? '')}`, {
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted) {
          setProduct(result)
          setMonths((current) => current || String(result.minTermMonths))
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause)
      })
      .finally(() => {
        if (!controller.signal.aborted) setPending(false)
      })
    return () => controller.abort()
  }, [id, reload])
  useEffect(() => {
    if (product && !pending && location.hash === '#apply')
      applicationPanel.current?.scrollIntoView({ block: 'start', behavior: 'auto' })
  }, [product, pending, location.hash])
  const amountValue = amount.trim() === '' ? null : Number(amount)
  const monthValue = months.trim() === '' ? null : Number(months)
  const incomeValue = income.trim() === '' ? null : Number(income)
  const amountValid =
    amountValue !== null &&
    Number.isSafeInteger(amountValue) &&
    !!product &&
    amountValue >= product.minAmount &&
    amountValue <= product.maxAmount
  const monthsValid =
    monthValue !== null &&
    Number.isSafeInteger(monthValue) &&
    !!product &&
    monthValue >= product.minTermMonths &&
    monthValue <= product.maxTermMonths
  const incomeValid =
    incomeValue !== null &&
    Number.isSafeInteger(incomeValue) &&
    incomeValue >= 0 &&
    incomeValue <= 100000000000
  const markTouched = (field: Field) => setTouched((current) => ({ ...current, [field]: true }))
  const amountError =
    touched.amount && !amountValid
      ? amountValue === null
        ? '신청 금액을 입력해 주세요.'
        : `상품 한도 안에서 원 단위 정수로 입력해 주세요.`
      : ''
  const monthError =
    touched.months && !monthsValid ? '신청 가능한 기간을 월 단위 정수로 입력해 주세요.' : ''
  const incomeError =
    touched.income && !incomeValid
      ? incomeValue === null
        ? '가상 연 소득을 입력해 주세요.'
        : '0원부터 1,000억원까지 원 단위 정수로 입력해 주세요.'
      : ''
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setTouched({ amount: true, months: true, income: true, acknowledged: true })
    if (
      !product ||
      !amountValid ||
      !monthsValid ||
      !incomeValid ||
      !acknowledged ||
      submitting ||
      user?.role !== 'CUSTOMER'
    )
      return
    setSubmitting(true)
    setSubmitError(null)
    const body: ApplicationInput = {
      productId: product.id,
      requestedAmount: amountValue!,
      termMonths: monthValue!,
      annualIncome: incomeValue!,
    }
    try {
      const result = await request<LoanApplication>('/loan-applications', {
        method: 'POST',
        body,
        idempotencyKey: identity.current.keyFor(body),
      })
      await navigate(`/applications/${result.id}`)
      identity.current.clear()
    } catch (cause) {
      setSubmitError(cause)
    } finally {
      setSubmitting(false)
    }
  }
  return (
    <>
      <section className="page-title">
        <h1>대출 신청</h1>
        <p>상품 조건을 확인하고 신청 정보를 입력해 주세요.</p>
      </section>
      <ProgressSteps current={2} />
      <ErrorNotice error={error} />
      {pending ? (
        <div className="empty-state" role="status">
          상품 정보를 불러오고 있습니다.
        </div>
      ) : error ? (
        <div className="bank-product-load-error">
          <button className="button button-outline" onClick={() => setReload((value) => value + 1)}>
            다시 불러오기
          </button>
          <Link to="/products" className="text-button">
            상품 목록으로 이동
          </Link>
        </div>
      ) : (
        product && (
          <>
            <section className="bank-product-detail-heading">
              <span className="bank-product-tag">고정금리 · 가상 금융상품</span>
              <h2>{product.name}</h2>
              <p>{product.description}</p>
            </section>
            <div className="bank-application-layout">
              <section
                className="bank-product-information"
                aria-labelledby="bank-product-information-title"
              >
                <h2 id="bank-product-information-title">상품안내</h2>
                <div className="bank-product-condition-summary">
                  <dl>
                    <div>
                      <dt>대출금리</dt>
                      <dd className="bank-product-detail-rate">
                        <span>연</span> {rate(product.annualInterestRate)}
                        <span>%</span>
                      </dd>
                    </div>
                    <div>
                      <dt>최대 한도</dt>
                      <dd>{compactWon(product.maxAmount)}</dd>
                    </div>
                    <div>
                      <dt>대출 기간</dt>
                      <dd>
                        {product.minTermMonths}~{product.maxTermMonths}개월
                      </dd>
                    </div>
                  </dl>
                </div>
                <dl className="bank-product-detail-terms">
                  <div>
                    <dt>신청 가능 금액</dt>
                    <dd>
                      {compactWon(product.minAmount)} ~ {compactWon(product.maxAmount)}
                    </dd>
                  </div>
                  <div>
                    <dt>신청 가능 기간</dt>
                    <dd>
                      {product.minTermMonths} ~ {product.maxTermMonths}개월
                    </dd>
                  </div>
                  <div>
                    <dt>상환 방식</dt>
                    <dd>원리금균등분할상환</dd>
                  </div>
                  <div>
                    <dt>금리 유형</dt>
                    <dd>고정금리</dd>
                  </div>
                  <div>
                    <dt>적용 상품 조건</dt>
                    <dd>버전 {product.policyVersion}</dd>
                  </div>
                </dl>
                <div className="bank-product-condition-note">
                  <h3>
                    <AppIcon name="info" size={17} /> 알아두세요
                  </h3>
                  <p>
                    접수 시점의 상품 조건이 신청 내역에 보관되며 모의 심사는 이 조건으로 진행됩니다.
                  </p>
                  <p>
                    현재 신청 접수·내역 조회와 모의 심사 결과 조회를 제공합니다. 약정·실행·상환
                    기능은 준비 중입니다.
                  </p>
                </div>
              </section>
              <section
                className="bank-application-panel"
                id="apply"
                ref={applicationPanel}
                aria-labelledby="bank-application-title"
              >
                <div className="bank-application-heading">
                  <h2 id="bank-application-title">신청정보 입력</h2>
                  <span>
                    <i aria-hidden="true">*</i> 필수 입력 항목
                  </span>
                </div>
                {!user ? (
                  <div className="bank-application-access">
                    <AppIcon name="shield" size={30} />
                    <h3>로그인이 필요합니다.</h3>
                    <p>
                      상품 조건은 로그인 없이 확인할 수 있습니다.
                      <br />
                      신청은 고객 계정으로 로그인한 후 이용해 주세요.
                    </p>
                    <Link
                      className="button button-primary full"
                      to={`/login?redirect=${encodeURIComponent(`/products/${id}#apply`)}`}
                    >
                      로그인
                    </Link>
                  </div>
                ) : user.role !== 'CUSTOMER' ? (
                  <div className="bank-application-access">
                    <h3>고객 계정으로 이용해 주세요.</h3>
                    <p>
                      직원 계정은 상품 조건을 조회할 수 있습니다. 대출 신청은 고객 계정으로만
                      가능합니다.
                    </p>
                    <Link className="button button-outline" to="/staff">
                      직원 업무로 이동
                    </Link>
                  </div>
                ) : (
                  <form className="bank-application-form" onSubmit={submit}>
                    <ErrorNotice error={submitError} />
                    <fieldset
                      className="form-fieldset bank-application-fields"
                      disabled={submitting}
                      aria-busy={submitting}
                    >
                      <legend className="bank-product-sr-only">대출 신청 정보</legend>
                      <div className="bank-application-field">
                        <label htmlFor="application-amount">
                          신청 금액 <i aria-hidden="true">*</i>
                        </label>
                        <div className="input-unit">
                          <input
                            id="application-amount"
                            type="number"
                            value={amount}
                            onChange={(event) => setAmount(event.target.value)}
                            min={product.minAmount}
                            max={product.maxAmount}
                            step="1"
                            required
                            inputMode="numeric"
                            placeholder="금액 입력"
                            onBlur={() => markTouched('amount')}
                            onInvalid={() => markTouched('amount')}
                            aria-invalid={!!amountError}
                            aria-describedby={`amount-help${amountError ? ' amount-error' : ''}`}
                          />
                          <span>원</span>
                        </div>
                        <p className="bank-application-help" id="amount-help">
                          {compactWon(product.minAmount)} ~ {compactWon(product.maxAmount)}
                        </p>
                        {amountError && (
                          <p className="bank-application-error" id="amount-error">
                            {amountError}
                          </p>
                        )}
                      </div>
                      <div className="bank-application-field">
                        <label htmlFor="application-months">
                          대출 기간 <i aria-hidden="true">*</i>
                        </label>
                        <div className="input-unit">
                          <input
                            id="application-months"
                            type="number"
                            value={months}
                            onChange={(event) => setMonths(event.target.value)}
                            min={product.minTermMonths}
                            max={product.maxTermMonths}
                            step="1"
                            required
                            inputMode="numeric"
                            onBlur={() => markTouched('months')}
                            onInvalid={() => markTouched('months')}
                            aria-invalid={!!monthError}
                            aria-describedby={`months-help${monthError ? ' months-error' : ''}`}
                          />
                          <span>개월</span>
                        </div>
                        <p className="bank-application-help" id="months-help">
                          {product.minTermMonths} ~ {product.maxTermMonths}개월
                        </p>
                        {monthError && (
                          <p className="bank-application-error" id="months-error">
                            {monthError}
                          </p>
                        )}
                      </div>
                      <div className="bank-application-field">
                        <label htmlFor="application-income">
                          가상 연 소득 <i aria-hidden="true">*</i>
                        </label>
                        <div className="input-unit">
                          <input
                            id="application-income"
                            type="number"
                            value={income}
                            onChange={(event) => setIncome(event.target.value)}
                            min="0"
                            max="100000000000"
                            step="1"
                            required
                            inputMode="numeric"
                            placeholder="테스트용 금액 입력"
                            onBlur={() => markTouched('income')}
                            onInvalid={() => markTouched('income')}
                            aria-invalid={!!incomeError}
                            aria-describedby={`income-help${incomeError ? ' income-error' : ''}`}
                          />
                          <span>원</span>
                        </div>
                        <p className="bank-application-help" id="income-help">
                          실제 소득 대신 가상의 금액을 입력해 주세요. 0원도 입력할 수 있습니다.
                        </p>
                        {incomeError && (
                          <p className="bank-application-error" id="income-error">
                            {incomeError}
                          </p>
                        )}
                      </div>
                      <div className="bank-application-consent">
                        <label htmlFor="application-consent">
                          <input
                            id="application-consent"
                            type="checkbox"
                            checked={acknowledged}
                            onChange={(event) => setAcknowledged(event.target.checked)}
                            required
                            onInvalid={() => markTouched('acknowledged')}
                          />
                          <span>상품 조건을 확인했으며, 학습용 가상 대출 신청임을 확인합니다.</span>
                        </label>
                        {touched.acknowledged && !acknowledged && (
                          <p className="bank-application-error">
                            상품 조건과 시뮬레이션 안내를 확인해 주세요.
                          </p>
                        )}
                      </div>
                      <button
                        className="button button-primary full bank-application-submit"
                        type="submit"
                        disabled={submitting}
                      >
                        {submitting ? '신청 접수 중…' : '대출 신청 접수'}
                        <AppIcon name="arrow" size={17} />
                      </button>
                    </fieldset>
                    <p className="bank-application-bottom-note">
                      접수 후 ‘나의 대출’에서 신청 조건과 진행 상태를 확인할 수 있습니다.
                    </p>
                  </form>
                )}
              </section>
            </div>
            <div className="bank-product-bottom">
              <Link to="/products" className="button button-outline">
                상품 목록
              </Link>
              <Link to="/my" className="text-button">
                나의 대출 조회 <AppIcon name="chevron" size={15} />
              </Link>
            </div>
          </>
        )
      )}
    </>
  )
}
