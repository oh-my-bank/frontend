import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ApiError, request } from '../lib/api'
import { won } from '../lib/format'
import { loanCommandMessage, loanDate, needsLoanReload, type LoanDetail } from '../lib/loans'
import {
  PREPAYMENT_MINIMUM,
  canPrepay,
  feeRateLabel,
  isAmountConflict,
  isStateChanged,
  prepaymentApplied,
  prepaymentNotice,
  prepaymentPreviewPath,
  prepaymentRequest,
  prepaymentTypeLabel,
  withPreviewState,
  type PrepaymentBody,
  type PrepaymentPreview,
  type PrepaymentResult,
  type PrepaymentType,
} from '../lib/prepayments'
import { isUncertain } from '../lib/reviews'
import { useAdminCommand } from '../lib/useAdminCommand'
import AppIcon from './AppIcon'
import ConfirmDialog from './ConfirmDialog'
import ErrorNotice from './ErrorNotice'
import '../styles/banking-products.css'
import '../styles/prepayments.css'

/**
 * Customer partial or full prepayment of an active loan (L03, LOAN_PREPAY_V1). The server computes the fee and the new schedule;
 * the page shows its preview before the customer confirms, and an uncertain result is retried with the same Idempotency-Key.
 */
export default function LoanPrepaymentSection({
  loan,
  path,
  onPrepaid,
  onConflict,
}: {
  loan: LoanDetail
  path: string
  onPrepaid: (latest: LoanDetail, notice: string) => void
  onConflict: (message: string) => void
}) {
  const command = useAdminCommand()
  const [type, setType] = useState<PrepaymentType>('PARTIAL')
  const [amount, setAmount] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ key: string; value: PrepaymentPreview } | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [previewError, setPreviewError] = useState<unknown>(null)
  const [confirming, setConfirming] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)
  // The number of prepayments before a request whose response never arrived; it may already be recorded.
  const [unresolved, setUnresolved] = useState<number | null>(null)
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState<{ message: string; failed?: unknown } | null>(null)
  // After 409 PREPAYMENT_STATE_CHANGED the page reloads the loan; this holds the stale loan until the new one arrives.
  const staleLoan = useRef<LoanDetail | null>(null)

  const parsed = prepaymentRequest(type, amount, loan.outstandingPrincipal)
  const body = 'body' in parsed ? parsed.body : null
  // A preview stays valid only for the same request on the same loan state.
  const key = JSON.stringify([body, loan.outstandingPrincipal, loan.paidInstallments])
  const current = body && preview?.key === key ? preview.value : null

  useEffect(() => {
    if (!staleLoan.current || staleLoan.current === loan) return
    staleLoan.current = null
    if (canPrepay(loan) && body) void fetchPreview(body, key)
    // Runs once the reloaded loan replaces the stale one; body and key belong to that render.
  }, [loan])
  if (!canPrepay(loan)) return null

  function edited() {
    setFormError(null)
    setPreviewError(null)
    // A different request is no longer the one whose result was uncertain.
    setUnresolved(null)
    setCheckResult(null)
  }
  async function loadPreview(event: FormEvent) {
    event.preventDefault()
    if (previewing) return
    if (!body) {
      setFormError('error' in parsed ? parsed.error : null)
      return
    }
    await fetchPreview(body, key)
  }
  async function fetchPreview(previewBody: PrepaymentBody, previewKey: string) {
    setFormError(null)
    setPreviewError(null)
    setPreviewing(true)
    try {
      setPreview({
        key: previewKey,
        value: await request<PrepaymentPreview>(prepaymentPreviewPath(path, previewBody)),
      })
    } catch (cause) {
      setPreview(null)
      if (!isAmountConflict(cause) && needsLoanReload(cause)) {
        onConflict(loanCommandMessage(cause, 'prepay') ?? cause.message)
        return
      }
      setPreviewError(cause)
    } finally {
      setPreviewing(false)
    }
  }
  function finished(latest: LoanDetail, notice: string) {
    command.setError(null)
    command.clear()
    setConfirming(false)
    setUnresolved(null)
    setAcknowledged(false)
    setPreview(null)
    setAmount('')
    onPrepaid(latest, notice)
  }
  async function send() {
    if (!body || !current) return
    setCheckResult(null)
    const before = loan.prepayments?.length ?? 0
    // The previewed state goes with the request, so a second identical prepayment is a new request with a new key.
    const sent = withPreviewState(body, current)
    const outcome = await command.run(
      { loanId: loan.id, command: 'prepay', body: sent },
      (requestKey) =>
        request<PrepaymentResult>(`${path}/prepayments`, {
          method: 'POST',
          idempotencyKey: requestKey,
          body: sent,
        }),
    )
    if (!outcome) return
    if (outcome.ok) {
      finished(outcome.value.loan, prepaymentNotice(outcome.value))
      return
    }
    const cause = outcome.error
    if (isUncertain(cause)) {
      setUnresolved(before)
      return
    }
    setUnresolved(null)
    if (!isAmountConflict(cause) && needsLoanReload(cause)) {
      setConfirming(false)
      setPreview(null)
      setAcknowledged(false)
      command.setError(null)
      // The loan moved on since the preview: reload it, then preview the same request again.
      if (isStateChanged(cause)) staleLoan.current = loan
      onConflict(loanCommandMessage(cause, 'prepay') ?? cause.message)
    }
  }
  async function check() {
    if (checking || unresolved === null) return
    setChecking(true)
    setCheckResult(null)
    try {
      const latest = await request<LoanDetail>(path)
      const recorded = latest.prepayments?.at(-1)
      if (prepaymentApplied(unresolved, latest) && recorded) {
        finished(latest, prepaymentNotice({ prepayment: recorded, loan: latest }))
        return
      }
      setUnresolved(null)
      command.setError(null)
      setCheckResult({
        message: '아직 조기상환되지 않았습니다. 내용을 확인한 뒤 다시 상환할 수 있습니다.',
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

  const amountError = type === 'PARTIAL' ? formError : null
  const serverFieldError =
    previewError instanceof ApiError ? previewError.fieldErrors.amount : undefined
  return (
    <section className="loan-next loan-prepay" aria-labelledby="loan-prepay-title">
      <h2 id="loan-prepay-title">조기상환</h2>
      <p>
        남은 원금의 일부나 전부를 미리 갚습니다. 부분상환은 남은 기간을 그대로 두고 남은 회차
        납입액을 다시 계산하며, 전액상환은 대출을 완납으로 끝냅니다. 상환일은 마지막으로 납부한
        회차의 납부일(납부 전이면 실행일)이므로 경과 이자는 없습니다.
      </p>
      <form className="loan-prepay-form" onSubmit={loadPreview} noValidate>
        <fieldset className="form-fieldset" disabled={previewing || command.pending}>
          <legend className="bank-sr-only">조기상환 조건</legend>
          <div className="bank-application-field">
            <span className="loan-prepay-label" id="prepay-type-label">
              상환 유형
            </span>
            <div
              className="loan-prepay-options"
              role="radiogroup"
              aria-labelledby="prepay-type-label"
            >
              {(['PARTIAL', 'FULL'] as const).map((value) => (
                <label key={value}>
                  <input
                    type="radio"
                    name="prepay-type"
                    value={value}
                    checked={type === value}
                    onChange={() => {
                      setType(value)
                      edited()
                    }}
                  />
                  <span>
                    {prepaymentTypeLabel(value)}
                    <small>
                      {value === 'PARTIAL'
                        ? ` ${won(PREPAYMENT_MINIMUM)} 이상, 남은 원금 미만`
                        : ` 남은 원금 ${won(loan.outstandingPrincipal)} 전부`}
                    </small>
                  </span>
                </label>
              ))}
            </div>
          </div>
          {type === 'PARTIAL' && (
            <div className="bank-application-field">
              <label htmlFor="prepay-amount">상환 원금</label>
              <div className="input-unit">
                <input
                  id="prepay-amount"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={amount}
                  placeholder="금액 입력"
                  onChange={(event) => {
                    setAmount(event.target.value)
                    edited()
                  }}
                  aria-invalid={!!(amountError || serverFieldError)}
                  aria-describedby={`prepay-amount-help${amountError || serverFieldError ? ' prepay-amount-error' : ''}`}
                />
                <span>원</span>
              </div>
              <p className="bank-application-help" id="prepay-amount-help">
                남은 원금 {won(loan.outstandingPrincipal)}보다 적은 금액을 원 단위로 입력합니다.
              </p>
              {(amountError || serverFieldError) && (
                <p className="bank-application-error" id="prepay-amount-error">
                  {amountError ?? serverFieldError}
                </p>
              )}
            </div>
          )}
        </fieldset>
        <div className="loan-step-actions">
          <button
            type="submit"
            className="button button-outline"
            disabled={previewing || command.pending}
          >
            {previewing ? '계산 중…' : '수수료·상환액 미리보기'}
          </button>
        </div>
      </form>
      {previewError !== null && (
        <ErrorNotice error={previewError} message={loanCommandMessage(previewError, 'prepay')} />
      )}
      {current && (
        <div className="loan-prepay-preview" aria-live="polite">
          <h3 className="sim-subheading">
            {prepaymentTypeLabel(current.type)} 미리보기{' '}
            <span className="loan-sim-tag">계산만, 저장 안 함</span>
          </h3>
          <PreviewSummary preview={current} />
          <div className="loan-step-actions">
            <button
              className="button button-primary"
              disabled={command.pending}
              onClick={() => {
                setCheckResult(null)
                command.setError(null)
                setConfirming(true)
              }}
            >
              {won(current.totalAmount)} {prepaymentTypeLabel(current.type)}하기
            </button>
          </div>
        </div>
      )}
      <p className="bank-section-help">
        <AppIcon name="info" size={14} /> 중도상환수수료 = 상환 원금 × 수수료율 × (면제기간 −
        경과일수) ÷ 면제기간(원 미만 버림)이며 면제기간이 지나면 0원입니다. 수수료율 1.2%·면제기간
        3년(1,095일)·최소 금액은 규칙 세트 <code>LOAN_PREPAY_V1</code>의 교육용 가정값으로, 상품
        정책이나 실제 은행 수수료가 아니고 상환 권유도 아닙니다.
      </p>
      <ConfirmDialog
        open={confirming && !!current}
        title={current ? `${prepaymentTypeLabel(current.type)}할까요?` : '조기상환'}
        confirmLabel={unresolved !== null ? '같은 요청으로 다시 시도' : '상환하기'}
        pendingLabel="상환 중…"
        cancelLabel={unresolved !== null ? '닫기' : '취소'}
        pending={command.pending}
        confirmDisabled={!acknowledged}
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
        onClose={() => setConfirming(false)}
      >
        {current && (
          <dl className="bank-confirm-summary">
            <div>
              <dt>상환 원금</dt>
              <dd>{won(current.principal)}</dd>
            </div>
            <div>
              <dt>중도상환수수료</dt>
              <dd>{won(current.fee)}</dd>
            </div>
            <div>
              <dt>실제 상환 총액</dt>
              <dd>{won(current.totalAmount)}</dd>
            </div>
            <div>
              <dt>상환일 (가상)</dt>
              <dd>{loanDate(current.businessDate)}</dd>
            </div>
            <div>
              <dt>분개</dt>
              <dd>
                차) 가상 결제 자금 {won(current.principal)} / 대) 대출채권 {won(current.principal)}
                {current.fee > 0 && (
                  <>
                    {' · '}차) 가상 결제 자금 {won(current.fee)} / 대) 수수료수익 {won(current.fee)}
                  </>
                )}
              </dd>
            </div>
          </dl>
        )}
        <p>가상 결제 자금으로 처리되는 교육용 시뮬레이션이며 실제 출금이 아닙니다.</p>
        <label className="bank-confirm-acknowledge">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
            disabled={command.pending}
          />
          <span>
            조기상환은 취소(반대 거래)할 수 없고, 조기상환한 대출은 철회할 수 없으며 그 이전 회차의
            납부도 취소할 수 없다는 것을 확인했습니다.
          </span>
        </label>
        <ErrorNotice error={command.error} message={loanCommandMessage(command.error, 'prepay')} />
        {checkResult && (
          <ErrorNotice error={checkResult.failed ?? true} message={checkResult.message} />
        )}
      </ConfirmDialog>
    </section>
  )
}

function PreviewSummary({ preview }: { preview: PrepaymentPreview }) {
  return (
    <>
      <dl className="details-list">
        <div>
          <dt>상환일 (가상)</dt>
          <dd>
            {loanDate(preview.businessDate)} · 실행 후 {preview.elapsedDays.toLocaleString('ko-KR')}
            일 경과
          </dd>
        </div>
        <div>
          <dt>수수료율 (교육용 가정값)</dt>
          <dd>
            {feeRateLabel(preview.feeRate)} · 면제기간{' '}
            {preview.exemptionDays.toLocaleString('ko-KR')}일
            {preview.elapsedDays >= preview.exemptionDays && ' (면제기간 경과)'}
          </dd>
        </div>
        <div>
          <dt>상환 원금</dt>
          <dd>{won(preview.principal)}</dd>
        </div>
        <div>
          <dt>중도상환수수료</dt>
          <dd>{won(preview.fee)}</dd>
        </div>
        <div>
          <dt>실제 상환 총액</dt>
          <dd>
            <strong>{won(preview.totalAmount)}</strong>
          </dd>
        </div>
        <div>
          <dt>남은 원금</dt>
          <dd>
            {won(preview.outstandingBefore)} → {won(preview.outstandingAfter)}
          </dd>
        </div>
        {preview.newPayment !== null && (
          <div>
            <dt>다음 회차 납입액</dt>
            <dd>
              {preview.currentPayment !== null && `${won(preview.currentPayment)} → `}
              {won(preview.newPayment)} (남은 {preview.remainingInstallments}회, 기간 유지)
            </dd>
          </div>
        )}
        <div>
          <dt>남은 회차 이자</dt>
          <dd>
            {won(preview.interestBefore)} → {won(preview.interestAfter)} (줄어드는 이자{' '}
            {won(preview.interestSaved)})
          </dd>
        </div>
      </dl>
      {preview.schedule.length > 0 && (
        <details className="loan-prepay-schedule">
          <summary>다시 계산한 남은 상환 일정 {preview.schedule.length}회 보기</summary>
          <div className="sim-table-wrap">
            <table className="sim-table">
              <caption className="bank-sr-only">부분상환 후 남은 회차 일정</caption>
              <thead>
                <tr>
                  <th scope="col">회차</th>
                  <th scope="col">납부일 (가상)</th>
                  <th scope="col" className="sim-number">
                    납입액
                  </th>
                  <th scope="col" className="sim-number">
                    원금
                  </th>
                  <th scope="col" className="sim-number">
                    이자
                  </th>
                  <th scope="col" className="sim-number">
                    납부 후 잔액
                  </th>
                </tr>
              </thead>
              <tbody>
                {preview.schedule.map((item) => (
                  <tr key={item.installment}>
                    <th scope="row">{item.installment}</th>
                    <td>{loanDate(item.dueDate)}</td>
                    <td className="sim-number">{won(item.payment)}</td>
                    <td className="sim-number">{won(item.principal)}</td>
                    <td className="sim-number">{won(item.interest)}</td>
                    <td className="sim-number">{won(item.balanceAfter)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
      <p className="bank-section-help">
        <AppIcon name="info" size={14} /> {preview.assumptionNotice} 규칙 {preview.ruleVersion}.
      </p>
    </>
  )
}
