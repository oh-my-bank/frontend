import { Fragment, useRef, useState } from 'react'
import { rate, wonText } from '../../lib/format'
import { normalizeRate, parseWholeNumber, visibleScheduleIndexes } from '../../lib/learning'
import {
  amortizingLabels,
  phaseLabels,
  signedWon,
  type AmortizingMethod,
} from '../../lib/rateScenario'
import {
  CalculationError,
  CalculatorForm,
  ChoiceField,
  NumberField,
  ResultPanel,
  ResultTable,
  errorFor,
  fieldId,
  formatErrors,
  formatMessages,
  useCalculation,
} from './parts'
import { ScheduleChart } from './ToolChart'
import '../../styles/rate-scenarios.css'

interface ChangeRow {
  key: number
  fromInstallment: string
  annualRate: string
}
const MAX_CHANGES = 10
const methodNotes: Record<AmortizingMethod, string> = {
  EQUAL_PAYMENT:
    '거치가 끝난 첫 회차와 금리가 바뀌는 회차마다 남은 원금·남은 회차로 월 상환액을 다시 계산합니다.',
  EQUAL_PRINCIPAL:
    '상환 기간 동안 같은 원금을 갚습니다. 금리가 바뀌면 이자만 달라지고 원금은 그대로입니다.',
}

export default function VariableLoanTool() {
  const { pending, error, result, fieldErrors, run } = useCalculation('variable-loan')
  const nextKey = useRef(2)
  const [principal, setPrincipal] = useState('50,000,000')
  const [termMonths, setTermMonths] = useState('60')
  const [graceMonths, setGraceMonths] = useState('12')
  const [annualRate, setAnnualRate] = useState('4.5')
  const [method, setMethod] = useState<AmortizingMethod>('EQUAL_PAYMENT')
  const [changes, setChanges] = useState<ChangeRow[]>([
    { key: 0, fromInstallment: '7', annualRate: '5.0' },
    { key: 1, fromInstallment: '25', annualRate: '3.5' },
  ])
  const [local, setLocal] = useState<Record<string, string>>({})
  const [expanded, setExpanded] = useState(false)
  const fields = [
    'principal',
    'termMonths',
    'graceMonths',
    'annualRate',
    'method',
    'rateChanges',
    ...changes.flatMap((_, index) => [
      `rateChanges[${index}].fromInstallment`,
      `rateChanges[${index}].annualRate`,
    ]),
  ]
  const fieldError = (path: string) => errorFor(path, local, fieldErrors)
  function updateChange(key: number, change: Partial<ChangeRow>) {
    setChanges((rows) => rows.map((row) => (row.key === key ? { ...row, ...change } : row)))
  }
  function addChange() {
    const key = nextKey.current++
    setChanges((rows) => [...rows, { key, fromInstallment: '', annualRate: '' }])
    const id = fieldId(`rateChanges[${changes.length}].fromInstallment`)
    requestAnimationFrame(() => document.getElementById(id)?.focus())
  }
  function removeChange(key: number) {
    setChanges((rows) => rows.filter((row) => row.key !== key))
    setLocal({})
  }
  function submit() {
    const amount = parseWholeNumber(principal)
    const months = parseWholeNumber(termMonths)
    const grace = graceMonths.trim() === '' ? 0 : parseWholeNumber(graceMonths)
    const percent = normalizeRate(annualRate)
    const parsed = changes.map((row) => ({
      fromInstallment: parseWholeNumber(row.fromInstallment),
      annualRate: normalizeRate(row.annualRate),
    }))
    const errors = formatErrors([
      ['principal', amount !== null, formatMessages.amount],
      ['termMonths', months !== null, formatMessages.months],
      ['graceMonths', grace !== null, formatMessages.months],
      ['annualRate', percent !== null, formatMessages.rate],
      ...parsed.flatMap((row, index): [string, boolean, string][] => [
        [
          `rateChanges[${index}].fromInstallment`,
          row.fromInstallment !== null,
          '회차를 정수로 입력해 주세요.',
        ],
        [`rateChanges[${index}].annualRate`, row.annualRate !== null, formatMessages.rate],
      ]),
    ])
    setLocal(errors)
    if (
      Object.keys(errors).length ||
      amount === null ||
      months === null ||
      grace === null ||
      percent === null
    )
      return
    setExpanded(false)
    void run({
      principal: amount,
      termMonths: months,
      graceMonths: grace,
      annualRate: percent,
      method,
      rateChanges: parsed.map((row) => ({
        fromInstallment: row.fromInstallment!,
        annualRate: row.annualRate!,
      })),
    })
  }
  const visible = result ? visibleScheduleIndexes(result.schedule.length, expanded) : []
  const hidden = result ? result.schedule.length - visible.length : 0
  return (
    <div className="tool-layout">
      <CalculatorForm title="대출 조건과 금리 경로" pending={pending} onSubmit={submit}>
        <NumberField
          path="principal"
          label="대출 원금"
          unit="원"
          value={principal}
          onChange={setPrincipal}
          help="1원 ~ 100억원"
          error={fieldError('principal')}
          reading
        />
        <div className="tool-field-pair">
          <NumberField
            path="termMonths"
            label="전체 기간"
            unit="개월"
            value={termMonths}
            onChange={setTermMonths}
            help="1 ~ 600개월(거치 포함)"
            error={fieldError('termMonths')}
          />
          <NumberField
            path="graceMonths"
            label="거치기간"
            unit="개월"
            value={graceMonths}
            onChange={setGraceMonths}
            help="0 ~ 120개월, 전체 기간보다 짧게"
            error={fieldError('graceMonths')}
            optional
          />
        </div>
        <NumberField
          path="annualRate"
          label="처음 연이율"
          unit="%"
          value={annualRate}
          onChange={setAnnualRate}
          help="연 0 ~ 30%, 소수 셋째 자리까지"
          error={fieldError('annualRate')}
        />
        <ChoiceField
          name="method"
          legend="거치 후 상환 방식"
          options={amortizingLabels}
          value={method}
          onChange={setMethod}
          error={fieldError('method')}
        />
        <p className="form-help">{methodNotes[method]}</p>
        <fieldset className="tool-group" aria-describedby="rate-changes-help">
          <legend>
            금리 변경 <span className="tool-assumption small">가정 시나리오</span>{' '}
            <span className="tool-optional">
              ({changes.length}/{MAX_CHANGES}건)
            </span>
          </legend>
          <p className="form-help" id="rate-changes-help">
            몇 회차부터 금리가 얼마로 바뀌는지 넣습니다. 2회차 이후, 앞 항목보다 뒤 회차여야 합니다.
            고정금리로 계산하려면 모두 삭제합니다.
          </p>
          {fieldErrors.rateChanges && (
            <p className="bank-application-error">{fieldErrors.rateChanges}</p>
          )}
          {changes.map((row, index) => (
            <div className="tool-loan-row rate-change-row" key={row.key}>
              <div className="tool-loan-row-heading">
                <h3>금리 변경 {index + 1}</h3>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => removeChange(row.key)}
                  aria-label={`금리 변경 ${index + 1} 삭제`}
                >
                  삭제
                </button>
              </div>
              <div className="tool-field-pair">
                <NumberField
                  path={`rateChanges[${index}].fromInstallment`}
                  label="적용 시작 회차"
                  unit="회차"
                  value={row.fromInstallment}
                  onChange={(value) => updateChange(row.key, { fromInstallment: value })}
                  help="2회차 ~ 전체 기간"
                  error={fieldError(`rateChanges[${index}].fromInstallment`)}
                />
                <NumberField
                  path={`rateChanges[${index}].annualRate`}
                  label="바뀐 연이율"
                  unit="%"
                  value={row.annualRate}
                  onChange={(value) => updateChange(row.key, { annualRate: value })}
                  help="연 0 ~ 30%"
                  error={fieldError(`rateChanges[${index}].annualRate`)}
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            className="button button-outline small"
            onClick={addChange}
            disabled={changes.length >= MAX_CHANGES}
          >
            금리 변경 추가
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
              총 이자 <strong>{wonText(result.totalInterest)}</strong>
              <span>고정금리·거치 없음 대비 {signedWon(result.interestDifference)}</span>
            </p>
            <ResultTable
              caption={`원금 ${wonText(result.principal)} · ${result.termMonths}개월(거치 ${result.graceMonths}개월) · 처음 연 ${rate(result.annualRate)}% · ${amortizingLabels[result.method]}`}
              rows={[
                ['첫 회 납입액', wonText(result.firstPayment)],
                ...(result.graceMonths > 0
                  ? ([
                      ['거치 기간 이자 합계', wonText(result.graceInterest)],
                      [
                        `원금 상환 첫 회(${result.graceMonths + 1}회차) 납입액`,
                        wonText(result.firstRepaymentPayment),
                      ],
                    ] as [string, string][])
                  : []),
                ['가장 큰 납입액', wonText(result.maxPayment)],
                ['총 상환액', wonText(result.totalPayment), true],
                ['총 이자', wonText(result.totalInterest), true],
                [
                  `비교: 거치 없이 연 ${rate(result.annualRate)}% 고정일 때 총 이자`,
                  wonText(result.fixedRateTotalInterest),
                ],
                ['이자 차이', signedWon(result.interestDifference), true],
              ]}
            />
            <div className="tool-table-wrap">
              <table className="tool-table">
                <caption>구간별 금리와 납입액</caption>
                <thead>
                  <tr>
                    <th scope="col">회차</th>
                    <th scope="col">구간</th>
                    <th scope="col">연이율</th>
                    <th scope="col">구간 첫 회 납입액</th>
                  </tr>
                </thead>
                <tbody>
                  {result.segments.map((segment) => (
                    <tr key={segment.fromInstallment}>
                      <th scope="row">
                        {segment.fromInstallment === segment.toInstallment
                          ? `${segment.fromInstallment}회`
                          : `${segment.fromInstallment}~${segment.toInstallment}회`}
                      </th>
                      <td>{phaseLabels[segment.phase]}</td>
                      <td>연 {rate(segment.annualRate)}%</td>
                      <td>{wonText(segment.payment)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ScheduleChart schedule={result.schedule} maxPayment={result.maxPayment} />
            <div className="tool-table-wrap">
              <table className="tool-table tool-schedule" id="variable-loan-schedule">
                <caption>
                  상환 일정 ({result.schedule.length}회
                  {hidden > 0 ? `, 처음 12회와 마지막 회 표시` : ''})
                </caption>
                <thead>
                  <tr>
                    <th scope="col">회차</th>
                    <th scope="col">연이율</th>
                    <th scope="col">납입액</th>
                    <th scope="col">원금</th>
                    <th scope="col">이자</th>
                    <th scope="col">남은 잔액</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((index, position) => {
                    const row = result.schedule[index]
                    const skipped = position > 0 && index - visible[position - 1] > 1
                    return (
                      <Fragment key={row.installment}>
                        {skipped && (
                          <tr className="tool-schedule-gap">
                            <td colSpan={6}>{hidden}개 회차 생략</td>
                          </tr>
                        )}
                        <tr className={row.phase === 'GRACE' ? 'rate-grace-row' : undefined}>
                          <th scope="row">
                            {row.installment}회
                            {row.phase === 'GRACE' && <span className="rate-phase-tag">거치</span>}
                          </th>
                          <td>{rate(row.annualRate)}%</td>
                          <td>{wonText(row.payment)}</td>
                          <td>{wonText(row.principal)}</td>
                          <td>{wonText(row.interest)}</td>
                          <td>{wonText(row.balance)}</td>
                        </tr>
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {result.schedule.length > 13 && (
              <button
                type="button"
                className="button button-outline small"
                aria-expanded={expanded}
                aria-controls="variable-loan-schedule"
                onClick={() => setExpanded((value) => !value)}
              >
                {expanded
                  ? '처음 12회와 마지막 회만 보기'
                  : `전체 ${result.schedule.length}회 보기`}
              </button>
            )}
            <p className="tool-notice">{result.notice}</p>
          </>
        )}
      </ResultPanel>
    </div>
  )
}
