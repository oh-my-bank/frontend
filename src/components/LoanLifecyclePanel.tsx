import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError, request } from '../lib/api'
import { dateTime, rate, repaymentLabel, won } from '../lib/format'
import {
  acknowledgementLabel,
  agreementBody,
  lifecycleStage,
  loanCommandMessage,
  loanDate,
  loanStatusLabel,
  needsLoanReload,
  type Agreement,
  type AgreementDraft,
  type LoanDetail,
  type LoanSummary,
} from '../lib/loans'
import { isUncertain } from '../lib/reviews'
import { useAdminCommand } from '../lib/useAdminCommand'
import type { LoanApplication } from '../types'
import AppIcon from './AppIcon'
import ConfirmDialog from './ConfirmDialog'
import ErrorNotice from './ErrorNotice'
import '../styles/loans.css'

/** Reports a finished step (or a conflict) to the application page, which reloads the application. */
export type LifecycleReport = (message: { tone: 'success' | 'error'; text: string }) => void

/** Agreement → execution → loan link for the customer's own approved application. */
export default function LoanLifecyclePanel({
  application,
  onChanged,
}: {
  application: LoanApplication
  onChanged: LifecycleReport
}) {
  const stage = lifecycleStage(application.status)
  if (!stage) return null
  if (stage === 'agree')
    return <AgreementStep applicationId={application.id} onChanged={onChanged} />
  return <AgreedStep application={application} stage={stage} onChanged={onChanged} />
}

type CheckResult = { message: string; failed?: unknown } | null

function AgreementStep({
  applicationId,
  onChanged,
}: {
  applicationId: string
  onChanged: LifecycleReport
}) {
  const path = `/loan-applications/${encodeURIComponent(applicationId)}`
  const [draft, setDraft] = useState<AgreementDraft | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<unknown>(null)
  const [reload, setReload] = useState(0)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState(false)
  const [unresolved, setUnresolved] = useState(false)
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState<CheckResult>(null)
  const [versionNotice, setVersionNotice] = useState<string | null>(null)
  const command = useAdminCommand()

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setLoadError(null)
    void request<AgreementDraft>(`${path}/agreement-draft`, { signal: controller.signal })
      .then((result) => {
        setDraft(result)
        setChecked(new Set())
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setLoadError(cause)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [path, reload])

  const body = draft ? agreementBody(draft, checked) : null

  async function send() {
    if (!body) return
    setCheckResult(null)
    const outcome = await command.run({ applicationId, command: 'agree', body }, (key) =>
      request<Agreement>(`${path}/agreement`, { method: 'POST', idempotencyKey: key, body }),
    )
    if (!outcome) return
    if (outcome.ok) {
      setConfirming(false)
      onChanged({
        tone: 'success',
        text: '약정이 완료되었습니다. 동의한 조건과 상품설명서 버전이 보관되었으며 이제 대출을 실행할 수 있습니다.',
      })
      return
    }
    const cause = outcome.error
    if (isUncertain(cause)) {
      setUnresolved(true)
      return
    }
    setConfirming(false)
    setUnresolved(false)
    if (cause instanceof ApiError && cause.code === 'EXPLANATION_VERSION_MISMATCH') {
      setVersionNotice(loanCommandMessage(cause, 'agree') ?? null)
      command.setError(null)
      setReload((value) => value + 1)
    } else if (needsLoanReload(cause)) {
      onChanged({ tone: 'error', text: loanCommandMessage(cause, 'agree') ?? cause.message })
    }
  }
  async function check() {
    if (checking) return
    setChecking(true)
    setCheckResult(null)
    try {
      await request<Agreement>(`${path}/agreement`)
      command.setError(null)
      setConfirming(false)
      onChanged({
        tone: 'success',
        text: '약정이 이미 반영되어 있습니다. 약정 내용을 확인해 주세요.',
      })
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === 'AGREEMENT_NOT_FOUND') {
        setUnresolved(false)
        command.setError(null)
        setCheckResult({
          message: '아직 약정되지 않았습니다. 내용을 확인한 뒤 다시 약정할 수 있습니다.',
        })
      } else
        setCheckResult({
          message: '반영 여부를 확인하지 못했습니다. 잠시 후 다시 확인해 주세요.',
          failed: cause,
        })
    } finally {
      setChecking(false)
    }
  }
  function toggle(code: string, on: boolean) {
    setChecked((current) => {
      const next = new Set(current)
      if (on) next.add(code)
      else next.delete(code)
      return next
    })
  }

  return (
    <section className="bank-statement loan-step" aria-labelledby="loan-agreement-title">
      <div className="bank-statement-heading">
        <div>
          <span>다음 단계 · 약정</span>
          <h2 id="loan-agreement-title">상품설명서 확인과 약정</h2>
        </div>
        <span className="loan-sim-tag">모의 약정</span>
      </div>
      <div className="bank-statement-body">
        {versionNotice && <div className="notice">{versionNotice}</div>}
        {loading && !draft ? (
          <div className="empty-state" role="status">
            약정 안내를 불러오고 있습니다.
          </div>
        ) : loadError || !draft ? (
          <>
            <ErrorNotice error={loadError} message={loanCommandMessage(loadError, 'agree')} />
            <button
              className="button button-outline"
              onClick={() => setReload((value) => value + 1)}
            >
              다시 불러오기
            </button>
          </>
        ) : (
          <>
            <p>
              심사에서 확정된 조건으로 약정합니다. 약정 후에는 조건이 고정되며, 이후 상품 조건이
              바뀌어도 이 약정에는 영향을 주지 않습니다.
            </p>
            <h3>확정 조건</h3>
            <dl className="details-list">
              <div>
                <dt>대출금액</dt>
                <dd>{won(draft.terms.amount)}</dd>
              </div>
              <div>
                <dt>대출기간</dt>
                <dd>{draft.terms.termMonths}개월</dd>
              </div>
              <div>
                <dt>금리</dt>
                <dd>연 {rate(draft.terms.annualInterestRate)}% (고정, 교육용 가정값)</dd>
              </div>
              <div>
                <dt>상환방식</dt>
                <dd>{repaymentLabel(draft.terms.repaymentMethod)}</dd>
              </div>
            </dl>
            <h3>상환 요약</h3>
            <dl className="details-list">
              <div>
                <dt>첫 회 납입액</dt>
                <dd>{won(draft.repayment.firstPayment)}</dd>
              </div>
              <div>
                <dt>마지막 회 납입액</dt>
                <dd>{won(draft.repayment.lastPayment)}</dd>
              </div>
              <div>
                <dt>총 이자</dt>
                <dd>{won(draft.repayment.totalInterest)}</dd>
              </div>
              <div>
                <dt>총 납입액</dt>
                <dd>{won(draft.repayment.totalPayment)}</dd>
              </div>
            </dl>
            <h3>상품설명서 (버전 {draft.explanation.version})</h3>
            <ol className="loan-explanation">
              {draft.explanation.items.map((item) => (
                <li key={item.title}>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                </li>
              ))}
            </ol>
            <fieldset className="loan-acknowledgements">
              <legend>필수 확인 항목</legend>
              {draft.requiredAcknowledgements.map((item) => (
                <label key={item.code}>
                  <input
                    type="checkbox"
                    checked={checked.has(item.code)}
                    onChange={(event) => toggle(item.code, event.target.checked)}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </fieldset>
            <p className="bank-section-help">
              <AppIcon name="info" size={14} /> {draft.notice}
            </p>
            <div className="loan-step-actions">
              <button
                className="button button-primary"
                disabled={!body || command.pending}
                onClick={() => {
                  setCheckResult(null)
                  setConfirming(true)
                }}
              >
                약정하기
              </button>
              {!body && (
                <span className="bank-section-help">필수 확인 항목을 모두 확인해 주세요.</span>
              )}
            </div>
          </>
        )}
      </div>
      {draft && (
        <ConfirmDialog
          open={confirming}
          title="이 조건으로 약정할까요?"
          confirmLabel={unresolved ? '같은 요청으로 다시 시도' : '약정하기'}
          pendingLabel="약정 중…"
          cancelLabel={unresolved ? '닫기' : '취소'}
          pending={command.pending}
          confirmDisabled={!body}
          extraAction={
            unresolved && (
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
          <dl className="bank-confirm-summary">
            <div>
              <dt>상품</dt>
              <dd>{draft.productName}</dd>
            </div>
            <div>
              <dt>조건</dt>
              <dd>
                {won(draft.terms.amount)} · {draft.terms.termMonths}개월 · 연{' '}
                {rate(draft.terms.annualInterestRate)}%
              </dd>
            </div>
            <div>
              <dt>상품설명서</dt>
              <dd>버전 {draft.explanation.version}</dd>
            </div>
          </dl>
          <p>약정은 철회할 수 없습니다. 가상 자금만 사용하는 교육용 시뮬레이션입니다.</p>
          <ErrorNotice error={command.error} message={loanCommandMessage(command.error, 'agree')} />
          {checkResult && (
            <ErrorNotice error={checkResult.failed ?? true} message={checkResult.message} />
          )}
        </ConfirmDialog>
      )}
    </section>
  )
}

function AgreedStep({
  application,
  stage,
  onChanged,
}: {
  application: LoanApplication
  stage: 'execute' | 'loan'
  onChanged: LifecycleReport
}) {
  const navigate = useNavigate()
  const path = `/loan-applications/${encodeURIComponent(application.id)}`
  const loansPath = `/loans?applicationId=${encodeURIComponent(application.id)}`
  const [agreement, setAgreement] = useState<Agreement | null>(null)
  const [loans, setLoans] = useState<LoanSummary[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<unknown>(null)
  const [reload, setReload] = useState(0)
  const [confirming, setConfirming] = useState(false)
  const [unresolved, setUnresolved] = useState(false)
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState<CheckResult>(null)
  const command = useAdminCommand()

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setLoadError(null)
    void Promise.all([
      request<Agreement>(`${path}/agreement`, { signal: controller.signal }),
      stage === 'loan'
        ? request<{ items: LoanSummary[] }>(loansPath, { signal: controller.signal })
        : Promise.resolve(null),
    ])
      .then(([agreed, list]) => {
        setAgreement(agreed)
        setLoans(list?.items ?? null)
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setLoadError(cause)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [path, loansPath, stage, reload])

  function opened(loanId: string, text: string) {
    navigate(`/loans/${loanId}`, { state: { notice: text } })
  }
  async function send() {
    setCheckResult(null)
    const outcome = await command.run(
      { applicationId: application.id, command: 'execute' },
      (key) => request<LoanDetail>(`${path}/execution`, { method: 'POST', idempotencyKey: key }),
    )
    if (!outcome) return
    if (outcome.ok) {
      opened(
        outcome.value.id,
        '대출이 실행되었습니다. 가상 결제 자금으로 지급되었고 상환 일정이 만들어졌습니다.',
      )
      return
    }
    const cause = outcome.error
    if (isUncertain(cause)) {
      setUnresolved(true)
      return
    }
    setConfirming(false)
    setUnresolved(false)
    if (needsLoanReload(cause))
      onChanged({ tone: 'error', text: loanCommandMessage(cause, 'execute') ?? cause.message })
  }
  async function check() {
    if (checking) return
    setChecking(true)
    setCheckResult(null)
    try {
      const list = await request<{ items: LoanSummary[] }>(loansPath)
      const loan = list.items[0]
      if (loan) {
        command.setError(null)
        opened(loan.id, '대출이 이미 실행되어 있습니다. 상환 일정을 확인해 주세요.')
        return
      }
      setUnresolved(false)
      command.setError(null)
      setCheckResult({
        message: '아직 실행되지 않았습니다. 내용을 확인한 뒤 다시 실행할 수 있습니다.',
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
    <section className="bank-statement loan-step" aria-labelledby="loan-agreed-title">
      <div className="bank-statement-heading">
        <div>
          <span>{stage === 'execute' ? '다음 단계 · 대출 실행' : '약정·실행 완료'}</span>
          <h2 id="loan-agreed-title">약정 내용</h2>
        </div>
        <span className="loan-sim-tag">모의 약정</span>
      </div>
      <div className="bank-statement-body">
        {loading && !agreement ? (
          <div className="empty-state" role="status">
            약정 내용을 불러오고 있습니다.
          </div>
        ) : loadError || !agreement ? (
          <>
            <ErrorNotice error={loadError} message={loanCommandMessage(loadError, 'execute')} />
            <button
              className="button button-outline"
              onClick={() => setReload((value) => value + 1)}
            >
              다시 불러오기
            </button>
          </>
        ) : (
          <>
            <dl className="details-list">
              <div>
                <dt>약정일시</dt>
                <dd>{dateTime(agreement.agreedAt)}</dd>
              </div>
              <div>
                <dt>약정 조건</dt>
                <dd>
                  {won(agreement.terms.amount)} · {agreement.terms.termMonths}개월 · 연{' '}
                  {rate(agreement.terms.annualInterestRate)}% ·{' '}
                  {repaymentLabel(agreement.terms.repaymentMethod)}
                </dd>
              </div>
              <div>
                <dt>상품설명서</dt>
                <dd>버전 {agreement.explanationVersion}</dd>
              </div>
              <div>
                <dt>확인 항목</dt>
                <dd>{agreement.acknowledgements.map(acknowledgementLabel).join(', ')}</dd>
              </div>
            </dl>
            {stage === 'execute' ? (
              <>
                <p>
                  대출을 실행하면 약정 금액이 가상 결제 자금으로 지급되고 원리금균등 상환 일정이
                  만들어집니다. 실행일은 오늘(한국 시간) 기준 가상 날짜이며, 회차마다 1개월 뒤가
                  납부일입니다.
                </p>
                <div className="loan-step-actions">
                  <button
                    className="button button-primary"
                    disabled={command.pending}
                    onClick={() => {
                      setCheckResult(null)
                      setConfirming(true)
                    }}
                  >
                    대출 실행
                  </button>
                </div>
              </>
            ) : loans && loans.length ? (
              <ul className="loan-link-list">
                {loans.map((loan) => (
                  <li key={loan.id}>
                    <div>
                      <strong>{loanStatusLabel(loan.status)}</strong>
                      <span>
                        남은 원금 {won(loan.outstandingPrincipal)} · {loan.paidInstallments}/
                        {loan.termMonths}회 납부 · 실행일 {loanDate(loan.executedOn)}
                      </span>
                    </div>
                    <Link to={`/loans/${loan.id}`} className="button button-outline small">
                      대출 상세·상환
                      <AppIcon name="chevron" size={14} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-state">실행된 대출 정보를 찾지 못했습니다.</div>
            )}
            <p className="bank-section-help">
              <AppIcon name="info" size={14} /> {agreement.notice}
            </p>
          </>
        )}
      </div>
      {agreement && (
        <ConfirmDialog
          open={confirming}
          title="대출을 실행할까요?"
          confirmLabel={unresolved ? '같은 요청으로 다시 시도' : '대출 실행'}
          pendingLabel="실행 중…"
          cancelLabel={unresolved ? '닫기' : '취소'}
          pending={command.pending}
          extraAction={
            unresolved && (
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
          <dl className="bank-confirm-summary">
            <div>
              <dt>실행 금액</dt>
              <dd>{won(agreement.terms.amount)}</dd>
            </div>
            <div>
              <dt>상환</dt>
              <dd>
                {agreement.terms.termMonths}회 · {repaymentLabel(agreement.terms.repaymentMethod)}
              </dd>
            </div>
          </dl>
          <p>실행은 취소할 수 없습니다. 실제 입금이 아닌 가상 자금 지급입니다.</p>
          <ErrorNotice
            error={command.error}
            message={loanCommandMessage(command.error, 'execute')}
          />
          {checkResult && (
            <ErrorNotice error={checkResult.failed ?? true} message={checkResult.message} />
          )}
        </ConfirmDialog>
      )}
    </section>
  )
}
