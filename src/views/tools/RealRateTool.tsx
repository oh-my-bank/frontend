import { useState } from 'react'
import { rate, wonText } from '../../lib/format'
import { normalizeRate, parseWholeNumber } from '../../lib/learning'
import {
  interpretationLabels,
  normalizeSignedRate,
  pairedAmount,
  signedPercent,
  taxMethodLabels,
} from '../../lib/planningTools'
import { signedWon } from '../../lib/rateScenario'
import {
  CalculationError,
  CalculatorForm,
  NumberField,
  ResultPanel,
  ResultTable,
  errorFor,
  formatErrors,
  formatMessages,
  useCalculation,
} from './parts'
import { StackedBars } from './ToolChart'
import '../../styles/planning-tools.css'

const fields = ['nominalRate', 'inflationRate', 'taxRatePercent', 'principal', 'termMonths']
const pairMessages = {
  principal: '기간을 넣었다면 원금도 함께 입력해 주세요.',
  termMonths: '원금을 넣었다면 기간도 함께 입력해 주세요.',
}
const badgeClass = { POSITIVE: 'approved', ZERO: '', NEGATIVE: 'rejected' } as const

export default function RealRateTool() {
  const { pending, error, result, fieldErrors, run } = useCalculation('real-rate')
  const [nominalRate, setNominalRate] = useState('3.0')
  const [inflationRate, setInflationRate] = useState('2.0')
  const [taxRatePercent, setTaxRatePercent] = useState('15.4')
  const [principal, setPrincipal] = useState('10,000,000')
  const [termMonths, setTermMonths] = useState('12')
  const [local, setLocal] = useState<Record<string, string>>({})
  function submit() {
    const nominal = normalizeRate(nominalRate)
    const inflation = normalizeSignedRate(inflationRate)
    const tax = taxRatePercent.trim() === '' ? undefined : normalizeRate(taxRatePercent)
    const amount = principal.trim() === '' ? undefined : parseWholeNumber(principal)
    const months = termMonths.trim() === '' ? undefined : parseWholeNumber(termMonths)
    const errors = formatErrors([
      ['nominalRate', nominal !== null, formatMessages.rate],
      [
        'inflationRate',
        inflation !== null,
        '연 % 숫자로 입력해 주세요. 물가 하락은 -1처럼 씁니다.',
      ],
      ['taxRatePercent', tax !== null, formatMessages.rate],
      ['principal', amount !== null, formatMessages.amount],
      ['termMonths', months !== null, formatMessages.months],
    ])
    const pair = pairedAmount(amount ?? null, months ?? null)
    if (Object.keys(errors).length === 0 && pair.error) {
      errors[pair.error] = pairMessages[pair.error]
      document.getElementById(`calc-${pair.error}`)?.focus()
    }
    setLocal(errors)
    if (Object.keys(errors).length > 0 || nominal === null || inflation === null || tax === null)
      return
    void run({
      nominalRate: nominal,
      inflationRate: inflation,
      ...(tax === undefined ? {} : { taxRatePercent: tax }),
      ...(pair.principal === undefined
        ? {}
        : { principal: pair.principal, termMonths: pair.termMonths }),
    })
  }
  return (
    <div className="tool-layout">
      <CalculatorForm title="금리와 물가" pending={pending} onSubmit={submit}>
        <NumberField
          path="nominalRate"
          label="명목 연금리"
          unit="%"
          value={nominalRate}
          onChange={setNominalRate}
          help="연 0 ~ 20%, 예금 상품에 적힌 세전 금리"
          error={errorFor('nominalRate', local, fieldErrors)}
        />
        <NumberField
          path="inflationRate"
          label="예상 연 물가상승률"
          unit="%"
          value={inflationRate}
          onChange={setInflationRate}
          help="연 -5 ~ 20%, 직접 넣는 가정값(예측 아님). 물가 하락은 -1처럼 입력"
          error={errorFor('inflationRate', local, fieldErrors)}
        />
        <NumberField
          path="taxRatePercent"
          label="이자소득세율"
          unit="%"
          value={taxRatePercent}
          onChange={setTaxRatePercent}
          help="0 ~ 50%, 비우면 15.4%(일반과세). 비과세는 0"
          error={errorFor('taxRatePercent', local, fieldErrors)}
          optional
        />
        <NumberField
          path="principal"
          label="원금"
          unit="원"
          value={principal}
          onChange={setPrincipal}
          help="1원 ~ 100억원. 기간과 함께 넣으면 단리 정기예금 기준 금액도 계산"
          error={errorFor('principal', local, fieldErrors)}
          reading
          optional
        />
        <NumberField
          path="termMonths"
          label="기간"
          unit="개월"
          value={termMonths}
          onChange={setTermMonths}
          help="1 ~ 120개월, 원금과 함께 입력"
          error={errorFor('termMonths', local, fieldErrors)}
          optional
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
              실질 수익률 <strong>연 {signedPercent(result.realRate)}%</strong>
              <span className={`status-badge ${badgeClass[result.interpretation]}`.trim()}>
                {interpretationLabels[result.interpretation]}
              </span>
            </p>
            <p
              className={`real-rate-message${result.interpretation === 'NEGATIVE' ? ' negative' : ''}`}
            >
              {result.interpretationMessage}
            </p>
            <ResultTable
              caption={`명목 연 ${rate(result.nominalRate)}% · 물가 연 ${signedPercent(result.inflationRate)}%(가정) · 세율 ${rate(result.taxRatePercent)}%`}
              rows={[
                ['세후 명목 수익률', `연 ${signedPercent(result.afterTaxNominalRate)}%`],
                ['세전 실질 수익률', `연 ${signedPercent(result.realRateBeforeTax)}%`],
                ['세후 실질 수익률(정확식)', `연 ${signedPercent(result.realRate)}%`, true],
                ['근사식(세후 명목 − 물가)', `연 ${signedPercent(result.approximateRealRate)}%`],
                ['근사식 − 정확식', `${signedPercent(result.approximationGap)}%p`],
              ]}
            />
            <div className="tool-explain">
              <h3>정확식과 근사식</h3>
              <p>
                정확식은 (1 + 세후 명목 수익률) ÷ (1 + 물가상승률) − 1입니다. 흔히 쓰는 근사식
                &lsquo;세후 명목 − 물가&rsquo;는 계산이 쉽지만 물가가 오를 때 실질 수익률을 조금
                크게 보입니다. 금리와 물가가 높을수록 두 값의 차이가 커집니다.
              </p>
            </div>
            {result.amount && (
              <>
                <ResultTable
                  caption={`원금 ${wonText(result.amount.principal)} · ${result.amount.termMonths}개월 단리 정기예금 · ${taxMethodLabels[result.amount.taxMethod]}`}
                  rows={[
                    ['세전 이자', wonText(result.amount.interest)],
                    ['이자소득세', wonText(result.amount.incomeTax)],
                    ['지방소득세', wonText(result.amount.localTax)],
                    ['세후 이자', wonText(result.amount.interestAfterTax)],
                    ['만기 수령액(명목)', wonText(result.amount.maturityAmount), true],
                    [`물가 배수(${result.amount.termMonths}개월)`, result.amount.priceLevelFactor],
                    ['만기 수령액의 지금 돈 가치', wonText(result.amount.maturityInTodayWon), true],
                    ['구매력 기준 증감', signedWon(result.amount.realGain)],
                    ['원금 구매력을 지키려면 필요한 금액', wonText(result.amount.breakEvenAmount)],
                  ]}
                />
                <StackedBars
                  title="명목 만기 금액과 지금 돈 가치"
                  rows={[
                    {
                      label: `만기 수령액(명목) ${wonText(result.amount.maturityAmount)}`,
                      max: Math.max(
                        result.amount.maturityAmount,
                        result.amount.breakEvenAmount,
                        result.amount.maturityInTodayWon,
                      ),
                      segments: [
                        { label: '원금', value: result.amount.principal, tone: 'principal' },
                        {
                          label: '세후 이자',
                          value: result.amount.interestAfterTax,
                          tone: 'interest',
                        },
                      ],
                      marker: {
                        value: result.amount.breakEvenAmount,
                        label: '원금 구매력 유지선',
                      },
                    },
                    {
                      label: `지금 돈 가치 ${wonText(result.amount.maturityInTodayWon)}`,
                      max: Math.max(
                        result.amount.maturityAmount,
                        result.amount.breakEvenAmount,
                        result.amount.maturityInTodayWon,
                      ),
                      segments: [
                        {
                          label: '지금 돈 가치',
                          value: result.amount.maturityInTodayWon,
                          tone: 'extra',
                        },
                      ],
                      marker: { value: result.amount.principal, label: '원금' },
                    },
                  ]}
                  note="첫 막대의 점선을 넘어야 물가가 오른 뒤에도 원금만큼의 물건을 살 수 있습니다."
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
