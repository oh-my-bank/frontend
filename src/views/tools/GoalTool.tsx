import { useState } from 'react'
import { rate, wonText } from '../../lib/format'
import { normalizeRate, parseWholeNumber, taxTypeLabels, type TaxType } from '../../lib/learning'
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

const fields = ['targetAmount', 'termMonths', 'annualRate', 'taxType']

export default function GoalTool() {
  const { pending, error, result, fieldErrors, run } = useCalculation('goal')
  const [targetAmount, setTargetAmount] = useState('10,000,000')
  const [termMonths, setTermMonths] = useState('24')
  const [annualRate, setAnnualRate] = useState('3.3')
  const [taxType, setTaxType] = useState<TaxType>('GENERAL')
  const [local, setLocal] = useState<Record<string, string>>({})
  function submit() {
    const amount = parseWholeNumber(targetAmount)
    const months = parseWholeNumber(termMonths)
    const percent = normalizeRate(annualRate)
    const errors = formatErrors([
      ['targetAmount', amount !== null, formatMessages.amount],
      ['termMonths', months !== null, formatMessages.months],
      ['annualRate', percent !== null, formatMessages.rate],
    ])
    setLocal(errors)
    if (amount === null || months === null || percent === null) return
    void run({ targetAmount: amount, termMonths: months, annualRate: percent, taxType })
  }
  return (
    <div className="tool-layout">
      <CalculatorForm title="목표 조건" pending={pending} onSubmit={submit}>
        <NumberField
          path="targetAmount"
          label="모으고 싶은 금액"
          unit="원"
          value={targetAmount}
          onChange={setTargetAmount}
          help="1만원 ~ 100억원, 세후 만기 수령액 기준"
          error={errorFor('targetAmount', local, fieldErrors)}
          reading
        />
        <NumberField
          path="termMonths"
          label="모을 기간"
          unit="개월"
          value={termMonths}
          onChange={setTermMonths}
          help="1 ~ 60개월"
          error={errorFor('termMonths', local, fieldErrors)}
        />
        <NumberField
          path="annualRate"
          label="적금 연이율"
          unit="%"
          value={annualRate}
          onChange={setAnnualRate}
          help="연 0 ~ 20%, 정액 적립식 단리 적금 기준"
          error={errorFor('annualRate', local, fieldErrors)}
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
              매달 <strong>{wonText(result.monthlyDeposit)}</strong>씩 넣으면 됩니다.
              <span>1,000원 단위로 올려 찾은 가장 작은 월 납입액</span>
            </p>
            <ResultTable
              caption={`목표 ${wonText(result.targetAmount)} · ${result.termMonths}개월 · 연 ${rate(result.annualRate)}% · ${taxTypeLabels[result.taxType]}`}
              rows={[
                ['월 납입액', wonText(result.monthlyDeposit), true],
                ['총 납입액', wonText(result.totalDeposit)],
                ['세후 이자', wonText(result.interestAfterTax)],
                ['만기 수령액', wonText(result.maturityAmount), true],
                ['목표 초과액', wonText(result.surplus)],
              ]}
            />
            <StackedBars
              title="만기 수령액과 목표 금액"
              rows={[
                {
                  label: `만기 수령액 ${wonText(result.maturityAmount)}`,
                  max: result.maturityAmount,
                  segments: [
                    { label: '총 납입액', value: result.totalDeposit, tone: 'principal' },
                    { label: '세후 이자', value: result.interestAfterTax, tone: 'interest' },
                  ],
                  marker: { value: result.targetAmount, label: '목표 금액' },
                },
              ]}
              note="점선이 목표 금액입니다. 월 납입액을 1,000원 줄이면 만기 수령액이 목표에 못 미칩니다."
            />
          </>
        )}
      </ResultPanel>
    </div>
  )
}
