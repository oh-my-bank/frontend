import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../../lib/api'
import { koreanWon } from '../../lib/format'
import {
  calculate,
  parseWholeNumber,
  type CalculationInput,
  type CalculationResult,
  type CalculatorKind,
} from '../../lib/learning'
import ErrorNotice from '../../components/ErrorNotice'

/** Input id for an API field path such as `loans[0].annualRate`. */
export const fieldId = (path: string) => `calc-${path.replace(/[^a-zA-Z0-9]+/g, '-')}`

/** Sends one calculation at a time; a newer submit or leaving the page cancels the older one. */
export function useCalculation<K extends CalculatorKind>(kind: K) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [result, setResult] = useState<CalculationResult<K> | null>(null)
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])
  async function run(body: CalculationInput<K>) {
    controller.current?.abort()
    const current = new AbortController()
    controller.current = current
    setPending(true)
    setError(null)
    try {
      setResult(await calculate(kind, body, current.signal))
    } catch (cause) {
      if (current.signal.aborted) return
      setError(cause)
    } finally {
      if (!current.signal.aborted) setPending(false)
    }
  }
  const fieldErrors: Record<string, string> = error instanceof ApiError ? error.fieldErrors : {}
  return { pending, error, result, fieldErrors, run }
}

/** Local format errors win over server messages, which only arrive after a submit. */
export function errorFor(
  path: string,
  local: Record<string, string>,
  server: Record<string, string>,
) {
  return local[path] ?? server[path] ?? ''
}

export const formatMessages = {
  amount: '원 단위 정수로 입력해 주세요. 쉼표는 넣어도 됩니다.',
  months: '개월 수를 정수로 입력해 주세요.',
  rate: '연 % 숫자로 입력해 주세요. 소수 셋째 자리까지 쓸 수 있습니다.',
}

/** Format errors of fields that could not be read; focus moves to the first of them. */
export function formatErrors(checks: [path: string, ok: boolean, message: string][]) {
  const errors: Record<string, string> = Object.fromEntries(
    checks.filter(([, ok]) => !ok).map(([path, , message]) => [path, message]),
  )
  const first = Object.keys(errors)[0]
  if (first) document.getElementById(fieldId(first))?.focus()
  return errors
}

export function NumberField({
  path,
  label,
  unit,
  value,
  onChange,
  help,
  error,
  reading = false,
  optional = false,
}: {
  path: string
  label: string
  unit: string
  value: string
  onChange: (value: string) => void
  help: string
  error: string
  /** Shows the amount in Korean units under the input, e.g. 1,000만원. */
  reading?: boolean
  optional?: boolean
}) {
  const id = fieldId(path)
  const amount = reading ? parseWholeNumber(value) : null
  return (
    <div className="bank-application-field tool-field">
      <label htmlFor={id}>
        {label}{' '}
        {optional ? <span className="tool-optional">(선택)</span> : <i aria-hidden="true">*</i>}
      </label>
      <div className="input-unit">
        <input
          id={id}
          type="text"
          inputMode={unit === '%' ? 'decimal' : 'numeric'}
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={!optional}
          aria-invalid={!!error}
          aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`}
        />
        <span>{unit}</span>
      </div>
      <p className="bank-application-help" id={`${id}-help`}>
        {amount !== null && amount > 0 && (
          <strong className="tool-reading">{koreanWon(amount)} · </strong>
        )}
        {help}
      </p>
      {error && (
        <p className="bank-application-error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  )
}

export function ChoiceField<T extends string>({
  name,
  legend,
  options,
  value,
  onChange,
  error = '',
}: {
  name: string
  legend: string
  options: Record<T, string>
  value: T
  onChange: (value: T) => void
  error?: string
}) {
  const id = fieldId(name)
  return (
    <fieldset className="tool-choice" aria-describedby={error ? `${id}-error` : undefined}>
      <legend>{legend}</legend>
      <div>
        {(Object.keys(options) as T[]).map((option) => (
          <label key={option}>
            <input
              type="radio"
              name={id}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
            />
            <span>{options[option]}</span>
          </label>
        ))}
      </div>
      {error && (
        <p className="bank-application-error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </fieldset>
  )
}

/**
 * Failure notice for a calculation. Field messages that have no matching input on the form
 * are listed here so none of the server's reasons is lost.
 */
export function CalculationError({ error, fields }: { error: unknown; fields: string[] }) {
  if (!error) return null
  const unmatched =
    error instanceof ApiError
      ? Object.entries(error.fieldErrors).filter(([path]) => !fields.includes(path))
      : []
  const message =
    error instanceof ApiError && error.code === 'VALIDATION_ERROR'
      ? '입력 범위를 벗어난 항목이 있습니다. 표시된 입력란을 확인해 주세요.'
      : undefined
  return (
    <>
      <ErrorNotice error={error} message={message} />
      {unmatched.length > 0 && (
        <ul className="tool-unmatched-errors">
          {unmatched.map(([path, text]) => (
            <li key={path}>
              <code>{path}</code>: {text}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

export function CalculatorForm({
  title,
  pending,
  onSubmit,
  children,
}: {
  title: string
  pending: boolean
  onSubmit: () => void
  children: ReactNode
}) {
  return (
    <form
      className="tool-form"
      noValidate
      aria-labelledby="tool-form-title"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <h2 id="tool-form-title">{title}</h2>
      {children}
      <button className="button button-primary full" type="submit" disabled={pending}>
        {pending ? '계산 중…' : '계산하기'}
      </button>
    </form>
  )
}

/** Result area with its loading, failure and empty states kept apart. */
export function ResultPanel({
  pending,
  failed,
  hasResult,
  ruleVersion,
  children,
}: {
  pending: boolean
  failed: boolean
  hasResult: boolean
  ruleVersion?: string
  children: ReactNode
}) {
  return (
    <section className="tool-result" aria-labelledby="tool-result-title" aria-busy={pending}>
      <div className="tool-result-heading">
        <h2 id="tool-result-title">계산 결과</h2>
        {ruleVersion && <span className="tool-rule-tag">규칙 {ruleVersion}</span>}
      </div>
      {pending && (
        <p className="tool-result-status" role="status">
          서버에서 계산하고 있습니다.
        </p>
      )}
      {hasResult ? (
        <div className={pending ? 'tool-result-stale' : undefined}>{children}</div>
      ) : (
        !pending &&
        (failed ? (
          <div className="empty-state">
            계산하지 못했습니다. 입력란 아래의 안내를 확인하고 다시 계산해 주세요.
          </div>
        ) : (
          <div className="empty-state">
            조건을 입력하고 <strong>계산하기</strong>를 누르면 서버가 계산한 결과가 여기에
            표시됩니다.
          </div>
        ))
      )}
    </section>
  )
}

/** Two-column statement table of server values. */
export function ResultTable({
  caption,
  rows,
}: {
  caption: string
  rows: [label: ReactNode, value: ReactNode, emphasis?: boolean][]
}) {
  return (
    <table className="tool-table tool-statement">
      <caption>{caption}</caption>
      <tbody>
        {rows.map(([label, value, emphasis], index) => (
          <tr key={index} className={emphasis ? 'emphasis' : undefined}>
            <th scope="row">{label}</th>
            <td>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function ConceptLinks({ concepts }: { concepts: { slug: string; label: string }[] }) {
  return (
    <aside className="tool-concepts" aria-labelledby="tool-concepts-title">
      <h2 id="tool-concepts-title">함께 읽을 개념</h2>
      <ul>
        {concepts.map((concept) => (
          <li key={concept.slug}>
            <Link to={`/learn/${concept.slug}`}>{concept.label}</Link>
          </li>
        ))}
      </ul>
    </aside>
  )
}
