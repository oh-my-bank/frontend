import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { ApiError, request, resetCsrf } from '../lib/api'
import type { User } from '../types'
interface AuthState {
  user: User | null
  ready: boolean
  error: string
  sessionExpired: boolean
  login: (input: { email: string; password: string }) => Promise<User>
  register: (input: { email: string; password: string; name: string }) => Promise<User>
  logout: () => Promise<void>
  refresh: () => Promise<User | null>
}
const AuthContext = createContext<AuthState | null>(null)
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [sessionExpired, setSessionExpired] = useState(false)
  const signedIn = useRef(false)
  useEffect(() => {
    signedIn.current = !!user
  }, [user])
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    const unauthorized = () => {
      // Only a session that was signed in can expire; an anonymous 401 is not news.
      if (signedIn.current) setSessionExpired(true)
      setUser(null)
      resetCsrf()
    }
    window.addEventListener('omb:unauthorized', unauthorized)
    void request<User>('/auth/me', { signal: controller.signal })
      .then((result) => {
        if (active) setUser(result)
      })
      .catch((cause) => {
        if (
          active &&
          !controller.signal.aborted &&
          !(cause instanceof ApiError && cause.status === 401)
        )
          setError('서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.')
      })
      .finally(() => {
        if (active) setReady(true)
      })
    return () => {
      active = false
      controller.abort()
      window.removeEventListener('omb:unauthorized', unauthorized)
    }
  }, [])
  async function login(input: { email: string; password: string }) {
    const result = await request<User>('/auth/login', { method: 'POST', body: input })
    resetCsrf()
    setUser(result)
    setError('')
    setSessionExpired(false)
    return result
  }
  async function register(input: { email: string; password: string; name: string }) {
    const result = await request<User>('/auth/register', { method: 'POST', body: input })
    resetCsrf()
    setUser(result)
    setError('')
    setSessionExpired(false)
    return result
  }
  async function logout() {
    await request<void>('/auth/logout', { method: 'POST' })
    resetCsrf()
    setUser(null)
    setSessionExpired(false)
  }
  /** Rechecks the server session, e.g. after a 403 that may be an expired session or a stale CSRF token. */
  async function refresh() {
    try {
      const result = await request<User>('/auth/me')
      setUser(result)
      return result
    } catch (cause) {
      // The 401 has already signed the user out through the unauthorized event.
      if (cause instanceof ApiError && cause.status === 401) return null
      throw cause
    }
  }
  return (
    <AuthContext.Provider
      value={{ user, ready, error, sessionExpired, login, register, logout, refresh }}
    >
      {children}
    </AuthContext.Provider>
  )
}
export function useAuth() {
  const state = useContext(AuthContext)
  if (!state) throw new Error('useAuth must be used within AuthProvider')
  return state
}
