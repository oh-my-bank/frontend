import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError, request } from '../lib/api'
import { useAdminCommand } from '../lib/useAdminCommand'
import { dateTime, rate, statusLabel, won } from '../lib/format'
import {
  NOTE_LIMIT,
  codePoints,
  commandApplied,
  historyLabel,
  isUncertain,
  needsReload,
  readRejection,
  rejectReasonLabels,
  reviewActions,
  reviewCommandMessage,
  reviewLoadMessage,
  ruleResultLabel,
  type RejectReasonCode,
  type ReviewCommand,
  type ReviewDetail,
} from '../lib/reviews'
import { useAuth } from '../stores/auth'
import AppIcon from '../components/AppIcon'
import ConfirmDialog from '../components/ConfirmDialog'
import ErrorNotice from '../components/ErrorNotice'
import StaffLoanLink from '../components/StaffLoanLink'
import '../styles/banking-records.css'
import '../styles/banking-admin.css'
import '../styles/staff-reviews.css'

const titles: Record<ReviewCommand, string> = {
  start: '심사 시작 확인',
  approve: '승인 확인',
  reject: '거절 확인',
}
const successes: Record<ReviewCommand, string> = {
  start: '심사를 시작했습니다. 모의 심사 규칙을 평가한 결과를 확인한 뒤 승인 또는 거절해 주세요.',
  approve: '승인했습니다. 고객 신청 내역에 확정 조건이 표시됩니다.',
  reject: '거절했습니다. 고객 신청 내역에 거절 안내가 표시됩니다.',
}
const confirmed: Record<ReviewCommand, string> = {
  start: '심사가 이미 시작된 것을 확인했습니다. 규칙 평가 결과를 확인해 주세요.',
  approve: '승인이 반영된 것을 확인했습니다. 처리 담당자는 결정 정보에서 확인하세요.',
  reject: '거절이 반영된 것을 확인했습니다. 처리 담당자는 결정 정보에서 확인하세요.',
}

export default function StaffReviewPage() {
  const { id = '' } = useParams()
  const { refresh } = useAuth()
  const path = `/reviews/${encodeURIComponent(id)}`
  const [detail, setDetail] = useState<ReviewDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [reload, setReload] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const noticeRef = useRef<HTMLDivElement>(null)
  const command = useAdminCommand()
  const [confirming, setConfirming] = useState<ReviewCommand | null>(null)
  // The command whose response never arrived; it may already be applied.
  const [unresolved, setUnresolved] = useState<ReviewCommand | null>(null)
  const [lastCommand, setLastCommand] = useState<ReviewCommand>('start')
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState<{ message: string; failed?: unknown } | null>(null)
  const [reasonCode, setReasonCode] = useState<RejectReasonCode | ''>('')
  const [note, setNote] = useState('')
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (notice) noticeRef.current?.focus()
  }, [notice])
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    void request<ReviewDetail>(path, { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setDetail(result)
      })
      .catch((cause) => {
        if (controller.signal.aborted) return
        setDetail(null)
        setError(cause)
        if (cause instanceof ApiError && cause.status === 403) void refresh().catch(() => null)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [path, reload])

  function open(next: ReviewCommand) {
    // An uncertain result stays explained until it is checked or sent again.
    if (unresolved !== next) {
      command.setError(null)
      setUnresolved(null)
    }
    setCheckResult(null)
    setFormErrors({})
    setNotice(null)
    setConfirming(next)
  }
  function done(message: string) {
    setConfirming(null)
    setUnresolved(null)
    setCheckResult(null)
    setReasonCode('')
    setNote('')
    setNotice(message)
    // A replayed response shows the state at the first request, so read the current state again.
    setReload((value) => value + 1)
  }
  async function send() {
    if (!detail || !confirming) return
    const kind = confirming
    setLastCommand(kind)
    let body: { reasonCode: RejectReasonCode; staffNote: string | null } | undefined
    if (kind === 'reject') {
      const read = readRejection(reasonCode, note, detail.review?.evaluation.result)
      setFormErrors(read.errors)
      if (!read.body) return
      body = read.body
    }
    const outcome = await command.run(
      { applicationId: detail.applicationId, command: kind, body: body ?? null },
      (key) =>
        request<ReviewDetail>(`${path}/${kind}`, {
          method: 'POST',
          idempotencyKey: key,
          ...(body ? { body } : {}),
        }),
    )
    if (!outcome) return
    if (outcome.ok) {
      setDetail(outcome.value)
      done(successes[kind])
      return
    }
    setCheckResult(null)
    const cause = outcome.error
    if (isUncertain(cause)) setUnresolved(kind)
    else if (cause instanceof ApiError && cause.code === 'VALIDATION_ERROR')
      setFormErrors(cause.fieldErrors)
    else if (needsReload(cause)) {
      setConfirming(null)
      setUnresolved(null)
      setReload((value) => value + 1)
    }
  }
  async function check() {
    if (checking || !unresolved) return
    setChecking(true)
    setCheckResult(null)
    try {
      const latest = await request<ReviewDetail>(path)
      setDetail(latest)
      if (commandApplied(unresolved, latest)) {
        command.setError(null)
        done(confirmed[unresolved])
        return
      }
      setUnresolved(null)
      command.setError(null)
      setCheckResult({
        message: '아직 반영되지 않았습니다. 내용을 확인한 뒤 다시 진행할 수 있습니다.',
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

  const actions = detail ? reviewActions(detail) : null
  const evaluation = detail?.review?.evaluation
  const decision = detail?.review?.decision
  const noteLength = codePoints(note.trim())
  return (
    <>
      <section className="page-title bank-title-actions">
        <div>
          <h1>심사 상세</h1>
          <p>신청 조건과 모의 심사 규칙 근거를 확인하고 심사를 진행합니다.</p>
        </div>
        <Link to="/staff/reviews" className="button button-outline">
          심사 목록
          <AppIcon name="chevron" size={15} />
        </Link>
      </section>
      {notice && (
        <div className="bank-admin-success" role="status" tabIndex={-1} ref={noticeRef}>
          <AppIcon name="check" size={19} />
          <p>{notice}</p>
        </div>
      )}
      {!confirming && !!command.error && (
        <ErrorNotice
          error={command.error}
          message={reviewCommandMessage(command.error, lastCommand)}
        />
      )}
      {loading && !detail ? (
        <div className="empty-state" role="status">
          심사 정보를 불러오고 있습니다.
        </div>
      ) : error || !detail || !actions ? (
        <>
          <ErrorNotice error={error} message={reviewLoadMessage(error)} />
          <div className="bank-product-load-error">
            <button
              className="button button-outline"
              onClick={() => setReload((value) => value + 1)}
            >
              다시 불러오기
            </button>
            <Link to="/staff/reviews" className="text-button">
              심사 목록으로 이동
            </Link>
          </div>
        </>
      ) : (
        <>
          <StaffLoanLink applicationId={detail.applicationId} status={detail.status} />
          <section
            className="bank-statement"
            aria-labelledby="staff-review-title"
            aria-busy={loading}
          >
            <div className="bank-statement-heading">
              <div>
                <span>신청 상품 · 정책 버전 {detail.application.policyVersion}</span>
                <h2 id="staff-review-title">{detail.application.productName}</h2>
              </div>
              <span className={`status-badge ${detail.status.toLowerCase()}`}>
                {statusLabel(detail.status)}
              </span>
            </div>
            <dl className="bank-statement-summary">
              <div>
                <dt>신청금액</dt>
                <dd className="bank-statement-principal">
                  {won(detail.application.requestedAmount)}
                </dd>
              </div>
              <div>
                <dt>신청 당시 금리</dt>
                <dd>
                  연 {rate(detail.application.annualInterestRate)}
                  <small>%</small>
                </dd>
              </div>
              <div>
                <dt>신청기간</dt>
                <dd>
                  {detail.application.termMonths}
                  <small>개월</small>
                </dd>
              </div>
            </dl>
            <div className="bank-statement-body">
              <h3>신청 정보</h3>
              <dl className="details-list">
                <div>
                  <dt>고객</dt>
                  <dd>{detail.customer.maskedName}</dd>
                </div>
                <div>
                  <dt>가상 연소득</dt>
                  <dd>{won(detail.application.annualIncome)}</dd>
                </div>
                <div>
                  <dt>접수일시</dt>
                  <dd>{dateTime(detail.application.appliedAt)}</dd>
                </div>
                <div>
                  <dt>신청번호</dt>
                  <dd className="monospace">{detail.applicationId}</dd>
                </div>
              </dl>
              <p className="bank-section-help">
                심사는 신청 시점에 보관한 조건만 사용합니다. 판매 중지나 새 정책 발행은 진행 중인
                심사에 영향을 주지 않습니다.
              </p>
            </div>
          </section>

          <section className="bank-record-section" aria-labelledby="staff-rule-title">
            <div className="section-heading">
              <div>
                <h2 id="staff-rule-title">모의 심사 규칙 근거</h2>
                <p>{detail.notice}</p>
              </div>
            </div>
            {evaluation ? (
              <div className="staff-rule-panel">
                <div className="staff-rule-result">
                  <span className={`staff-rule-tag ${evaluation.result.toLowerCase()}`}>
                    {ruleResultLabel(evaluation.result)}
                  </span>
                  <strong>
                    상환 비율{' '}
                    {evaluation.repaymentRatio === null
                      ? '계산 불가'
                      : `${evaluation.repaymentRatio}%`}
                  </strong>
                  <span>
                    기준 {evaluation.thresholdPercent}% 이하 · {evaluation.ruleVersion}
                  </span>
                </div>
                <dl className="details-list">
                  <div>
                    <dt>월 상환액 M</dt>
                    <dd>{won(evaluation.monthlyPayment)}</dd>
                  </div>
                  <div>
                    <dt>연간 원리금 A</dt>
                    <dd>
                      {won(evaluation.annualRepayment)}
                      <small className="staff-rule-formula">
                        {' '}
                        = M × {Math.min(evaluation.inputs.termMonths, 12)}개월
                      </small>
                    </dd>
                  </div>
                  <div>
                    <dt>가상 연소득 I</dt>
                    <dd>{won(evaluation.inputs.annualIncome)}</dd>
                  </div>
                  <div>
                    <dt>평가 시각</dt>
                    <dd>
                      {dateTime(detail.review!.startedAt)} · {detail.review!.startedBy.name}
                    </dd>
                  </div>
                </dl>
                <p className="bank-section-help">
                  원리금균등 월 상환액(원 미만 반올림)에 12개월(기간이 짧으면 그 기간)을 곱한 연간
                  원리금이 가상 연소득의 {evaluation.thresholdPercent}% 이하이면 기준 충족입니다.
                  이번 신청 한 건만 반영하며 규칙은 심사 시작 때 한 번만 평가합니다.
                </p>
              </div>
            ) : (
              <div className="empty-state">
                <h3>아직 심사를 시작하지 않았습니다.</h3>
                <p>심사를 시작하면 신청 조건으로 모의 심사 규칙을 한 번 평가해 저장합니다.</p>
              </div>
            )}
          </section>

          {decision && (
            <section className="bank-record-section" aria-labelledby="staff-decision-title">
              <div className="section-heading">
                <div>
                  <h2 id="staff-decision-title">심사 결정</h2>
                  <p>결정은 변경·취소할 수 없습니다.</p>
                </div>
              </div>
              <dl className="details-list staff-decision-list">
                <div>
                  <dt>결과</dt>
                  <dd>
                    <span className={`status-badge ${decision.result.toLowerCase()}`}>
                      {statusLabel(decision.result)}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>결정</dt>
                  <dd>
                    {dateTime(decision.decidedAt)} · {decision.decidedBy.name}
                  </dd>
                </div>
                {decision.approvedTerms && (
                  <div>
                    <dt>확정 조건</dt>
                    <dd>
                      {won(decision.approvedTerms.amount)} · {decision.approvedTerms.termMonths}개월
                      · 연 {rate(decision.approvedTerms.annualInterestRate)}%
                    </dd>
                  </div>
                )}
                {decision.reasonCode && (
                  <div>
                    <dt>거절 사유</dt>
                    <dd>
                      {rejectReasonLabels[decision.reasonCode] ?? decision.reasonCode}
                      {decision.reasonMessage && (
                        <small className="staff-decision-message">
                          고객 안내: {decision.reasonMessage}
                        </small>
                      )}
                    </dd>
                  </div>
                )}
                {decision.staffNote && (
                  <div>
                    <dt>직원 메모</dt>
                    <dd>
                      {decision.staffNote}
                      <small className="staff-decision-message">직원에게만 표시됩니다.</small>
                    </dd>
                  </div>
                )}
              </dl>
            </section>
          )}

          {(actions.canStart || actions.canReject) && (
            <section className="bank-admin-actions" aria-labelledby="staff-actions-title">
              <h2 id="staff-actions-title" className="bank-sr-only">
                심사 업무
              </h2>
              <div>
                {actions.canStart && (
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => open('start')}
                  >
                    심사 시작
                  </button>
                )}
                {actions.canApprove && (
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => open('approve')}
                  >
                    승인
                  </button>
                )}
                {actions.canReject && (
                  <button
                    type="button"
                    className="button button-danger-outline"
                    onClick={() => open('reject')}
                  >
                    거절
                  </button>
                )}
              </div>
              {actions.approvalBlocked && (
                <p className="staff-approval-blocked" role="note">
                  <AppIcon name="info" size={17} />
                  모의 심사 기준(연간 원리금 ÷ 가상 연소득 {evaluation?.thresholdPercent}% 이하)을
                  충족하지 않아 승인할 수 없습니다. 거절로 처리해 주세요.
                </p>
              )}
              <p className="bank-section-help">
                시작·승인·거절은 다른 담당자와 동시에 처리하면 먼저 반영된 한 건만 성공합니다.
                취소·재심사·조건 조정은 제공하지 않습니다.
              </p>
            </section>
          )}

          <section className="bank-record-section" aria-labelledby="staff-history-title">
            <div className="section-heading">
              <div>
                <h2 id="staff-history-title">처리 이력</h2>
              </div>
            </div>
            <ol className="staff-history">
              {detail.history.map((event) => (
                <li key={`${event.event}-${event.at}`}>
                  <strong>{historyLabel(event.event)}</strong>
                  <span>
                    {dateTime(event.at)}
                    {event.actor ? ` · ${event.actor.name}` : ' · 고객'}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <ConfirmDialog
            open={!!confirming}
            title={confirming ? titles[confirming] : ''}
            danger={confirming === 'reject'}
            confirmLabel={
              unresolved && unresolved === confirming
                ? '같은 요청으로 다시 시도'
                : confirming
                  ? { start: '심사 시작', approve: '승인', reject: '거절' }[confirming]
                  : ''
            }
            pendingLabel="처리 중…"
            cancelLabel={unresolved ? '닫기' : '취소'}
            pending={command.pending}
            extraAction={
              unresolved &&
              unresolved === confirming && (
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
            onClose={() => setConfirming(null)}
          >
            {!!command.error && confirming && (
              <ErrorNotice
                error={command.error}
                message={reviewCommandMessage(command.error, confirming)}
              />
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
                <dt>대상 신청</dt>
                <dd>
                  {detail.customer.maskedName} · {detail.application.productName}
                </dd>
              </div>
              <div>
                <dt>신청 조건</dt>
                <dd>
                  {won(detail.application.requestedAmount)} · {detail.application.termMonths}개월 ·
                  연 {rate(detail.application.annualInterestRate)}%
                </dd>
              </div>
              {evaluation && (
                <div>
                  <dt>규칙 결과</dt>
                  <dd>
                    {ruleResultLabel(evaluation.result)}
                    {evaluation.repaymentRatio !== null &&
                      ` · 상환 비율 ${evaluation.repaymentRatio}%`}
                  </dd>
                </div>
              )}
              <div>
                <dt>변경</dt>
                <dd>
                  {confirming === 'start'
                    ? '신청 완료 → 심사 중'
                    : confirming === 'approve'
                      ? '심사 중 → 승인 완료'
                      : '심사 중 → 심사 거절'}
                </dd>
              </div>
            </dl>
            {confirming === 'start' && (
              <ul className="bank-confirm-effects">
                <li>
                  신청 조건으로 모의 심사 규칙을 한 번 평가해 저장합니다. 이후 다시 평가하지
                  않습니다.
                </li>
                <li>고객 신청 내역에 심사 중으로 표시됩니다.</li>
              </ul>
            )}
            {confirming === 'approve' && (
              <ul className="bank-confirm-effects">
                <li>신청 조건 그대로 확정 조건으로 저장합니다.</li>
                <li>
                  <strong>되돌릴 수 없습니다.</strong> 약정·실행 전이므로 대출금이 지급되지
                  않습니다.
                </li>
              </ul>
            )}
            {confirming === 'reject' && (
              <fieldset className="form-fieldset" disabled={command.pending}>
                <legend className="bank-sr-only">거절 정보</legend>
                <div className="bank-application-field">
                  <span className="staff-field-label" id="staff-reason-label">
                    거절 사유 <i aria-hidden="true">*</i>
                  </span>
                  <div
                    className="staff-reason-options"
                    role="radiogroup"
                    aria-labelledby="staff-reason-label"
                    aria-describedby={formErrors.reasonCode ? 'staff-reason-error' : undefined}
                  >
                    {(Object.keys(rejectReasonLabels) as RejectReasonCode[]).map((code) => {
                      const unavailable =
                        code === 'DSR_LIMIT_EXCEEDED' && evaluation?.result === 'MET'
                      return (
                        <label key={code} className={unavailable ? 'unavailable' : ''}>
                          <input
                            type="radio"
                            name="staff-reason"
                            value={code}
                            checked={reasonCode === code}
                            disabled={unavailable}
                            onChange={() => {
                              setReasonCode(code)
                              setFormErrors({})
                            }}
                          />
                          <span>
                            {rejectReasonLabels[code]}
                            {unavailable && <small> (기준 충족 신청에는 사용할 수 없음)</small>}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                  {formErrors.reasonCode && (
                    <p className="bank-application-error" id="staff-reason-error">
                      {formErrors.reasonCode}
                    </p>
                  )}
                </div>
                <div className="bank-application-field">
                  <label htmlFor="staff-note">
                    직원 메모
                    {reasonCode === 'STAFF_DECISION' && <i aria-hidden="true"> *</i>}
                  </label>
                  <textarea
                    id="staff-note"
                    className="bank-admin-textarea"
                    value={note}
                    rows={3}
                    onChange={(event) => {
                      setNote(event.target.value)
                      setFormErrors((errors) => ({ ...errors, staffNote: '' }))
                    }}
                    aria-invalid={!!formErrors.staffNote}
                    aria-describedby={`staff-note-help${formErrors.staffNote ? ' staff-note-error' : ''}`}
                  />
                  <p className="bank-application-help" id="staff-note-help">
                    직원에게만 표시되며 고객에게는 사유별 안내 문구만 보입니다. 실제 개인정보를 적지
                    마세요. ({noteLength.toLocaleString('ko-KR')}/{NOTE_LIMIT}자)
                  </p>
                  {formErrors.staffNote && (
                    <p className="bank-application-error" id="staff-note-error">
                      {formErrors.staffNote}
                    </p>
                  )}
                </div>
              </fieldset>
            )}
          </ConfirmDialog>
        </>
      )}
    </>
  )
}
