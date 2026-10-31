import { useState } from 'react'
import { request } from '../lib/api'
import { won } from '../lib/format'
import {
  canWithdraw,
  loanCommandMessage,
  loanDate,
  needsLoanReload,
  withdrawalApplied,
  type LoanDetail,
} from '../lib/loans'
import { isUncertain } from '../lib/reviews'
import { useAdminCommand } from '../lib/useAdminCommand'
import AppIcon from './AppIcon'
import ConfirmDialog from './ConfirmDialog'
import ErrorNotice from './ErrorNotice'

/**
 * Customer withdrawal of an executed loan with no repayment (decision 0008). The loan is not deleted: a disbursement reversal is
 * recorded and the loan and its application become WITHDRAWN for good.
 */
export default function LoanWithdrawalSection({
  loan,
  path,
  onWithdrawn,
  onConflict,
}: {
  loan: LoanDetail
  path: string
  onWithdrawn: (latest: LoanDetail) => void
  onConflict: (message: string) => void
}) {
  const command = useAdminCommand()
  const [confirming, setConfirming] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)
  // The withdrawal response never arrived; it may already be recorded.
  const [unresolved, setUnresolved] = useState(false)
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState<{ message: string; failed?: unknown } | null>(null)

  if (loan.status === 'WITHDRAWN') {
    return (
      <section className="loan-next" aria-labelledby="loan-withdrawn-title">
        <h2 id="loan-withdrawn-title">대출 철회 완료</h2>
        <p>
          이 대출은 철회되었습니다. 실행 거래는 지우지 않고 반대 거래(차변 가상 결제 자금 / 대변
          대출채권 {won(loan.principal)})로 기록했으며 남은 원금은 0원입니다. 철회한 대출은 다시
          실행하거나 납부할 수 없습니다.
        </p>
      </section>
    )
  }
  if (loan.status !== 'ACTIVE') return null

  function finished(latest: LoanDetail) {
    command.setError(null)
    setConfirming(false)
    setUnresolved(false)
    setAcknowledged(false)
    onWithdrawn(latest)
  }
  async function send() {
    setCheckResult(null)
    const outcome = await command.run({ loanId: loan.id, command: 'withdraw' }, (key) =>
      request<LoanDetail>(`${path}/withdrawal`, { method: 'POST', idempotencyKey: key }),
    )
    if (!outcome) return
    if (outcome.ok) {
      finished(outcome.value)
      return
    }
    const cause = outcome.error
    if (isUncertain(cause)) {
      setUnresolved(true)
      return
    }
    setConfirming(false)
    setUnresolved(false)
    if (needsLoanReload(cause)) {
      command.setError(null)
      onConflict(loanCommandMessage(cause, 'withdraw') ?? cause.message)
    }
  }
  async function check() {
    if (checking) return
    setChecking(true)
    setCheckResult(null)
    try {
      const latest = await request<LoanDetail>(path)
      if (withdrawalApplied(latest)) {
        finished(latest)
        return
      }
      setUnresolved(false)
      command.setError(null)
      setCheckResult({
        message: '아직 철회되지 않았습니다. 내용을 확인한 뒤 다시 철회할 수 있습니다.',
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
    <section className="loan-next" aria-labelledby="loan-withdraw-title">
      <h2 id="loan-withdraw-title">대출 철회</h2>
      {canWithdraw(loan) ? (
        <>
          <p>
            아직 납부하지 않은 대출은 철회할 수 있습니다. 철회하면 실행 거래의 반대 거래가 기록되고
            대출과 신청이 철회 상태로 끝납니다.
          </p>
          <button
            className="button button-outline"
            disabled={command.pending}
            onClick={() => {
              setCheckResult(null)
              setConfirming(true)
            }}
          >
            대출 철회
          </button>
        </>
      ) : (
        <p>
          납부가 있는 대출은 철회할 수 없습니다. 운영자가 납부를 모두 취소한 뒤에 철회할 수
          있습니다.
        </p>
      )}
      <p className="bank-section-help">
        <AppIcon name="info" size={14} /> 실제 대출성 상품의 청약철회권(계약 후 14일 이내 등)을 본뜬
        교육용 단순화입니다. 가상 시간이 흐르지 않으므로 기간 조건은 적용하지 않습니다.
      </p>
      <ConfirmDialog
        open={confirming}
        title="대출을 철회할까요?"
        confirmLabel={unresolved ? '같은 요청으로 다시 시도' : '철회하기'}
        pendingLabel="철회 중…"
        cancelLabel={unresolved ? '닫기' : '취소'}
        pending={command.pending}
        danger
        confirmDisabled={!acknowledged}
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
            <dt>대출 원금</dt>
            <dd>{won(loan.principal)}</dd>
          </div>
          <div>
            <dt>반대 거래</dt>
            <dd>
              차) 가상 결제 자금 {won(loan.principal)} / 대) 대출채권 {won(loan.principal)}
            </dd>
          </div>
          <div>
            <dt>거래일 (가상)</dt>
            <dd>{loanDate(loan.executedOn)} (실행일)</dd>
          </div>
        </dl>
        <p>
          원래 실행 거래는 그대로 두고 반대 거래를 추가합니다. 실제 반환·출금이 아닌 가상 자금
          처리입니다.
        </p>
        <label className="bank-confirm-acknowledge">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
            disabled={command.pending}
          />
          <span>철회한 대출은 다시 실행하거나 납부할 수 없다는 것을 확인했습니다.</span>
        </label>
        <ErrorNotice
          error={command.error}
          message={loanCommandMessage(command.error, 'withdraw')}
        />
        {checkResult && (
          <ErrorNotice error={checkResult.failed ?? true} message={checkResult.message} />
        )}
      </ConfirmDialog>
    </section>
  )
}
