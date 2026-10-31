import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ApiError, request } from '../lib/api'
import {
  actionLabel,
  actionLabels,
  auditLoadMessage,
  auditQuery,
  filterFromParams,
  filterToParams,
  hasFilter,
  roleLabel,
  stateParts,
  targetLink,
  targetTypeLabel,
  targetTypeLabels,
  validateFilter,
  type AuditEntry,
  type AuditFilter,
  type AuditFilterField,
  type AuditPage,
} from '../lib/auditLogs'
import { dateTime } from '../lib/format'
import { useAuth } from '../stores/auth'
import AppIcon from '../components/AppIcon'
import ErrorNotice from '../components/ErrorNotice'
import '../styles/banking-records.css'
import '../styles/banking-admin.css'
import '../styles/audit-logs.css'

const fieldIds: Record<AuditFilterField, string> = {
  fromDate: 'audit-from',
  toDate: 'audit-to',
  action: 'audit-action',
  targetType: 'audit-target-type',
  actorId: 'audit-actor',
  targetId: 'audit-target',
}

function StateCell({ value }: { value: string | null }) {
  const parts = stateParts(value)
  if (!parts.length) return <span className="bank-audit-none">없음</span>
  return (
    <span className="bank-audit-state">
      {parts.map((part) => (
        <code key={part}>{part}</code>
      ))}
    </span>
  )
}

export default function AdminAuditLogsPage() {
  const { refresh } = useAuth()
  const [params, setParams] = useSearchParams()
  const applied = filterFromParams(params)
  const appliedKey = params.toString()
  const [form, setForm] = useState<AuditFilter>(applied)
  const [errors, setErrors] = useState<Partial<Record<AuditFilterField, string>>>({})
  const [items, setItems] = useState<AuditEntry[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [pending, setPending] = useState(true)
  const [more, setMore] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [moreError, setMoreError] = useState<unknown>(null)
  const [reload, setReload] = useState(0)
  const moreController = useRef<AbortController | null>(null)
  const resultsHeading = useRef<HTMLHeadingElement>(null)

  // A new filter or reload starts again from the newest record; the cursor belongs to one filter.
  useEffect(() => {
    setForm(applied)
    const invalid = validateFilter(applied)
    if (Object.keys(invalid).length) {
      setErrors(invalid)
      setItems([])
      setNextCursor(null)
      setPending(false)
      return
    }
    const controller = new AbortController()
    moreController.current?.abort()
    setPending(true)
    setError(null)
    setMoreError(null)
    void request<AuditPage>(`/admin/audit-logs${auditQuery(applied)}`, {
      signal: controller.signal,
    })
      .then((page) => {
        if (controller.signal.aborted) return
        setItems(page.items)
        setNextCursor(page.nextCursor)
      })
      .catch((cause) => {
        if (controller.signal.aborted) return
        setItems([])
        setNextCursor(null)
        setError(cause)
        if (cause instanceof ApiError && cause.status === 403) void refresh().catch(() => null)
      })
      .finally(() => {
        if (!controller.signal.aborted) setPending(false)
      })
    return () => controller.abort()
  }, [appliedKey, reload])

  useEffect(() => () => moreController.current?.abort(), [])

  const change = (field: AuditFilterField, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }
  const apply = (filter: AuditFilter) => {
    const invalid = validateFilter(filter)
    setErrors(invalid)
    const first = Object.keys(invalid)[0] as AuditFilterField | undefined
    if (first) {
      document.getElementById(fieldIds[first])?.focus()
      return
    }
    const nextParams = filterToParams(filter)
    if (nextParams.toString() === appliedKey) setReload((value) => value + 1)
    else setParams(nextParams)
    resultsHeading.current?.focus()
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    apply(form)
  }
  const narrow = (field: 'actorId' | 'targetId', value: string) =>
    apply({ ...applied, [field]: value })

  const loadMore = () => {
    if (!nextCursor || more) return
    const controller = new AbortController()
    moreController.current = controller
    setMore(true)
    setMoreError(null)
    void request<AuditPage>(`/admin/audit-logs${auditQuery(applied, nextCursor)}`, {
      signal: controller.signal,
    })
      .then((page) => {
        if (controller.signal.aborted) return
        setItems((current) => [...current, ...page.items])
        setNextCursor(page.nextCursor)
      })
      .catch((cause) => {
        if (controller.signal.aborted) return
        setMoreError(cause)
        if (cause instanceof ApiError && cause.status === 403) void refresh().catch(() => null)
      })
      .finally(() => {
        if (!controller.signal.aborted) setMore(false)
      })
  }

  const describedBy = (field: AuditFilterField, help = false) =>
    [help ? `${fieldIds[field]}-help` : '', errors[field] ? `${fieldIds[field]}-error` : '']
      .filter(Boolean)
      .join(' ') || undefined
  const fieldError = (field: AuditFilterField) =>
    errors[field] && (
      <p className="bank-application-error" id={`${fieldIds[field]}-error`}>
        {errors[field]}
      </p>
    )
  const filtered = hasFilter(applied)

  return (
    <>
      <section className="page-title">
        <h1>감사 로그</h1>
        <p>가입·신청·심사·상품 변경 업무의 수행자와 상태 변화를 최신순으로 조회합니다.</p>
      </section>
      <div className="notice bank-admin-scope">
        감사 기록은 각 업무가 처리될 때 함께 저장되며 이 화면에서는 조회만 할 수 있습니다. 고객
        이름은 첫 글자만 표시하고 이메일·비밀번호는 표시하지 않습니다. 모든 데이터는 가상 고객의
        시뮬레이션 기록입니다.
      </div>

      <section className="bank-record-section" aria-labelledby="bank-audit-filter-title">
        <form className="bank-audit-filter" onSubmit={submit} noValidate>
          <h2 id="bank-audit-filter-title" className="bank-admin-form-title">
            조회 조건
          </h2>
          <div className="bank-audit-filter-grid">
            <div className="bank-application-field">
              <label htmlFor={fieldIds.fromDate}>시작일</label>
              <input
                id={fieldIds.fromDate}
                type="date"
                value={form.fromDate}
                onChange={(event) => change('fromDate', event.target.value)}
                aria-invalid={!!errors.fromDate}
                aria-describedby={describedBy('fromDate')}
              />
              {fieldError('fromDate')}
            </div>
            <div className="bank-application-field">
              <label htmlFor={fieldIds.toDate}>종료일</label>
              <input
                id={fieldIds.toDate}
                type="date"
                value={form.toDate}
                onChange={(event) => change('toDate', event.target.value)}
                aria-invalid={!!errors.toDate}
                aria-describedby={describedBy('toDate', true)}
              />
              <p className="bank-application-help" id={`${fieldIds.toDate}-help`}>
                한국 시간 기준, 종료일 하루 전체를 포함합니다.
              </p>
              {fieldError('toDate')}
            </div>
            <div className="bank-application-field">
              <label htmlFor={fieldIds.action}>행위</label>
              <select
                id={fieldIds.action}
                value={form.action}
                onChange={(event) => change('action', event.target.value)}
              >
                <option value="">전체</option>
                {Object.entries(actionLabels).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
                {form.action && !actionLabels[form.action] && (
                  <option value={form.action}>{form.action}</option>
                )}
              </select>
            </div>
            <div className="bank-application-field">
              <label htmlFor={fieldIds.targetType}>대상 유형</label>
              <select
                id={fieldIds.targetType}
                value={form.targetType}
                onChange={(event) => change('targetType', event.target.value)}
              >
                <option value="">전체</option>
                {Object.entries(targetTypeLabels).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
                {form.targetType && !targetTypeLabels[form.targetType] && (
                  <option value={form.targetType}>{form.targetType}</option>
                )}
              </select>
            </div>
            <div className="bank-application-field bank-admin-text-field">
              <label htmlFor={fieldIds.actorId}>수행자 ID</label>
              <div className="input-unit">
                <input
                  id={fieldIds.actorId}
                  value={form.actorId}
                  onChange={(event) => change('actorId', event.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={!!errors.actorId}
                  aria-describedby={describedBy('actorId')}
                />
              </div>
              {fieldError('actorId')}
            </div>
            <div className="bank-application-field bank-admin-text-field">
              <label htmlFor={fieldIds.targetId}>대상 ID</label>
              <div className="input-unit">
                <input
                  id={fieldIds.targetId}
                  value={form.targetId}
                  onChange={(event) => change('targetId', event.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={!!errors.targetId}
                  aria-describedby={describedBy('targetId')}
                />
              </div>
              {fieldError('targetId')}
            </div>
          </div>
          <div className="bank-audit-filter-actions">
            <button className="button button-primary" type="submit">
              <AppIcon name="search" size={17} />
              조회
            </button>
            <button
              className="button button-outline"
              type="button"
              disabled={!filtered && !hasFilter(form)}
              onClick={() => {
                setErrors({})
                setForm(filterFromParams(new URLSearchParams()))
                if (filtered) setParams(new URLSearchParams())
              }}
            >
              조건 초기화
            </button>
          </div>
        </form>
      </section>

      <section className="bank-record-section" aria-labelledby="bank-audit-list-title">
        <div className="section-heading">
          <div>
            <h2 id="bank-audit-list-title" ref={resultsHeading} tabIndex={-1}>
              감사 기록
              <span className="count-tag">
                {pending || error ? '—' : `${items.length}${nextCursor ? '+' : ''}`}
              </span>
            </h2>
            <p>
              {filtered ? '조회 조건에 맞는 기록' : '전체 기록'}을 최신순으로{' '}
              {items.length ? '표시합니다.' : '조회합니다.'} 한 번에 최대 50건씩 불러옵니다.
            </p>
          </div>
        </div>
        <ErrorNotice error={error} message={auditLoadMessage(error)} />
        {pending ? (
          <div className="empty-state" role="status">
            감사 기록을 불러오고 있습니다.
          </div>
        ) : error ? (
          <div className="empty-state">
            <h3>감사 기록을 불러오지 못했습니다.</h3>
            <p>연결 상태와 계정 권한, 조회 조건을 확인한 뒤 다시 시도해 주세요.</p>
            <button
              className="button button-outline small"
              onClick={() => setReload((value) => value + 1)}
            >
              다시 불러오기
            </button>
          </div>
        ) : Object.keys(validateFilter(applied)).length ? (
          <div className="empty-state">
            <h3>조회 조건을 확인해 주세요.</h3>
            <p>주소에 담긴 조건이 올바르지 않습니다. 조건을 고친 뒤 다시 조회해 주세요.</p>
          </div>
        ) : !items.length ? (
          <div className="empty-state bank-empty-records">
            <AppIcon name="document" size={30} />
            <h3>{filtered ? '조건에 맞는 감사 기록이 없습니다.' : '아직 감사 기록이 없습니다.'}</h3>
            {filtered && (
              <button className="text-button" onClick={() => setParams(new URLSearchParams())}>
                전체 기록 보기
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="bank-application-table-wrap">
              <table className="bank-application-table bank-admin-table bank-audit-table">
                <caption className="bank-sr-only">
                  감사 기록 목록, 최신순 {items.length}건{nextCursor ? ', 이후 기록 있음' : ''}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">일시</th>
                    <th scope="col">행위</th>
                    <th scope="col">대상</th>
                    <th scope="col">변경 전</th>
                    <th scope="col">변경 후</th>
                    <th scope="col">수행자</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((entry) => {
                    const link = targetLink(entry)
                    return (
                      <tr key={entry.id}>
                        <td className="bank-date-cell" data-label="일시">
                          <time dateTime={entry.occurredAt}>{dateTime(entry.occurredAt)}</time>
                        </td>
                        <td className="bank-product-cell" data-label="행위">
                          <strong>{actionLabel(entry.action)}</strong>
                          <small className="bank-audit-code">{entry.action}</small>
                        </td>
                        <td data-label="대상">
                          <span className="bank-audit-target">
                            {targetTypeLabel(entry.targetType)}
                            {link ? (
                              <Link to={link} className="bank-audit-id">
                                {entry.targetId}
                              </Link>
                            ) : (
                              <code className="bank-audit-id">{entry.targetId}</code>
                            )}
                          </span>
                          {applied.targetId !== entry.targetId && (
                            <button
                              type="button"
                              className="text-button bank-audit-narrow"
                              onClick={() => narrow('targetId', entry.targetId)}
                            >
                              이 대상 기록만
                            </button>
                          )}
                        </td>
                        <td data-label="변경 전">
                          <StateCell value={entry.beforeState} />
                        </td>
                        <td data-label="변경 후">
                          <StateCell value={entry.afterState} />
                        </td>
                        <td data-label="수행자">
                          <span className="bank-audit-target">
                            {entry.actor.displayName ?? '이름 없음'}
                            <small>{roleLabel(entry.actor.role)}</small>
                          </span>
                          {applied.actorId !== entry.actor.id && (
                            <button
                              type="button"
                              className="text-button bank-audit-narrow"
                              onClick={() => narrow('actorId', entry.actor.id)}
                            >
                              이 수행자 기록만
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <ErrorNotice
              error={moreError}
              message={
                auditLoadMessage(moreError) ??
                '다음 기록을 불러오지 못했습니다. 이미 표시한 기록은 그대로 유지됩니다.'
              }
            />
            <div className="bank-audit-more">
              {nextCursor ? (
                <button
                  className="button button-outline"
                  type="button"
                  onClick={loadMore}
                  disabled={more}
                  aria-busy={more}
                >
                  {more ? '불러오는 중' : moreError ? '다시 시도' : '이전 기록 더 보기'}
                </button>
              ) : (
                <p role="status">조건에 맞는 마지막 기록까지 표시했습니다.</p>
              )}
            </div>
          </>
        )}
      </section>
    </>
  )
}
