import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError, request } from '../lib/api'
import {
  commandMessage,
  fieldErrorsFrom,
  fieldId,
  isUncertain,
  loadMessage,
  orderedErrors,
  policyChanges,
  policyForm,
  policyRows,
  publishOutcome,
  readPolicy,
  rebasePolicyForm,
  type FieldErrors,
  type PolicyField,
} from '../lib/adminProducts'
import { useAdminCommand } from '../lib/useAdminCommand'
import { dateTime } from '../lib/format'
import { useAuth } from '../stores/auth'
import type { AdminProduct, PolicyTerms, PolicyVersion } from '../types'
import AppIcon from '../components/AppIcon'
import ConfirmDialog from '../components/ConfirmDialog'
import ErrorNotice from '../components/ErrorNotice'
import FieldErrorSummary from '../components/FieldErrorSummary'
import PolicyFields from '../components/PolicyFields'
import '../styles/banking-products.css'
import '../styles/banking-records.css'
import '../styles/banking-admin.css'

interface PublishRequest {
  expectedCurrentVersion: number
  policy: PolicyTerms
}

export default function AdminPolicyPublishPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const command = useAdminCommand()
  const path = `/admin/loan-products/${encodeURIComponent(id)}`
  const [product, setProduct] = useState<AdminProduct | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<unknown>(null)
  const [reload, setReload] = useState(0)
  const [form, setForm] = useState(policyForm())
  const [attempted, setAttempted] = useState(false)
  const [serverErrors, setServerErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState('')
  const [focusField, setFocusField] = useState<string | null>(null)
  const [review, setReview] = useState<PublishRequest | null>(null)
  // A publication whose response never arrived; it may already be applied.
  const [unresolved, setUnresolved] = useState<PublishRequest | null>(null)
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState<{ message: string; failed?: unknown } | null>(null)
  const [rebased, setRebased] = useState<{ from: number; to: number } | null>(null)
  const rebasedRef = useRef<HTMLDivElement>(null)
  const base = product?.currentPolicy
  const current = readPolicy(form)
  const errors = { ...(attempted ? current.errors : {}), ...serverErrors }
  const changes = base && review ? policyChanges(base, review.policy) : []
  const retrying = !!unresolved && JSON.stringify(unresolved) === JSON.stringify(review)
  const commandFieldErrors = fieldErrorsFrom(command.error)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setLoadError(null)
    void request<AdminProduct>(path, { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return
        setProduct(result)
        setForm(policyForm(result.currentPolicy))
      })
      .catch((cause) => {
        if (controller.signal.aborted) return
        setLoadError(cause)
        if (cause instanceof ApiError && cause.status === 403) void refresh().catch(() => null)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [path, reload])
  useEffect(() => {
    if (!focusField || review) return
    document.getElementById(fieldId(focusField))?.focus()
    setFocusField(null)
  }, [focusField, review])
  useEffect(() => {
    if (rebased && !review) rebasedRef.current?.focus()
  }, [rebased, review])

  function changeField(field: PolicyField, value: string) {
    setForm((values) => ({ ...values, [field]: value }))
    setFormError('')
    setServerErrors((fields) => {
      const next = { ...fields }
      delete next[`policy.${field}`]
      return next
    })
  }
  function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!base) return
    setAttempted(true)
    setServerErrors({})
    setFormError('')
    if (!current.terms) {
      setFocusField(orderedErrors(current.errors)[0]?.[0] ?? null)
      return
    }
    if (!policyChanges(base, current.terms).length) {
      setFormError(
        '현재 정책과 같은 조건입니다. 바꿀 조건을 수정한 뒤 발행해 주세요. 같은 조건은 새 버전으로 발행할 수 없습니다.',
      )
      return
    }
    // An uncertain result stays explained until it is checked or sent again.
    if (!unresolved) command.setError(null)
    setCheckResult(null)
    setReview({ expectedCurrentVersion: base.version, policy: current.terms })
  }
  function published(notice: string) {
    setUnresolved(null)
    void navigate(`/admin/products/${id}`, { state: { notice } })
  }
  /** Shows the policy another administrator published and keeps only this administrator's edits. */
  async function rebaseOnLatest(previous: PolicyTerms & { version: number }) {
    const latest = await request<AdminProduct>(path)
    setProduct(latest)
    setForm((values) => rebasePolicyForm(values, previous, latest.currentPolicy))
    setRebased({ from: previous.version, to: latest.currentPolicy.version })
    setUnresolved(null)
    setReview(null)
    return latest
  }
  async function publish() {
    if (!review || !base) return
    const outcome = await command.run({ productId: id, ...review }, (key) =>
      request<AdminProduct>(`${path}/policies`, {
        method: 'POST',
        body: review,
        idempotencyKey: key,
      }),
    )
    if (!outcome) return
    if (outcome.ok) {
      published(
        `정책 버전 ${outcome.value.currentPolicy.version} 발행을 완료했습니다. 새 신청부터 이 조건이 적용됩니다.`,
      )
      return
    }
    setCheckResult(null)
    const cause = outcome.error
    if (isUncertain(cause)) {
      setUnresolved(review)
      return
    }
    const fieldErrors = fieldErrorsFrom(cause)
    if (Object.keys(fieldErrors).length) {
      setReview(null)
      setServerErrors(fieldErrors)
      setFocusField(orderedErrors(fieldErrors)[0]?.[0] ?? null)
      return
    }
    if (!(cause instanceof ApiError)) return
    if (cause.code === 'POLICY_VERSION_CONFLICT') {
      // The publication was refused for certain; only the reload of the newer policy failed.
      await rebaseOnLatest(base).catch((reason: unknown) => {
        setReview(null)
        setLoadError(reason)
      })
    } else if (cause.code === 'POLICY_UNCHANGED') {
      setReview(null)
      setFormError(commandMessage(cause, 'publish') ?? cause.message)
    } else if (['PRODUCT_INACTIVE', 'PRODUCT_NOT_FOUND'].includes(cause.code)) {
      setReview(null)
      setReload((value) => value + 1)
    }
  }
  async function check() {
    if (!unresolved || !base || checking) return
    setChecking(true)
    setCheckResult(null)
    try {
      const { items } = await request<{ items: PolicyVersion[] }>(`${path}/policies`)
      const outcome = publishOutcome(items, unresolved.expectedCurrentVersion, unresolved.policy)
      if (outcome.state === 'applied') {
        published(`정책 버전 ${outcome.version}의 발행이 반영된 것을 확인했습니다.`)
        return
      }
      if (outcome.state === 'superseded') {
        command.setError(null)
        await rebaseOnLatest(base)
        return
      }
      setUnresolved(null)
      command.setError(null)
      setCheckResult({
        message: `현재 정책이 아직 버전 ${unresolved.expectedCurrentVersion}입니다. 발행이 반영되지 않았으니 다시 발행할 수 있습니다.`,
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

  return (
    <>
      <section className="page-title bank-title-actions">
        <div>
          <h1>새 정책 발행</h1>
          <p>현재 정책을 기준으로 바꿀 조건을 입력합니다. 기존 버전은 그대로 보존됩니다.</p>
        </div>
        <Link to={`/admin/products/${id}`} className="button button-outline">
          상품 상세
          <AppIcon name="chevron" size={15} />
        </Link>
      </section>
      {loading && !product ? (
        <div className="empty-state" role="status">
          현재 정책을 불러오고 있습니다.
        </div>
      ) : loadError || !product || !base ? (
        <>
          <ErrorNotice error={loadError} message={loadMessage(loadError)} />
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
      ) : !product.active ? (
        <>
          {/* A publication refused with PRODUCT_INACTIVE lands here after the reload. */}
          <ErrorNotice error={command.error} message={commandMessage(command.error, 'publish')} />
          <section className="bank-record-notice" aria-labelledby="bank-admin-publish-inactive">
            <AppIcon name="info" size={21} />
            <div>
              <h2 id="bank-admin-publish-inactive">판매 중지된 상품입니다.</h2>
              <p>
                이 상품은 판매가 중지되어 새 정책을 발행할 수 없습니다.{' '}
                <Link to={`/admin/products/${product.id}`}>상품 상세</Link>에서 정책 이력을 확인할
                수 있습니다.
              </p>
            </div>
          </section>
        </>
      ) : (
        <div className="bank-admin-layout bank-admin-publish-layout">
          <form className="bank-admin-form" onSubmit={confirm} noValidate>
            {rebased && !review && (
              <div className="error-notice" role="alert" tabIndex={-1} ref={rebasedRef}>
                <strong>
                  다른 관리자가 먼저 정책을 발행했습니다. 기준 버전: {rebased.from} → {rebased.to}
                </strong>
                <p>
                  최신 정책을 다시 불러왔습니다. 직접 바꾼 항목만 유지하고 나머지는 최신 값으로
                  맞췄습니다. 변경 내용을 다시 확인한 뒤 발행해 주세요.
                </p>
              </div>
            )}
            {!review && unresolved && (
              <div className="error-notice" role="alert">
                <strong>직전 발행 요청의 결과를 확인하지 못했습니다.</strong>
                <p>
                  같은 내용으로 다시 발행하면 같은 요청 키를 사용하므로 중복 발행되지 않습니다.
                  내용을 바꾸기 전에 <Link to={`/admin/products/${id}`}>상품 상세</Link>의 정책
                  이력에서 반영 여부를 확인해 주세요.
                </p>
              </div>
            )}
            {!review &&
              !!command.error &&
              !unresolved &&
              !Object.keys(commandFieldErrors).length &&
              !(command.error instanceof ApiError && command.error.code === 'POLICY_UNCHANGED') && (
                <ErrorNotice
                  error={command.error}
                  message={commandMessage(command.error, 'publish')}
                />
              )}
            {formError && (
              <div className="error-notice" role="alert">
                <strong>변경된 조건이 없습니다.</strong>
                <p>{formError}</p>
              </div>
            )}
            <FieldErrorSummary errors={errors} />
            <fieldset className="form-fieldset" disabled={command.pending}>
              <legend className="bank-sr-only">새 정책 조건</legend>
              <h2 className="bank-admin-form-title">
                새 정책 조건 <span>기준 버전 {base.version}</span>
              </h2>
              <p className="bank-section-help bank-admin-form-help">
                {product.name}의 현재 조건이 입력되어 있습니다. 바꿀 항목만 수정해 주세요.
              </p>
              <PolicyFields value={form} errors={errors} onChange={changeField} base={base} />
              <button className="button button-primary full bank-admin-submit" type="submit">
                변경 내용 확인
                <AppIcon name="arrow" size={17} />
              </button>
            </fieldset>
          </form>
          <aside className="bank-admin-aside" aria-labelledby="bank-admin-base-title">
            <h2 id="bank-admin-base-title">
              <AppIcon name="layers" size={18} /> 현재 정책 · 버전 {base.version}
            </h2>
            <p className="bank-admin-aside-meta">
              {product.name} · {dateTime(base.createdAt)} 발행
            </p>
            <dl className="bank-admin-base-terms">
              {policyRows.map((row) => (
                <div key={row.key}>
                  <dt>{row.label}</dt>
                  <dd>{row.format(base)}</dd>
                </div>
              ))}
            </dl>
            <ul>
              <li>발행하면 새 버전이 현재 정책이 되고 새 신청부터 적용됩니다.</li>
              <li>이미 접수된 신청은 접수 당시 버전의 조건을 유지합니다.</li>
              <li>발행한 버전은 수정·삭제할 수 없습니다.</li>
            </ul>
          </aside>
        </div>
      )}
      <ConfirmDialog
        open={!!review}
        title="새 정책 발행 확인"
        confirmLabel={retrying ? '같은 요청으로 다시 발행' : '발행'}
        pendingLabel="발행 중…"
        cancelLabel={unresolved ? '닫기' : '취소'}
        pending={command.pending}
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
        onConfirm={publish}
        onClose={() => setReview(null)}
      >
        {review && product && (
          <>
            {unresolved && !retrying ? (
              <div className="error-notice" role="alert">
                <strong>직전 발행 요청의 결과를 확인하지 못했습니다.</strong>
                <p>반영 여부를 먼저 확인해 주세요. 내용이 다른 요청은 별도 발행으로 처리됩니다.</p>
              </div>
            ) : (
              !!command.error &&
              !Object.keys(commandFieldErrors).length && (
                <ErrorNotice
                  error={command.error}
                  message={commandMessage(command.error, 'publish')}
                />
              )
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
                <dt>기준 버전</dt>
                <dd>버전 {review.expectedCurrentVersion} (현재 정책)</dd>
              </div>
            </dl>
            <h3 className="bank-confirm-subtitle">변경 내용 {changes.length}건</h3>
            <ul className="bank-change-list">
              {changes.map((change) => (
                <li key={change.label}>
                  <span>{change.label}</span>
                  <span>
                    <span className="bank-sr-only">변경 전</span>
                    <del>{change.before}</del>
                    <AppIcon name="arrow" size={14} />
                    <span className="bank-sr-only">변경 후</span>
                    <ins>{change.after}</ins>
                  </span>
                </li>
              ))}
            </ul>
            <p className="bank-confirm-warning">
              <AppIcon name="info" size={17} />
              <span>
                발행하면 새 신청부터 바뀐 조건이 적용됩니다. 이미 접수된 신청은 버전{' '}
                {review.expectedCurrentVersion} 이하의 접수 당시 조건을 유지하며, 발행한 버전은
                수정·삭제할 수 없습니다.
              </span>
            </p>
          </>
        )}
      </ConfirmDialog>
    </>
  )
}
