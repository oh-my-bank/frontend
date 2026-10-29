import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../stores/auth'
import AppIcon from '../components/AppIcon'
import BrandLogo from '../components/BrandLogo'
import ErrorNotice from '../components/ErrorNotice'
import { destinationAfterAuthentication } from '../lib/navigation'

export default function AuthPage() {
  const { login, register, error: connectionError } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [registering, setRegistering] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<unknown>(null)
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
    <div className="auth-layout">
      <section className="auth-story">
        <BrandLogo to="/products" />
        <div className="auth-story-content">
          <span className="pill pill-outline">YOUR FIRST FINANCIAL JOURNEY</span>
          <h1>
            금융의 흐름을,
            <br />
            나의 경험으로.
          </h1>
          <p>
            상품을 알아보고, 대출을 신청하고.
            <br />
            가상의 금융 생활에서 진짜 이해를 시작하세요.
          </p>
          <div className="auth-art" aria-hidden="true">
            <div className="art-ring ring-one" />
            <div className="art-ring ring-two" />
            <div className="art-card">
              <span>OH MY BANK</span>
              <strong>
                금융을 배우는
                <br />
                새로운 시작.
              </strong>
              <div className="art-card-bottom">
                <i />
                <span>SIMULATION ONLY</span>
              </div>
            </div>
            <span className="art-star">✳</span>
          </div>
        </div>
        <p className="auth-disclaimer">
          <AppIcon name="shield" size={16} />
          실제 자금 이동 없는 안전한 가상 환경
        </p>
      </section>
      <main id="main" className="auth-form-panel">
        <div className="auth-form-wrap">
          <span className="eyebrow">WELCOME TO OMB</span>
          <h2>{registering ? '새로운 시작을 함께해요.' : '다시 만나 반가워요.'}</h2>
          <p className="muted">
            {registering
              ? '가상의 정보로 테스트 계정을 만들어 주세요.'
              : '로그인하고 나의 금융 여정을 이어가세요.'}
          </p>
          {connectionError && (
            <div className="info-banner">{connectionError} 백엔드가 실행 중인지 확인해 주세요.</div>
          )}
          <ErrorNotice error={error} />
          <form onSubmit={submit} className="stack-form">
            {registering && (
              <label>
                이름
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={60}
                  autoComplete="name"
                  placeholder="가상 고객 이름"
                  disabled={pending}
                />
              </label>
            )}
            <label>
              이메일
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                maxLength={254}
                autoComplete="username"
                placeholder="name@example.com"
                disabled={pending}
              />
            </label>
            <label>
              비밀번호
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
                minLength={registering ? 10 : undefined}
                maxLength={72}
                autoComplete={registering ? 'new-password' : 'current-password'}
                placeholder="비밀번호를 입력해 주세요"
                disabled={pending}
              />
              {registering && (
                <small className="muted">
                  10자 이상, UTF-8 기준 72바이트 이하로 입력해 주세요.
                </small>
              )}
            </label>
            <button className="button button-dark full" disabled={pending}>
              {pending ? '처리 중…' : registering ? '테스트 계정 만들기' : '로그인'}
              <AppIcon name="arrow" size={18} />
            </button>
          </form>
          <p className="auth-switch">
            {registering ? '이미 계정이 있나요?' : '처음 방문하셨나요?'}
            <button
              type="button"
              className="text-button"
              disabled={pending}
              onClick={() => {
                setRegistering((v) => !v)
                setError(null)
              }}
            >
              {registering ? '로그인' : '테스트 계정 만들기'}
            </button>
          </p>
          <Link to="/products" className="auth-browse">
            로그인 없이 금융상품 둘러보기
            <AppIcon name="arrow" size={15} />
          </Link>
          <div className="auth-footnote">
            학습용 서비스입니다. 실제 개인정보나 금융정보를 입력하지 마세요.
          </div>
        </div>
      </main>
    </div>
  )
}
