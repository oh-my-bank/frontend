import type { ReactNode } from 'react'
import { koreanWon } from '../../lib/format'
import { parseWholeNumber } from '../../lib/learning'
import '../../styles/simulation.css'

/** Labelled text input with a unit, help text and the field's own error message. */
export default function SimField({
  id,
  label,
  value,
  onChange,
  unit,
  help,
  error,
  money = false,
  inputMode = 'numeric',
  maxLength,
  required = true,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  unit?: string
  help?: ReactNode
  error?: string
  money?: boolean
  inputMode?: 'numeric' | 'decimal' | 'text'
  maxLength?: number
  required?: boolean
}) {
  const amount = money ? parseWholeNumber(value) : null
  const described = [
    amount !== null && `${id}-reading`,
    help && `${id}-help`,
    error && `${id}-error`,
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <div className="sim-field">
      <label htmlFor={id}>
        {label}
        {required && (
          <i className="sim-required" aria-hidden="true">
            *
          </i>
        )}
      </label>
      <div className={unit ? 'input-unit' : undefined}>
        <input
          id={id}
          type="text"
          inputMode={inputMode}
          autoComplete="off"
          value={value}
          maxLength={maxLength}
          aria-required={required}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={!!error}
          aria-describedby={described || undefined}
        />
        {unit && <span>{unit}</span>}
      </div>
      {amount !== null && (
        <p className="sim-reading" id={`${id}-reading`}>
          {koreanWon(amount)}
        </p>
      )}
      {help && (
        <p className="sim-help" id={`${id}-help`}>
          {help}
        </p>
      )}
      {error && (
        <p className="sim-error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  )
}
