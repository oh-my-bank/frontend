import { useRef, useState } from 'react'
import { wonText } from '../../lib/format'
import {
  methodLabels,
  normalizeRate,
  parseWholeNumber,
  type DsrLoanInput,
  type RepaymentMethod,
} from '../../lib/learning'
import {
  CalculationError,
  CalculatorForm,
  NumberField,
  ResultPanel,
  ResultTable,
  errorFor,
  fieldId,
  formatErrors,
  formatMessages,
  useCalculation,
} from './parts'
import { StackedBars } from './ToolChart'

interface LoanRow {
  key: number
  name: string
  principal: string
  termMonths: string
  annualRate: string
  method: RepaymentMethod
}
const MAX_LOANS = 10
const loanFields = ['name', 'principal', 'termMonths', 'annualRate', 'method']

function MethodSelect({
  path,
  value,
  onChange,
  error,
}: {
  path: string
  value: RepaymentMethod
  onChange: (value: RepaymentMethod) => void
  error: string
}) {
  const id = fieldId(path)
  return (
    <div className="bank-application-field tool-field">
      <label htmlFor={id}>
        상환 방식 <i aria-hidden="true">*</i>
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as RepaymentMethod)}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
      >
        {(Object.keys(methodLabels) as RepaymentMethod[]).map((method) => (
          <option key={method} value={method}>
            {methodLabels[method]}
          </option>
        ))}
      </select>
      {error && (
        <p className="bank-application-error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  )
}

export default function DsrTool() {
  const { pending, error, result, fieldErrors, run } = useCalculation('dsr')
  const nextKey = useRef(1)
  const [annualIncome, setAnnualIncome] = useState('50,000,000')
  const [loans, setLoans] = useState<LoanRow[]>([
    {
      key: 0,
      name: '기존 신용대출',
      principal: '20,000,000',
      termMonths: '60',
      annualRate: '6.5',
      method: 'EQUAL_PAYMENT',
    },
  ])
  const [withCandidate, setWithCandidate] = useState(true)
  const [candidate, setCandidate] = useState({
    principal: '30,000,000',
    termMonths: '36',
    annualRate: '5.125',
    method: 'EQUAL_PAYMENT' as RepaymentMethod,
  })
  const [local, setLocal] = useState<Record<string, string>>({})
  const fields = [
    'annualIncome',
    'loans',
    'candidate',
    ...loans.flatMap((_, index) => loanFields.map((field) => `loans[${index}].${field}`)),
    ...loanFields.slice(1).map((field) => `candidate.${field}`),
  ]
  const fieldError = (path: string) => errorFor(path, local, fieldErrors)
  const candidateRepayment = result?.candidate?.annualRepayment ?? null
  function updateLoan(key: number, change: Partial<LoanRow>) {
    setLoans((rows) => rows.map((row) => (row.key === key ? { ...row, ...change } : row)))
  }
  function addLoan() {
    const key = nextKey.current++
    setLoans((rows) => [
      ...rows,
      { key, name: '', principal: '', termMonths: '', annualRate: '', method: 'EQUAL_PAYMENT' },
    ])
    const id = fieldId(`loans[${loans.length}].name`)
    requestAnimationFrame(() => document.getElementById(id)?.focus())
  }
  function removeLoan(key: number) {
    setLoans((rows) => rows.filter((row) => row.key !== key))
    setLocal({})
  }
  function submit() {
    const income = parseWholeNumber(annualIncome)
    const parsedLoans = loans.map((row) => ({
      principal: parseWholeNumber(row.principal),
      termMonths: parseWholeNumber(row.termMonths),
      annualRate: normalizeRate(row.annualRate),
    }))
    const candidatePrincipal =
      candidate.principal.trim() === '' ? null : parseWholeNumber(candidate.principal)
    const candidateMonths = parseWholeNumber(candidate.termMonths)
    const candidateRate = normalizeRate(candidate.annualRate)
    const errors = formatErrors([
      ['annualIncome', income !== null, formatMessages.amount],
      ...parsedLoans.flatMap((row, index): [string, boolean, string][] => [
        [`loans[${index}].principal`, row.principal !== null, formatMessages.amount],
        [`loans[${index}].termMonths`, row.termMonths !== null, formatMessages.months],
        [`loans[${index}].annualRate`, row.annualRate !== null, formatMessages.rate],
      ]),
      ...(withCandidate
        ? ([
            [
              'candidate.principal',
              candidate.principal.trim() === '' || candidatePrincipal !== null,
              formatMessages.amount,
            ],
            ['candidate.termMonths', candidateMonths !== null, formatMessages.months],
            ['candidate.annualRate', candidateRate !== null, formatMessages.rate],
          ] as [string, boolean, string][])
        : []),
    ])
    setLocal(errors)
    if (Object.keys(errors).length || income === null) return
    const body: DsrLoanInput[] = loans.map((row, index) => ({
      name: row.name.trim() || null,
      principal: parsedLoans[index].principal!,
      termMonths: parsedLoans[index].termMonths!,
      annualRate: parsedLoans[index].annualRate!,
      method: row.method,
    }))
    void run({
      annualIncome: income,
      loans: body,
      candidate: withCandidate
        ? {
            principal: candidatePrincipal,
            termMonths: candidateMonths!,
            annualRate: candidateRate!,
            method: candidate.method,
          }
        : null,
    })
  }
  return (
    <div className="tool-layout">
      <CalculatorForm title="소득과 대출" pending={pending} onSubmit={submit}>
        <NumberField
          path="annualIncome"
          label="가상 연소득"
          unit="원"
          value={annualIncome}
          onChange={setAnnualIncome}
          help="1원 ~ 1,000억원. 실제 소득 대신 가상의 금액을 넣어 주세요."
          error={fieldError('annualIncome')}
          reading
        />
        <fieldset className="tool-group" aria-describedby="dsr-loans-help">
          <legend>
            기존 대출{' '}
            <span className="tool-optional">
              ({loans.length}/{MAX_LOANS}건)
            </span>
          </legend>
          <p className="form-help" id="dsr-loans-help">
            지금 갚고 있는 대출을 넣습니다. 없으면 모두 삭제해도 됩니다.
          </p>
          {fieldErrors.loans && <p className="bank-application-error">{fieldErrors.loans}</p>}
          {loans.map((row, index) => (
            <div className="tool-loan-row" key={row.key}>
              <div className="tool-loan-row-heading">
                <h3>기존 대출 {index + 1}</h3>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => removeLoan(row.key)}
                  aria-label={`기존 대출 ${index + 1} 삭제`}
                >
                  삭제
                </button>
              </div>
              <div className="bank-application-field tool-field">
                <label htmlFor={fieldId(`loans[${index}].name`)}>
                  이름 <span className="tool-optional">(선택)</span>
                </label>
                <input
                  id={fieldId(`loans[${index}].name`)}
                  type="text"
                  maxLength={30}
                  value={row.name}
                  onChange={(event) => updateLoan(row.key, { name: event.target.value })}
                  aria-invalid={!!fieldError(`loans[${index}].name`)}
                />
                {fieldError(`loans[${index}].name`) && (
                  <p className="bank-application-error">{fieldError(`loans[${index}].name`)}</p>
                )}
              </div>
              <NumberField
                path={`loans[${index}].principal`}
                label="원금"
                unit="원"
                value={row.principal}
                onChange={(value) => updateLoan(row.key, { principal: value })}
                help="1원 ~ 100억원"
                error={fieldError(`loans[${index}].principal`)}
                reading
              />
              <div className="tool-field-pair">
                <NumberField
                  path={`loans[${index}].termMonths`}
                  label="기간"
                  unit="개월"
                  value={row.termMonths}
                  onChange={(value) => updateLoan(row.key, { termMonths: value })}
                  help="1 ~ 600개월"
                  error={fieldError(`loans[${index}].termMonths`)}
                />
                <NumberField
                  path={`loans[${index}].annualRate`}
                  label="연이율"
                  unit="%"
                  value={row.annualRate}
                  onChange={(value) => updateLoan(row.key, { annualRate: value })}
                  help="연 0 ~ 30%"
                  error={fieldError(`loans[${index}].annualRate`)}
                />
              </div>
              <MethodSelect
                path={`loans[${index}].method`}
                value={row.method}
                onChange={(method) => updateLoan(row.key, { method })}
                error={fieldError(`loans[${index}].method`)}
              />
            </div>
          ))}
          <button
            type="button"
            className="button button-outline small"
            onClick={addLoan}
            disabled={loans.length >= MAX_LOANS}
          >
            기존 대출 추가
          </button>
        </fieldset>
        <fieldset className="tool-group">
          <legend>신규 대출</legend>
          <label className="checkbox-label tool-check">
            <input
              type="checkbox"
              checked={withCandidate}
              onChange={(event) => setWithCandidate(event.target.checked)}
            />
            <span>신규 대출 조건을 넣고 최대 원금을 함께 계산합니다.</span>
          </label>
          {fieldErrors.candidate && (
            <p className="bank-application-error">{fieldErrors.candidate}</p>
          )}
          {withCandidate && (
            <div className="tool-loan-row">
              <NumberField
                path="candidate.principal"
                label="희망 원금"
                unit="원"
                value={candidate.principal}
                onChange={(principal) => setCandidate((value) => ({ ...value, principal }))}
                help="비우면 최대 원금만 계산합니다."
                error={fieldError('candidate.principal')}
                reading
                optional
              />
              <div className="tool-field-pair">
                <NumberField
                  path="candidate.termMonths"
                  label="기간"
                  unit="개월"
                  value={candidate.termMonths}
                  onChange={(termMonths) => setCandidate((value) => ({ ...value, termMonths }))}
                  help="1 ~ 600개월"
                  error={fieldError('candidate.termMonths')}
                />
                <NumberField
                  path="candidate.annualRate"
                  label="연이율"
                  unit="%"
                  value={candidate.annualRate}
                  onChange={(annualRate) => setCandidate((value) => ({ ...value, annualRate }))}
                  help="연 0 ~ 30%"
                  error={fieldError('candidate.annualRate')}
                />
              </div>
              <MethodSelect
                path="candidate.method"
                value={candidate.method}
                onChange={(method) => setCandidate((value) => ({ ...value, method }))}
                error={fieldError('candidate.method')}
              />
            </div>
          )}
        </fieldset>
        <CalculationError error={error} fields={fields} />
      </CalculatorForm>
      <ResultPanel
        pending={pending}
        failed={!!error}
        hasResult={!!result}
        ruleVersion={result?.ruleVersion}
      >
        {result && (
          <>
            <p className="tool-headline">
              DSR <strong>{result.dsrPercent}%</strong>
              <span className={`status-badge ${result.result === 'MET' ? 'approved' : 'rejected'}`}>
                {result.result === 'MET'
                  ? `한도 ${result.thresholdPercent}% 이내`
                  : `한도 ${result.thresholdPercent}% 초과`}
              </span>
            </p>
            <ResultTable
              caption={`가상 연소득 ${wonText(result.annualIncome)} 기준`}
              rows={[
                ['기존 대출 연간 원리금', wonText(result.existingAnnualRepayment)],
                ...(candidateRepayment !== null
                  ? ([['신규 대출 연간 원리금', wonText(candidateRepayment)]] as [string, string][])
                  : []),
                ['연간 원리금 합계', wonText(result.totalAnnualRepayment), true],
                [
                  `연간 원리금 한도(소득의 ${result.thresholdPercent}%)`,
                  wonText(result.limitAnnualRepayment),
                ],
                ['DSR', `${result.dsrPercent}%`, true],
                [
                  '판정',
                  result.result === 'MET'
                    ? `충족 (${result.thresholdPercent}% 이하)`
                    : `미충족 (${result.thresholdPercent}% 초과)`,
                ],
              ]}
            />
            {result.candidate && (
              <div className="tool-explain">
                <h3>신규 대출 최대 원금</h3>
                <p>
                  입력한 신규 대출 조건(기간·금리·상환 방식)으로는 원금{' '}
                  <strong>{wonText(result.candidate.maxPrincipal)}</strong>까지 DSR{' '}
                  {result.thresholdPercent}% 안에 들어갑니다(만 원 단위).
                  {result.candidate.firstPayment != null &&
                    ` 희망 원금 ${wonText(result.candidate.principal ?? 0)}의 첫 회 납입액은 ${wonText(result.candidate.firstPayment)}입니다.`}
                </p>
              </div>
            )}
            {result.loans.length > 0 && (
              <div className="tool-table-wrap">
                <table className="tool-table">
                  <caption>기존 대출별 원리금</caption>
                  <thead>
                    <tr>
                      <th scope="col">대출</th>
                      <th scope="col">첫 회 납입액</th>
                      <th scope="col">연간 원리금</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.loans.map((loan, index) => (
                      <tr key={index}>
                        <th scope="row">{loan.name ?? `기존 대출 ${index + 1}`}</th>
                        <td>{wonText(loan.firstPayment)}</td>
                        <td>{wonText(loan.annualRepayment)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <StackedBars
              title="연간 원리금과 DSR 한도"
              rows={[
                {
                  label: `연간 원리금 합계 ${wonText(result.totalAnnualRepayment)}`,
                  max: Math.max(result.totalAnnualRepayment, result.limitAnnualRepayment),
                  segments: [
                    {
                      label: '기존 대출',
                      value: result.existingAnnualRepayment,
                      tone: 'extra',
                    },
                    ...(candidateRepayment !== null
                      ? [
                          {
                            label: '신규 대출',
                            value: candidateRepayment,
                            tone: 'interest' as const,
                          },
                        ]
                      : []),
                  ],
                  marker: {
                    value: result.limitAnnualRepayment,
                    label: `한도(소득의 ${result.thresholdPercent}%)`,
                  },
                },
              ]}
              note="점선이 연간 원리금 한도입니다. 막대가 점선을 넘으면 한도를 초과합니다."
            />
            <p className="tool-notice">{result.notice}</p>
          </>
        )}
      </ResultPanel>
    </div>
  )
}
