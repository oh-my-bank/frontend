import { ApiError, errorMessage } from '../lib/api'
import '../styles/banking-products.css'

export default function ErrorNotice({ error, message }: { error: unknown; message?: string }) {
  if (!error) return null
  return (
    <div className="error-notice" role="alert">
      <strong>확인이 필요합니다.</strong>
      <p>{message ?? errorMessage(error)}</p>
      {error instanceof ApiError && error.traceId && (
        <details className="error-notice-details">
          <summary>오류 상세 정보</summary>
          <p>문의 시 아래 요청 식별자를 알려 주세요.</p>
          <code>{error.traceId}</code>
        </details>
      )}
    </div>
  )
}
