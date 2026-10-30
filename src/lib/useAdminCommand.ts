import { useRef, useState } from 'react'
import { ApiError } from './api'
import { createRequestIdentity } from './idempotency'
import { useAuth } from '../stores/auth'

export type CommandOutcome<T> = { ok: true; value: T } | { ok: false; error: unknown }

/**
 * Runs one administrator change at a time. The Idempotency-Key follows the payload, so retrying an
 * uncertain result reuses it and only a different command (or one after success) gets a new key.
 */
export function useAdminCommand() {
  const { refresh } = useAuth()
  const identity = useRef(createRequestIdentity())
  const running = useRef(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<unknown>(null)
  async function run<T>(
    payload: unknown,
    send: (key: string) => Promise<T>,
  ): Promise<CommandOutcome<T> | undefined> {
    if (running.current) return undefined
    running.current = true
    setPending(true)
    setError(null)
    try {
      const value = await send(identity.current.keyFor(payload))
      identity.current.clear()
      return { ok: true, value }
    } catch (cause) {
      // A 403 can be an expired session behind a stale CSRF token; /auth/me tells the cases apart
      // and signs the user out when the session is gone.
      if (cause instanceof ApiError && cause.status === 403) await refresh().catch(() => null)
      setError(cause)
      return { ok: false, error: cause }
    } finally {
      running.current = false
      setPending(false)
    }
  }
  return { run, pending, error, setError }
}
