import { reactive } from 'vue'
import { ApiError, request, resetCsrf } from '../lib/api'
import type { User } from '../types'

export const auth = reactive<{ user: User | null; ready: boolean; error: string }>({ user: null, ready: false, error: '' })
window.addEventListener('omb:unauthorized', () => { auth.user = null })

export async function bootstrapAuth() {
  auth.error = ''
  try { auth.user = await request<User>('/auth/me') }
  catch (error) { if (!(error instanceof ApiError && error.status === 401)) auth.error = '서버 연결을 확인해 주세요.' }
  finally { auth.ready = true }
}
export async function login(input: { email: string; password: string }) {
  auth.user = await request<User>('/auth/login', { method: 'POST', body: input })
  resetCsrf()
}
export async function register(input: { email: string; password: string; name: string }) {
  auth.user = await request<User>('/auth/register', { method: 'POST', body: input })
  resetCsrf()
}
export async function logout() {
  await request<void>('/auth/logout', { method: 'POST' })
  auth.user = null
  resetCsrf()
}
