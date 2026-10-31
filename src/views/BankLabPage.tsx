import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../lib/api'
import { rate, wonText } from '../lib/format'
import { normalizeRate } from '../lib/learning'
import {
  bankAmount,
  checkStatus,
  eokToWon,
  fetchBankOpsRules,
  metricInfo,
  normalizeSignedRate,
  simulateBankOps,
  wonToEok,
  type BankOpsCheck,
  type BankOpsInput,
  type BankOpsResult,
  type BankOpsRules,
  type BankOpsScenario,
} from '../lib/bankOps'
import AppIcon from '../components/AppIcon'
import ErrorNotice from '../components/ErrorNotice'
import SourceList from '../components/SourceList'
import {
  CalculationError,
  ConceptLinks,
  ResultPanel,
  ResultTable,
  errorFor,
  fieldId,
  formatErrors,
} from './tools/parts'
import { StackedBars } from './tools/ToolChart'
import '../styles/banking-products.css'
import '../styles/tools.css'
import '../styles/bank-lab.css'

type AmountKey =
  | 'cash'
  | 'securities'
  | 'mortgageLoans'
  | 'householdLoans'
  | 'corporateLoans'
  | 'deposits'
  | 'capital'
  | 'nonInterestIncome'
  | 'operatingExpense'
type RateKey =
  | 'securitiesYield'
  | 'mortgageRate'
  | 'householdRate'
  | 'corporateRate'
  | 'depositRate'
  | 'borrowingRate'
  | 'creditLossRate'
type ShockKey =
  'baseRateChange' | 'loanPassThroughPercent' | 'depositPassThroughPercent' | 'extraCreditLossRate'
type FormState = Record<AmountKey | RateKey, string> & {
  withShock: boolean
  shock: Record<ShockKey, string>
}

const assetFields: [AmountKey, string, string][] = [
  ['cash', '현금·중앙은행 예치금', '이자가 없는 지급준비 자산으로 봅니다.'],
  ['securities', '유가증권(국공채)', '고유동성자산이며 위험가중치 0%로 봅니다.'],
  ['mortgageLoans', '주택담보대출', '위험가중치 35%(교육용 가정값)'],
  ['householdLoans', '기타 가계대출', '신용대출 등. 위험가중치 75%(교육용 가정값)'],
  ['corporateLoans', '기업대출', '위험가중치 100%(교육용 가정값)'],
]
const fundingFields: [AmountKey, string, string][] = [
  ['deposits', '예금(예수금)', '1원 이상. 30일 유출률 10%로 봅니다(교육용 가정값).'],
  ['capital', '자기자본', '1원 이상. 자산 − 예금 − 자본이 차입금이 됩니다.'],
]
const rateFields: [RateKey, string, string][] = [
  ['securitiesYield', '유가증권 수익률', '연 0 ~ 20%. 충격 때도 그대로(고정금리 채권 가정)'],
  ['mortgageRate', '주택담보대출 금리', '연 0 ~ 30%'],
  ['householdRate', '기타 가계대출 금리', '연 0 ~ 30%'],
  ['corporateRate', '기업대출 금리', '연 0 ~ 30%'],
  ['depositRate', '예금 금리', '연 0 ~ 20%'],
  ['borrowingRate', '차입금 금리', '연 0 ~ 20%. 기준금리 변동이 100% 전가된다고 봅니다.'],
]
const amountKeys = [...assetFields, ...fundingFields]
  .map(([key]) => key)
  .concat(['nonInterestIncome', 'operatingExpense'])
const rateKeys: RateKey[] = [...rateFields.map(([key]) => key), 'creditLossRate']

function formFrom(input: BankOpsInput): FormState {
  const shock = input.shock ?? {
    baseRateChange: '1.000',
    loanPassThroughPercent: 70,
    depositPassThroughPercent: 50,
    extraCreditLossRate: '0.600',
  }
  return {
    ...(Object.fromEntries(amountKeys.map((key) => [key, wonToEok(input[key])])) as Record<
      AmountKey,
      string
    >),
    ...(Object.fromEntries(rateKeys.map((key) => [key, String(Number(input[key]))])) as Record<
      RateKey,
      string
    >),
    withShock: input.shock !== null,
    shock: {
      baseRateChange: String(Number(shock.baseRateChange)),
      loanPassThroughPercent: String(shock.loanPassThroughPercent),
      depositPassThroughPercent: String(shock.depositPassThroughPercent),
      extraCreditLossRate: String(Number(shock.extraCreditLossRate)),
    },
  }
}

const formatMessage = {
  amount: '억원 단위 숫자로 입력해 주세요. 소수 넷째 자리(1만원)까지 쓸 수 있습니다.',
  rate: '연 % 숫자로 입력해 주세요. 소수 셋째 자리까지 쓸 수 있습니다.',
  change: '%p 숫자로 입력해 주세요. 내리면 앞에 -를 붙입니다.',
  percent: '0 ~ 100 사이 정수로 입력해 주세요.',
}

function Field({
  path,
  label,
  unit,
  value,
  onChange,
  help,
  error,
}: {
  path: string
  label: string
  unit: string
  value: string
  onChange: (value: string) => void
  help: string
  error: string
}) {
  const id = fieldId(path)
  return (
    <div className="bank-application-field tool-field">
      <label htmlFor={id}>
        {label} <i aria-hidden="true">*</i>
      </label>
      <div className="input-unit">
        <input
          id={id}
          type="text"
          inputMode={unit === '%p' ? 'text' : 'decimal'}
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
          aria-invalid={!!error}
          aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`}
        />
        <span>{unit}</span>
      </div>
      <p className="bank-application-help" id={`${id}-help`}>
        {help}
      </p>
      {error && (
        <p className="bank-application-error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  )
}

function StatusBadge({ check }: { check: BankOpsCheck }) {
  const status = checkStatus(check)
  return (
    <span className={`status-badge ${status.tone === 'pending' ? '' : status.tone}`}>
      {status.label}
    </span>
  )
}

const percentText = (value: string | null) => (value === null ? '산출 불가' : `${value}%`)
const basisLabel = (check: BankOpsCheck) =>
  check.basis === 'REGULATION' ? '제도 기준' : '교육용 참고선'
const comparisonText = (check: BankOpsCheck) =>
  `${check.thresholdPercent}% ${check.comparison === 'MIN' ? '이상' : '이하'}`

function MetricCard({
  info,
  value,
  shocked,
  check,
  children,
}: {
  info: { title: string; text: string }
  value: string
  shocked?: string
  check?: BankOpsCheck
  children?: ReactNode
}) {
  return (
    <li className="bank-lab-metric">
      <h3>{info.title}</h3>
      <p className="bank-lab-metric-value">
        <strong>{value}</strong>
        {check && <StatusBadge check={check} />}
      </p>
      {shocked !== undefined && <p className="bank-lab-metric-shock">충격 후 {shocked}</p>}
      {check && <p className="bank-lab-metric-threshold">기준 {comparisonText(check)}</p>}
      <p className="bank-lab-metric-text">{info.text}</p>
      {children}
    </li>
  )
}

function profitBars(label: string, scenario: BankOpsScenario) {
  const revenue = scenario.interestIncome + scenario.nonInterestIncome
  const costs = scenario.interestExpense + scenario.creditCost + scenario.operatingExpense
  return {
    label: `${label}: 수익 ${bankAmount(revenue)} · 세전이익 ${bankAmount(scenario.preTaxProfit)}`,
    max: Math.max(revenue, costs),
    segments: [
      { label: '이자비용', value: scenario.interestExpense, tone: 'extra' as const },
      { label: '대손비용', value: scenario.creditCost, tone: 'tax' as const },
      { label: '판관비', value: scenario.operatingExpense, tone: 'interest' as const },
      ...(scenario.preTaxProfit > 0
        ? [{ label: '세전이익', value: scenario.preTaxProfit, tone: 'principal' as const }]
        : []),
    ],
    marker: { value: revenue, label: '수익 합계(이자수익+비이자이익)' },
  }
}

function comparisonRows(base: BankOpsScenario, shocked: BankOpsScenario | null) {
  const pair = (pick: (scenario: BankOpsScenario) => string) =>
    [pick(base), shocked ? pick(shocked) : null] as const
  return [
    ['평균 대출금리', pair((s) => `${rate(s.averageLoanRate)}%`)],
    ['예금 금리', pair((s) => `${rate(s.rates.deposit)}%`)],
    ['차입금 금리', pair((s) => `${rate(s.rates.borrowing)}%`)],
    ['대손율', pair((s) => `${rate(s.creditLossRate)}%`)],
    ['이자수익', pair((s) => bankAmount(s.interestIncome))],
    ['이자비용', pair((s) => bankAmount(s.interestExpense))],
    ['순이자이익', pair((s) => bankAmount(s.netInterestIncome))],
    ['비이자이익', pair((s) => bankAmount(s.nonInterestIncome))],
    ['판관비', pair((s) => bankAmount(s.operatingExpense))],
    ['대손비용', pair((s) => bankAmount(s.creditCost))],
    ['세전이익', pair((s) => bankAmount(s.preTaxProfit))],
    ['예대금리차', pair((s) => `${s.loanDepositSpread}%p`)],
    ['NIM', pair((s) => `${s.nimPercent}%`)],
    ['ROA', pair((s) => `${s.roaPercent}%`)],
    ['ROE', pair((s) => `${s.roePercent}%`)],
    ['1년 후 자기자본', pair((s) => bankAmount(s.capitalAfterOneYear))],
    ['1년 후 BIS 비율', pair((s) => `${s.bisRatioAfterPercent}%`)],
  ] as const
}

function Results({ result }: { result: BankOpsResult }) {
  const { balanceSheet: sheet, structure, baseline, shocked } = result
  const check = (code: string) => result.checks.find((item) => item.code === code)
  const scenarioChecks = [
    ...baseline.checks.map((item) => ['기준', item] as const),
    ...(shocked?.checks.map((item) => ['충격', item] as const) ?? []),
  ]
  return (
    <>
      <p className="tool-headline">
        1년 세전이익 <strong>{bankAmount(baseline.preTaxProfit)}</strong>
        {shocked && <span>충격 시나리오 {bankAmount(shocked.preTaxProfit)}</span>}
      </p>
      <ul className="bank-lab-metrics">
        <MetricCard
          info={metricInfo.nim}
          value={`${baseline.nimPercent}%`}
          shocked={shocked ? `${shocked.nimPercent}%` : undefined}
        />
        <MetricCard
          info={metricInfo.spread}
          value={`${baseline.loanDepositSpread}%p`}
          shocked={shocked ? `${shocked.loanDepositSpread}%p` : undefined}
        />
        <MetricCard
          info={metricInfo.roe}
          value={`${baseline.roePercent}%`}
          shocked={shocked ? `${shocked.roePercent}%` : undefined}
        />
        <MetricCard
          info={metricInfo.bis}
          value={`${structure.bisRatioPercent}%`}
          check={check('BIS_WITH_BUFFER')}
        >
          <p className="bank-lab-metric-threshold">
            1년 후 기준 {baseline.bisRatioAfterPercent}%
            {shocked && ` · 충격 ${shocked.bisRatioAfterPercent}%`}
          </p>
        </MetricCard>
        <MetricCard
          info={metricInfo.lcr}
          value={percentText(structure.lcrPercent)}
          check={check('LCR_MINIMUM')}
        />
        <MetricCard
          info={metricInfo.ltd}
          value={`${structure.weightedLoanToDepositPercent}%`}
          check={check('LOAN_TO_DEPOSIT')}
        >
          <p className="bank-lab-metric-threshold">
            가중치 없는 예대율 {structure.loanToDepositPercent}%
          </p>
        </MetricCard>
      </ul>
      <div className="tool-table-wrap">
        <table className="tool-table">
          <caption>기준선 판정</caption>
          <thead>
            <tr>
              <th scope="col">지표</th>
              <th scope="col">값</th>
              <th scope="col">기준</th>
              <th scope="col">성격</th>
              <th scope="col">판정</th>
            </tr>
          </thead>
          <tbody>
            {result.checks.map((item) => (
              <tr key={item.code}>
                <th scope="row">{item.label}</th>
                <td>{percentText(item.valuePercent)}</td>
                <td>{comparisonText(item)}</td>
                <td>{basisLabel(item)}</td>
                <td>
                  <StatusBadge check={item} />
                </td>
              </tr>
            ))}
            {scenarioChecks.map(([label, item]) => (
              <tr key={`${label}-${item.code}`}>
                <th scope="row">
                  {item.label} ({label})
                </th>
                <td>{percentText(item.valuePercent)}</td>
                <td>{comparisonText(item)}</td>
                <td>{basisLabel(item)}</td>
                <td>
                  <StatusBadge check={item} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="tool-table-wrap">
        <table className="tool-table bank-lab-compare">
          <caption>
            {shocked && result.shock
              ? `기준 vs 충격(기준금리 ${Number(result.shock.baseRateChange) > 0 ? '+' : ''}${rate(result.shock.baseRateChange)}%p, 대출 전가 ${result.shock.loanPassThroughPercent}%·예금 전가 ${result.shock.depositPassThroughPercent}%, 대손 +${rate(result.shock.extraCreditLossRate)}%p)`
              : '기준 시나리오 1년 손익'}
          </caption>
          <thead>
            <tr>
              <th scope="col">항목</th>
              <th scope="col">기준</th>
              {shocked && <th scope="col">충격</th>}
            </tr>
          </thead>
          <tbody>
            {comparisonRows(baseline, shocked).map(([label, [base, shock]]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td>{base}</td>
                {shocked && <td>{shock}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <StackedBars
        title="수익과 비용 구성"
        rows={[profitBars('기준', baseline), ...(shocked ? [profitBars('충격', shocked)] : [])]}
        note="점선이 수익 합계입니다. 비용 막대가 점선을 넘으면 그만큼 손실입니다."
      />
      <ResultTable
        caption="재무상태표와 규제 산출 기초(서버 계산)"
        rows={[
          ['총자산', bankAmount(sheet.totalAssets), true],
          ['대출 합계', bankAmount(sheet.totalLoans)],
          ['예금', bankAmount(sheet.deposits)],
          ['차입금(자산 − 예금 − 자본)', bankAmount(sheet.borrowings)],
          ['자기자본', bankAmount(sheet.capital)],
          ['위험가중자산', bankAmount(structure.riskWeightedAssets), true],
          ['고유동성자산(현금+유가증권)', bankAmount(structure.hqla)],
          ['30일 순현금유출', bankAmount(structure.netCashOutflows)],
        ]}
      />
      <p className="form-help">
        금액은 조·억 단위로 줄여 보여 줍니다. 세전이익 정확값은 {wonText(baseline.preTaxProfit)}
        입니다.
      </p>
      <ul className="bank-lab-notices">
        {result.notices.map((notice) => (
          <li key={notice} className="tool-notice">
            {notice}
          </li>
        ))}
      </ul>
    </>
  )
}

function Assumptions({ rules }: { rules: BankOpsRules }) {
  const w = rules.riskWeights
  return (
    <section id="assumptions" className="guide-section" aria-labelledby="assumptions-title">
      <div className="section-heading">
        <div>
          <h2 id="assumptions-title">규칙과 단순화 가정</h2>
          <p>BIS·LCR 기준선만 제도 수치이고, 나머지 계수는 교육용 가정값입니다.</p>
        </div>
        <span className="tool-rule-tag">규칙 {rules.ruleVersion}</span>
      </div>
      <div className="tool-table-wrap">
        <table className="tool-table">
          <caption>이 시뮬레이터의 계수와 실제 규제의 차이</caption>
          <thead>
            <tr>
              <th scope="col">항목</th>
              <th scope="col">이 규칙</th>
              <th scope="col">실제</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">BIS 기준선</th>
              <td>
                최저 {rules.thresholds.bisMinimumPercent}%, 자본보전완충 포함{' '}
                {rules.thresholds.bisWithBufferPercent}%{' '}
                <span className="tool-assumption small">제도</span>
              </td>
              <td>국내 은행은 D-SIB 추가자본·경기대응완충 등으로 요구 수준이 더 높습니다.</td>
            </tr>
            <tr>
              <th scope="row">LCR 기준선</th>
              <td>
                {rules.thresholds.lcrMinimumPercent}% 이상{' '}
                <span className="tool-assumption small">제도</span>
              </td>
              <td>외화 LCR 등 별도 기준과 감독 당국의 한시 조정이 있습니다.</td>
            </tr>
            <tr>
              <th scope="row">위험가중치</th>
              <td>
                주담대 {w.mortgage}% · 기타 가계 {w.household}% · 기업 {w.corporate}% · 현금·국공채{' '}
                {w.securities}% <span className="tool-assumption small">교육용 가정값</span>
              </td>
              <td>
                LTV·신용등급·차주 유형별 세분 가중치, 내부등급법, 시장·운영 리스크까지 더합니다.
              </td>
            </tr>
            <tr>
              <th scope="row">LCR 유출률</th>
              <td>
                예금 {rules.lcrRunoff.deposits}% · 차입금 {rules.lcrRunoff.borrowings}%, 유입 0{' '}
                <span className="tool-assumption small">교육용 가정값</span>
              </td>
              <td>
                예금 종류별 3~100% 유출률, 유입은 유출의 75% 한도, 자산 등급별 할인이 있습니다.
              </td>
            </tr>
            <tr>
              <th scope="row">예대율</th>
              <td>
                가계 {rules.loanToDepositWeights.household}% · 기업{' '}
                {rules.loanToDepositWeights.corporate}% 가중, 참고선{' '}
                {rules.thresholds.loanToDepositMaxPercent}%{' '}
                <span className="tool-assumption small">교육용 가정값</span>
              </td>
              <td>감독규정의 원화예대율은 대상 예금·대출과 가중치를 따로 정합니다.</td>
            </tr>
            <tr>
              <th scope="row">손익·금리 충격</th>
              <td>
                잔액 1년 불변, 세금·배당 없음, 즉시 전가(차입금 {rules.borrowingPassThroughPercent}
                %·유가증권 0%)
              </td>
              <td>평균잔액·재가격 주기에 따라 점진 전가되고, 채권 평가손익도 생깁니다.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <SourceList sources={rules.sources} />
    </section>
  )
}

export default function BankLabPage() {
  const [rules, setRules] = useState<BankOpsRules | null>(null)
  const [rulesError, setRulesError] = useState<unknown>(null)
  const [reload, setReload] = useState(0)
  const [form, setForm] = useState<FormState | null>(null)
  const [local, setLocal] = useState<Record<string, string>>({})
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [result, setResult] = useState<BankOpsResult | null>(null)
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])
  useEffect(() => {
    const current = new AbortController()
    setRulesError(null)
    fetchBankOpsRules(current.signal)
      .then((loaded) => {
        setRules(loaded)
        setForm((value) => value ?? formFrom(loaded.example))
      })
      .catch((cause) => {
        if (!current.signal.aborted) setRulesError(cause)
      })
    return () => current.abort()
  }, [reload])

  const serverErrors: Record<string, string> = error instanceof ApiError ? error.fieldErrors : {}
  const fieldError = (path: string) => errorFor(path, local, serverErrors)
  const shockPaths = [
    'shock',
    'shock.baseRateChange',
    'shock.loanPassThroughPercent',
    'shock.depositPassThroughPercent',
    'shock.extraCreditLossRate',
  ]
  const fields = [...amountKeys, ...rateKeys, ...shockPaths]

  function set<K extends AmountKey | RateKey>(key: K, value: string) {
    setForm((current) => (current ? { ...current, [key]: value } : current))
  }
  function setShock(key: ShockKey, value: string) {
    setForm((current) =>
      current ? { ...current, shock: { ...current.shock, [key]: value } } : current,
    )
  }
  function percent(value: string) {
    const text = value.trim().replace(/%$/, '').trim()
    return /^\d{1,3}$/.test(text) && Number(text) <= 100 ? Number(text) : null
  }

  async function submit() {
    if (!form) return
    const amounts = Object.fromEntries(amountKeys.map((key) => [key, eokToWon(form[key])]))
    const rates = Object.fromEntries(rateKeys.map((key) => [key, normalizeRate(form[key])]))
    const change = normalizeSignedRate(form.shock.baseRateChange)
    const loanPass = percent(form.shock.loanPassThroughPercent)
    const depositPass = percent(form.shock.depositPassThroughPercent)
    const extra = normalizeRate(form.shock.extraCreditLossRate)
    const errors = formatErrors([
      ...amountKeys.map((key): [string, boolean, string] => [
        key,
        amounts[key] !== null,
        formatMessage.amount,
      ]),
      ...rateKeys.map((key): [string, boolean, string] => [
        key,
        rates[key] !== null,
        formatMessage.rate,
      ]),
      ...(form.withShock
        ? ([
            ['shock.baseRateChange', change !== null, formatMessage.change],
            ['shock.loanPassThroughPercent', loanPass !== null, formatMessage.percent],
            ['shock.depositPassThroughPercent', depositPass !== null, formatMessage.percent],
            ['shock.extraCreditLossRate', extra !== null, formatMessage.rate],
          ] as [string, boolean, string][])
        : []),
    ])
    setLocal(errors)
    if (Object.keys(errors).length) return
    const body = {
      ...amounts,
      ...rates,
      shock: form.withShock
        ? {
            baseRateChange: change!,
            loanPassThroughPercent: loanPass!,
            depositPassThroughPercent: depositPass!,
            extraCreditLossRate: extra!,
          }
        : null,
    } as BankOpsInput
    controller.current?.abort()
    const current = new AbortController()
    controller.current = current
    setPending(true)
    setError(null)
    try {
      setResult(await simulateBankOps(body, current.signal))
    } catch (cause) {
      if (current.signal.aborted) return
      setError(cause)
    } finally {
      if (!current.signal.aborted) setPending(false)
    }
  }

  function resetToExample() {
    if (!rules) return
    setForm(formFrom(rules.example))
    setLocal({})
  }

  const amountField = ([key, label, help]: [AmountKey, string, string]) =>
    form && (
      <Field
        key={key}
        path={key}
        label={label}
        unit="억원"
        value={form[key]}
        onChange={(value) => set(key, value)}
        help={help}
        error={fieldError(key)}
      />
    )

  return (
    <>
      <header className="page-title">
        <div>
          <h1>은행 경영 시뮬레이터</h1>
          <p>
            가상 은행의 예금·대출·자본을 정하면 서버가 1년 손익과 NIM, BIS 자기자본비율, LCR,
            예대율을 계산합니다. 기준금리와 연체율이 바뀌면 은행이 어떻게 흔들리는지 비교해 보세요.
          </p>
        </div>
        <Link to="#assumptions" className="text-button">
          규칙·가정 보기
          <AppIcon name="chevron" size={14} />
        </Link>
      </header>
      <p className="tool-disclaimer">
        <AppIcon name="info" size={16} />
        교육용으로 단순화한 계산입니다. 실제 은행의 경영 지표·규제 비율 산출이나 투자 판단 근거가
        아니며, 예시 은행의 숫자는 교육용 가정값입니다.
      </p>
      {rulesError && !rules ? (
        <>
          <ErrorNotice error={rulesError} message="시뮬레이터 규칙을 불러오지 못했습니다." />
          <button
            type="button"
            className="button button-outline small"
            onClick={() => setReload((value) => value + 1)}
          >
            다시 불러오기
          </button>
        </>
      ) : !rules || !form ? (
        <div className="empty-state" role="status">
          시뮬레이터 규칙을 불러오고 있습니다.
        </div>
      ) : (
        <>
          <div className="tool-layout">
            <form
              className="tool-form"
              noValidate
              aria-labelledby="tool-form-title"
              onSubmit={(event) => {
                event.preventDefault()
                void submit()
              }}
            >
              <h2 id="tool-form-title">가상 은행 조건</h2>
              <p className="form-help">
                금액은 억원 단위입니다(1조 = 10,000억). 처음 값은 교육용 예시 은행입니다.{' '}
                <button type="button" className="text-button" onClick={resetToExample}>
                  예시 값으로 되돌리기
                </button>
              </p>
              <fieldset className="tool-group">
                <legend>자산</legend>
                {assetFields.map(amountField)}
              </fieldset>
              <fieldset className="tool-group">
                <legend>부채·자본</legend>
                {fundingFields.map(amountField)}
              </fieldset>
              <fieldset className="tool-group">
                <legend>금리</legend>
                {rateFields.map(([key, label, help]) => (
                  <Field
                    key={key}
                    path={key}
                    label={label}
                    unit="%"
                    value={form[key]}
                    onChange={(value) => set(key, value)}
                    help={help}
                    error={fieldError(key)}
                  />
                ))}
              </fieldset>
              <fieldset className="tool-group">
                <legend>1년 손익 가정</legend>
                <Field
                  path="creditLossRate"
                  label="연간 대손율"
                  unit="%"
                  value={form.creditLossRate}
                  onChange={(value) => set('creditLossRate', value)}
                  help="대출 잔액 중 1년 동안 손실로 볼 비율. 0 ~ 20%"
                  error={fieldError('creditLossRate')}
                />
                {amountField(['nonInterestIncome', '비이자이익', '수수료 등. 0 이상'])}
                {amountField(['operatingExpense', '판매관리비', '인건비·전산비 등. 0 이상'])}
              </fieldset>
              <fieldset className="tool-group">
                <legend>충격 시나리오</legend>
                <label className="checkbox-label tool-check">
                  <input
                    type="checkbox"
                    checked={form.withShock}
                    onChange={(event) =>
                      setForm((current) =>
                        current ? { ...current, withShock: event.target.checked } : current,
                      )
                    }
                  />
                  <span>기준금리·연체율 충격을 같은 은행에 적용해 비교합니다.</span>
                </label>
                {serverErrors.shock && (
                  <p className="bank-application-error">{serverErrors.shock}</p>
                )}
                {form.withShock && (
                  <div className="tool-loan-row">
                    <Field
                      path="shock.baseRateChange"
                      label="기준금리 변동"
                      unit="%p"
                      value={form.shock.baseRateChange}
                      onChange={(value) => setShock('baseRateChange', value)}
                      help="-5 ~ 5%p. 가정 시나리오이며 금리 예측이 아닙니다."
                      error={fieldError('shock.baseRateChange')}
                    />
                    <div className="tool-field-pair">
                      <Field
                        path="shock.loanPassThroughPercent"
                        label="대출 금리 전가율"
                        unit="%"
                        value={form.shock.loanPassThroughPercent}
                        onChange={(value) => setShock('loanPassThroughPercent', value)}
                        help="0 ~ 100"
                        error={fieldError('shock.loanPassThroughPercent')}
                      />
                      <Field
                        path="shock.depositPassThroughPercent"
                        label="예금 금리 전가율"
                        unit="%"
                        value={form.shock.depositPassThroughPercent}
                        onChange={(value) => setShock('depositPassThroughPercent', value)}
                        help="0 ~ 100"
                        error={fieldError('shock.depositPassThroughPercent')}
                      />
                    </div>
                    <Field
                      path="shock.extraCreditLossRate"
                      label="대손율 추가"
                      unit="%p"
                      value={form.shock.extraCreditLossRate}
                      onChange={(value) => setShock('extraCreditLossRate', value)}
                      help="연체 증가로 늘어나는 대손율. 0 ~ 20%p"
                      error={fieldError('shock.extraCreditLossRate')}
                    />
                  </div>
                )}
              </fieldset>
              <CalculationError error={error} fields={fields} />
              <button className="button button-primary full" type="submit" disabled={pending}>
                {pending ? '계산 중…' : '계산하기'}
              </button>
            </form>
            <ResultPanel
              pending={pending}
              failed={!!error}
              hasResult={!!result}
              ruleVersion={result?.ruleVersion}
            >
              {result && <Results result={result} />}
            </ResultPanel>
          </div>
          <Assumptions rules={rules} />
        </>
      )}
      <ConceptLinks
        concepts={[
          { slug: 'how-banks-earn', label: '은행은 어떻게 돈을 버나' },
          { slug: 'bank-soundness', label: '은행 건전성' },
          { slug: 'base-rate-and-pricing', label: '기준금리와 금리 결정' },
        ]}
      />
    </>
  )
}
