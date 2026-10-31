import { useRef, useState } from 'react'
import { rate, wonText } from '../../lib/format'
import { normalizeRate, parseWholeNumber, taxTypeLabels, type TaxType } from '../../lib/learning'
import {
  amortizingLabels,
  normalizeDelta,
  ratePathText,
  samplePayments,
  signedWon,
  type AmortizingMethod,
  type RateScenarioResult,
  type ScenarioResult,
} from '../../lib/rateScenario'
import {
  CalculationError,
  CalculatorForm,
  ChoiceField,
  NumberField,
  ResultPanel,
  errorFor,
  fieldId,
  formatErrors,
  formatMessages,
  useCalculation,
} from './parts'
import { StackedBars } from './ToolChart'
import '../../styles/rate-scenarios.css'

interface ChangeRow {
  key: number
  fromMonth: string
  deltaPercentPoint: string
}
interface ScenarioRow {
  key: number
  name: string
  changes: ChangeRow[]
}
const MAX_SCENARIOS = 4
const MAX_CHANGES = 10
const deltaMessage = '%p 숫자로 입력해 주세요. 내리면 앞에 -를 붙입니다(예: -0.5).'
/** Dash patterns tell the lines apart without relying on colour; the table below has every value. */
const lineStyles = ['', '10 6', '3 5', '14 4 3 4', '2 3']

function PaymentLines({ result }: { result: RateScenarioResult }) {
  const width = 1000
  const height = 180
  const all = result.scenarios.flatMap((scenario) => scenario.loan.payments)
  const max = Math.max(...all)
  const min = Math.min(...all)
  const months = result.loan.termMonths
  const span = max - min || 1
  const x = (installment: number) => (months > 1 ? ((installment - 1) / (months - 1)) * width : 0)
  const y = (value: number) => height - 8 - ((value - min) / span) * (height - 16)
  return (
    <figure className="tool-chart rate-lines">
      <figcaption>시나리오별 월 납입액 추이</figcaption>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`1회차부터 ${months}회차까지 시나리오별 월 납입액. 가장 작은 납입액 ${wonText(min)}, 가장 큰 납입액 ${wonText(max)}. 시나리오별 금액은 아래 비교 표에 있습니다.`}
      >
        <rect width={width} height={height} fill="#f2f6f4" />
        {result.scenarios.map((scenario, index) => (
          <polyline
            key={index}
            fill="none"
            stroke={index === 0 ? '#1f5149' : '#008577'}
            strokeWidth={index === 0 ? 3 : 2.5}
            strokeDasharray={lineStyles[index % lineStyles.length] || undefined}
            vectorEffect="non-scaling-stroke"
            points={samplePayments(
              scenario.loan.payments,
              scenario.loan.rates.map((segment) => segment.fromInstallment),
            )
              .map(([installment, value]) => `${x(installment)},${y(value)}`)
              .join(' ')}
          />
        ))}
      </svg>
      <div className="tool-schedule-axis" aria-hidden="true">
        <span>1회</span>
        <span>{months}회</span>
      </div>
      <ul className="tool-chart-legend">
        {result.scenarios.map((scenario, index) => (
          <li key={index}>
            <svg className="rate-line-swatch" viewBox="0 0 32 8" aria-hidden="true">
              <line
                x1="0"
                x2="32"
                y1="4"
                y2="4"
                stroke={index === 0 ? '#1f5149' : '#008577'}
                strokeWidth="3"
                strokeDasharray={lineStyles[index % lineStyles.length] || undefined}
              />
            </svg>
            {scenario.name}
          </li>
        ))}
      </ul>
    </figure>
  )
}

function changeText(scenario: ScenarioResult) {
  if (scenario.baseline) return '변동 없음'
  return scenario.changes
    .map((change) => `${change.fromMonth}개월째부터 ${change.deltaPercentPoint}%p`)
    .join(', ')
}

export default function RateScenarioTool() {
  const { pending, error, result, fieldErrors, run } = useCalculation('rate-scenario')
  const nextKey = useRef(10)
  const [loan, setLoan] = useState({
    principal: '300,000,000',
    termMonths: '360',
    annualRate: '4.0',
    method: 'EQUAL_PAYMENT' as AmortizingMethod,
  })
  const [withDeposit, setWithDeposit] = useState(true)
  const [deposit, setDeposit] = useState({
    principal: '50,000,000',
    termMonths: '24',
    annualRate: '3.0',
    taxType: 'GENERAL' as TaxType,
  })
  const [scenarios, setScenarios] = useState<ScenarioRow[]>([
    {
      key: 0,
      name: '금리 상승',
      changes: [{ key: 1, fromMonth: '13', deltaPercentPoint: '+1.0' }],
    },
    {
      key: 2,
      name: '금리 하락',
      changes: [{ key: 3, fromMonth: '13', deltaPercentPoint: '-1.0' }],
    },
  ])
  const [local, setLocal] = useState<Record<string, string>>({})
  const fieldError = (path: string) => errorFor(path, local, fieldErrors)
  const fields = [
    'loan',
    'deposit',
    'scenarios',
    ...['principal', 'termMonths', 'annualRate', 'method'].map((field) => `loan.${field}`),
    ...['principal', 'termMonths', 'annualRate', 'taxType'].map((field) => `deposit.${field}`),
    ...scenarios.flatMap((scenario, i) => [
      `scenarios[${i}].name`,
      `scenarios[${i}].changes`,
      ...scenario.changes.flatMap((_, j) => [
        `scenarios[${i}].changes[${j}].fromMonth`,
        `scenarios[${i}].changes[${j}].deltaPercentPoint`,
      ]),
    ]),
  ]
  function updateScenario(key: number, change: (row: ScenarioRow) => ScenarioRow) {
    setScenarios((rows) => rows.map((row) => (row.key === key ? change(row) : row)))
  }
  function addScenario() {
    const key = nextKey.current++
    const changeKey = nextKey.current++
    setScenarios((rows) => [
      ...rows,
      { key, name: '', changes: [{ key: changeKey, fromMonth: '', deltaPercentPoint: '' }] },
    ])
    const id = fieldId(`scenarios[${scenarios.length}].name`)
    requestAnimationFrame(() => document.getElementById(id)?.focus())
  }
  function removeScenario(key: number) {
    setScenarios((rows) => rows.filter((row) => row.key !== key))
    setLocal({})
  }
  function addChange(scenarioKey: number, index: number, count: number) {
    const key = nextKey.current++
    updateScenario(scenarioKey, (row) => ({
      ...row,
      changes: [...row.changes, { key, fromMonth: '', deltaPercentPoint: '' }],
    }))
    const id = fieldId(`scenarios[${index}].changes[${count}].fromMonth`)
    requestAnimationFrame(() => document.getElementById(id)?.focus())
  }
  function removeChange(scenarioKey: number, changeKey: number) {
    updateScenario(scenarioKey, (row) => ({
      ...row,
      changes: row.changes.filter((change) => change.key !== changeKey),
    }))
    setLocal({})
  }
  function submit() {
    const loanPrincipal = parseWholeNumber(loan.principal)
    const loanMonths = parseWholeNumber(loan.termMonths)
    const loanRate = normalizeRate(loan.annualRate)
    const depositPrincipal = parseWholeNumber(deposit.principal)
    const depositMonths = parseWholeNumber(deposit.termMonths)
    const depositRate = normalizeRate(deposit.annualRate)
    const parsed = scenarios.map((scenario) => ({
      name: scenario.name.trim(),
      changes: scenario.changes.map((change) => ({
        fromMonth: parseWholeNumber(change.fromMonth),
        deltaPercentPoint: normalizeDelta(change.deltaPercentPoint),
      })),
    }))
    const errors = formatErrors([
      ['loan.principal', loanPrincipal !== null, formatMessages.amount],
      ['loan.termMonths', loanMonths !== null, formatMessages.months],
      ['loan.annualRate', loanRate !== null, formatMessages.rate],
      ...(withDeposit
        ? ([
            ['deposit.principal', depositPrincipal !== null, formatMessages.amount],
            ['deposit.termMonths', depositMonths !== null, formatMessages.months],
            ['deposit.annualRate', depositRate !== null, formatMessages.rate],
          ] as [string, boolean, string][])
        : []),
      ...parsed.flatMap((scenario, i): [string, boolean, string][] => [
        [`scenarios[${i}].name`, scenario.name !== '', '시나리오 이름을 입력해 주세요.'],
        ...scenario.changes.flatMap((change, j): [string, boolean, string][] => [
          [
            `scenarios[${i}].changes[${j}].fromMonth`,
            change.fromMonth !== null,
            formatMessages.months,
          ],
          [
            `scenarios[${i}].changes[${j}].deltaPercentPoint`,
            change.deltaPercentPoint !== null,
            deltaMessage,
          ],
        ]),
      ]),
    ])
    setLocal(errors)
    if (Object.keys(errors).length) return
    void run({
      loan: {
        principal: loanPrincipal!,
        termMonths: loanMonths!,
        annualRate: loanRate!,
        method: loan.method,
      },
      deposit: withDeposit
        ? {
            principal: depositPrincipal!,
            termMonths: depositMonths!,
            annualRate: depositRate!,
            taxType: deposit.taxType,
          }
        : null,
      scenarios: parsed.map((scenario) => ({
        name: scenario.name,
        changes: scenario.changes.map((change) => ({
          fromMonth: change.fromMonth!,
          deltaPercentPoint: change.deltaPercentPoint!,
        })),
      })),
    })
  }
  const maxInterest = result
    ? Math.max(...result.scenarios.map((scenario) => scenario.loan.totalInterest))
    : 0
  const maxDeposit = result
    ? Math.max(...result.scenarios.map((scenario) => scenario.deposit?.interestAfterTax ?? 0))
    : 0
  return (
    <div className="tool-layout">
      <CalculatorForm title="조건과 금리 시나리오" pending={pending} onSubmit={submit}>
        <fieldset className="tool-group">
          <legend>변동금리 대출</legend>
          <NumberField
            path="loan.principal"
            label="대출 원금"
            unit="원"
            value={loan.principal}
            onChange={(principal) => setLoan((value) => ({ ...value, principal }))}
            help="1원 ~ 100억원"
            error={fieldError('loan.principal')}
            reading
          />
          <div className="tool-field-pair">
            <NumberField
              path="loan.termMonths"
              label="기간"
              unit="개월"
              value={loan.termMonths}
              onChange={(termMonths) => setLoan((value) => ({ ...value, termMonths }))}
              help="1 ~ 600개월"
              error={fieldError('loan.termMonths')}
            />
            <NumberField
              path="loan.annualRate"
              label="현재 연이율"
              unit="%"
              value={loan.annualRate}
              onChange={(annualRate) => setLoan((value) => ({ ...value, annualRate }))}
              help="연 0 ~ 30%"
              error={fieldError('loan.annualRate')}
            />
          </div>
          <ChoiceField
            name="loan.method"
            legend="상환 방식"
            options={amortizingLabels}
            value={loan.method}
            onChange={(method) => setLoan((value) => ({ ...value, method }))}
            error={fieldError('loan.method')}
          />
        </fieldset>
        <fieldset className="tool-group">
          <legend>예금</legend>
          <label className="checkbox-label tool-check">
            <input
              type="checkbox"
              checked={withDeposit}
              onChange={(event) => setWithDeposit(event.target.checked)}
            />
            <span>예금 이자도 함께 비교합니다.</span>
          </label>
          {withDeposit && (
            <>
              <NumberField
                path="deposit.principal"
                label="예금 원금"
                unit="원"
                value={deposit.principal}
                onChange={(principal) => setDeposit((value) => ({ ...value, principal }))}
                help="1원 ~ 100억원"
                error={fieldError('deposit.principal')}
                reading
              />
              <div className="tool-field-pair">
                <NumberField
                  path="deposit.termMonths"
                  label="기간"
                  unit="개월"
                  value={deposit.termMonths}
                  onChange={(termMonths) => setDeposit((value) => ({ ...value, termMonths }))}
                  help="1 ~ 120개월"
                  error={fieldError('deposit.termMonths')}
                />
                <NumberField
                  path="deposit.annualRate"
                  label="현재 연이율"
                  unit="%"
                  value={deposit.annualRate}
                  onChange={(annualRate) => setDeposit((value) => ({ ...value, annualRate }))}
                  help="연 0 ~ 20%"
                  error={fieldError('deposit.annualRate')}
                />
              </div>
              <ChoiceField
                name="deposit.taxType"
                legend="과세"
                options={taxTypeLabels}
                value={deposit.taxType}
                onChange={(taxType) => setDeposit((value) => ({ ...value, taxType }))}
                error={fieldError('deposit.taxType')}
              />
            </>
          )}
        </fieldset>
        <fieldset className="tool-group" aria-describedby="scenarios-help">
          <legend>
            금리 시나리오 <span className="tool-assumption small">가정 시나리오</span>{' '}
            <span className="tool-optional">
              ({scenarios.length}/{MAX_SCENARIOS}개)
            </span>
          </legend>
          <p className="form-help" id="scenarios-help">
            몇 개월째부터 기준금리가 현재보다 몇 %p 달라지는지 넣습니다. 변동폭은 늘{' '}
            <strong>현재 금리 대비</strong>이고 대출·예금 금리에 같은 폭으로 반영됩니다. &lsquo;현재
            금리 유지&rsquo;는 자동으로 함께 계산합니다.
          </p>
          {fieldErrors.scenarios && (
            <p className="bank-application-error">{fieldErrors.scenarios}</p>
          )}
          {scenarios.map((scenario, i) => (
            <div className="tool-loan-row rate-scenario-row" key={scenario.key}>
              <div className="tool-loan-row-heading">
                <h3>시나리오 {i + 1}</h3>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => removeScenario(scenario.key)}
                  disabled={scenarios.length <= 1}
                  aria-label={`시나리오 ${i + 1} 삭제`}
                >
                  삭제
                </button>
              </div>
              <div className="bank-application-field tool-field">
                <label htmlFor={fieldId(`scenarios[${i}].name`)}>
                  이름 <i aria-hidden="true">*</i>
                </label>
                <input
                  id={fieldId(`scenarios[${i}].name`)}
                  type="text"
                  maxLength={20}
                  value={scenario.name}
                  required
                  onChange={(event) =>
                    updateScenario(scenario.key, (row) => ({ ...row, name: event.target.value }))
                  }
                  aria-invalid={!!fieldError(`scenarios[${i}].name`)}
                  aria-describedby={
                    fieldError(`scenarios[${i}].name`)
                      ? `${fieldId(`scenarios[${i}].name`)}-error`
                      : undefined
                  }
                />
                {fieldError(`scenarios[${i}].name`) && (
                  <p
                    className="bank-application-error"
                    id={`${fieldId(`scenarios[${i}].name`)}-error`}
                  >
                    {fieldError(`scenarios[${i}].name`)}
                  </p>
                )}
              </div>
              {fieldErrors[`scenarios[${i}].changes`] && (
                <p className="bank-application-error">{fieldErrors[`scenarios[${i}].changes`]}</p>
              )}
              {scenario.changes.map((change, j) => (
                <div className="rate-change-line" key={change.key}>
                  <div className="tool-field-pair">
                    <NumberField
                      path={`scenarios[${i}].changes[${j}].fromMonth`}
                      label={`변경 ${j + 1} 시작`}
                      unit="개월째"
                      value={change.fromMonth}
                      onChange={(fromMonth) =>
                        updateScenario(scenario.key, (row) => ({
                          ...row,
                          changes: row.changes.map((item) =>
                            item.key === change.key ? { ...item, fromMonth } : item,
                          ),
                        }))
                      }
                      help="1 ~ 600, 앞 변경보다 뒤"
                      error={fieldError(`scenarios[${i}].changes[${j}].fromMonth`)}
                    />
                    <NumberField
                      path={`scenarios[${i}].changes[${j}].deltaPercentPoint`}
                      label="현재 대비 변동폭"
                      unit="%p"
                      value={change.deltaPercentPoint}
                      onChange={(deltaPercentPoint) =>
                        updateScenario(scenario.key, (row) => ({
                          ...row,
                          changes: row.changes.map((item) =>
                            item.key === change.key ? { ...item, deltaPercentPoint } : item,
                          ),
                        }))
                      }
                      help="-5 ~ +5%p"
                      error={fieldError(`scenarios[${i}].changes[${j}].deltaPercentPoint`)}
                    />
                  </div>
                  {scenario.changes.length > 1 && (
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => removeChange(scenario.key, change.key)}
                      aria-label={`시나리오 ${i + 1}의 변경 ${j + 1} 삭제`}
                    >
                      변경 {j + 1} 삭제
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="button button-outline small"
                onClick={() => addChange(scenario.key, i, scenario.changes.length)}
                disabled={scenario.changes.length >= MAX_CHANGES}
              >
                변경 시점 추가
              </button>
            </div>
          ))}
          <button
            type="button"
            className="button button-outline small"
            onClick={addScenario}
            disabled={scenarios.length >= MAX_SCENARIOS}
          >
            시나리오 추가
          </button>
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
              시나리오 {result.scenarios.length - 1}개 비교
              <span>
                대출 {wonText(result.loan.principal)} · {result.loan.termMonths}개월 · 현재 연{' '}
                {rate(result.loan.annualRate)}%
              </span>
            </p>
            <p className="tool-disclaimer rate-assumption-note">
              <span className="tool-assumption">가정 시나리오</span> 입력한 금리 경로로 계산한
              결과이며 미래 금리 예측이 아닙니다.
            </p>
            <div className="tool-table-wrap">
              <table className="tool-table rate-compare">
                <caption>시나리오별 대출 상환 비교</caption>
                <thead>
                  <tr>
                    <th scope="col">시나리오</th>
                    <th scope="col">금리 경로</th>
                    <th scope="col">첫 회 / 최대 월 납입액</th>
                    <th scope="col">총 이자</th>
                    <th scope="col">유지 대비</th>
                  </tr>
                </thead>
                <tbody>
                  {result.scenarios.map((scenario, index) => (
                    <tr key={index} className={scenario.baseline ? 'emphasis' : undefined}>
                      <th scope="row">
                        {scenario.name}
                        <span className="rate-change-text">{changeText(scenario)}</span>
                      </th>
                      <td>{ratePathText(scenario.loan.rates, rate)}</td>
                      <td>
                        {wonText(scenario.loan.firstPayment)} / {wonText(scenario.loan.maxPayment)}
                      </td>
                      <td>{wonText(scenario.loan.totalInterest)}</td>
                      <td>
                        {scenario.baseline ? '기준' : signedWon(scenario.loan.interestDifference)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaymentLines result={result} />
            <StackedBars
              title="시나리오별 대출 총 이자"
              rows={result.scenarios.map((scenario) => ({
                label: `${scenario.name} ${wonText(scenario.loan.totalInterest)}`,
                max: maxInterest,
                segments: [
                  {
                    label: '대출 총 이자',
                    value: scenario.loan.totalInterest,
                    tone: 'interest' as const,
                  },
                ],
              }))}
            />
            {result.deposit && (
              <>
                <div className="tool-table-wrap">
                  <table className="tool-table rate-compare">
                    <caption>
                      시나리오별 예금 이자 비교(원금 {wonText(result.deposit.principal)} ·{' '}
                      {result.deposit.termMonths}개월 · 현재 연 {rate(result.deposit.annualRate)}% ·{' '}
                      {taxTypeLabels[result.deposit.taxType]})
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">시나리오</th>
                        <th scope="col">평균 연이율</th>
                        <th scope="col">세전 이자</th>
                        <th scope="col">세금</th>
                        <th scope="col">세후 이자</th>
                        <th scope="col">유지 대비</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.scenarios.map((scenario, index) =>
                        scenario.deposit ? (
                          <tr key={index} className={scenario.baseline ? 'emphasis' : undefined}>
                            <th scope="row">{scenario.name}</th>
                            <td>연 {rate(scenario.deposit.averageAnnualRate)}%</td>
                            <td>{wonText(scenario.deposit.interest)}</td>
                            <td>{wonText(scenario.deposit.totalTax)}</td>
                            <td>{wonText(scenario.deposit.interestAfterTax)}</td>
                            <td>
                              {scenario.baseline
                                ? '기준'
                                : signedWon(scenario.deposit.interestAfterTaxDifference)}
                            </td>
                          </tr>
                        ) : null,
                      )}
                    </tbody>
                  </table>
                </div>
                <StackedBars
                  title="시나리오별 예금 세후 이자"
                  rows={result.scenarios.map((scenario) => ({
                    label: `${scenario.name} ${wonText(scenario.deposit?.interestAfterTax ?? 0)}`,
                    max: maxDeposit,
                    segments: [
                      {
                        label: '예금 세후 이자',
                        value: scenario.deposit?.interestAfterTax ?? 0,
                        tone: 'principal' as const,
                      },
                    ],
                  }))}
                  note="금리가 오르면 대출자는 이자를 더 내고 예금자는 이자를 더 받습니다. 같은 변동폭이 양쪽에 어떻게 작용하는지 비교해 보세요."
                />
              </>
            )}
            <p className="tool-notice">{result.notice}</p>
          </>
        )}
      </ResultPanel>
    </div>
  )
}
