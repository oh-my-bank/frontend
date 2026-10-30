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

const fields = ['principal', 'termMonths', 'annualRate', 'interestType', 'taxType']

export default function DepositTool() {
  const { pending, error, result, fieldErrors, run } = useCalculation('deposit')
  const [principal, setPrincipal] = useState('10,000,000')
  const [termMonths, setTermMonths] = useState('12')
  const [annualRate, setAnnualRate] = useState('3.0')
  const [interestType, setInterestType] = useState<InterestType>('SIMPLE')
  const [taxType, setTaxType] = useState<TaxType>('GENERAL')
  const [local, setLocal] = useState<Record<string, string>>({})
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
    void run({ principal: amount, termMonths: months, annualRate: percent, interestType, taxType })
  }
  return (
    <div className="tool-layout">
      <CalculatorForm title="예금 조건" pending={pending} onSubmit={submit}>
        <NumberField
          path="principal"
          label="맡길 원금"
          unit="원"
          value={principal}
          onChange={setPrincipal}
          help="1원 ~ 100억원"
          error={errorFor('principal', local, fieldErrors)}
          reading
        />
        <NumberField
          path="termMonths"
          label="예치 기간"
          unit="개월"
          value={termMonths}
          onChange={setTermMonths}
          help="1 ~ 120개월"
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
              <span>세후 연환산 수익률 연 {rate(result.effectiveAnnualRateAfterTax)}%</span>
            </p>
            <ResultTable
              caption={`원금 ${wonText(result.principal)} · ${result.termMonths}개월 · 연 ${rate(result.annualRate)}% · ${interestTypeLabels[result.interestType]} · ${taxTypeLabels[result.taxType]}`}
              rows={[
                ['세전 이자', wonText(result.interest)],
                ['이자소득세(14%)', wonText(result.incomeTax)],
                ['지방소득세(소득세의 10%)', wonText(result.localTax)],
                ['세금 합계', wonText(result.totalTax)],
                ['세후 이자', wonText(result.interestAfterTax), true],
                ['만기 수령액', wonText(result.maturityAmount), true],
                ['세후 연환산 수익률', `연 ${rate(result.effectiveAnnualRateAfterTax)}%`],
              ]}
            />
            <StackedBars
              title="원금과 이자, 이자와 세금의 비중"
              note="각 막대는 그 줄의 합계(만기 수령액, 세전 이자)를 전체 길이로 그렸습니다."
              rows={[
                {
                  label: `만기 수령액 ${wonText(result.maturityAmount)}`,
                  max: result.maturityAmount,
                  segments: [
                    { label: '원금', value: result.principal, tone: 'principal' },
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
