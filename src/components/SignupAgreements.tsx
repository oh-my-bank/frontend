import { Link } from 'react-router-dom'
import { ageCheckboxId, legalPath, type LegalDocumentSummary } from '../lib/legal'

const errorId = 'signup-agreements-error'

/**
 * Required sign-up confirmations (L04): 14 or older, then each required document. Each document
 * box names the exact version the request will carry; full texts open in a new tab so the
 * half-filled form is kept. After a refused submit only the boxes still empty are marked invalid.
 */
export default function SignupAgreements({
  required,
  checked,
  onChange,
  ageConfirmed,
  onAgeChange,
  error,
}: {
  required: LegalDocumentSummary[]
  checked: Record<string, boolean>
  onChange: (next: Record<string, boolean>) => void
  ageConfirmed: boolean
  onAgeChange: (value: boolean) => void
  error: string
}) {
  const all = ageConfirmed && required.length > 0 && required.every((doc) => checked[doc.code])
  const invalid = (isChecked: boolean) =>
    error && !isChecked ? { 'aria-invalid': true, 'aria-describedby': errorId } : {}
  return (
    <fieldset className="signup-agreements">
      <legend>가입 확인과 약관 동의</legend>
      <label className="checkbox-label signup-agreements-all">
        <input
          type="checkbox"
          checked={all}
          onChange={(event) => {
            onAgeChange(event.target.checked)
            onChange(Object.fromEntries(required.map((doc) => [doc.code, event.target.checked])))
          }}
        />
        필수 항목에 모두 동의합니다.
      </label>
      <div className="signup-agreement">
        <label className="checkbox-label" htmlFor={ageCheckboxId}>
          <input
            id={ageCheckboxId}
            type="checkbox"
            checked={ageConfirmed}
            onChange={(event) => onAgeChange(event.target.checked)}
            {...invalid(ageConfirmed)}
          />
          <span>[필수] 만 14세 이상입니다.</span>
        </label>
      </div>
      {required.map((doc) => (
        <div className="signup-agreement" key={doc.code}>
          <div className="signup-agreement-row">
            <label className="checkbox-label" htmlFor={`agreement-${doc.code}`}>
              <input
                id={`agreement-${doc.code}`}
                type="checkbox"
                checked={!!checked[doc.code]}
                onChange={(event) => onChange({ ...checked, [doc.code]: event.target.checked })}
                {...(error && !checked[doc.code]
                  ? invalid(false)
                  : doc.summary.length
                    ? { 'aria-describedby': `agreement-${doc.code}-summary` }
                    : {})}
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
        <p className="bank-application-error" id={errorId} role="alert">
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
