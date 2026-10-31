import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../stores/auth'
import { ApiError } from '../lib/api'
import { createRequestIdentity } from '../lib/idempotency'
import type { StrategyRequest } from '../lib/strategy'
import {
  saveNameError,
  saveNameMaxLength,
  saveStrategy,
  stashPendingInput,
  type SavedStrategy,
} from '../lib/strategySaves'
import AppIcon from './AppIcon'
import ErrorNotice from './ErrorNotice'
import SimField from './sim/SimField'
import '../styles/strategy-saves.css'

/**
 * Saves the input of the plan on screen. The server recomputes the plan, so only the input and a name are sent.
 * An unclear failure keeps the same key for the same name and input, so a retry never saves twice.
 */
export default function StrategySavePanel({
  input,
  stale,
}: {
  input: StrategyRequest
  stale: boolean
}) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [saved, setSaved] = useState<SavedStrategy | null>(null)
  const identity = useRef(createRequestIdentity())
  const sending = useRef(false)

  if (!user || user.role !== 'CUSTOMER') {
    return (
      <section className="strategy-save" aria-labelledby="strategy-save-title">
        <h3 id="strategy-save-title">이 전략 저장하기</h3>
        {user ? (
          <p className="sim-help">
            전략 저장·비교는 고객 계정으로 로그인했을 때 이용할 수 있습니다.
          </p>
        ) : (
          <>
            <p className="sim-help">
              고객 계정으로 로그인하면 이 입력과 결과를 이름 붙여 저장하고, 다른 전략과 나란히
              비교할 수 있습니다. 로그인 후 이 화면으로 돌아오면 입력값을 다시 채워 둡니다.
            </p>
            <button
              type="button"
              className="button button-outline"
              onClick={() => {
                stashPendingInput(input)
                void navigate(`/login?redirect=${encodeURIComponent('/strategy')}`)
              }}
            >
              로그인하고 저장하기 <AppIcon name="arrow" size={16} />
            </button>
          </>
        )}
      </section>
    )
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (sending.current || stale) return
    const problem = saveNameError(name)
    setNameError(problem)
    if (problem) {
      document.getElementById('strategy-save-name')?.focus()
      return
    }
    const payload = { name: name.trim(), input }
    sending.current = true
    setPending(true)
    setError(null)
    try {
      const result = await saveStrategy(
        payload.name,
        payload.input,
        identity.current.keyFor(payload),
      )
      identity.current.clear()
      setSaved(result)
      setName('')
    } catch (cause) {
      if (cause instanceof ApiError && cause.fieldErrors.name) setNameError(cause.fieldErrors.name)
      setError(cause)
    } finally {
      sending.current = false
      setPending(false)
    }
  }

  const limitReached = error instanceof ApiError && error.code === 'STRATEGY_SAVE_LIMIT'
  return (
    <section className="strategy-save" aria-labelledby="strategy-save-title">
      <h3 id="strategy-save-title">이 전략 저장하기</h3>
      <p className="sim-help">
        저장하면 지금 입력값으로 서버가 다시 계산한 결과를 규칙 버전과 함께 보관합니다. 규칙이
        바뀌어도 저장한 결과는 바뀌지 않습니다.
      </p>
      {saved ? (
        <div className="strategy-save-done" role="status">
          <p>
            <AppIcon name="check" size={16} /> ‘{saved.name}’ 전략을 저장했습니다.
          </p>
          <div className="strategy-save-links">
            <Link className="button button-outline small" to={`/strategy/saves/${saved.id}`}>
              저장한 전략 보기
            </Link>
            <Link className="button button-outline small" to="/strategy/saves">
              내 전략 목록·비교
            </Link>
            <button type="button" className="text-button" onClick={() => setSaved(null)}>
              다른 이름으로 한 번 더 저장
            </button>
          </div>
        </div>
      ) : (
        <form className="strategy-save-form" onSubmit={submit} noValidate>
          <SimField
            id="strategy-save-name"
            label="전략 이름"
            inputMode="text"
            maxLength={saveNameMaxLength}
            value={name}
            error={nameError ?? undefined}
            onChange={(value) => {
              setName(value)
              setNameError(null)
            }}
            help={`예: 지출 20만 원 줄인 경우. ${saveNameMaxLength}자 이하. 실제 개인정보는 적지 마세요.`}
          />
          {stale && (
            <p className="sim-help" role="status">
              입력을 바꾸었습니다. 다시 계산한 뒤 저장할 수 있습니다.
            </p>
          )}
          <ErrorNotice
            error={error}
            message={
              limitReached
                ? `${error.message} 내 전략 목록에서 정리할 수 있습니다.`
                : error instanceof ApiError && error.code === 'NETWORK_ERROR'
                  ? '저장 결과를 확인하지 못했습니다. 같은 이름으로 다시 저장하면 같은 요청 키를 사용해 중복 저장되지 않습니다.'
                  : undefined
            }
          />
          <div className="strategy-save-actions">
            <button type="submit" className="button button-primary" disabled={pending || stale}>
              {pending ? '저장 중…' : '전략 저장'}
            </button>
            <Link className="text-button" to="/strategy/saves">
              내 전략 목록 <AppIcon name="chevron" size={14} />
            </Link>
          </div>
        </form>
      )}
    </section>
  )
}
