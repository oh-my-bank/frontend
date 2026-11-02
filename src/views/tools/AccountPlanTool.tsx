import { useState } from 'react'
import { wonText } from '../../lib/format'
import { parseWholeNumber } from '../../lib/learning'
import { accountPlanWarningLabels, accountRoleTones, signedPercent } from '../../lib/planningTools'
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

const fields = [
  'monthlyIncome',
  'fixedExpense',
  'livingExpense',
  'emergencyMonths',
  'currentEmergencyFund',
]

export default function AccountPlanTool() {
  const { pending, error, result, fieldErrors, run } = useCalculation('account-plan')
  const [monthlyIncome, setMonthlyIncome] = useState('3,000,000')
  const [fixedExpense, setFixedExpense] = useState('900,000')
  const [livingExpense, setLivingExpense] = useState('1,100,000')
  const [emergencyMonths, setEmergencyMonths] = useState('6')
  const [currentEmergencyFund, setCurrentEmergencyFund] = useState('2,000,000')
  const [local, setLocal] = useState<Record<string, string>>({})
  function submit() {
    const income = parseWholeNumber(monthlyIncome)
    const fixed = parseWholeNumber(fixedExpense)
    const living = parseWholeNumber(livingExpense)
    const months = emergencyMonths.trim() === '' ? undefined : parseWholeNumber(emergencyMonths)
    const current = parseWholeNumber(currentEmergencyFund)
    const errors = formatErrors([
      ['monthlyIncome', income !== null, formatMessages.amount],
      ['fixedExpense', fixed !== null, formatMessages.amount],
      ['livingExpense', living !== null, formatMessages.amount],
      ['emergencyMonths', months !== null, formatMessages.months],
      ['currentEmergencyFund', current !== null, formatMessages.amount],
    ])
    setLocal(errors)
    if (income === null || fixed === null || living === null || months === null || current === null)
      return
    void run({
      monthlyIncome: income,
      fixedExpense: fixed,
      livingExpense: living,
      ...(months === undefined ? {} : { emergencyMonths: months }),
      currentEmergencyFund: current,
    })
  }
  return (
    <div className="tool-layout">
      <CalculatorForm title="소득과 지출" pending={pending} onSubmit={submit}>
        <NumberField
          path="monthlyIncome"
          label="월 세후 소득(실수령액)"
          unit="원"
          value={monthlyIncome}
          onChange={setMonthlyIncome}
          help="0 ~ 10억원, 가상 금액"
          error={errorFor('monthlyIncome', local, fieldErrors)}
          reading
        />
        <NumberField
          path="fixedExpense"
          label="월 고정지출"
          unit="원"
          value={fixedExpense}
          onChange={setFixedExpense}
          help="월세·관리비·보험료·통신비·대출 상환처럼 매달 같은 날 빠지는 돈"
          error={errorFor('fixedExpense', local, fieldErrors)}
          reading
        />
        <NumberField
          path="livingExpense"
          label="월 변동지출(생활비)"
          unit="원"
          value={livingExpense}
          onChange={setLivingExpense}
          help="식비·교통비·쇼핑처럼 달마다 달라지는 돈"
          error={errorFor('livingExpense', local, fieldErrors)}
          reading
        />
        <NumberField
          path="emergencyMonths"
          label="비상금 목표 개월 수"
          unit="개월"
          value={emergencyMonths}
          onChange={setEmergencyMonths}
          help="3 ~ 12개월, 비우면 6개월. 목표액 = 월 지출 합계(고정 + 생활비) × 개월 수"
          error={errorFor('emergencyMonths', local, fieldErrors)}
          optional
        />
        <NumberField
          path="currentEmergencyFund"
          label="지금 모아 둔 비상금"
          unit="원"
          value={currentEmergencyFund}
          onChange={setCurrentEmergencyFund}
          help="0 ~ 100억원"
          error={errorFor('currentEmergencyFund', local, fieldErrors)}
          reading
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
              {result.monthlySurplus > 0 ? (
                <>
                  매달 <strong>{wonText(result.monthlySurplus)}</strong>이 남습니다.
                </>
              ) : (
                <>
                  매달 남는 돈이 <strong>{signedWon(result.monthlySurplus)}</strong>입니다.
                </>
              )}
              <span className="tool-assumption">교육용 배분 예시</span>
            </p>
            {result.warnings.length > 0 && (
              <ul className="tool-warnings" aria-label="확인할 점">
                {result.warnings.map((warning) => (
                  <li key={warning.code}>
                    <strong>{accountPlanWarningLabels[warning.code] ?? '확인 필요'}</strong>
                    <span>{warning.message}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="tool-table-wrap">
              <table className="tool-table account-plan-table">
                <caption>계좌 역할별 월 배분 (월 소득 {wonText(result.monthlyIncome)})</caption>
                <thead>
                  <tr>
                    <th scope="col">계좌</th>
                    <th scope="col">비상금 모으는 동안</th>
                    <th scope="col">비상금 목표 도달 후</th>
                  </tr>
                </thead>
                <tbody>
                  {result.accounts.map((account) => (
                    <tr key={account.role}>
                      <th scope="row">
                        {account.name}
                        <small>{account.purpose}</small>
                      </th>
                      <td>{wonText(account.monthlyAmount)}</td>
                      <td>{wonText(account.afterTargetMonthlyAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ResultTable
              caption={`비상금 목표: 월 지출 합계 × ${result.emergencyMonths}개월`}
              rows={[
                ['월 지출 합계(고정 + 생활비)', wonText(result.totalExpense)],
                ['비상금 목표액', wonText(result.emergencyTarget), true],
                ['지금 모아 둔 비상금', wonText(result.currentEmergencyFund)],
                ['부족분', wonText(result.emergencyGap)],
                ...(result.emergencyExcess > 0
                  ? ([['목표보다 많은 금액', wonText(result.emergencyExcess)]] as [
                      string,
                      string,
                    ][])
                  : []),
                ['12개월 안에 채우는 데 필요한 월 적립', wonText(result.emergencyMonthlyNeed)],
                ['목표 도달까지', monthsText(result.monthsToTarget), true],
                ...(result.finalMonthTopup !== null
                  ? ([['마지막 달 적립액', wonText(result.finalMonthTopup)]] as [string, string][])
                  : []),
                [
                  '저축률(여유자금 ÷ 소득)',
                  result.savingsRatePercent === null
                    ? '-'
                    : `${signedPercent(result.savingsRatePercent)}%`,
                ],
                ...(result.monthlyShortfall > 0
                  ? ([['월 부족액', wonText(result.monthlyShortfall)]] as [string, string][])
                  : []),
              ]}
            />
            <StackedBars
              title="계좌 역할별 월 배분"
              rows={[
                {
                  label: '비상금 모으는 동안',
                  max: Math.max(
                    result.monthlyIncome,
                    result.accounts.reduce((sum, account) => sum + account.monthlyAmount, 0),
                  ),
                  segments: result.accounts.map((account) => ({
                    label: account.name,
                    value: account.monthlyAmount,
                    tone: accountRoleTones[account.role],
                  })),
                },
                {
                  label: '목표 도달 후',
                  max: Math.max(
                    result.monthlyIncome,
                    result.accounts.reduce(
                      (sum, account) => sum + account.afterTargetMonthlyAmount,
                      0,
                    ),
                  ),
                  segments: result.accounts.map((account) => ({
                    label: account.name,
                    value: account.afterTargetMonthlyAmount,
                    tone: accountRoleTones[account.role],
                  })),
                },
              ]}
              note="막대 전체가 월 소득입니다. 비상금 목표에 도달하면 파킹통장 적립분이 저축 계좌로 옮겨 갑니다."
            />
            <div className="tool-explain">
              <h3>이 배분을 읽는 법</h3>
              <p>
                비상금 목표와 월 적립 규칙은 나의 전략(BANK_STRATEGY_V1)과 같습니다. 남는 여유자금을
                먼저 비상금으로, 목표에 닿은 뒤에는 저축 계좌로 보내는 순서와 계좌를 네 개로 나누는
                구조는 교육용 가정값입니다. 파킹통장 이자는 계산에 넣지 않았으므로 실제로는 조금 더
                빨리 도달할 수 있습니다.
              </p>
              <p>
                특정 은행이나 상품을 고르라는 뜻이 아닙니다. 기간별 저축액은 목표 저축 계산기나 나의
                전략에서 따로 계산해 보세요.
              </p>
            </div>
            <p className="tool-notice">{result.notice}</p>
          </>
        )}
      </ResultPanel>
    </div>
  )
}

function monthsText(months: number | null) {
  if (months === null) return '여유자금이 없어 도달할 수 없음'
  if (months === 0) return '이미 도달'
  return `${months}개월`
}
