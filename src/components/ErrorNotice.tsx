import { ApiError, errorMessage } from '../lib/api'

export default function ErrorNotice({ error }: { error: unknown }) {
  if (!error) return null
  return (
    <div className="error-notice" role="alert">
      <strong>요청을 확인해 주세요</strong>
      <p>{errorMessage(error)}</p>
      {error instanceof ApiError && error.traceId && <small>오류 추적 ID · {error.traceId}</small>}
    </div>
  )
}
