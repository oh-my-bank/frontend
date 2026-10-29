interface CsrfToken { token: string; headerName: string }
let csrf: CsrfToken | undefined

export class ApiError extends Error {
  constructor(public code: string, message: string, public status = 0, public traceId?: string) {
    super(message)
    this.name = 'ApiError'
  }
}

export function resetCsrf() { csrf = undefined }

export async function request<T>(path: string, options: { method?: string; body?: unknown; idempotencyKey?: string } = {}): Promise<T> {
  const method = options.method ?? 'GET'
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (method !== 'GET') {
    if (!csrf) csrf = await request<CsrfToken>('/auth/csrf')
    headers[csrf.headerName] = csrf.token
  }
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey
  let response: Response
  try {
    response = await fetch(`/api/v1${path}`, { method, credentials: 'same-origin', headers, ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }) })
  } catch {
    throw new ApiError('NETWORK_ERROR', '서버에 연결하지 못했습니다. 연결을 확인하고 다시 시도해 주세요. 신청을 다시 보내면 동일한 요청 키를 사용합니다.')
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as { code?: string; message?: string; traceId?: string }
    if (response.status === 403) resetCsrf()
    if (response.status === 401) window.dispatchEvent(new Event('omb:unauthorized'))
    throw new ApiError(error.code ?? `HTTP_${response.status}`, error.message ?? (response.status === 401 ? '로그인이 필요합니다.' : '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'), response.status, error.traceId)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export function errorMessage(error: unknown): string { return error instanceof Error ? error.message : '잠시 후 다시 시도해 주세요.' }
