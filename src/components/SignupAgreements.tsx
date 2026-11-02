import { Link } from 'react-router-dom'
import { legalPath, type LegalDocumentSummary } from '../lib/legal'

/**
 * Required sign-up agreements (L04). Each box names the exact document version the request will
 * carry; full texts open in a new tab so the half-filled form is kept.
 */
export default function SignupAgreements({
  required,
  checked,
  onChange,
  error,
}: {
  required: LegalDocumentSummary[]
  checked: Record<string, boolean>
  onChange: (next: Record<string, boolean>) => void
  error: string
}) {
  const all = required.length > 0 && required.every((doc) => checked[doc.code])
  return (
    <fieldset
      className="signup-agreements"
      aria-invalid={!!error}
      aria-describedby={error ? 'signup-agreements-error' : undefined}
    >
      <legend>약관 동의</legend>
      <label className="checkbox-label signup-agreements-all">
        <input
          type="checkbox"
          checked={all}
          onChange={(event) =>
            onChange(Object.fromEntries(required.map((doc) => [doc.code, event.target.checked])))
          }
        />
        필수 항목에 모두 동의합니다.
      </label>
      {required.map((doc) => (
        <div className="signup-agreement" key={doc.code}>
          <div className="signup-agreement-row">
            <label className="checkbox-label" htmlFor={`agreement-${doc.code}`}>
              <input
                id={`agreement-${doc.code}`}
                type="checkbox"
                checked={!!checked[doc.code]}
                onChange={(event) => onChange({ ...checked, [doc.code]: event.target.checked })}
                aria-describedby={doc.summary.length ? `agreement-${doc.code}-summary` : undefined}
              />
              <span>
                {doc.consentLabel ?? `[필수] ${doc.title}에 동의합니다.`}{' '}
                <small className="form-help">({doc.version})</small>
              </span>
            </label>
            <Link
              to={legalPath(doc.code)}
              target="_blank"
              rel="noopener"
              aria-label={`${doc.title} 전문 보기 (새 창)`}
            >
              전문 보기
            </Link>
          </div>
          {doc.summary.length > 0 && (
            <dl className="signup-agreement-summary" id={`agreement-${doc.code}-summary`}>
              {doc.summary.map((item) => (
                <div key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{item.text}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      ))}
      {error && (
        <p className="bank-application-error" id="signup-agreements-error" role="alert">
          {error}
        </p>
      )}
      <p className="signup-notice-link">
        가입 전에{' '}
        <Link to="/notice" target="_blank" rel="noopener" aria-label="서비스 고지 (새 창)">
          서비스 고지
        </Link>
        를 확인해 주세요. 실제 금융거래·투자 자문·상품 추천이 아닌 교육용 모의 서비스입니다.
      </p>
    </fieldset>
  )
}
