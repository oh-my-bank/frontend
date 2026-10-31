import { useState } from 'react'
import { ApiError, request } from '../lib/api'
import { won } from '../lib/format'
import {
  REVERSAL_NOTE_LIMIT,
  loanCommandMessage,
  loanDate,
  needsLoanReload,
  reversalApplied,
  reversalBody,
  reversalReasons,
  reversalTarget,
  type LoanDetail,
  type RepaymentReversalResult,
  type ReversalReason,
} from '../lib/loans'
import { isUncertain } from '../lib/reviews'
import { useAdminCommand } from '../lib/useAdminCommand'
import { useAuth } from '../stores/auth'
import AppIcon from './AppIcon'
import ConfirmDialog from './ConfirmDialog'
import ErrorNotice from './ErrorNotice'
import '../styles/staff-reviews.css'

/**
 * ADMIN correction of the latest repayment (decision 0008). The repayment stays in the ledger; a mirrored reversal is added and the
 * installment becomes unpaid again. REVIEWER only reads.
 */
export default function StaffReversalSection({
  loan,
  path,
  onReversed,
  onConflict,
}: {
  loan: LoanDetail
  path: string
  onReversed: (latest: LoanDetail, installment: number) => void
  onConflict: (message: string) => void
}) {
  const { user } = useAuth()
  const command = useAdminCommand()
  const [confirming, setConfirming] = useState(false)
  const [reasonCode, setReasonCode] = useState<ReversalReason | ''>('')
  const [note, setNote] = useState('')
  // The installment whose reversal response never arrived; it may already be recorded.
  const [unresolved, setUnresolved] = useState<number | null>(null)
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState<{ message: string; failed?: unknown } | null>(null)
  const target = reversalTarget(loan)
  if (loan.status === 'WITHDRAWN') return null
  if (user?.role !== 'ADMIN') {
    return (
      <section className="loan-next" aria-labelledby="staff-reversal-title">
        <h2 id="staff-reversal-title">납부 취소</h2>
        <p>납부 취소(반대 거래 정정)는 운영 관리자만 할 수 있습니다. 이 화면은 조회 전용입니다.</p>
      </section>
    )
  }
  const noteLength = [...note.trim()].length
  const body = target ? reversalBody(target.installment, reasonCode, note) : null
  const fieldErrors = command.error instanceof ApiError ? command.error.fieldErrors : undefined

  function close() {
    setConfirming(false)
  }
  function finished(latest: LoanDetail, installment: number) {
    command.setError(null)
    setConfirming(false)
    setUnresolved(null)
    setReasonCode('')
    setNote('')
    onReversed(latest, installment)
  }
  async function send() {
    if (!body) return
    setCheckResult(null)
    const outcome = await command.run({ loanId: loan.id, command: 'reverse', body }, (key) =>
      request<RepaymentReversalResult>(`${path}/repayment-reversals`, {
        method: 'POST',
        idempotencyKey: key,
        body,
      }),
    )
    if (!outcome) return
    if (outcome.ok) {
      finished(outcome.value.loan, outcome.value.reversal.installment)
      return
    }
    const cause = outcome.error
    if (isUncertain(cause)) {
      setUnresolved(body.installment)
      return
    }
    setUnresolved(null)
    if (needsLoanReload(cause)) {
      setConfirming(false)
      command.setError(null)
      onConflict(loanCommandMessage(cause, 'reverse') ?? cause.message)
    }
  }
  async function check() {
    if (checking || unresolved === null) return
    setChecking(true)
    setCheckResult(null)
    try {
      const latest = await request<{ loan: LoanDetail }>(path)
      if (reversalApplied(unresolved, latest.loan)) {
        finished(latest.loan, unresolved)
        return
      }
      setUnresolved(null)
      command.setError(null)
      setCheckResult({
        message: '아직 취소되지 않았습니다. 내용을 확인한 뒤 다시 취소할 수 있습니다.',
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
    <section className="loan-next" aria-labelledby="staff-reversal-title">
      <h2 id="staff-reversal-title">최근 납부 취소</h2>
      {target ? (
        <>
          <dl className="details-list">
            <div>
              <dt>취소 대상</dt>
              <dd>{target.installment}회차 (가장 최근 납부)</dd>
            </div>
            <div>
              <dt>납부일 (가상)</dt>
              <dd>{loanDate(target.paidOn ?? target.dueDate)}</dd>
            </div>
            <div>
              <dt>납입액</dt>
              <dd>
                {won(target.payment)} (원금 {won(target.principal)} · 이자 {won(target.interest)})
              </dd>
            </div>
          </dl>
          <button
            className="button button-outline"
            disabled={command.pending}
            onClick={() => {
              setCheckResult(null)
              command.setError(null)
              setConfirming(true)
            }}
          >
            {target.installment}회차 납부 취소
          </button>
        </>
      ) : (
        <p>취소할 납부가 없습니다.</p>
      )}
      <p className="bank-section-help">
        <AppIcon name="info" size={14} /> 가장 최근에 납부한 회차부터 하나씩만 취소할 수 있습니다.
        원래 납부 거래는 그대로 두고 반대 거래를 추가하며, 취소한 회차는 고객이 다시 납부할 수
        있습니다.
      </p>
      {target && (
        <ConfirmDialog
          open={confirming}
          title={`${target.installment}회차 납부를 취소할까요?`}
          confirmLabel={unresolved !== null ? '같은 요청으로 다시 시도' : '납부 취소'}
          pendingLabel="취소 기록 중…"
          cancelLabel="닫기"
          pending={command.pending}
          danger
          confirmDisabled={!body}
          extraAction={
            unresolved !== null && (
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
          onClose={close}
        >
          <dl className="bank-confirm-summary">
            <div>
              <dt>반대 거래</dt>
              <dd>
                차) 대출채권 {won(target.principal)}
                {target.interest > 0 && <> · 차) 이자수익 {won(target.interest)}</>} / 대) 가상 결제
                자금 {won(target.payment)}
              </dd>
            </div>
            <div>
              <dt>취소 후 남은 원금</dt>
              <dd>{won(loan.outstandingPrincipal + target.principal)}</dd>
            </div>
            <div>
              <dt>취소 후 상태</dt>
              <dd>
                {target.installment - 1}/{loan.termMonths}회 납부 · 상환 중
              </dd>
            </div>
          </dl>
          <fieldset className="form-fieldset" disabled={command.pending}>
            <legend className="bank-sr-only">취소 정보</legend>
            <div className="bank-application-field">
              <span className="staff-field-label" id="reversal-reason-label">
                취소 사유 <i aria-hidden="true">*</i>
              </span>
              <div
                className="staff-reason-options"
                role="radiogroup"
                aria-labelledby="reversal-reason-label"
              >
                {reversalReasons.map((item) => (
                  <label key={item.value}>
                    <input
                      type="radio"
                      name="reversal-reason"
                      value={item.value}
                      checked={reasonCode === item.value}
                      onChange={() => setReasonCode(item.value)}
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
              {fieldErrors?.reasonCode && (
                <p className="bank-application-error">{fieldErrors.reasonCode}</p>
              )}
            </div>
            <div className="bank-application-field">
              <label htmlFor="reversal-note">메모 (선택)</label>
              <textarea
                id="reversal-note"
                className="bank-admin-textarea"
                value={note}
                rows={3}
                onChange={(event) => setNote(event.target.value)}
                aria-invalid={noteLength > REVERSAL_NOTE_LIMIT}
                aria-describedby="reversal-note-help"
              />
              <p className="bank-application-help" id="reversal-note-help">
                운영 기록용 메모입니다. 실제 개인정보를 적지 마세요. (
                {noteLength.toLocaleString('ko-KR')}/{REVERSAL_NOTE_LIMIT}자)
              </p>
              {(noteLength > REVERSAL_NOTE_LIMIT || fieldErrors?.note) && (
                <p className="bank-application-error">
                  {fieldErrors?.note ?? `메모는 ${REVERSAL_NOTE_LIMIT}자 이하로 입력해 주세요.`}
                </p>
              )}
            </div>
          </fieldset>
          <ErrorNotice
            error={command.error}
            message={loanCommandMessage(command.error, 'reverse')}
          />
          {checkResult && (
            <ErrorNotice error={checkResult.failed ?? true} message={checkResult.message} />
          )}
        </ConfirmDialog>
      )}
    </section>
  )
}
