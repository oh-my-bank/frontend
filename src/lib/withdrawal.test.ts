import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, resetCsrf } from './api'
import {
  WITHDRAWAL_CONFIRM_PHRASE,
  serverWithdrawalErrors,
  withdrawAccount,
  withdrawalErrorMessage,
  withdrawalErrors,
  withdrawalNotice,
  type WithdrawalResult,
} from './withdrawal'

const result: WithdrawalResult = {
  status: 'WITHDRAWN',
  withdrawnAt: '2026-11-02T03:00:00Z',
  deleted: { strategySaves: 1, learningProgress: 2, requestRecords: 3 },
  simulationClosed: true,
  retainedLoanApplications: 0,
}

describe('withdrawal form checks', () => {
  it('needs the current password and the exact upper-case phrase', () => {
    expect(withdrawalErrors({ currentPassword: 'OmbDemo123!', confirm: 'WITHDRAW' })).toEqual({})
    expect(WITHDRAWAL_CONFIRM_PHRASE).toBe('WITHDRAW')
    const errors = withdrawalErrors({ currentPassword: '', confirm: 'withdraw' })
    expect(Object.keys(errors).sort()).toEqual(['confirm', 'currentPassword'])
    expect(withdrawalErrors({ currentPassword: 'x', confirm: ' WITHDRAW' }).confirm).toContain(
      'WITHDRAW',
    )
  })
  it('maps only this form’s server field errors', () => {
    expect(serverWithdrawalErrors({ currentPassword: '불일치', newPassword: 'x' })).toEqual({
      currentPassword: '불일치',
    })
  })
})

describe('withdrawal messages', () => {
  it('explains how an active loan can end before withdrawing', () => {
    const blocked = new ApiError(
      'WITHDRAWAL_BLOCKED_ACTIVE_LOAN',
      '상환 중인 대출 1건이 있어 탈퇴할 수 없습니다.',
      409,
    )
    expect(withdrawalErrorMessage(blocked)).toContain('상환 중인 대출 1건')
    expect(withdrawalErrorMessage(blocked)).toContain('철회')
  })
  it('warns that a lost response may already have withdrawn the account', () => {
    expect(withdrawalErrorMessage(new ApiError('NETWORK_ERROR', 'x'))).toContain('이미 처리')
    expect(
      withdrawalErrorMessage(new ApiError('CURRENT_PASSWORD_MISMATCH', '불일치', 400)),
    ).toBeNull()
    expect(withdrawalErrorMessage(new Error('x'))).toBeNull()
  })
  it('tells what stayed and that the email can register again', () => {
    expect(withdrawalNotice(result)).not.toContain('대출 신청')
    const kept = withdrawalNotice({ ...result, retainedLoanApplications: 2 })
    expect(kept).toContain('대출 신청 2건')
    expect(kept).toContain('다시 가입')
  })
})

describe('withdrawal request', () => {
  beforeEach(() => resetCsrf())
  afterEach(() => vi.unstubAllGlobals())

  it('sends the password and phrase with the CSRF token and no idempotency key', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ token: 'csrf-one', headerName: 'X-CSRF-TOKEN' }))
      .mockResolvedValueOnce(Response.json(result))
    vi.stubGlobal('fetch', fetch)
    await expect(
      withdrawAccount({ currentPassword: 'OmbDemo123!', confirm: 'WITHDRAW' }),
    ).resolves.toEqual(result)
    expect(fetch.mock.calls[1]?.[0]).toBe('/api/v1/account/withdrawal')
    const init = fetch.mock.calls[1]?.[1] as RequestInit & { headers: Record<string, string> }
    expect(init.method).toBe('POST')
    expect(init.headers['X-CSRF-TOKEN']).toBe('csrf-one')
    expect(init.headers['Idempotency-Key']).toBeUndefined()
    expect(JSON.parse(init.body as string)).toEqual({
      currentPassword: 'OmbDemo123!',
      confirm: 'WITHDRAW',
    })
  })
})
