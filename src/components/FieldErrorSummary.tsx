import {
  fieldId,
  fieldLabels,
  fieldOrder,
  orderedErrors,
  type FieldErrors,
} from '../lib/adminProducts'
import '../styles/banking-products.css'
import '../styles/banking-admin.css'

/** Lists every invalid field with a shortcut to its input; the inputs carry the same messages. */
export default function FieldErrorSummary({ errors }: { errors: FieldErrors }) {
  const entries = orderedErrors(errors)
  if (!entries.length) return null
  return (
    <div className="error-notice bank-admin-error-summary" role="alert">
      <strong>입력 내용을 확인해 주세요. ({entries.length}개 항목)</strong>
      <ul>
        {entries.map(([path, message]) => (
          <li key={path}>
            {fieldOrder.includes(path) ? (
              <button type="button" onClick={() => document.getElementById(fieldId(path))?.focus()}>
                {fieldLabels[path] ?? path}
              </button>
            ) : (
              <span>{fieldLabels[path] ?? path}</span>
            )}
            : {message}
          </li>
        ))}
      </ul>
    </div>
  )
}
