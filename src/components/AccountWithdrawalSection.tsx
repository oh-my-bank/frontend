import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError } from '../lib/api'
import {
  WITHDRAWAL_CONFIRM_PHRASE,
  serverWithdrawalErrors,
  withdrawAccount,
  withdrawalEffects,
  withdrawalErrorMessage,
  withdrawalErrors,
  withdrawalNotice,
  type WithdrawalErrors,
  type WithdrawalField,
  type WithdrawalInput,
} from '../lib/withdrawal'
import { useAuth } from '../stores/auth'
import type { Role } from '../types'
import AppIcon from './AppIcon'
import ConfirmDialog from './ConfirmDialog'
import ErrorNotice from './ErrorNotice'
import '../styles/account-withdrawal.css'

const fields: WithdrawalField[] = ['currentPassword', 'confirm']
const emptyForm: WithdrawalInput = { currentPassword: '', confirm: '' }

/**
 * Customer self-withdrawal (L08). The account row is de-identified, personal inputs are deleted and transaction records stay
 * without anything that identifies the customer. Staff accounts are closed by the operator, so they see the procedure only.
 */
export default function AccountWithdrawalSection({ role }: { role: Role }) {
  const navigate = useNavigate()
  const { endSession } = useAuth()
  const [form, setForm] = useState<WithdrawalInput>(emptyForm)
  const [errors, setErrors] = useState<WithdrawalErrors>({})
  const [submitError, setSubmitError] = useState<unknown>(null)
  const [confirming, setConfirming] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)
  const [pending, setPending] = useState(false)
  // A synchronous guard: a double click must not send two withdrawals.
  const sending = useRef(false)
  // Set once the server ended the session. The signed-in state is cleared when this page unmounts after leaving for the home page:
  // clearing it while /account is still shown would let the route guard send the user to the login page instead.
  const withdrawn = useRef(false)
  const endSessionRef = useRef(endSession)
  endSessionRef.current = endSession
  useEffect(
    () => () => {
      if (withdrawn.current) endSessionRef.current()
    },
    [],
  )

  if (role !== 'CUSTOMER') {
    return (
      <section className="account-card" aria-labelledby="account-withdrawal-title">
        <h2 id="account-withdrawal-title">회원 탈퇴</h2>
        <p>
          심사 담당자·운영 관리자 계정은 화면에서 스스로 탈퇴할 수 없습니다. 업무 기록의 책임자를
          남겨야 하므로 운영 관리자가 운영 절차에 따라 계정을 정리합니다. 운영 관리자에게 요청해
          주세요.
        </p>
      </section>
    )
  }

  function edit(field: WithdrawalField, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const local = withdrawalErrors(form)
    setErrors(local)
    setSubmitError(null)
    const first = fields.find((field) => local[field])
    if (first) {
      document.getElementById(`withdrawal-${first}`)?.focus()
      return
    }
    setAcknowledged(false)
    setConfirming(true)
  }

  async function send() {
    if (sending.current) return
    sending.current = true
    setPending(true)
    try {
      const result = await withdrawAccount(form)
      withdrawn.current = true
      void navigate('/', { replace: true, state: { notice: withdrawalNotice(result) } })
    } catch (cause) {
      const fromServer = cause instanceof ApiError ? serverWithdrawalErrors(cause.fieldErrors) : {}
      setConfirming(false)
      setErrors(fromServer)
      setSubmitError(cause)
      setForm((current) => ({ ...current, currentPassword: '' }))
      const field = fields.find((name) => fromServer[name])
      if (field) document.getElementById(`withdrawal-${field}`)?.focus()
    } finally {
      sending.current = false
      setPending(false)
    }
  }

  const blockedByLoan =
    submitError instanceof ApiError && submitError.code === 'WITHDRAWAL_BLOCKED_ACTIVE_LOAN'
  return (
    <section className="account-card account-withdrawal" aria-labelledby="account-withdrawal-title">
      <h2 id="account-withdrawal-title">회원 탈퇴</h2>
      <p>
        탈퇴하면 이 계정으로 다시 로그인할 수 없고 되돌릴 수 없습니다. 상환 중인 대출이 있으면
        탈퇴할 수 없습니다(실제 은행에서 잔액이 남은 대출 계좌를 해지할 수 없는 것과 같은
        원칙입니다). 모의 운용의 가상 자금은 탈퇴를 막지 않습니다.
      </p>
      <div className="withdrawal-effects">
        <div>
          <h3>지워지는 정보</h3>
          <ul>
            {withdrawalEffects.deleted.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3>식별할 수 없는 상태로 남는 기록</h3>
          <ul>
            {withdrawalEffects.retained.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
      <p className="account-hint">
        <AppIcon name="info" size={16} />
        탈퇴 후 같은 이메일로 다시 가입할 수 있습니다. 새 계정은 이전 기록과 연결되지 않습니다.
      </p>

      <ErrorNotice error={submitError} message={withdrawalErrorMessage(submitError) ?? undefined} />
      {blockedByLoan && (
        <p className="withdrawal-next">
          <Link to="/my">신청·대출 내역에서 상환 중인 대출 확인하기</Link>
        </p>
      )}
      <form className="stack-form account-form" onSubmit={review} noValidate>
        <fieldset className="form-fieldset" disabled={pending}>
          <div className="bank-application-field">
            <label htmlFor="withdrawal-currentPassword">현재 비밀번호</label>
            <input
              id="withdrawal-currentPassword"
              type="password"
              value={form.currentPassword}
              onChange={(event) => edit('currentPassword', event.target.value)}
              maxLength={72}
              autoComplete="current-password"
              required
              aria-invalid={!!errors.currentPassword}
              aria-describedby={
                [
                  'withdrawal-currentPassword-help',
                  errors.currentPassword ? 'withdrawal-currentPassword-error' : '',
                ]
                  .filter(Boolean)
                  .join(' ') || undefined
              }
            />
            <p className="bank-application-help" id="withdrawal-currentPassword-help">
              틀리면 로그인 실패와 같은 횟수에 포함됩니다.
            </p>
            {errors.currentPassword && (
              <p className="bank-application-error" id="withdrawal-currentPassword-error">
                {errors.currentPassword}
              </p>
            )}
          </div>
          <div className="bank-application-field">
            <label htmlFor="withdrawal-confirm">확인 문구</label>
            <input
              id="withdrawal-confirm"
              type="text"
              value={form.confirm}
              onChange={(event) => edit('confirm', event.target.value)}
              maxLength={20}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              required
              aria-invalid={!!errors.confirm}
              aria-describedby={
                ['withdrawal-confirm-help', errors.confirm ? 'withdrawal-confirm-error' : '']
                  .filter(Boolean)
                  .join(' ') || undefined
              }
            />
            <p className="bank-application-help" id="withdrawal-confirm-help">
              탈퇴하려면 <strong>{WITHDRAWAL_CONFIRM_PHRASE}</strong>를 대문자로 입력해 주세요.
            </p>
            {errors.confirm && (
              <p className="bank-application-error" id="withdrawal-confirm-error">
                {errors.confirm}
              </p>
            )}
          </div>
          <button className="button button-danger-outline" disabled={pending}>
            회원 탈퇴 진행
          </button>
        </fieldset>
      </form>

      <ConfirmDialog
        open={confirming}
        title="회원 탈퇴"
        confirmLabel="탈퇴하기"
        pendingLabel="탈퇴 처리 중입니다…"
        cancelLabel="계속 이용하기"
        pending={pending}
        danger
        confirmDisabled={!acknowledged}
        onConfirm={() => void send()}
        onClose={() => setConfirming(false)}
      >
        <p>
          탈퇴하면 이 계정의 이메일·이름·비밀번호와 저장한 전략·학습 진도가 지워지고 모든 기기에서
          로그아웃됩니다. 대출·모의 운용 기록은 누구의 것인지 알 수 없는 상태로 남습니다.
        </p>
        <label className="bank-confirm-acknowledge">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
            disabled={pending}
          />
          <span>탈퇴는 되돌릴 수 없고 지운 정보는 복구할 수 없다는 것을 확인했습니다.</span>
        </label>
      </ConfirmDialog>
    </section>
  )
}
