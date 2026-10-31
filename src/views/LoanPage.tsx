import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ApiError, request } from '../lib/api'
import { won } from '../lib/format'
import {
  loanCommandMessage,
  loanDate,
  needsLoanReload,
  repaymentApplied,
  repaymentBody,
  type LoanDetail,
  type RepaymentResult,
} from '../lib/loans'
import { isUncertain } from '../lib/reviews'
import { useAdminCommand } from '../lib/useAdminCommand'
import AppIcon from '../components/AppIcon'
import ConfirmDialog from '../components/ConfirmDialog'
import ErrorNotice from '../components/ErrorNotice'
import { LoanRecordTabs, LoanStatement } from '../components/LoanRecords'
import LoanWithdrawalSection from '../components/LoanWithdrawalSection'
import '../styles/banking-records.css'
import '../styles/simulation.css'
import '../styles/loans.css'

export default function LoanPage() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const path = `/loans/${encodeURIComponent(id ?? '')}`
  const [loan, setLoan] = useState<LoanDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [reload, setReload] = useState(0)
  const [notice, setNotice] = useState<string | null>(
    () => (location.state as { notice?: string } | null)?.notice ?? null,
  )
  const noticeRef = useRef<HTMLDivElement>(null)
  const command = useAdminCommand()
  const [confirming, setConfirming] = useState(false)
  // The installment whose repayment response never arrived; it may already be recorded.
  const [unresolved, setUnresolved] = useState<number | null>(null)
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState<{ message: string; failed?: unknown } | null>(null)
  const [conflict, setConflict] = useState<string | null>(null)

  useEffect(() => {
    // The arrival notice is shown once; a refresh should not repeat it.
    if ((location.state as { notice?: string } | null)?.notice)
      navigate(location.pathname, { replace: true, state: null })
  }, [location.state, location.pathname, navigate])
  useEffect(() => {
    if (notice) noticeRef.current?.focus()
  }, [notice])
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    void request<LoanDetail>(path, { signal: controller.signal })
      .then(setLoan)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(cause)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [path, reload])

  const body = loan ? repaymentBody(loan) : null
  const next = loan?.nextInstallment ?? null

  function refreshAll() {
    setReload((value) => value + 1)
  }
  function recorded(latest: LoanDetail, installment: number) {
    setLoan(latest)
    setConfirming(false)
    setUnresolved(null)
    setNotice(
      latest.status === 'PAID_OFF'
        ? `${installment}회차 납부로 대출을 완납했습니다. 남은 원금은 0원입니다.`
        : `${installment}회차 납부가 기록되었습니다. 남은 원금은 ${won(latest.outstandingPrincipal)}입니다.`,
    )
  }
  async function send() {
    if (!body) return
    setCheckResult(null)
    setConflict(null)
    setNotice(null)
    const outcome = await command.run({ loanId: id, command: 'repay', body }, (key) =>
      request<RepaymentResult>(`${path}/repayments`, { method: 'POST', idempotencyKey: key, body }),
    )
    if (!outcome) return
    if (outcome.ok) {
      recorded(outcome.value.loan, outcome.value.repayment.installment)
      return
    }
    const cause = outcome.error
    if (isUncertain(cause)) {
      setUnresolved(body.installment)
      return
    }
    setConfirming(false)
    setUnresolved(null)
    if (needsLoanReload(cause)) {
      setConflict(loanCommandMessage(cause, 'repay') ?? cause.message)
      command.setError(null)
      refreshAll()
    }
  }
  async function check() {
    if (checking || unresolved === null) return
    setChecking(true)
    setCheckResult(null)
    try {
      const latest = await request<LoanDetail>(path)
      if (repaymentApplied(unresolved, latest)) {
        command.setError(null)
        recorded(latest, unresolved)
        return
      }
      setLoan(latest)
      setUnresolved(null)
      command.setError(null)
      setCheckResult({
        message: '아직 납부되지 않았습니다. 내용을 확인한 뒤 다시 납부할 수 있습니다.',
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
    <>
      <section className="page-title bank-title-actions">
        <div>
          <h1>대출 상세</h1>
          <p>모의 대출의 남은 원금, 상환 일정과 거래원장을 확인하고 회차를 납부합니다.</p>
        </div>
        <Link to="/my" className="button button-outline">
          나의 대출
          <AppIcon name="chevron" size={15} />
        </Link>
      </section>
      {notice && (
        <div className="bank-admin-success" role="status" tabIndex={-1} ref={noticeRef}>
          <AppIcon name="check" size={19} />
          <p>{notice}</p>
        </div>
      )}
      {conflict && (
        <div className="notice" role="alert">
          {conflict}
        </div>
      )}
      {loading && !loan ? (
        <div className="empty-state" role="status">
          대출 정보를 불러오고 있습니다.
        </div>
      ) : error || !loan ? (
        <>
          <ErrorNotice
            error={error}
            message={
              error instanceof ApiError && error.status === 404
                ? '대출 내역을 찾을 수 없습니다. 나의 대출에서 다시 선택해 주세요.'
                : undefined
            }
          />
          <div className="bank-record-retry">
            <button
              className="button button-outline"
              onClick={() => setReload((value) => value + 1)}
            >
              다시 불러오기
            </button>
          </div>
        </>
      ) : (
        <>
          <LoanStatement
            loan={loan}
            loading={loading}
            extra={
              <div>
                <dt>신청 내역</dt>
                <dd>
                  <Link to={`/applications/${loan.applicationId}`}>신청·약정 내용 보기</Link>
                </dd>
              </div>
            }
          />

          {loan.status !== 'WITHDRAWN' && (
            <section className="loan-next" aria-labelledby="loan-next-title">
              <h2 id="loan-next-title">다음 납부</h2>
              {next && body ? (
                <>
                  <dl className="details-list">
                    <div>
                      <dt>회차</dt>
                      <dd>{next.installment}회차</dd>
                    </div>
                    <div>
                      <dt>납부일 (가상)</dt>
                      <dd>{loanDate(next.dueDate)}</dd>
                    </div>
                    <div>
                      <dt>납입액</dt>
                      <dd>
                        {won(next.payment)} (원금 {won(next.principal)} · 이자 {won(next.interest)})
                      </dd>
                    </div>
                  </dl>
                  <button
                    className="button button-primary"
                    disabled={command.pending}
                    onClick={() => {
                      setCheckResult(null)
                      setConfirming(true)
                    }}
                  >
                    {next.installment}회차 납부하기
                  </button>
                </>
              ) : (
                <p>모든 회차를 납부해 대출을 완납했습니다. 남은 원금은 0원입니다.</p>
              )}
              <p className="bank-section-help">
                <AppIcon name="info" size={14} /> 회차 순서대로, 회차 납입액 그대로만 납부할 수
                있습니다. 납부는 해당 회차 납부일에 낸 것으로 기록되는 가상 시간 진행이며 실제
                출금이 아닙니다. 부분·조기 상환과 연체는 제공하지 않습니다.
              </p>
            </section>
          )}
          <LoanWithdrawalSection
            loan={loan}
            path={path}
            onWithdrawn={(latest) => {
              setLoan(latest)
              setConflict(null)
              setNotice(
                '대출을 철회했습니다. 실행 거래의 반대 거래가 기록되었고 남은 원금은 0원입니다.',
              )
            }}
            onConflict={(message) => {
              setNotice(null)
              setConflict(message)
              refreshAll()
            }}
          />

          <LoanRecordTabs loan={loan} ledgerPath={`${path}/ledger`} />

          <section className="bank-record-notice" aria-labelledby="loan-notice-title">
            <AppIcon name="info" size={21} />
            <div>
              <h2 id="loan-notice-title">확인해 주세요</h2>
              <p>{loan.notice}</p>
            </div>
          </section>

          <ConfirmDialog
            open={confirming && !!next}
            title={next ? `${next.installment}회차를 납부할까요?` : '납부'}
            confirmLabel={unresolved !== null ? '같은 요청으로 다시 시도' : '납부하기'}
            pendingLabel="납부 중…"
            cancelLabel={unresolved !== null ? '닫기' : '취소'}
            pending={command.pending}
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
            {next && (
              <dl className="bank-confirm-summary">
                <div>
                  <dt>납입액</dt>
                  <dd>{won(next.payment)}</dd>
                </div>
                <div>
                  <dt>구성</dt>
                  <dd>
                    원금 {won(next.principal)} · 이자 {won(next.interest)}
                  </dd>
                </div>
                <div>
                  <dt>납부일 (가상)</dt>
                  <dd>{loanDate(next.dueDate)}</dd>
                </div>
              </dl>
            )}
            <p>
              고객은 납부를 취소할 수 없습니다. 착오 납부 정정은 운영자가 최근 회차부터 반대
              거래로만 처리합니다. 가상 결제 자금으로 처리되는 교육용 시뮬레이션입니다.
            </p>
            <ErrorNotice
              error={command.error}
              message={loanCommandMessage(command.error, 'repay')}
            />
            {checkResult && (
              <ErrorNotice error={checkResult.failed ?? true} message={checkResult.message} />
            )}
          </ConfirmDialog>
        </>
      )}
    </>
  )
}
