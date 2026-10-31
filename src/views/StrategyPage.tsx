import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../stores/auth'
import { ApiError, request } from '../lib/api'
import { rate, won } from '../lib/format'
import { fetchRules, type Rules } from '../lib/learning'
import { productLabel, sandboxLimits, simulationPrefillLocation } from '../lib/simulation'
import {
  actionStatus,
  actionTypeLabel,
  buildStrategyRequest,
  monthlyAllocation,
  stepOfField,
  strategyFieldId,
  strategyFieldLabel,
  strategyLimits,
  strategySteps,
  type StrategyAction,
  type StrategyDraft,
  type StrategyPlan,
  type StrategyRequest,
} from '../lib/strategy'
import AppIcon from '../components/AppIcon'
import ErrorNotice from '../components/ErrorNotice'
import SimField from '../components/sim/SimField'
import StrategySavePanel from '../components/StrategySavePanel'
import AllocationChart from '../components/sim/AllocationChart'
import { clearPendingInput, draftFromRequest, peekPendingInput } from '../lib/strategySaves'
import '../styles/simulation.css'

const initialDraft: StrategyDraft = {
  monthlyIncome: '',
  monthlyExpense: '',
  liquidAssets: '',
  emergencyMonths: '6',
  taxFree: false,
  goals: [],
  loans: [],
}

/** A saved strategy's input (router state) or the input kept across the login detour fills the form. */
function prefilledDraft(state: unknown): StrategyDraft {
  const prefill = (state as { prefill?: StrategyRequest } | null)?.prefill ?? peekPendingInput()
  return prefill ? draftFromRequest(prefill) : initialDraft
}

export default function StrategyPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const [draft, setDraft] = useState<StrategyDraft>(() => prefilledDraft(location.state))
  const [step, setStep] = useState(0)
  const [shown, setShown] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<unknown>(null)
  const [plan, setPlan] = useState<{ result: StrategyPlan; input: StrategyRequest } | null>(null)
  const [rules, setRules] = useState<Rules | null>(null)
  const [rulesFailed, setRulesFailed] = useState(false)
  const nextKey = useRef(0)
  const focusTarget = useRef<string | null>(null)
  const validation = buildStrategyRequest(draft)

  useEffect(() => {
    const controller = new AbortController()
    fetchRules(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setRules(result)
      })
      .catch(() => {
        if (!controller.signal.aborted) setRulesFailed(true)
      })
    return () => controller.abort()
  }, [])
  useEffect(() => clearPendingInput(), [])
  useEffect(() => {
    if (!focusTarget.current) return
    document.getElementById(focusTarget.current)?.focus()
    focusTarget.current = null
  })

  const hideErrors = (drop: (path: string) => boolean) =>
    setShown((current) =>
      Object.fromEntries(Object.entries(current).filter(([path]) => !drop(path))),
    )
  const update = (path: string, patch: Partial<StrategyDraft>) => {
    setDraft((current) => ({ ...current, ...patch }))
    hideErrors((shownPath) => shownPath === path)
  }
  const updateGoal = (index: number, field: 'name' | 'targetAmount' | 'months', value: string) => {
    setDraft((current) => ({
      ...current,
      goals: current.goals.map((goal, at) => (at === index ? { ...goal, [field]: value } : goal)),
    }))
    hideErrors((path) => path === `goals[${index}].${field}`)
  }
  const updateLoan = (index: number, field: 'name' | 'balance' | 'annualRate', value: string) => {
    setDraft((current) => ({
      ...current,
      loans: current.loans.map((loan, at) => (at === index ? { ...loan, [field]: value } : loan)),
    }))
    hideErrors((path) => path === `loans[${index}].${field}`)
  }

  function showErrors(errors: Record<string, string>, steps: number[]) {
    setShown((current) => ({
      ...Object.fromEntries(
        Object.entries(current).filter(([path]) => !steps.includes(stepOfField(path))),
      ),
      ...errors,
    }))
    const first = Object.keys(errors)[0]
    if (first) {
      setStep(stepOfField(first))
      focusTarget.current = strategyFieldId(first)
    }
  }

  function next() {
    const stepErrors = Object.fromEntries(
      Object.entries(validation.errors).filter(([path]) => stepOfField(path) === step),
    )
    showErrors(stepErrors, [step])
    if (Object.keys(stepErrors).length) return
    setStep(step + 1)
    focusTarget.current = 'strategy-step-heading'
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (step < strategySteps.length - 1) {
      next()
      return
    }
    if (submitting) return
    if (!validation.request) {
      showErrors(validation.errors, [0, 1, 2, 3])
      return
    }
    const body = validation.request
    setSubmitting(true)
    setSubmitError(null)
    try {
      const result = await request<StrategyPlan>('/strategy/plan', { method: 'POST', body })
      setPlan({ result, input: body })
      focusTarget.current = 'strategy-result-title'
    } catch (cause) {
      setSubmitError(cause)
      if (cause instanceof ApiError && Object.keys(cause.fieldErrors).length)
        showErrors(cause.fieldErrors, [0, 1, 2, 3])
    } finally {
      setSubmitting(false)
    }
  }

  const stale =
    !!plan && JSON.stringify(plan.input) !== JSON.stringify(validation.request ?? undefined)
  const shownEntries = Object.entries(shown)
  const field = (path: string) => ({
    id: strategyFieldId(path),
    error: shown[path],
  })

  return (
    <>
      <section className="page-title">
        <div>
          <h1>나의 전략</h1>
          <p>
            소득·지출·자산·목표·대출을 넣으면 공개된 규칙에 따라 비상금 → 고금리 대출 → 목표별
            예·적금 순서로 실행 항목을 계산합니다.
          </p>
        </div>
        {user?.role === 'CUSTOMER' && (
          <Link className="button button-outline" to="/strategy/saves">
            <AppIcon name="list" size={16} /> 내 전략 목록·비교
          </Link>
        )}
      </section>
      <p className="notice sim-lead-notice">
        <AppIcon name="info" size={16} /> 교육용 규칙(BANK_STRATEGY_V1)의 계산 결과이며 실제
        금융상품 추천이나 투자 자문이 아닙니다. 입력값은 직접 저장하기 전에는 서버에 남기지
        않습니다.
      </p>

      <form className="sim-panel sim-strategy-form" onSubmit={submit} noValidate>
        <ol className="sim-steps" aria-label="전략 입력 단계">
          {strategySteps.map((label, index) => (
            <li key={label} className={index === step ? 'current' : index < step ? 'done' : ''}>
              <button
                type="button"
                onClick={() => setStep(index)}
                aria-current={index === step ? 'step' : undefined}
                disabled={submitting}
              >
                <span className="sim-step-number">{index + 1}</span>
                <span>{label}</span>
              </button>
            </li>
          ))}
        </ol>
        {shownEntries.length > 0 && (
          <div className="error-notice sim-error-summary" role="alert">
            <strong>입력 내용을 확인해 주세요. ({shownEntries.length}개 항목)</strong>
            <ul>
              {shownEntries.map(([path, message]) => (
                <li key={path}>
                  <button
                    type="button"
                    className="sim-link-button"
                    onClick={() => {
                      setStep(stepOfField(path))
                      focusTarget.current = strategyFieldId(path)
                    }}
                  >
                    {strategyFieldLabel(path)}
                  </button>
                  : {message}
                </li>
              ))}
            </ul>
          </div>
        )}
        <fieldset className="sim-fieldset" disabled={submitting} aria-busy={submitting}>
          <legend id="strategy-step-heading" tabIndex={-1}>
            {step + 1}단계. {strategySteps[step]}
          </legend>
          {step === 0 && (
            <div className="sim-form-grid">
              <SimField
                {...field('monthlyIncome')}
                label="월 실수령 소득"
                unit="원"
                money
                value={draft.monthlyIncome}
                onChange={(value) => update('monthlyIncome', { monthlyIncome: value })}
                help="세금·보험료를 뺀 뒤 통장에 들어오는 금액. 0원부터 10억 원까지."
              />
              <SimField
                {...field('monthlyExpense')}
                label="월 지출"
                unit="원"
                money
                value={draft.monthlyExpense}
                onChange={(value) => update('monthlyExpense', { monthlyExpense: value })}
                help="주거비·생활비·대출 상환액 등 매달 나가는 돈. 0원부터 10억 원까지."
              />
            </div>
          )}
          {step === 1 && (
            <div className="sim-form-grid">
              <SimField
                {...field('liquidAssets')}
                label="현금성 자산"
                unit="원"
                money
                value={draft.liquidAssets}
                onChange={(value) => update('liquidAssets', { liquidAssets: value })}
                help="지금 꺼내 쓸 수 있는 예금·통장 잔액. 0원부터 100억 원까지."
              />
              <SimField
                {...field('emergencyMonths')}
                label="비상금 개월 수"
                unit="개월"
                value={draft.emergencyMonths}
                onChange={(value) => update('emergencyMonths', { emergencyMonths: value })}
                help="월 지출의 몇 개월분을 비상금으로 둘지(3~12개월, 기본 6개월). 교육용 가정값입니다."
              />
              <label className="sim-check">
                <input
                  type="checkbox"
                  checked={draft.taxFree}
                  onChange={(event) => update('taxFree', { taxFree: event.target.checked })}
                />
                <span>
                  비과세로 계산
                  <small>
                    체크하지 않으면 이자소득세 15.4%를 뺀 세후 금액으로 계산합니다. 비과세 자격은
                    실제 제도에서 따로 확인해야 합니다.
                  </small>
                </span>
              </label>
            </div>
          )}
          {step === 2 && (
            <div className="sim-repeat">
              <p className="sim-help">
                목표는 최대 {strategyLimits.maxGoals}개, 목표액 10만 원~100억 원, 기간
                1~36개월입니다. 목표가 없으면 다음 단계로 넘어가세요.
              </p>
              {draft.goals.map((goal, index) => (
                <fieldset className="sim-repeat-item" key={goal.key}>
                  <legend>목표 {index + 1}</legend>
                  <SimField
                    {...field(`goals[${index}].name`)}
                    label="목표 이름"
                    inputMode="text"
                    maxLength={strategyLimits.maxNameLength}
                    value={goal.name}
                    onChange={(value) => updateGoal(index, 'name', value)}
                  />
                  <SimField
                    {...field(`goals[${index}].targetAmount`)}
                    label="목표액"
                    unit="원"
                    money
                    value={goal.targetAmount}
                    onChange={(value) => updateGoal(index, 'targetAmount', value)}
                  />
                  <SimField
                    {...field(`goals[${index}].months`)}
                    label="기간"
                    unit="개월"
                    value={goal.months}
                    onChange={(value) => updateGoal(index, 'months', value)}
                  />
                  <button
                    type="button"
                    className="button button-outline small sim-remove"
                    onClick={() => {
                      setDraft((current) => ({
                        ...current,
                        goals: current.goals.filter((_, at) => at !== index),
                      }))
                      hideErrors((path) => path.startsWith('goals'))
                    }}
                  >
                    <AppIcon name="close" size={14} /> 목표 {index + 1} 삭제
                  </button>
                </fieldset>
              ))}
              {draft.goals.length < strategyLimits.maxGoals && (
                <button
                  type="button"
                  className="button button-outline small"
                  onClick={() => {
                    const index = draft.goals.length
                    setDraft((current) => ({
                      ...current,
                      goals: [
                        ...current.goals,
                        {
                          key: `goal-${nextKey.current++}`,
                          name: '',
                          targetAmount: '',
                          months: '',
                        },
                      ],
                    }))
                    focusTarget.current = strategyFieldId(`goals[${index}].name`)
                  }}
                >
                  <AppIcon name="plus" size={14} /> 목표 추가
                </button>
              )}
            </div>
          )}
          {step === 3 && (
            <div className="sim-repeat">
              <p className="sim-help">
                보유 대출은 최대 {strategyLimits.maxLoans}건, 잔액 1원~100억 원, 연 금리 0~30%(소수
                셋째 자리까지)입니다. 대출이 없으면 바로 계산하세요.
              </p>
              {draft.loans.map((loan, index) => (
                <fieldset className="sim-repeat-item" key={loan.key}>
                  <legend>대출 {index + 1}</legend>
                  <SimField
                    {...field(`loans[${index}].name`)}
                    label="대출 이름"
                    inputMode="text"
                    maxLength={strategyLimits.maxNameLength}
                    value={loan.name}
                    onChange={(value) => updateLoan(index, 'name', value)}
                  />
                  <SimField
                    {...field(`loans[${index}].balance`)}
                    label="잔액"
                    unit="원"
                    money
                    value={loan.balance}
                    onChange={(value) => updateLoan(index, 'balance', value)}
                  />
                  <SimField
                    {...field(`loans[${index}].annualRate`)}
                    label="연 금리"
                    unit="%"
                    inputMode="decimal"
                    value={loan.annualRate}
                    onChange={(value) => updateLoan(index, 'annualRate', value)}
                  />
                  <button
                    type="button"
                    className="button button-outline small sim-remove"
                    onClick={() => {
                      setDraft((current) => ({
                        ...current,
                        loans: current.loans.filter((_, at) => at !== index),
                      }))
                      hideErrors((path) => path.startsWith('loans'))
                    }}
                  >
                    <AppIcon name="close" size={14} /> 대출 {index + 1} 삭제
                  </button>
                </fieldset>
              ))}
              {draft.loans.length < strategyLimits.maxLoans && (
                <button
                  type="button"
                  className="button button-outline small"
                  onClick={() => {
                    const index = draft.loans.length
                    setDraft((current) => ({
                      ...current,
                      loans: [
                        ...current.loans,
                        { key: `loan-${nextKey.current++}`, name: '', balance: '', annualRate: '' },
                      ],
                    }))
                    focusTarget.current = strategyFieldId(`loans[${index}].name`)
                  }}
                >
                  <AppIcon name="plus" size={14} /> 대출 추가
                </button>
              )}
            </div>
          )}
        </fieldset>
        <ErrorNotice error={submitError} />
        <div className="sim-form-actions">
          {step > 0 && (
            <button
              type="button"
              className="button button-outline"
              disabled={submitting}
              onClick={() => {
                setStep(step - 1)
                focusTarget.current = 'strategy-step-heading'
              }}
            >
              이전 단계
            </button>
          )}
          <button type="submit" className="button button-primary" disabled={submitting}>
            {step < strategySteps.length - 1
              ? '다음 단계'
              : submitting
                ? '계산 중…'
                : plan
                  ? '다시 계산'
                  : '전략 계산'}
            <AppIcon name="arrow" size={16} />
          </button>
        </div>
      </form>

      {plan && (
        <StrategyResult
          plan={plan.result}
          input={plan.input}
          stale={stale}
          rules={rules}
          rulesFailed={rulesFailed}
          onSimulate={() => {
            const target = simulationPrefillLocation(
              Math.min(plan.input.liquidAssets, sandboxLimits.initialCash),
              Math.min(plan.result.summary.monthlyIncome, sandboxLimits.monthlyIncome),
            )
            void navigate(target.to, { state: target.state })
          }}
        />
      )}
      {plan && (
        <StrategySavePanel key={JSON.stringify(plan.input)} input={plan.input} stale={stale} />
      )}
    </>
  )
}

export const warningLabels: Record<string, string> = {
  NEGATIVE_CASHFLOW: '여유자금 없음',
  DEPOSIT_PROTECTION_LIMIT: '예금자보호 한도',
}

function StrategyResult({
  plan,
  input,
  stale,
  rules,
  rulesFailed,
  onSimulate,
}: {
  plan: StrategyPlan
  input: StrategyRequest
  stale: boolean
  rules: Rules | null
  rulesFailed: boolean
  onSimulate: () => void
}) {
  const { summary } = plan
  const capped =
    input.liquidAssets > sandboxLimits.initialCash ||
    summary.monthlyIncome > sandboxLimits.monthlyIncome
  return (
    <section className="sim-result" aria-labelledby="strategy-result-title">
      <div className="section-heading">
        <div>
          <h2 id="strategy-result-title" tabIndex={-1}>
            전략 결과
          </h2>
          <p>
            규칙 {plan.ruleVersion} · 금리표 {plan.ratesVersion}(교육용 가정값)
          </p>
        </div>
      </div>
      {stale && (
        <p className="sim-stale" role="status">
          입력을 바꾸었습니다. 아래 결과는 이전 입력으로 계산한 것이며, 다시 계산하면 바뀝니다.
        </p>
      )}
      {plan.warnings.length > 0 && (
        <ul className="sim-warnings" aria-label="경고">
          {plan.warnings.map((warning) => (
            <li key={warning.code}>
              <strong>{warningLabels[warning.code] ?? '확인 필요'}</strong>
              <span>{warning.message}</span>
            </li>
          ))}
        </ul>
      )}
      <dl className="sim-summary">
        <div>
          <dt>월 여유자금</dt>
          <dd>{won(summary.monthlySurplus)}</dd>
        </div>
        <div>
          <dt>저축률</dt>
          <dd>{summary.savingsRatePercent === null ? '-' : `${summary.savingsRatePercent}%`}</dd>
        </div>
        <div>
          <dt>비상금 목표</dt>
          <dd>{won(summary.emergencyTarget)}</dd>
        </div>
        <div>
          <dt>현재 자산의 비상금 커버</dt>
          <dd>
            {summary.emergencyCoverageMonths === null
              ? '-'
              : `${summary.emergencyCoverageMonths}개월`}
          </dd>
        </div>
        <div>
          <dt>기준 금리(12개월 정기예금 세후)</dt>
          <dd>연 {rate(summary.benchmarkRate)}%</dd>
        </div>
        <div>
          <dt>월 배분 / 미배분</dt>
          <dd>
            {won(summary.allocatedMonthly)} / {won(summary.unallocatedMonthly)}
          </dd>
        </div>
      </dl>

      <h3 className="sim-subheading">실행 순서</h3>
      <ol className="sim-action-list">
        {plan.actions.map((action) => (
          <ActionItem key={action.order} action={action} />
        ))}
      </ol>

      <h3 className="sim-subheading">월 여유자금 배분</h3>
      <AllocationChart segments={monthlyAllocation(plan)} />

      <details className="sim-rates">
        <summary>사용한 모의 상품 금리표 (교육용 가정값)</summary>
        {rules ? (
          <div className="sim-table-wrap">
            <table className="sim-table">
              <caption className="sim-sr-only">모의 상품 금리표 {rules.ruleVersion}</caption>
              <thead>
                <tr>
                  <th scope="col">상품</th>
                  <th scope="col">기간</th>
                  <th scope="col" className="sim-number">
                    연 금리
                  </th>
                </tr>
              </thead>
              <tbody>
                {rules.products.map((product) => (
                  <tr key={product.code}>
                    <th scope="row" data-label="상품">
                      {product.name}
                    </th>
                    <td data-label="기간">
                      {product.termMonths === null ? '수시' : `${product.termMonths}개월`}
                    </td>
                    <td data-label="연 금리" className="sim-number">
                      {rate(product.annualRate)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="sim-help">
            {rulesFailed ? '금리표를 불러오지 못했습니다. ' : '금리표를 불러오고 있습니다. '}
            금리표는 <Link to="/tools">계산기</Link>에서도 볼 수 있습니다.
          </p>
        )}
        <p className="sim-help">
          특정 은행·시점의 고시 금리가 아니라 학습을 위해 정한 가정값입니다.
        </p>
      </details>

      <p className="notice">{plan.notice}</p>

      <div className="sim-next">
        <div>
          <h3>이 계획을 가상 시간으로 운용해 보기</h3>
          <p>
            현금성 자산을 초기 가상 자금으로, 월 소득을 월 가상 급여(급여일 25일)로 채운 모의 운용
            시작 화면으로 이동합니다. 고객 계정 로그인이 필요합니다.
            {capped &&
              ' 모의 운용 한도(초기 자금 10억 원, 월 급여 1억 원)를 넘는 금액은 한도로 맞춥니다.'}
          </p>
        </div>
        <button type="button" className="button button-primary" onClick={onSimulate}>
          이 계획으로 모의 운용 시작 <AppIcon name="arrow" size={16} />
        </button>
      </div>
    </section>
  )
}

export function ActionItem({ action }: { action: StrategyAction }) {
  const status = actionStatus(action.status)
  const target = action.goalName ?? action.loanName
  const facts: [string, string][] = []
  if (action.productCode) facts.push(['상품', productLabel(action.productCode)])
  if (action.amount !== null) facts.push(['금액', won(action.amount)])
  if (action.monthlyAmount !== null) facts.push(['필요 월 금액', won(action.monthlyAmount)])
  if (action.allocatedMonthly !== null) facts.push(['배분 월 금액', won(action.allocatedMonthly)])
  if (action.shortfallMonthly !== null) facts.push(['부족 월 금액', won(action.shortfallMonthly)])
  if (action.termMonths !== null) facts.push(['기간', `${action.termMonths}개월`])
  if (action.annualRate !== null) facts.push(['연 금리', `${rate(action.annualRate)}%`])
  if (action.expectedMaturityAfterTax !== null)
    facts.push(['세후 만기 예상', won(action.expectedMaturityAfterTax)])
  if (action.interestSavedPerYear !== null)
    facts.push(['연 절감 이자', won(action.interestSavedPerYear)])
  return (
    <li className={`sim-action tone-${status.tone}`}>
      <div className="sim-action-head">
        <span className="sim-action-order" aria-hidden="true">
          {action.order}
        </span>
        <div>
          <span className="sim-action-type">
            {actionTypeLabel(action.type)}
            {target && ` · ${target}`}
          </span>
          <h4>
            <span className="sim-sr-only">{action.order}번. </span>
            {action.title}
          </h4>
        </div>
        <span className={`sim-badge tone-${status.tone}`}>{status.label}</span>
      </div>
      {facts.length > 0 && (
        <dl className="sim-facts">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="sim-action-reason">{action.reason}</p>
      {action.conceptSlug && (
        <Link className="text-button" to={`/learn/${action.conceptSlug}`}>
          관련 개념 배우기 <AppIcon name="chevron" size={14} />
        </Link>
      )}
    </li>
  )
}
