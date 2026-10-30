import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { request } from '../lib/api'
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_NAME_LENGTH,
  commandMessage,
  fieldErrorsFrom,
  fieldId,
  findActiveByName,
  isUncertain,
  orderedErrors,
  policyForm,
  policyRows,
  readProduct,
  type FieldErrors,
  type PolicyField,
} from '../lib/adminProducts'
import { useAdminCommand } from '../lib/useAdminCommand'
import type { AdminProduct, ProductInput } from '../types'
import AppIcon from '../components/AppIcon'
import ConfirmDialog from '../components/ConfirmDialog'
import ErrorNotice from '../components/ErrorNotice'
import FieldErrorSummary from '../components/FieldErrorSummary'
import PolicyFields from '../components/PolicyFields'
import '../styles/banking-products.css'
import '../styles/banking-admin.css'

const describedBy = (path: string, error?: string) =>
  `${fieldId(path)}-help${error ? ` ${fieldId(path)}-error` : ''}`

export default function AdminProductNewPage() {
  const navigate = useNavigate()
  const command = useAdminCommand()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [policy, setPolicy] = useState(policyForm())
  const [attempted, setAttempted] = useState(false)
  const [serverErrors, setServerErrors] = useState<FieldErrors>({})
  const [focusField, setFocusField] = useState<string | null>(null)
  const [review, setReview] = useState<ProductInput | null>(null)
  // A registration whose response never arrived; it may exist on the server.
  const [unresolved, setUnresolved] = useState<ProductInput | null>(null)
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState<{ message: string; failed?: unknown } | null>(null)
  const current = readProduct(name, description, policy)
  const errors = { ...(attempted ? current.errors : {}), ...serverErrors }
  const retrying = !!unresolved && JSON.stringify(unresolved) === JSON.stringify(review)
  const commandFieldErrors = fieldErrorsFrom(command.error)
  useEffect(() => {
    // Runs after the dialog has closed, so the dialog does not move focus back to its opener.
    if (!focusField || review) return
    document.getElementById(fieldId(focusField))?.focus()
    setFocusField(null)
  }, [focusField, review])

  function edited(path: string) {
    setServerErrors((fields) => {
      const next = { ...fields }
      delete next[path]
      return next
    })
  }
  function changePolicy(field: PolicyField, value: string) {
    setPolicy((form) => ({ ...form, [field]: value }))
    edited(`policy.${field}`)
  }
  function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAttempted(true)
    setServerErrors({})
    if (!current.input) {
      setFocusField(orderedErrors(current.errors)[0]?.[0] ?? null)
      return
    }
    // An uncertain result stays explained until it is checked or sent again.
    if (!unresolved) command.setError(null)
    setCheckResult(null)
    setReview(current.input)
  }
  async function create() {
    if (!review) return
    const outcome = await command.run(review, (key) =>
      request<AdminProduct>('/admin/loan-products', {
        method: 'POST',
        body: review,
        idempotencyKey: key,
      }),
    )
    if (!outcome) return
    if (outcome.ok) {
      setUnresolved(null)
      await navigate(`/admin/products/${outcome.value.id}`, {
        state: { notice: '상품을 등록했습니다. 정책 버전 1로 판매를 시작했습니다.' },
      })
      return
    }
    setCheckResult(null)
    if (isUncertain(outcome.error)) {
      setUnresolved(review)
      return
    }
    const fieldErrors = fieldErrorsFrom(outcome.error)
    if (Object.keys(fieldErrors).length) {
      setReview(null)
      setServerErrors(fieldErrors)
      setFocusField(orderedErrors(fieldErrors)[0]?.[0] ?? null)
    }
  }
  async function check() {
    if (!unresolved || checking) return
    setChecking(true)
    setCheckResult(null)
    try {
      const { items } = await request<{ items: AdminProduct[] }>('/admin/loan-products')
      const found = findActiveByName(items, unresolved.name)
      if (found) {
        await navigate(`/admin/products/${found.id}`, {
          state: {
            notice:
              '같은 이름의 판매 중 상품을 확인했습니다. 등록 요청이 처리된 결과인지 상품 정보를 확인해 주세요.',
          },
        })
        return
      }
      setUnresolved(null)
      command.setError(null)
      setCheckResult({
        message: `판매 중인 상품 중 ‘${unresolved.name}’ 상품이 없어 등록되지 않은 것으로 확인했습니다. 내용을 확인한 뒤 등록해 주세요.`,
      })
    } catch (cause) {
      setCheckResult({
        message: '등록 여부를 확인하지 못했습니다. 잠시 후 다시 확인해 주세요.',
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
          <h1>상품 등록</h1>
          <p>상품 정보와 첫 번째 정책 조건을 입력합니다. 등록하면 즉시 판매가 시작됩니다.</p>
        </div>
        <Link to="/admin/products" className="button button-outline">
          상품 목록
          <AppIcon name="chevron" size={15} />
        </Link>
      </section>
      <div className="bank-admin-layout">
        <form className="bank-admin-form" onSubmit={confirm} noValidate>
          {!review && unresolved && (
            <div className="error-notice" role="alert">
              <strong>직전 등록 요청의 결과를 확인하지 못했습니다.</strong>
              <p>
                내용을 바꿔 다시 등록하기 전에 <Link to="/admin/products">상품 목록</Link>에서 ‘
                {unresolved.name}’ 등록 여부를 확인해 주세요. 같은 내용으로 다시 등록하면 같은 요청
                키를 사용하므로 중복 등록되지 않습니다.
              </p>
            </div>
          )}
          {!review && !!command.error && !unresolved && !Object.keys(commandFieldErrors).length && (
            <ErrorNotice error={command.error} message={commandMessage(command.error, 'create')} />
          )}
          <FieldErrorSummary errors={errors} />
          <fieldset className="form-fieldset" disabled={command.pending}>
            <legend className="bank-sr-only">상품 등록 정보</legend>
            <section aria-labelledby="admin-basic-title">
              <h2 id="admin-basic-title" className="bank-admin-form-title">
                기본 정보
              </h2>
              <div className="bank-application-field bank-admin-text-field">
                <label htmlFor={fieldId('name')}>
                  상품명 <i aria-hidden="true">*</i>
                </label>
                <div className="input-unit">
                  <input
                    id={fieldId('name')}
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value)
                      edited('name')
                    }}
                    maxLength={MAX_NAME_LENGTH}
                    autoComplete="off"
                    required
                    aria-invalid={!!errors.name}
                    aria-describedby={describedBy('name', errors.name)}
                  />
                </div>
                <p className="bank-application-help" id={`${fieldId('name')}-help`}>
                  판매 중인 상품과 겹치지 않는 100자 이내의 이름 · 등록 후 수정할 수 없습니다.
                </p>
                {errors.name && (
                  <p className="bank-application-error" id={`${fieldId('name')}-error`}>
                    {errors.name}
                  </p>
                )}
              </div>
              <div className="bank-application-field">
                <label htmlFor={fieldId('description')}>
                  상품 설명 <i aria-hidden="true">*</i>
                </label>
                <textarea
                  id={fieldId('description')}
                  className="bank-admin-textarea"
                  value={description}
                  onChange={(event) => {
                    setDescription(event.target.value)
                    edited('description')
                  }}
                  maxLength={MAX_DESCRIPTION_LENGTH}
                  rows={4}
                  required
                  aria-invalid={!!errors.description}
                  aria-describedby={describedBy('description', errors.description)}
                />
                <p className="bank-application-help" id={`${fieldId('description')}-help`}>
                  고객 상품 화면에 표시됩니다 ({description.length.toLocaleString('ko-KR')}
                  /1,000자) · 등록 후 수정할 수 없습니다.
                </p>
                {errors.description && (
                  <p className="bank-application-error" id={`${fieldId('description')}-error`}>
                    {errors.description}
                  </p>
                )}
              </div>
            </section>
            <section aria-labelledby="admin-policy-title">
              <h2 id="admin-policy-title" className="bank-admin-form-title">
                정책 조건 <span>버전 1</span>
              </h2>
              <PolicyFields value={policy} errors={errors} onChange={changePolicy} />
            </section>
            <button className="button button-primary full bank-admin-submit" type="submit">
              입력 내용 확인
              <AppIcon name="arrow" size={17} />
            </button>
          </fieldset>
        </form>
        <aside className="bank-admin-aside" aria-labelledby="admin-create-note-title">
          <h2 id="admin-create-note-title">
            <AppIcon name="info" size={18} /> 등록 전 확인해 주세요
          </h2>
          <ul>
            <li>등록하면 판매 중 상태로 고객 상품 목록과 신청 화면에 바로 공개됩니다.</li>
            <li>상품명과 설명은 등록 후 수정할 수 없습니다.</li>
            <li>조건을 바꾸려면 새 정책 버전을 발행합니다. 이미 접수된 신청은 바뀌지 않습니다.</li>
            <li>판매 중지는 되돌릴 수 없습니다.</li>
            <li>가상 상품입니다. 실제 금융상품이나 실제 자금을 사용하지 않습니다.</li>
          </ul>
        </aside>
      </div>
      <ConfirmDialog
        open={!!review}
        title="상품 등록 확인"
        confirmLabel={retrying ? '같은 요청으로 다시 등록' : '등록'}
        pendingLabel="등록 중…"
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
              {checking ? '확인 중…' : '등록 여부 확인'}
            </button>
          )
        }
        onConfirm={create}
        onClose={() => setReview(null)}
      >
        {review && (
          <>
            {unresolved && !retrying ? (
              <div className="error-notice" role="alert">
                <strong>직전 등록 요청의 결과를 확인하지 못했습니다.</strong>
                <p>
                  ‘{unresolved.name}’ 등록 여부를 먼저 확인해 주세요. 내용이 다른 요청은 새 상품으로
                  등록됩니다.
                </p>
              </div>
            ) : (
              !!command.error &&
              !Object.keys(commandFieldErrors).length && (
                <ErrorNotice
                  error={command.error}
                  message={commandMessage(command.error, 'create')}
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
                <dt>상품명</dt>
                <dd>{review.name}</dd>
              </div>
              <div>
                <dt>상품 설명</dt>
                <dd className="bank-confirm-description">{review.description}</dd>
              </div>
              {policyRows.map((row) => (
                <div key={row.key}>
                  <dt>{row.label}</dt>
                  <dd>{row.format(review.policy)}</dd>
                </div>
              ))}
            </dl>
            <p className="bank-confirm-warning">
              <AppIcon name="info" size={17} />
              <span>
                등록하면 정책 버전 1로 즉시 판매가 시작됩니다. 상품명과 설명은 등록 후 수정할 수
                없습니다.
              </span>
            </p>
          </>
        )}
      </ConfirmDialog>
    </>
  )
}
