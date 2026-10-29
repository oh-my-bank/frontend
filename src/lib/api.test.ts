import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, request, resetCsrf } from './api'

describe('session mutations', () => {
  beforeEach(() => resetCsrf())
  afterEach(() => vi.unstubAllGlobals())

  it('obtains a CSRF token before sending a financial mutation and includes the retry identity', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ token: 'csrf-one', headerName: 'X-CSRF-TOKEN' })).mockResolvedValueOnce(Response.json({ id: 'application-one' }, { status: 201 }))
    vi.stubGlobal('fetch', fetch)
    await request('/loan-applications', { method: 'POST', body: { requestedAmount: 1000000 }, idempotencyKey: 'stable-request-key' })
    expect(fetch.mock.calls[0]?.[0]).toBe('/api/v1/auth/csrf')
    expect(fetch.mock.calls[1]?.[1]).toMatchObject({ credentials: 'same-origin', method: 'POST', headers: { 'X-CSRF-TOKEN': 'csrf-one', 'Idempotency-Key': 'stable-request-key' } })
  })

  it('sends no financial mutation when the CSRF handshake fails', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ code: 'SERVICE_UNAVAILABLE', message: '서버 준비 중' }, { status: 503 }))
    vi.stubGlobal('fetch', fetch)
    await expect(request('/loan-applications', { method: 'POST', body: { requestedAmount: 1000000 } })).rejects.toMatchObject({ status: 503 })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('does not silently replay an ambiguous financial mutation after a network failure', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ token: 'csrf-one', headerName: 'X-CSRF-TOKEN' })).mockRejectedValueOnce(new TypeError('connection closed'))
    vi.stubGlobal('fetch', fetch)
    await expect(request('/loan-applications', { method: 'POST', body: { requestedAmount: 1000000 }, idempotencyKey: 'stable-request-key' })).rejects.toBeInstanceOf(ApiError)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('obtains a new token after the session changes', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ token: 'csrf-old', headerName: 'X-CSRF-TOKEN' })).mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(Response.json({ token: 'csrf-new', headerName: 'X-CSRF-TOKEN' })).mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetch)
    await request('/auth/logout', { method: 'POST' })
    resetCsrf()
    await request('/auth/login', { method: 'POST', body: {} })
    expect(fetch.mock.calls[3]?.[1]).toMatchObject({ headers: { 'X-CSRF-TOKEN': 'csrf-new' } })
  })
})
