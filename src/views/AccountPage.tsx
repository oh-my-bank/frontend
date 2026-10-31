import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ApiError } from '../lib/api'
import {
  changePassword,
  fetchAccount,
  passwordChangeErrors,
  passwordFieldLabels,
  serverPasswordErrors,
  type Account,
  type PasswordChange,
  type PasswordErrors,
  type PasswordField,
} from '../lib/account'
import { dateTime } from '../lib/format'
import AppIcon from '../components/AppIcon'
import ErrorNotice from '../components/ErrorNotice'
import '../styles/banking-products.css'
import '../styles/account.css'

const roleLabels = { CUSTOMER: '고객', REVIEWER: '심사 담당자', ADMIN: '운영 관리자' }
const fields: PasswordField[] = ['currentPassword', 'newPassword', 'confirmPassword']
const emptyForm: PasswordChange = { currentPassword: '', newPassword: '', confirmPassword: '' }

export default function AccountPage() {
  const [account, setAccount] = useState<Account | null>(null)
  const [loadError, setLoadError] = useState<unknown>(null)
  const [reload, setReload] = useState(0)
  const [form, setForm] = useState<PasswordChange>(emptyForm)
  const [errors, setErrors] = useState<PasswordErrors>({})
  const [submitError, setSubmitError] = useState<unknown>(null)
  const [changed, setChanged] = useState(false)
  const [pending, setPending] = useState(false)
  // A synchronous guard: a double click must not send two password changes.
  const submitting = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    setLoadError(null)
    fetchAccount(controller.signal)
      .then(setAccount)
      .catch((cause) => {
        if (!controller.signal.aborted) setLoadError(cause)
      })
    return () => controller.abort()
  }, [reload])

  function edit(field: PasswordField, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setChanged(false)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return
    const local = passwordChangeErrors(form)
    setErrors(local)
    setSubmitError(null)
    setChanged(false)
    const first = fields.find((field) => local[field])
    if (first) {
      document.getElementById(`account-${first}`)?.focus()
      return
    }
    submitting.current = true
    setPending(true)
    try {
      setAccount(await changePassword(form))
      setForm(emptyForm)
      setChanged(true)
    } catch (cause) {
      const fromServer = cause instanceof ApiError ? serverPasswordErrors(cause.fieldErrors) : {}
      setErrors(fromServer)
      setSubmitError(cause)
      const field = fields.find((name) => fromServer[name])
      if (field) document.getElementById(`account-${field}`)?.focus()
    } finally {
      submitting.current = false
      setPending(false)
    }
  }

  const locked = submitError instanceof ApiError && submitError.code === 'LOGIN_LOCKED'
  return (
    <>
      <header className="page-title">
        <h1>내 정보</h1>
        <p>로그인 기록을 확인하고 비밀번호를 변경합니다.</p>
      </header>

      <section
        className="account-card"
        aria-labelledby="account-profile-title"
        aria-busy={!account && !loadError}
      >
        <h2 id="account-profile-title">계정 정보</h2>
        {loadError ? (
          <>
            <ErrorNotice error={loadError} message="계정 정보를 불러오지 못했습니다." />
            <button className="button button-outline small" onClick={() => setReload((n) => n + 1)}>
              다시 불러오기
            </button>
          </>
        ) : !account ? (
          <div className="empty-state" role="status">
            계정 정보를 불러오고 있습니다.
          </div>
        ) : (
          <>
            <dl className="details-list">
              <div>
                <dt>이름</dt>
                <dd>{account.name}</dd>
              </div>
              <div>
                <dt>이메일</dt>
                <dd className="account-wrap">{account.email}</dd>
              </div>
              <div>
                <dt>역할</dt>
                <dd>{roleLabels[account.role]}</dd>
              </div>
              <div>
                <dt>가입일시</dt>
                <dd>{dateTime(account.createdAt)}</dd>
              </div>
              <div>
                <dt>이번 로그인</dt>
                <dd>{account.lastLoginAt ? dateTime(account.lastLoginAt) : '기록 없음'}</dd>
              </div>
              <div>
                <dt>직전 로그인</dt>
                <dd>
                  {account.previousLoginAt
                    ? dateTime(account.previousLoginAt)
                    : '기록 없음(이번이 첫 로그인입니다)'}
                </dd>
              </div>
              <div>
                <dt>비밀번호 변경</dt>
                <dd>
                  {account.passwordChangedAt
                    ? dateTime(account.passwordChangedAt)
                    : '변경 기록 없음'}
                </dd>
              </div>
            </dl>
            <p className="account-hint">
              <AppIcon name="info" size={16} />
              직전 로그인 시각이 기억과 다르면 다른 사람이 계정을 사용했을 수 있습니다. 비밀번호를
              바로 변경해 주세요.
            </p>
          </>
        )}
      </section>

      <section className="account-card" aria-labelledby="account-protection-title">
        <h2 id="account-protection-title">로그인 보호</h2>
        <p>
          {account
            ? `이메일 하나에 로그인을 ${account.loginPolicy.maxFailures}회 연속 실패하면 ${account.loginPolicy.lockMinutes}분 동안 로그인이 제한됩니다.`
            : '연속으로 여러 번 로그인에 실패하면 잠시 로그인이 제한됩니다.'}{' '}
          비밀번호 변경 화면의 현재 비밀번호 오입력도 같은 횟수에 포함됩니다. 이 기준은 교육용
          가정값이며 실제 은행의 기준과 다를 수 있습니다.
        </p>
      </section>

      <section className="account-card" aria-labelledby="account-password-title">
        <h2 id="account-password-title">비밀번호 변경</h2>
        <p>
          변경하면 이 화면의 로그인은 유지되고, 다른 브라우저·기기의 로그인은 다음 요청 때
          종료됩니다. 실제로 사용하는 비밀번호를 입력하지 마세요.
        </p>
        {changed && (
          <div className="notice account-success" role="status">
            비밀번호를 변경했습니다. 다른 곳의 로그인은 종료되며 다음 로그인부터 새 비밀번호를
            사용합니다.
          </div>
        )}
        <ErrorNotice
          error={submitError}
          message={
            locked
              ? `${submitError.message} 제한이 끝날 때까지 비밀번호를 변경할 수 없습니다.`
              : undefined
          }
        />
        <form className="stack-form account-form" onSubmit={submit} noValidate>
          <fieldset className="form-fieldset" disabled={pending}>
            {fields.map((field) => (
              <div className="bank-application-field" key={field}>
                <label htmlFor={`account-${field}`}>{passwordFieldLabels[field]}</label>
                <input
                  id={`account-${field}`}
                  type="password"
                  value={form[field]}
                  onChange={(event) => edit(field, event.target.value)}
                  maxLength={72}
                  autoComplete={field === 'currentPassword' ? 'current-password' : 'new-password'}
                  required
                  aria-invalid={!!errors[field]}
                  aria-describedby={
                    [
                      field === 'newPassword' ? 'account-newPassword-help' : '',
                      errors[field] ? `account-${field}-error` : '',
                    ]
                      .filter(Boolean)
                      .join(' ') || undefined
                  }
                />
                {field === 'newPassword' && (
                  <p className="bank-application-help" id="account-newPassword-help">
                    10자 이상, UTF-8 기준 72바이트 이하 · 현재 비밀번호와 달라야 합니다.
                  </p>
                )}
                {errors[field] && (
                  <p className="bank-application-error" id={`account-${field}-error`}>
                    {errors[field]}
                  </p>
                )}
              </div>
            ))}
            <button className="button button-primary" disabled={pending}>
              {pending ? '변경 중입니다…' : '비밀번호 변경'}
            </button>
          </fieldset>
        </form>
      </section>
    </>
  )
}
