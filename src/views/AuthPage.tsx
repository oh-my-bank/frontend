import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../stores/auth'
import AppIcon from '../components/AppIcon'
import ErrorNotice from '../components/ErrorNotice'
import { destinationAfterAuthentication } from '../lib/navigation'

export default function AuthPage() {
  const { login, register, error: connectionError, sessionExpired } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const registering = params.get('mode') === 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<unknown>(null)
  function changeMode(value: boolean) {
    setError(null)
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (value) next.set('mode', 'register')
        else next.delete('mode')
        return next
      },
      { replace: true },
    )
  }
  function tabKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next = event.key === 'Home' ? false : event.key === 'End' ? true : !registering
    changeMode(next)
    document.getElementById(next ? 'register-tab' : 'login-tab')?.focus()
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setError(null)
    try {
      const user = registering
        ? await register({ email: email.trim(), password, name: name.trim() })
        : await login({ email: email.trim(), password })
      navigate(destinationAfterAuthentication(params.get('redirect'), user.role, registering), {
        replace: true,
      })
    } catch (cause) {
      setError(cause)
    } finally {
      setPending(false)
    }
  }
  return (
    <>
      <header className="page-title">
        <h1>{registering ? '회원가입' : '로그인'}</h1>
        <p>
          {registering ? '학습용 고객 계정을 등록합니다.' : 'Oh My Bank에 오신 것을 환영합니다.'}
        </p>
      </header>
      <div className="auth-tabs" role="tablist" aria-label="회원 서비스">
        <button
          role="tab"
          aria-selected={!registering}
          tabIndex={registering ? -1 : 0}
          onKeyDown={tabKey}
          aria-controls="auth-panel"
          id="login-tab"
          disabled={pending}
          onClick={() => changeMode(false)}
        >
          로그인
        </button>
        <button
          role="tab"
          aria-selected={registering}
          tabIndex={registering ? 0 : -1}
          onKeyDown={tabKey}
          aria-controls="auth-panel"
          id="register-tab"
          disabled={pending}
          onClick={() => changeMode(true)}
        >
          회원가입
        </button>
      </div>
      <section
        id="auth-panel"
        className="bank-auth-panel"
        role="tabpanel"
        aria-labelledby={registering ? 'register-tab' : 'login-tab'}
      >
        <div className="bank-auth-form">
          <h2>{registering ? '고객정보 입력' : '이메일 로그인'}</h2>
          <p className="auth-form-intro">
            {registering
              ? '가상의 정보로 계정을 만들어 주세요.'
              : '가입 시 등록한 이메일과 비밀번호를 입력해 주세요.'}
          </p>
          {connectionError && <div className="notice">{connectionError}</div>}
          {sessionExpired && !registering && (
            <div className="notice" role="status">
              로그인 시간이 만료되었습니다. 다시 로그인하면 이용하던 화면으로 돌아갑니다. 완료
              안내를 받지 못한 변경은 다시 확인해 주세요.
            </div>
          )}
          <ErrorNotice error={error} />
          <form className="stack-form" onSubmit={submit}>
            <fieldset className="form-fieldset" disabled={pending}>
              {registering && (
                <label htmlFor="auth-name">
                  이름
                  <input
                    id="auth-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={60}
                    autoComplete="name"
                    required
                    placeholder="가상 고객 이름"
                  />
                </label>
              )}
              <label htmlFor="auth-email">
                이메일
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={254}
                  autoComplete="username"
                  required
                  placeholder="name@example.com"
                />
              </label>
              <label htmlFor="auth-password">
                비밀번호
                <input
                  id="auth-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={registering ? 10 : undefined}
                  maxLength={72}
                  autoComplete={registering ? 'new-password' : 'current-password'}
                  required
                  placeholder="비밀번호를 입력해 주세요"
                  aria-describedby={registering ? 'password-help' : undefined}
                />
                {registering && (
                  <small id="password-help" className="form-help">
                    10자 이상, UTF-8 기준 72바이트 이하
                  </small>
                )}
              </label>
              <button className="button button-primary full auth-submit" disabled={pending}>
                {pending ? '처리 중입니다…' : registering ? '가입하기' : '로그인'}
              </button>
            </fieldset>
          </form>
          <div className="auth-form-links">
            <button
              type="button"
              className="text-button"
              onClick={() => changeMode(!registering)}
              disabled={pending}
            >
              {registering ? '로그인으로 이동' : '처음 이용하시나요? 회원가입'}
              <AppIcon name="chevron" size={14} />
            </button>
          </div>
        </div>
        <aside className="auth-information">
          <span className="auth-shield">
            <AppIcon name="shield" size={38} />
          </span>
          <h2>
            가상 자금으로 배우는
            <br />
            은행 이용
          </h2>
          <p>
            실제 자금 이동 없이
            <br />
            예·적금 운용과 대출 업무를 경험해 보세요.
          </p>
          <ul>
            <li>가상 정보로 회원가입</li>
            <li>모의 운용에서 예·적금 가입과 시간 진행</li>
            <li>대출 상품 신청과 접수 내역 조회</li>
          </ul>
          <Link to="/guide" className="button button-outline small">
            이용안내
            <AppIcon name="chevron" size={14} />
          </Link>
        </aside>
      </section>
      <div className="auth-bottom-notice">
        <AppIcon name="info" size={19} />
        <p>
          금융업무 학습을 위한 시뮬레이션입니다. 실제 개인정보·금융정보 대신 가상의 정보로 이용해
          주세요.
        </p>
      </div>
    </>
  )
}
