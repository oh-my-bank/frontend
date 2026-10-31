import { useState } from 'react'
import { ApiError, request } from '../lib/api'
import { commandMessage, isUncertain, policyRows } from '../lib/adminProducts'
import { useAdminCommand } from '../lib/useAdminCommand'
import type { AdminProduct } from '../types'
import AppIcon from './AppIcon'
import ConfirmDialog from './ConfirmDialog'
import ErrorNotice from './ErrorNotice'

const rateRow = policyRows.find((row) => row.key === 'annualInterestRate')!
const amountRow = (key: 'minAmount' | 'maxAmount') => policyRows.find((row) => row.key === key)!

/**
 * Resumes sales of a stopped product with its current policy (R13). An unclear result is checked
 * against the latest product before the same request (same key) is sent again.
 */
export default function ProductReactivation({
  product,
  onChanged,
  onReload,
}: {
  product: AdminProduct
  onChanged: (product: AdminProduct, message: string) => void
  onReload: () => void
}) {
  const command = useAdminCommand()
  const [confirming, setConfirming] = useState(false)
  const [unresolved, setUnresolved] = useState(false)
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState<{ message: string; failed?: unknown } | null>(null)
  const path = `/admin/loan-products/${encodeURIComponent(product.id)}`
  const policy = product.currentPolicy

  function open() {
    if (!unresolved) command.setError(null)
    setCheckResult(null)
    setConfirming(true)
  }
  function done(updated: AdminProduct, message: string) {
    setConfirming(false)
    setUnresolved(false)
    setCheckResult(null)
    onChanged(updated, message)
  }
  async function reactivate() {
    const outcome = await command.run({ productId: product.id, command: 'reactivate' }, (key) =>
      request<AdminProduct>(`${path}/reactivation`, { method: 'POST', idempotencyKey: key }),
    )
    if (!outcome) return
    if (outcome.ok) {
      done(
        outcome.value,
        `판매를 재개했습니다. 정책 버전 ${outcome.value.currentPolicy.version} 조건으로 고객 상품 목록과 신규 신청에 다시 공개되었습니다.`,
      )
      return
    }
    setCheckResult(null)
    if (isUncertain(outcome.error)) setUnresolved(true)
    else if (
      outcome.error instanceof ApiError &&
      ['PRODUCT_ACTIVE', 'PRODUCT_NOT_FOUND'].includes(outcome.error.code)
    ) {
      setConfirming(false)
      onReload()
    }
  }
  async function check() {
    if (checking) return
    setChecking(true)
    setCheckResult(null)
    try {
      const latest = await request<AdminProduct>(path)
      if (latest.active) {
        done(latest, '판매 재개가 반영된 것을 확인했습니다. 고객 상품 목록에 다시 공개되었습니다.')
        return
      }
      setUnresolved(false)
      command.setError(null)
      setCheckResult({
        message:
          '아직 판매 중지 상태입니다. 판매 재개가 반영되지 않았으니 다시 진행할 수 있습니다.',
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
      {!confirming && !!command.error && (
        <ErrorNotice error={command.error} message={commandMessage(command.error, 'reactivate')} />
      )}
      <section className="bank-record-notice" aria-labelledby="bank-admin-inactive-title">
        <AppIcon name="info" size={21} />
        <div>
          <h2 id="bank-admin-inactive-title">판매 중지된 상품입니다.</h2>
          <p>
            고객 상품 목록과 신규 신청에서 제외되었으며 이미 접수된 신청 내역은 계속 조회됩니다.
            판매를 재개하면 현재 정책 버전 조건으로 다시 공개됩니다. 정책 발행은 판매 재개 후에 할
            수 있습니다.
          </p>
          <button type="button" className="button button-primary small" onClick={open}>
            판매 재개
          </button>
        </div>
      </section>
      <ConfirmDialog
        open={confirming}
        title="판매 재개 확인"
        confirmLabel={unresolved ? '같은 요청으로 다시 시도' : '판매 재개'}
        pendingLabel="처리 중…"
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
        onConfirm={reactivate}
        onClose={() => setConfirming(false)}
      >
        {!!command.error && (
          <ErrorNotice
            error={command.error}
            message={commandMessage(command.error, 'reactivate')}
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
            <dt>대상 상품</dt>
            <dd>{product.name}</dd>
          </div>
          <div>
            <dt>다시 판매할 정책</dt>
            <dd>
              버전 {policy.version} · {rateRow.format(policy)} ·{' '}
              {amountRow('minAmount').format(policy)} ~ {amountRow('maxAmount').format(policy)} ·{' '}
              {policy.minTermMonths}~{policy.maxTermMonths}개월
            </dd>
          </div>
          <div>
            <dt>변경</dt>
            <dd>판매 중지 → 판매 중</dd>
          </div>
        </dl>
        <ul className="bank-confirm-effects">
          <li>고객 상품 목록·상품 상세에 다시 공개되고 새 신청을 받습니다.</li>
          <li>
            정책 조건은 바뀌지 않습니다. 조건을 바꾸려면 판매 재개 후 새 정책 버전을 발행해 주세요.
          </li>
          <li>
            판매 중인 다른 상품과 이름이 같으면 재개할 수 없습니다. 먼저 상품명을 바꿔 주세요.
          </li>
        </ul>
      </ConfirmDialog>
    </>
  )
}
