import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ApiError, request } from '../lib/api'
import { commandMessage, isUncertain, loadMessage, policyRows } from '../lib/adminProducts'
import { useAdminCommand } from '../lib/useAdminCommand'
import { dateTime } from '../lib/format'
import { useAuth } from '../stores/auth'
import type { AdminProduct, PolicyVersion } from '../types'
import AppIcon from '../components/AppIcon'
import ConfirmDialog from '../components/ConfirmDialog'
import ErrorNotice from '../components/ErrorNotice'
import '../styles/banking-records.css'
import '../styles/banking-admin.css'

const rowFor = (key: string) => policyRows.find((row) => row.key === key)!

export default function AdminProductPage() {
  const { id = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const [product, setProduct] = useState<AdminProduct | null>(null)
  const [history, setHistory] = useState<PolicyVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [historyError, setHistoryError] = useState<unknown>(null)
  const [reload, setReload] = useState(0)
  const [notice, setNotice] = useState<string | null>(
    () => (location.state as { notice?: string } | null)?.notice ?? null,
  )
  const noticeRef = useRef<HTMLDivElement>(null)
  const command = useAdminCommand()
  const [confirming, setConfirming] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)
  // A deactivation whose response never arrived; it may already be applied.
  const [unresolved, setUnresolved] = useState(false)
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState<{ message: string; failed?: unknown } | null>(null)
  const path = `/admin/loan-products/${encodeURIComponent(id)}`

  useEffect(() => {
    // The notice belongs to the change that led here, not to a later reload of this page.
    if ((location.state as { notice?: string } | null)?.notice)
      void navigate(location.pathname, { replace: true, state: null })
  }, [location.state, location.pathname, navigate])
  useEffect(() => {
    if (notice) noticeRef.current?.focus()
  }, [notice])
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    setHistoryError(null)
    void Promise.allSettled([
      request<AdminProduct>(path, { signal: controller.signal }),
      request<{ items: PolicyVersion[] }>(`${path}/policies`, { signal: controller.signal }),
    ]).then(([productResult, historyResult]) => {
      if (!active) return
      if (productResult.status === 'fulfilled') setProduct(productResult.value)
      else {
        setProduct(null)
        setError(productResult.reason)
        if (productResult.reason instanceof ApiError && productResult.reason.status === 403)
          void refresh().catch(() => null)
      }
      if (historyResult.status === 'fulfilled') setHistory(historyResult.value.items)
      else setHistoryError(historyResult.reason)
      setLoading(false)
    })
    return () => {
      active = false
      controller.abort()
    }
  }, [path, reload])

  function openDeactivation() {
    // An uncertain result stays explained until it is checked or sent again.
    if (!unresolved) command.setError(null)
    setCheckResult(null)
    setAcknowledged(unresolved)
    setConfirming(true)
  }
  function deactivated(updated: AdminProduct, message: string) {
    setProduct(updated)
    setConfirming(false)
    setAcknowledged(false)
    setUnresolved(false)
    setCheckResult(null)
    setNotice(message)
  }
  async function deactivate() {
    if (!product) return
    const outcome = await command.run({ productId: product.id }, (key) =>
      request<AdminProduct>(`${path}/deactivation`, { method: 'POST', idempotencyKey: key }),
    )
    if (!outcome) return
    if (outcome.ok) {
      deactivated(
        outcome.value,
        '판매를 중지했습니다. 고객 상품 목록과 신규 신청에서 제외되었으며 기존 신청 내역은 계속 조회됩니다.',
      )
      return
    }
    setCheckResult(null)
    if (isUncertain(outcome.error)) setUnresolved(true)
    else if (
      outcome.error instanceof ApiError &&
      ['PRODUCT_INACTIVE', 'PRODUCT_NOT_FOUND'].includes(outcome.error.code)
    ) {
      setConfirming(false)
      setReload((value) => value + 1)
    }
  }
  async function check() {
    if (checking) return
    setChecking(true)
    setCheckResult(null)
    try {
      const latest = await request<AdminProduct>(path)
      if (!latest.active) {
        deactivated(
          latest,
          '판매 중지가 반영된 것을 확인했습니다. 고객 상품 목록과 신규 신청에서 제외되었습니다.',
        )
        return
      }
      setProduct(latest)
      setUnresolved(false)
      command.setError(null)
      setCheckResult({
        message:
          '아직 판매 중인 상품입니다. 판매 중지가 반영되지 않았으니 다시 진행할 수 있습니다.',
      })
    } catch (cause) {
      setCheckResult({
        message: '반영 여부를 확인하지 못했습니다. 잠시 후 다시 확인해 주세요.',
        failed: cause,
      })
    } finally {
      setChecking(false)
    }
  }

  const policy = product?.currentPolicy
  return (
    <>
      <section className="page-title bank-title-actions">
        <div>
          <h1>상품 상세</h1>
          <p>현재 정책과 정책 버전 이력을 확인하고 판매 상태를 관리합니다.</p>
        </div>
        <Link to="/admin/products" className="button button-outline">
          상품 목록
          <AppIcon name="chevron" size={15} />
        </Link>
      </section>
      {notice && (
        <div className="bank-admin-success" role="status" tabIndex={-1} ref={noticeRef}>
          <AppIcon name="check" size={19} />
          <p>{notice}</p>
        </div>
      )}
      {!confirming && !!command.error && (
        <ErrorNotice error={command.error} message={commandMessage(command.error, 'deactivate')} />
      )}
      {loading && !product ? (
        <div className="empty-state" role="status">
          상품 정보를 불러오고 있습니다.
        </div>
      ) : error || !product || !policy ? (
        <>
          <ErrorNotice error={error} message={loadMessage(error)} />
          <div className="bank-product-load-error">
            <button
              className="button button-outline"
              onClick={() => setReload((value) => value + 1)}
            >
              다시 불러오기
            </button>
            <Link to="/admin/products" className="text-button">
              상품 목록으로 이동
            </Link>
          </div>
        </>
      ) : (
        <>
          <section className="bank-admin-summary" aria-labelledby="bank-admin-product-title">
            <div className="bank-admin-summary-heading">
              <div>
                <span>상품명</span>
                <h2 id="bank-admin-product-title">{product.name}</h2>
              </div>
              <span className={`status-badge ${product.active ? 'active' : 'inactive'}`}>
                {product.active ? '판매 중' : '판매 중지'}
              </span>
            </div>
            <p className="bank-admin-description">{product.description}</p>
            <div className="bank-admin-current">
              <h3>
                현재 정책 <strong>버전 {policy.version}</strong>
                <small>{dateTime(policy.createdAt)} 발행</small>
              </h3>
              <dl className="bank-admin-terms">
                <div>
                  <dt>연이율</dt>
                  <dd>{rowFor('annualInterestRate').format(policy)}</dd>
                </div>
                <div>
                  <dt>신청 가능 금액</dt>
                  <dd>
                    {rowFor('minAmount').format(policy)} ~ {rowFor('maxAmount').format(policy)}
                  </dd>
                </div>
                <div>
                  <dt>대출 기간</dt>
                  <dd>
                    {policy.minTermMonths}~{policy.maxTermMonths}개월
                  </dd>
                </div>
                <div>
                  <dt>설명서 버전</dt>
                  <dd>{policy.explanationVersion}</dd>
                </div>
              </dl>
            </div>
            <dl className="details-list bank-admin-details">
              <div>
                <dt>상품 ID</dt>
                <dd className="monospace">{product.id}</dd>
              </div>
              <div>
                <dt>등록일시</dt>
                <dd>{dateTime(product.createdAt)}</dd>
              </div>
              <div>
                <dt>상환 방식</dt>
                <dd>{rowFor('repaymentMethod').format(policy)}</dd>
              </div>
              {product.deactivatedAt && (
                <div>
                  <dt>판매 중지 일시</dt>
                  <dd>{dateTime(product.deactivatedAt)}</dd>
                </div>
              )}
            </dl>
          </section>
          {product.active ? (
            <section className="bank-admin-actions" aria-labelledby="bank-admin-actions-title">
              <h2 id="bank-admin-actions-title" className="bank-sr-only">
                상품 변경 업무
              </h2>
              <div>
                <Link
                  to={`/admin/products/${product.id}/policies/new`}
                  className="button button-primary"
                >
                  새 정책 발행
                </Link>
                <button
                  type="button"
                  className="button button-danger-outline"
                  onClick={openDeactivation}
                >
                  판매 중지
                </button>
              </div>
              <p className="bank-section-help">
                조건 변경은 새 정책 버전으로 발행하며 기존 버전은 수정·삭제되지 않습니다.
                상품명·설명 수정과 재활성화는 제공하지 않습니다.
              </p>
            </section>
          ) : (
            <section className="bank-record-notice" aria-labelledby="bank-admin-inactive-title">
              <AppIcon name="info" size={21} />
              <div>
                <h2 id="bank-admin-inactive-title">판매 중지된 상품입니다.</h2>
                <p>
                  고객 상품 목록과 신규 신청에서 제외되었으며 이미 접수된 신청 내역은 계속
                  조회됩니다. 이번 버전에는 재활성화와 정책 발행을 제공하지 않습니다.
                </p>
              </div>
            </section>
          )}
          <section className="bank-record-section" aria-labelledby="bank-admin-history-title">
            <div className="section-heading">
              <div>
                <h2 id="bank-admin-history-title">
                  정책 버전 이력
                  <span className="count-tag">{historyError ? '—' : history.length}</span>
                </h2>
                <p>정책 버전은 수정·삭제되지 않으며 신청에는 접수 시점의 버전이 보관됩니다.</p>
              </div>
            </div>
            {historyError ? (
              <>
                <ErrorNotice error={historyError} message={loadMessage(historyError)} />
                <button
                  className="button button-outline small"
                  onClick={() => setReload((value) => value + 1)}
                >
                  이력 다시 불러오기
                </button>
              </>
            ) : (
              <div className="bank-application-table-wrap">
                <table className="bank-application-table bank-admin-table">
                  <caption className="bank-sr-only">{product.name} 정책 버전 이력</caption>
                  <thead>
                    <tr>
                      <th scope="col">버전</th>
                      <th scope="col">연이율</th>
                      <th scope="col">신청 가능 금액</th>
                      <th scope="col">대출 기간</th>
                      <th scope="col">설명서 버전</th>
                      <th scope="col">발행일시</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((item) => (
                      <tr key={item.version}>
                        <th scope="row" className="bank-product-cell" data-label="버전">
                          버전 {item.version}
                          {item.version === policy.version && (
                            <span className="bank-admin-current-tag">현재</span>
                          )}
                        </th>
                        <td data-label="연이율">{rowFor('annualInterestRate').format(item)}</td>
                        <td data-label="신청 가능 금액">
                          {rowFor('minAmount').format(item)} ~ {rowFor('maxAmount').format(item)}
                        </td>
                        <td data-label="대출 기간">
                          {item.minTermMonths}~{item.maxTermMonths}개월
                        </td>
                        <td data-label="설명서 버전">{item.explanationVersion}</td>
                        <td className="bank-date-cell" data-label="발행일시">
                          {dateTime(item.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <ConfirmDialog
            open={confirming}
            title="판매 중지 확인"
            danger
            confirmLabel={unresolved ? '같은 요청으로 다시 시도' : '판매 중지'}
            pendingLabel="처리 중…"
            cancelLabel={unresolved ? '닫기' : '취소'}
            pending={command.pending}
            confirmDisabled={!acknowledged}
            extraAction={
              unresolved && (
                <button
                  type="button"
                  className="button button-outline"
                  onClick={check}
                  disabled={checking || command.pending}
                >
                  {checking ? '확인 중…' : '반영 여부 확인'}
                </button>
              )
            }
            onConfirm={deactivate}
            onClose={() => setConfirming(false)}
          >
            {!!command.error && (
              <ErrorNotice
                error={command.error}
                message={commandMessage(command.error, 'deactivate')}
              />
            )}
            {checkResult &&
              (checkResult.failed ? (
                <ErrorNotice error={checkResult.failed} message={checkResult.message} />
              ) : (
                <p className="notice" role="status">
                  {checkResult.message}
                </p>
              ))}
            <dl className="bank-confirm-summary">
              <div>
                <dt>대상 상품</dt>
                <dd>{product.name}</dd>
              </div>
              <div>
                <dt>현재 정책</dt>
                <dd>
                  버전 {policy.version} · {rowFor('annualInterestRate').format(policy)}
                </dd>
              </div>
              <div>
                <dt>변경</dt>
                <dd>판매 중 → 판매 중지</dd>
              </div>
            </dl>
            <ul className="bank-confirm-effects">
              <li>고객 상품 목록·상품 상세에서 제외되고 새 신청을 받을 수 없습니다.</li>
              <li>이미 접수된 신청 내역과 접수 당시 조건은 그대로 조회됩니다.</li>
              <li>
                <strong>되돌릴 수 없습니다.</strong> 재활성화 기능이 없으며 이후 정책 발행도 할 수
                없습니다. 다시 판매하려면 새 상품으로 등록해야 합니다.
              </li>
            </ul>
            <label className="bank-confirm-acknowledge">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
                disabled={command.pending}
              />
              <span>판매 중지는 되돌릴 수 없다는 것을 확인했습니다.</span>
            </label>
          </ConfirmDialog>
        </>
      )}
    </>
  )
}
