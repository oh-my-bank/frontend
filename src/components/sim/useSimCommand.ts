import { useRef, useState } from 'react'
import { ApiError } from '../../lib/api'
import { createRequestIdentity } from '../../lib/idempotency'
import { reusesRequestKey } from '../../lib/simulation'
import { useAuth } from '../../stores/auth'

export type SimOutcome<T> =
  { ok: true; value: T; replayed: boolean } | { ok: false; error: unknown }
export type SimCommand = 'create' | 'close' | 'advance' | 'open' | 'closeAccount'

/**
 * Runs one simulation command at a time. Each command keeps its own Idempotency-Key per payload:
 * an uncertain failure resends the same content with the same key, while a success or a definite
 * rejection starts the next attempt with a new one. `replayed` marks a resend whose response may
 * be the first attempt's snapshot, so the caller reloads the current state.
 */
export function useSimCommand() {
  const { refresh } = useAuth()
  const [identities] = useState(() => ({
    create: createRequestIdentity(),
    close: createRequestIdentity(),
    advance: createRequestIdentity(),
    open: createRequestIdentity(),
    closeAccount: createRequestIdentity(),
  }))
  const sentKeys = useRef<Partial<Record<SimCommand, string>>>({})
  const running = useRef(false)
  const [pending, setPending] = useState<SimCommand | null>(null)
  async function run<T>(
    command: SimCommand,
    payload: unknown,
    send: (key: string) => Promise<T>,
  ): Promise<SimOutcome<T> | undefined> {
    if (running.current) return undefined
    running.current = true
    setPending(command)
    const identity = identities[command]
    const key = identity.keyFor(payload)
    const replayed = sentKeys.current[command] === key
    sentKeys.current[command] = key
    try {
      const value = await send(key)
      identity.clear()
      delete sentKeys.current[command]
      return { ok: true, value, replayed }
    } catch (cause) {
      if (!reusesRequestKey(cause)) {
        identity.clear()
        delete sentKeys.current[command]
      }
      // A 403 can be an expired session behind a stale CSRF token; /auth/me tells them apart.
      if (cause instanceof ApiError && cause.status === 403) await refresh().catch(() => null)
      return { ok: false, error: cause }
    } finally {
      running.current = false
      setPending(null)
    }
  }
  return { run, pending }
}
