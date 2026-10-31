import { useEffect, useState, type FormEvent } from 'react'
import { ApiError, request } from '../lib/api'
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_NAME_LENGTH,
  commandMessage,
  detailsOutcome,
  fieldErrorsFrom,
  fieldId,
  isUncertain,
  loadMessage,
  readDetails,
  type FieldErrors,
  type ProductDetailVersion,
} from '../lib/adminProducts'
import { useAdminCommand } from '../lib/useAdminCommand'
import { dateTime } from '../lib/format'
import type { AdminProduct } from '../types'
import ConfirmDialog from './ConfirmDialog'
import ErrorNotice from './ErrorNotice'
import FieldErrorSummary from './FieldErrorSummary'

type Edit = { name: string; description: string }
const describedBy = (path: string, error?: string) =>
  `${fieldId(path)}-help${error ? ` ${fieldId(path)}-error` : ''}`

/**
 * Name and description edits (R13). Each edit appends a details version checked against the version
 * the administrator saw; applications keep the product name they copied when submitted.
 */
export default function ProductDetailsSection({
  product,
  onChanged,
  onReload,
}: {
  product: AdminProduct
  onChanged: (product: AdminProduct, message: string) => void
  onReload: () => void
}) {
  const path = `/admin/loan-products/${encodeURIComponent(product.id)}`
  const command = useAdminCommand()
  const [history, setHistory] = useState<ProductDetailVersion[]>([])
  const [historyError, setHistoryError] = useState<unknown>(null)
  const [historyReload, setHistoryReload] = useState(0)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(product.name)
  const [description, setDescription] = useState(product.description)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [notice, setNotice] = useState<string | null>(null)
  // The edit and the version it was based on, while the confirmation is open.
  const [review, setReview] = useState<{ input: Edit; base: number } | null>(null)
  // The last sent edit whose result never arrived; it may already be applied.
  const [unresolved, setUnresolved] = useState<{ input: Edit; base: number } | null>(null)
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState<{ message: string; failed?: unknown } | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setHistoryError(null)
    void request<{ items: ProductDetailVersion[] }>(`${path}/details`, {
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted) setHistory(result.items)
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setHistoryError(cause)
      })
    return () => controller.abort()
  }, [path, product.detailVersion, historyReload])

  function startEditing() {
    setName(product.name)
    setDescription(product.description)
    setErrors({})
    setNotice(null)
    command.setError(null)
    setEditing(true)
  }
  function confirm(event: FormEvent) {
    event.preventDefault()
    const result = readDetails(name, description, product)
    setErrors(result.errors)
    setNotice(null)
    if (result.unchanged) {
      setNotice('현재 상품 정보와 같습니다. 바꿀 상품명이나 설명을 입력해 주세요.')
      return
    }
    if (!result.input) {
      const first = Object.keys(result.errors)[0]
      if (first) document.getElementById(fieldId(first))?.focus()
      return
    }
    // An unclear earlier attempt keeps its base version, so the retry is the same request and key.
    const retry =
      unresolved &&
      unresolved.input.name === result.input.name &&
      unresolved.input.description === result.input.description
    if (retry) setReview(unresolved)
    else {
      setUnresolved(null)
      command.setError(null)
      setReview({ input: result.input, base: product.detailVersion })
    }
    setCheckResult(null)
  }
  function done(updated: AdminProduct, message: string) {
    setReview(null)
    setUnresolved(null)
    setCheckResult(null)
    setEditing(false)
    onChanged(updated, message)
  }
  async function send() {
    if (!review) return
    const body = { expectedDetailVersion: review.base, ...review.input }
    const outcome = await command.run({ productId: product.id, command: 'details', body }, (key) =>
      request<AdminProduct>(`${path}/details`, {
        method: 'POST',
        idempotencyKey: key,
        body: JSON.stringify(body),
      }),
    )
    if (!outcome) return
    if (outcome.ok) {
      done(
        outcome.value,
        `상품 정보를 버전 ${outcome.value.detailVersion}으로 수정했습니다. 고객 상품 화면과 새 신청부터 반영되며 이미 접수된 신청의 상품명은 바뀌지 않습니다.`,
      )
      return
    }
    setCheckResult(null)
    if (isUncertain(outcome.error)) {
      setUnresolved(review)
      return
    }
    setReview(null)
    setErrors(fieldErrorsFrom(outcome.error))
    if (
      outcome.error instanceof ApiError &&
      outcome.error.code === 'PRODUCT_DETAILS_VERSION_CONFLICT'
    )
      onReload()
  }
  async function check() {
    if (!review || checking) return
    setChecking(true)
    setCheckResult(null)
    try {
      const latest = await request<{ items: ProductDetailVersion[] }>(`${path}/details`)
      const outcome = detailsOutcome(latest.items, review.base, review.input)
      if (outcome.state === 'applied') {
        done(
          await request<AdminProduct>(path),
          `상품 정보 수정(버전 ${outcome.version})이 반영된 것을 확인했습니다.`,
        )
        return
      }
      setUnresolved(null)
      command.setError(null)
      if (outcome.state === 'superseded') {
        setReview(null)
        onReload()
        setNotice(
          '다른 관리자가 먼저 상품 정보를 수정했습니다. 최신 정보를 다시 불러왔으니 확인한 뒤 다시 수정해 주세요.',
        )
        return
      }
      setCheckResult({
        message: '수정이 반영되지 않았습니다. 내용을 확인한 뒤 다시 진행할 수 있습니다.',
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
    <section className="bank-record-section" aria-labelledby="bank-admin-details-title">
      <div className="section-heading">
        <div>
          <h2 id="bank-admin-details-title">
            상품 정보 이력
            <span className="count-tag">{historyError ? '—' : history.length}</span>
          </h2>
          <p>
            상품명·설명을 바꾸면 새 정보 버전이 추가됩니다. 이전 버전은 수정·삭제되지 않으며 이미
            접수된 신청에는 접수 당시 상품명이 보관됩니다.
          </p>
        </div>
        {!editing && (
          <button type="button" className="button button-outline small" onClick={startEditing}>
            상품 정보 수정
          </button>
        )}
      </div>
      {editing && (
        <form className="bank-admin-form bank-admin-details-form" onSubmit={confirm} noValidate>
          {!review && !!command.error && (
            <ErrorNotice error={command.error} message={commandMessage(command.error, 'details')} />
          )}
          {notice && (
            <p className="notice" role="status">
              {notice}
            </p>
          )}
          <FieldErrorSummary errors={errors} />
          <fieldset className="form-fieldset" disabled={command.pending}>
            <legend className="bank-sr-only">상품 정보 수정</legend>
            <div className="bank-application-field bank-admin-text-field">
              <label htmlFor={fieldId('name')}>
                상품명 <i aria-hidden="true">*</i>
              </label>
              <div className="input-unit">
                <input
                  id={fieldId('name')}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={MAX_NAME_LENGTH}
                  autoComplete="off"
                  required
                  aria-invalid={!!errors.name}
                  aria-describedby={describedBy('name', errors.name)}
                />
              </div>
              <p className="bank-application-help" id={`${fieldId('name')}-help`}>
                판매 중인 다른 상품과 겹치지 않는 100자 이내의 이름
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
                onChange={(event) => setDescription(event.target.value)}
                maxLength={MAX_DESCRIPTION_LENGTH}
                rows={4}
                required
                aria-invalid={!!errors.description}
                aria-describedby={describedBy('description', errors.description)}
              />
              <p className="bank-application-help" id={`${fieldId('description')}-help`}>
                고객 상품 화면에 표시됩니다 ({description.length.toLocaleString('ko-KR')}/1,000자)
              </p>
              {errors.description && (
                <p className="bank-application-error" id={`${fieldId('description')}-error`}>
                  {errors.description}
                </p>
              )}
            </div>
            <div className="bank-admin-details-actions">
              <button className="button button-primary" type="submit">
                변경 내용 확인
              </button>
              <button
                className="button button-outline"
                type="button"
                onClick={() => {
                  setEditing(false)
                  setReview(null)
                  setUnresolved(null)
                }}
              >
                취소
              </button>
            </div>
          </fieldset>
        </form>
      )}
      {historyError ? (
        <>
          <ErrorNotice error={historyError} message={loadMessage(historyError)} />
          <button
            className="button button-outline small"
            onClick={() => setHistoryReload((value) => value + 1)}
          >
            이력 다시 불러오기
          </button>
        </>
      ) : (
        <div className="bank-application-table-wrap">
          <table className="bank-application-table bank-admin-table">
            <caption className="bank-sr-only">{product.name} 상품 정보 버전 이력</caption>
            <thead>
              <tr>
                <th scope="col">버전</th>
                <th scope="col">상품명</th>
                <th scope="col">상품 설명</th>
                <th scope="col">기록일시</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.version}>
                  <th scope="row" className="bank-product-cell" data-label="버전">
                    버전 {item.version}
                    {item.version === product.detailVersion && (
                      <span className="bank-admin-current-tag">현재</span>
                    )}
                  </th>
                  <td data-label="상품명">{item.name}</td>
                  <td data-label="상품 설명" className="bank-admin-description-cell">
                    {item.description}
                  </td>
                  <td className="bank-date-cell" data-label="기록일시">
                    {dateTime(item.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmDialog
        open={!!review}
        title="상품 정보 수정 확인"
        confirmLabel={unresolved ? '같은 요청으로 다시 시도' : '수정'}
        pendingLabel="처리 중…"
        cancelLabel={unresolved ? '닫기' : '취소'}
        pending={command.pending}
        extraAction={
          !!unresolved && (
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
        onConfirm={send}
        onClose={() => {
          setReview(null)
          setCheckResult(null)
        }}
      >
        {!!command.error && (
          <ErrorNotice error={command.error} message={commandMessage(command.error, 'details')} />
        )}
        {checkResult &&
          (checkResult.failed ? (
            <ErrorNotice error={checkResult.failed} message={checkResult.message} />
          ) : (
            <p className="notice" role="status">
              {checkResult.message}
            </p>
          ))}
        {review && (
          <dl className="bank-confirm-summary">
            <div>
              <dt>기준 정보 버전</dt>
              <dd>
                버전 {review.base} → 버전 {review.base + 1}
              </dd>
            </div>
            <div>
              <dt>상품명</dt>
              <dd>
                {review.input.name === product.name
                  ? `${product.name} (변경 없음)`
                  : `${product.name} → ${review.input.name}`}
              </dd>
            </div>
            <div>
              <dt>상품 설명</dt>
              <dd className="bank-confirm-description">
                {review.input.description === product.description
                  ? '변경 없음'
                  : review.input.description}
              </dd>
            </div>
          </dl>
        )}
        <ul className="bank-confirm-effects">
          <li>고객 상품 목록·상세와 이후 새 신청에 바뀐 정보가 표시됩니다.</li>
          <li>이미 접수된 신청의 상품명과 정책 조건은 바뀌지 않습니다.</li>
          <li>이전 정보는 이력으로 보존되며 정책 버전은 새로 만들지 않습니다.</li>
        </ul>
      </ConfirmDialog>
    </section>
  )
}
