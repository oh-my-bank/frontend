import {
  changedFields,
  fieldId,
  policyRows,
  wholeNumber,
  type FieldErrors,
  type PolicyField,
  type PolicyForm,
} from '../lib/adminProducts'
import { koreanWon } from '../lib/format'
import type { PolicyTerms } from '../types'
import '../styles/banking-products.css'
import '../styles/banking-admin.css'

const inputs: Record<
  PolicyField,
  { label: string; unit?: string; help: string; inputMode: 'decimal' | 'numeric' | 'text' }
> = {
  annualInterestRate: {
    label: '연이율',
    unit: '%',
    help: '0~100, 소수점 셋째 자리까지 (예: 4.9 또는 5.125)',
    inputMode: 'decimal',
  },
  minAmount: {
    label: '최소 금액',
    unit: '원',
    help: '1원 ~ 100억원, 원 단위 정수',
    inputMode: 'numeric',
  },
  maxAmount: {
    label: '최대 금액',
    unit: '원',
    help: '최소 금액 이상 100억원 이하',
    inputMode: 'numeric',
  },
  minTermMonths: { label: '최소 기간', unit: '개월', help: '1~600개월', inputMode: 'numeric' },
  maxTermMonths: {
    label: '최대 기간',
    unit: '개월',
    help: '최소 기간 이상 600개월 이하',
    inputMode: 'numeric',
  },
  explanationVersion: {
    label: '설명서 버전',
    help: '영문·숫자·._- 40자 이내 (예: youth-v1)',
    inputMode: 'text',
  },
}

/** Policy term inputs shared by product registration and policy publication. */
export default function PolicyFields({
  value,
  errors,
  onChange,
  base,
}: {
  value: PolicyForm
  errors: FieldErrors
  onChange: (field: PolicyField, value: string) => void
  /** The policy being replaced; each input then shows its current value and whether it changed. */
  base?: PolicyTerms
}) {
  const changed = base ? changedFields(value, base) : []
  function field(name: PolicyField) {
    const path = `policy.${name}`
    const id = fieldId(path)
    const input = inputs[name]
    const error = errors[path]
    const amount = input.unit === '원' ? wholeNumber(value[name]) : null
    const current = base && policyRows.find((row) => row.key === name)?.format(base)
    return (
      <div className={`bank-application-field${input.unit ? '' : ' bank-admin-text-field'}`}>
        <label htmlFor={id}>
          {input.label} <i aria-hidden="true">*</i>
          {changed.includes(name) && <span className="bank-admin-changed">변경</span>}
        </label>
        <div className="input-unit">
          <input
            id={id}
            value={value[name]}
            onChange={(event) => onChange(name, event.target.value)}
            inputMode={input.inputMode}
            autoComplete="off"
            spellCheck={false}
            required
            aria-invalid={!!error}
            aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`}
          />
          {input.unit && <span>{input.unit}</span>}
        </div>
        <p className="bank-application-help" id={`${id}-help`}>
          {input.help}
          {amount !== null && amount > 0 && <> · 입력값 {koreanWon(amount)}</>}
          {current && <> · 현재 {current}</>}
        </p>
        {error && (
          <p className="bank-application-error" id={`${id}-error`}>
            {error}
          </p>
        )}
      </div>
    )
  }
  return (
    <div className="bank-admin-policy-fields">
      {field('annualInterestRate')}
      <fieldset className="bank-admin-range">
        <legend>신청 가능 금액</legend>
        <div>
          {field('minAmount')}
          {field('maxAmount')}
        </div>
      </fieldset>
      <fieldset className="bank-admin-range">
        <legend>대출 기간</legend>
        <div>
          {field('minTermMonths')}
          {field('maxTermMonths')}
        </div>
      </fieldset>
      <div className="bank-application-field">
        <span className="bank-admin-fixed-label">상환 방식</span>
        <p className="bank-admin-fixed-value">원리금균등분할상환</p>
        <p className="bank-application-help">현재 지원하는 상환 방식은 한 가지입니다.</p>
        {errors['policy.repaymentMethod'] && (
          <p className="bank-application-error">{errors['policy.repaymentMethod']}</p>
        )}
      </div>
      {field('explanationVersion')}
    </div>
  )
}
