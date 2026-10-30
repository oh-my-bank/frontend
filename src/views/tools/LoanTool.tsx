import { Fragment, useState } from 'react'
import { rate, wonText } from '../../lib/format'
import {
  methodLabels,
  normalizeRate,
  parseWholeNumber,
  visibleScheduleIndexes,
  type RepaymentMethod,
} from '../../lib/learning'
import {
  CalculationError,
  CalculatorForm,
  ChoiceField,
  NumberField,
  ResultPanel,
  ResultTable,
  errorFor,
  formatErrors,
  formatMessages,
  useCalculation,
} from './parts'
import { ScheduleChart } from './ToolChart'

const fields = ['principal', 'termMonths', 'annualRate', 'method']
const methodNotes: Record<RepaymentMethod, string> = {
  EQUAL_PAYMENT: '매달 같은 금액을 내고, 그 안에서 원금 비중이 점점 커집니다.',
  EQUAL_PRINCIPAL: '매달 같은 원금을 갚아 납입액이 처음에 크고 점점 줄어듭니다.',
  BULLET: '매달 이자만 내다가 마지막 회차에 원금 전부를 갚습니다.',
}

export default function LoanTool() {
  const { pending, error, result, fieldErrors, run } = useCalculation('loan')
  const [principal, setPrincipal] = useState('10,000,000')
  const [termMonths, setTermMonths] = useState('12')
  const [annualRate, setAnnualRate] = useState('12.0')
  const [method, setMethod] = useState<RepaymentMethod>('EQUAL_PAYMENT')
  const [local, setLocal] = useState<Record<string, string>>({})
  const [expanded, setExpanded] = useState(false)
  function submit() {
    const amount = parseWholeNumber(principal)
    const months = parseWholeNumber(termMonths)
    const percent = normalizeRate(annualRate)
    const errors = formatErrors([
      ['principal', amount !== null, formatMessages.amount],
      ['termMonths', months !== null, formatMessages.months],
      ['annualRate', percent !== null, formatMessages.rate],
    ])
    setLocal(errors)
    if (amount === null || months === null || percent === null) return
    setExpanded(false)
    void run({ principal: amount, termMonths: months, annualRate: percent, method })
  }
  const visible = result ? visibleScheduleIndexes(result.schedule.length, expanded) : []
  const hidden = result ? result.schedule.length - visible.length : 0
  return (
    <div className="tool-layout">
      <CalculatorForm title="대출 조건" pending={pending} onSubmit={submit}>
        <NumberField
          path="principal"
          label="대출 원금"
          unit="원"
          value={principal}
          onChange={setPrincipal}
          help="1원 ~ 100억원"
          error={errorFor('principal', local, fieldErrors)}
          reading
        />
        <NumberField
          path="termMonths"
          label="대출 기간"
          unit="개월"
          value={termMonths}
          onChange={setTermMonths}
          help="1 ~ 600개월, 매달 1회 상환"
          error={errorFor('termMonths', local, fieldErrors)}
        />
        <NumberField
          path="annualRate"
          label="연이율"
          unit="%"
          value={annualRate}
          onChange={setAnnualRate}
          help="연 0 ~ 30%, 소수 셋째 자리까지"
          error={errorFor('annualRate', local, fieldErrors)}
        />
        <ChoiceField
          name="method"
          legend="상환 방식"
          options={methodLabels}
          value={method}
          onChange={setMethod}
          error={fieldErrors.method}
        />
        <p className="form-help">{methodNotes[method]}</p>
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
              <span>
                첫 회 {wonText(result.firstPayment)} · 최대 {wonText(result.maxPayment)}
              </span>
            </p>
            <ResultTable
              caption={`원금 ${wonText(result.principal)} · ${result.termMonths}개월 · 연 ${rate(result.annualRate)}% · ${methodLabels[result.method]}`}
              rows={[
                ['첫 회 납입액', wonText(result.firstPayment)],
                ['가장 큰 납입액', wonText(result.maxPayment)],
                ['총 상환액', wonText(result.totalPayment), true],
                ['총 이자', wonText(result.totalInterest), true],
              ]}
            />
            <ScheduleChart schedule={result.schedule} maxPayment={result.maxPayment} />
            <div className="tool-table-wrap">
              <table className="tool-table tool-schedule" id="loan-schedule">
                <caption>
                  상환 일정 ({result.schedule.length}회
                  {hidden > 0 ? `, 처음 12회와 마지막 회 표시` : ''})
                </caption>
                <thead>
                  <tr>
                    <th scope="col">회차</th>
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
                            <td colSpan={5}>{hidden}개 회차 생략</td>
                          </tr>
                        )}
                        <tr>
                          <th scope="row">{row.installment}회</th>
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
                aria-controls="loan-schedule"
                onClick={() => setExpanded((value) => !value)}
              >
                {expanded
                  ? '처음 12회와 마지막 회만 보기'
                  : `전체 ${result.schedule.length}회 보기`}
              </button>
            )}
          </>
        )}
      </ResultPanel>
    </div>
  )
}
