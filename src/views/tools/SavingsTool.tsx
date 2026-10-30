import { useState } from 'react'
import { rate, wonText } from '../../lib/format'
import {
  interestTypeLabels,
  normalizeRate,
  parseWholeNumber,
  taxTypeLabels,
  type InterestType,
  type TaxType,
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
import { StackedBars } from './ToolChart'

const fields = ['monthlyDeposit', 'termMonths', 'annualRate', 'interestType', 'taxType']

export default function SavingsTool() {
  const { pending, error, result, fieldErrors, run } = useCalculation('savings')
  const [monthlyDeposit, setMonthlyDeposit] = useState('500,000')
  const [termMonths, setTermMonths] = useState('12')
  const [annualRate, setAnnualRate] = useState('3.5')
  const [interestType, setInterestType] = useState<InterestType>('SIMPLE')
  const [taxType, setTaxType] = useState<TaxType>('GENERAL')
  const [local, setLocal] = useState<Record<string, string>>({})
  function submit() {
    const amount = parseWholeNumber(monthlyDeposit)
    const months = parseWholeNumber(termMonths)
    const percent = normalizeRate(annualRate)
    const errors = formatErrors([
      ['monthlyDeposit', amount !== null, formatMessages.amount],
      ['termMonths', months !== null, formatMessages.months],
      ['annualRate', percent !== null, formatMessages.rate],
    ])
    setLocal(errors)
    if (amount === null || months === null || percent === null) return
    void run({
      monthlyDeposit: amount,
      termMonths: months,
      annualRate: percent,
      interestType,
      taxType,
    })
  }
  return (
    <div className="tool-layout">
      <CalculatorForm title="적금 조건" pending={pending} onSubmit={submit}>
        <NumberField
          path="monthlyDeposit"
          label="월 납입액"
          unit="원"
          value={monthlyDeposit}
          onChange={setMonthlyDeposit}
          help="1원 ~ 10억원, 매달 같은 금액(정액 적립식)"
          error={errorFor('monthlyDeposit', local, fieldErrors)}
          reading
        />
        <NumberField
          path="termMonths"
          label="납입 기간"
          unit="개월"
          value={termMonths}
          onChange={setTermMonths}
          help="1 ~ 60개월, 1회차는 가입일에 납입"
          error={errorFor('termMonths', local, fieldErrors)}
        />
        <NumberField
          path="annualRate"
          label="연이율"
          unit="%"
          value={annualRate}
          onChange={setAnnualRate}
          help="연 0 ~ 20%, 소수 셋째 자리까지"
          error={errorFor('annualRate', local, fieldErrors)}
        />
        <ChoiceField
          name="interestType"
          legend="이자 방식"
          options={interestTypeLabels}
          value={interestType}
          onChange={setInterestType}
          error={fieldErrors.interestType}
        />
        <ChoiceField
          name="taxType"
          legend="과세 구분"
          options={taxTypeLabels}
          value={taxType}
          onChange={setTaxType}
          error={fieldErrors.taxType}
        />
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
              만기에 <strong>{wonText(result.maturityAmount)}</strong>을 받습니다.
              <span>예금 환산 금리 연 {rate(result.depositEquivalentRate)}%</span>
            </p>
            <ResultTable
              caption={`월 ${wonText(result.monthlyDeposit)} · ${result.termMonths}개월 · 연 ${rate(result.annualRate)}% · ${interestTypeLabels[result.interestType]} · ${taxTypeLabels[result.taxType]}`}
              rows={[
                ['총 납입액', wonText(result.totalDeposit)],
                ['세전 이자', wonText(result.interest)],
                ['이자소득세(14%)', wonText(result.incomeTax)],
                ['지방소득세(소득세의 10%)', wonText(result.localTax)],
                ['세금 합계', wonText(result.totalTax)],
                ['세후 이자', wonText(result.interestAfterTax), true],
                ['만기 수령액', wonText(result.maturityAmount), true],
                ['평균 예치 기간', `${result.averageHoldingMonths}개월`],
                ['예금 환산 금리', `연 ${rate(result.depositEquivalentRate)}%`],
              ]}
            />
            <div className="tool-explain">
              <h3>예금 환산 금리란?</h3>
              <p>
                적금은 1회차 납입금만 {result.termMonths}개월 동안 맡겨지고 마지막 회차는 1개월만
                맡겨집니다. 그래서 납입금의 평균 예치 기간은 {result.averageHoldingMonths}
                개월입니다.
              </p>
              <p>
                같은 총액 {wonText(result.totalDeposit)}을 처음부터 {result.termMonths}개월 동안
                예금에 맡겼다고 보면, 이번 적금 이자는 연 {rate(result.depositEquivalentRate)}% 예금
                이자와 같습니다.
                {result.termMonths > 1 &&
                  ` 연 ${rate(result.annualRate)}% 적금의 이자가 같은 금리 예금보다 적은 이유입니다.`}
              </p>
            </div>
            <StackedBars
              title="납입액과 이자, 이자와 세금의 비중"
              note="각 막대는 그 줄의 합계(만기 수령액, 세전 이자)를 전체 길이로 그렸습니다."
              rows={[
                {
                  label: `만기 수령액 ${wonText(result.maturityAmount)}`,
                  max: result.maturityAmount,
                  segments: [
                    { label: '총 납입액', value: result.totalDeposit, tone: 'principal' },
                    { label: '세후 이자', value: result.interestAfterTax, tone: 'interest' },
                  ],
                },
                {
                  label: `세전 이자 ${wonText(result.interest)}`,
                  max: result.interest,
                  segments: [
                    { label: '세후 이자', value: result.interestAfterTax, tone: 'interest' },
                    { label: '세금', value: result.totalTax, tone: 'tax' },
                  ],
                },
              ]}
            />
          </>
        )}
      </ResultPanel>
    </div>
  )
}
