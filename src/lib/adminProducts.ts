import { ApiError } from './api'
import { koreanWon, rate, repaymentLabel } from './format'
import type { AdminProduct, PolicyTerms, PolicyVersion, ProductInput } from '../types'

export const MAX_AMOUNT = 10000000000
export const MAX_TERM_MONTHS = 600
export const MAX_NAME_LENGTH = 100
export const MAX_DESCRIPTION_LENGTH = 1000
// Same rules as the server (decision 0003): 0~100 with at most three decimals, no sign or exponent.
const rateFormat = /^(100(\.0{1,3})?|[1-9]?[0-9](\.[0-9]{1,3})?)$/
const explanationFormat = /^[A-Za-z0-9._-]{1,40}$/
const wholeNumberFormat = /^(\d+|\d{1,3}(,\d{3})+)$/
const grouped = new Intl.NumberFormat('ko-KR')

export type PolicyField =
  | 'annualInterestRate'
  | 'minAmount'
  | 'maxAmount'
  | 'minTermMonths'
  | 'maxTermMonths'
  | 'explanationVersion'
export type PolicyForm = Record<PolicyField, string>
/** Messages keyed by the API field path, such as `name` or `policy.maxAmount`. */
export type FieldErrors = Record<string, string>
export type AdminCommand = 'create' | 'publish' | 'deactivate' | 'reactivate' | 'details'

/** One stored version of a product's name and description, newest first in the history API. */
export interface ProductDetailVersion {
  version: number
  name: string
  description: string
  createdAt: string
}

const rules = {
  rate: '0~100 사이의 숫자를 소수점 셋째 자리까지 입력해 주세요.',
  amount: '1원부터 100억원까지 원 단위 정수로 입력해 주세요.',
  term: '1개월부터 600개월까지 정수로 입력해 주세요.',
  explanation: '영문·숫자·마침표(.)·밑줄(_)·하이픈(-)으로 40자 이내로 입력해 주세요.',
}
/** Form order, so the first invalid input can receive focus. */
export const fieldOrder = [
  'name',
  'description',
  'policy.annualInterestRate',
  'policy.minAmount',
  'policy.maxAmount',
  'policy.minTermMonths',
  'policy.maxTermMonths',
  'policy.explanationVersion',
]

export const fieldLabels: Record<string, string> = {
  name: '상품명',
  description: '상품 설명',
  'policy.annualInterestRate': '연이율',
  'policy.minAmount': '최소 금액',
  'policy.maxAmount': '최대 금액',
  'policy.minTermMonths': '최소 기간',
  'policy.maxTermMonths': '최대 기간',
  'policy.repaymentMethod': '상환 방식',
  'policy.explanationVersion': '설명서 버전',
  expectedCurrentVersion: '기준 정책 버전',
}

/** Input id for an API field path, so a server field error reaches the matching input. */
export const fieldId = (path: string) => `admin-${path.replace('.', '-')}`

/** Errors in form order; fields without an input, such as the repayment method, come last. */
export function orderedErrors(errors: FieldErrors) {
  const rank = (path: string) => (fieldOrder.includes(path) ? fieldOrder.indexOf(path) : 99)
  return Object.entries(errors).sort(([a], [b]) => rank(a) - rank(b))
}

export function policyForm(policy?: PolicyTerms): PolicyForm {
  return {
    annualInterestRate: policy?.annualInterestRate ?? '',
    minAmount: policy ? grouped.format(policy.minAmount) : '',
    maxAmount: policy ? grouped.format(policy.maxAmount) : '',
    minTermMonths: policy ? String(policy.minTermMonths) : '',
    maxTermMonths: policy ? String(policy.maxTermMonths) : '',
    explanationVersion: policy?.explanationVersion ?? '',
  }
}

/** '5.2' and '5.200' are the same policy rate on the server. */
export function normalizeRate(value: string) {
  const [whole, fraction = ''] = value.split('.')
  return `${whole}.${fraction.padEnd(3, '0')}`
}

/** Digits with optional thousands separators, e.g. 50000000 or 50,000,000. */
export function wholeNumber(value: string): number | null {
  const text = value.trim()
  if (!wholeNumberFormat.test(text)) return null
  const number = Number(text.replaceAll(',', ''))
  return Number.isSafeInteger(number) ? number : null
}

/** Mirrors the server rules so most mistakes are explained before a command is sent. */
export function readPolicy(form: PolicyForm): { terms?: PolicyTerms; errors: FieldErrors } {
  const errors: FieldErrors = {}
  const annualInterestRate = form.annualInterestRate.trim()
  if (!annualInterestRate) errors['policy.annualInterestRate'] = '연이율을 입력해 주세요.'
  else if (!rateFormat.test(annualInterestRate)) errors['policy.annualInterestRate'] = rules.rate
  const read = (field: PolicyField, label: string, max: number, rule: string) => {
    const text = form[field].trim()
    const value = wholeNumber(text)
    if (!text) errors[`policy.${field}`] = `${label}을 입력해 주세요.`
    else if (value === null || value < 1 || value > max) errors[`policy.${field}`] = rule
    return value ?? 0
  }
  const minAmount = read('minAmount', '최소 금액', MAX_AMOUNT, rules.amount)
  const maxAmount = read('maxAmount', '최대 금액', MAX_AMOUNT, rules.amount)
  if (!errors['policy.minAmount'] && !errors['policy.maxAmount'] && minAmount > maxAmount)
    errors['policy.maxAmount'] = '최대 금액은 최소 금액 이상이어야 합니다.'
  const minTermMonths = read('minTermMonths', '최소 기간', MAX_TERM_MONTHS, rules.term)
  const maxTermMonths = read('maxTermMonths', '최대 기간', MAX_TERM_MONTHS, rules.term)
  if (
    !errors['policy.minTermMonths'] &&
    !errors['policy.maxTermMonths'] &&
    minTermMonths > maxTermMonths
  )
    errors['policy.maxTermMonths'] = '최대 기간은 최소 기간 이상이어야 합니다.'
  const explanationVersion = form.explanationVersion.trim()
  if (!explanationVersion) errors['policy.explanationVersion'] = '설명서 버전을 입력해 주세요.'
  else if (!explanationFormat.test(explanationVersion))
    errors['policy.explanationVersion'] = rules.explanation
  if (Object.keys(errors).length) return { errors }
  return {
    errors,
    terms: {
      annualInterestRate: normalizeRate(annualInterestRate),
      minAmount,
      maxAmount,
      minTermMonths,
      maxTermMonths,
      repaymentMethod: 'EQUAL_PRINCIPAL_AND_INTEREST',
      explanationVersion,
    },
  }
}

/** Name and description rules shared by registration and the details edit (decision 0003). */
function readDetailFields(name: string, description: string) {
  const errors: FieldErrors = {}
  const trimmedName = name.trim()
  const trimmedDescription = description.trim()
  if (!trimmedName) errors.name = '상품명을 입력해 주세요.'
  else if (trimmedName.length > MAX_NAME_LENGTH)
    errors.name = '상품명은 100자 이내로 입력해 주세요.'
  if (!trimmedDescription) errors.description = '상품 설명을 입력해 주세요.'
  else if (trimmedDescription.length > MAX_DESCRIPTION_LENGTH)
    errors.description = '상품 설명은 1,000자 이내로 입력해 주세요.'
  return { name: trimmedName, description: trimmedDescription, errors }
}

/** A details edit; unchanged values are reported before sending, like the server's PRODUCT_DETAILS_UNCHANGED. */
export function readDetails(
  name: string,
  description: string,
  current: { name: string; description: string },
): { input?: { name: string; description: string }; errors: FieldErrors; unchanged?: boolean } {
  const read = readDetailFields(name, description)
  if (Object.keys(read.errors).length) return { errors: read.errors }
  if (read.name === current.name && read.description === current.description)
    return { errors: {}, unchanged: true }
  return { errors: {}, input: { name: read.name, description: read.description } }
}

/** Whether an uncertain details edit from `baseVersion` was applied, judged from the details history. */
export function detailsOutcome(
  history: ProductDetailVersion[],
  baseVersion: number,
  input: { name: string; description: string },
): { state: 'applied'; version: number } | { state: 'not-applied' | 'superseded' } {
  const newer = history.filter((item) => item.version > baseVersion)
  if (!newer.length) return { state: 'not-applied' }
  const mine = newer.find(
    (item) => item.name === input.name && item.description === input.description,
  )
  return mine ? { state: 'applied', version: mine.version } : { state: 'superseded' }
}

export type StatusFilter = 'all' | 'active' | 'inactive'
const statusFilters: StatusFilter[] = ['all', 'active', 'inactive']
export const MAX_SEARCH_LENGTH = 100

/** List view state kept in the URL, so a search survives reloads and the back button. */
export function listState(params: URLSearchParams): { status: StatusFilter; q: string } {
  const status = params.get('status') as StatusFilter | null
  return {
    status: status && statusFilters.includes(status) ? status : 'all',
    q: (params.get('q') ?? '').trim().slice(0, MAX_SEARCH_LENGTH),
  }
}

/** Admin list request; the server matches the name literally and ignores case. */
export function listPath(q: string) {
  const query = q.trim()
  return query ? `/admin/loan-products?q=${encodeURIComponent(query)}` : '/admin/loan-products'
}

export function readProduct(
  name: string,
  description: string,
  policy: PolicyForm,
): { input?: ProductInput; errors: FieldErrors } {
  const {
    name: trimmedName,
    description: trimmedDescription,
    errors,
  } = readDetailFields(name, description)
  const { terms, errors: policyErrors } = readPolicy(policy)
  Object.assign(errors, policyErrors)
  if (!terms || Object.keys(errors).length) return { errors }
  return { errors, input: { name: trimmedName, description: trimmedDescription, policy: terms } }
}

/** Display order and wording of policy terms in summaries, histories and change lists. */
export const policyRows: {
  key: keyof PolicyTerms
  label: string
  format: (terms: PolicyTerms) => string
}[] = [
  {
    key: 'annualInterestRate',
    label: '연이율',
    format: (t) => `연 ${rate(t.annualInterestRate)}%`,
  },
  { key: 'minAmount', label: '최소 금액', format: (t) => koreanWon(t.minAmount) },
  { key: 'maxAmount', label: '최대 금액', format: (t) => koreanWon(t.maxAmount) },
  { key: 'minTermMonths', label: '최소 기간', format: (t) => `${t.minTermMonths}개월` },
  { key: 'maxTermMonths', label: '최대 기간', format: (t) => `${t.maxTermMonths}개월` },
  { key: 'repaymentMethod', label: '상환 방식', format: (t) => repaymentLabel(t.repaymentMethod) },
  { key: 'explanationVersion', label: '설명서 버전', format: (t) => t.explanationVersion },
]

const comparable = (terms: PolicyTerms, key: keyof PolicyTerms) =>
  key === 'annualInterestRate' ? normalizeRate(terms.annualInterestRate) : String(terms[key])

/** Terms that differ, in display order; an empty list means the server would answer POLICY_UNCHANGED. */
export function policyChanges(current: PolicyTerms, next: PolicyTerms) {
  return policyRows
    .filter((row) => comparable(current, row.key) !== comparable(next, row.key))
    .map((row) => ({ label: row.label, before: row.format(current), after: row.format(next) }))
}

function sameInput(field: PolicyField, left: string, right: string) {
  const a = left.trim()
  const b = right.trim()
  if (field === 'explanationVersion') return a === b
  if (field === 'annualInterestRate')
    return rateFormat.test(a) && rateFormat.test(b)
      ? normalizeRate(a) === normalizeRate(b)
      : a === b
  const x = wholeNumber(a)
  return x === null ? a === b : x === wholeNumber(b)
}

/** Inputs whose value differs from the given policy, compared the way the server compares terms. */
export function changedFields(form: PolicyForm, base: PolicyTerms) {
  const before = policyForm(base)
  return (Object.keys(form) as PolicyField[]).filter(
    (field) => !sameInput(field, form[field], before[field]),
  )
}

/**
 * After another administrator publishes first, keeps only the fields this administrator changed
 * from the policy they started with and takes every other field from the latest policy.
 */
export function rebasePolicyForm(
  form: PolicyForm,
  previous: PolicyTerms,
  latest: PolicyTerms,
): PolicyForm {
  const edited = changedFields(form, previous)
  const after = policyForm(latest)
  const fields = Object.keys(form) as PolicyField[]
  return Object.fromEntries(
    fields.map((field) => [field, edited.includes(field) ? form[field] : after[field]]),
  ) as PolicyForm
}

const fallbackFieldMessages: FieldErrors = {
  name: '상품명은 공백이 아닌 100자 이내로 입력해 주세요.',
  description: '상품 설명은 공백이 아닌 1,000자 이내로 입력해 주세요.',
  'policy.annualInterestRate': rules.rate,
  'policy.minAmount': rules.amount,
  'policy.maxAmount': rules.amount,
  'policy.minTermMonths': rules.term,
  'policy.maxTermMonths': rules.term,
  'policy.repaymentMethod': '지원하는 상환 방식은 원리금균등분할상환입니다.',
  'policy.explanationVersion': rules.explanation,
  expectedCurrentVersion: '기준 정책 버전을 확인할 수 없습니다. 최신 정책을 다시 불러와 주세요.',
  expectedDetailVersion:
    '기준 상품 정보 버전을 확인할 수 없습니다. 최신 정보를 다시 불러와 주세요.',
}
const duplicateName = '판매 중인 상품 중 같은 이름이 있습니다. 다른 상품명을 입력해 주세요.'

/** Server field errors by path; English validator defaults are replaced with the Korean rule. */
export function fieldErrorsFrom(error: unknown): FieldErrors {
  if (!(error instanceof ApiError)) return {}
  if (error.code === 'PRODUCT_NAME_DUPLICATE') return { name: duplicateName }
  return Object.fromEntries(
    Object.entries(error.fieldErrors).map(([field, message]) => [
      field,
      /[가-힣]/.test(message)
        ? message
        : (fallbackFieldMessages[field] ?? '입력값을 확인해 주세요.'),
    ]),
  )
}

/** The change may have been applied: no response, a gateway or server failure, or an unreadable success. */
export function isUncertain(error: unknown) {
  return !(error instanceof ApiError) || error.code === 'NETWORK_ERROR' || error.status >= 500
}

const uncertainMessages: Record<AdminCommand, string> = {
  create:
    '등록 결과를 확인하지 못했습니다. 먼저 등록 여부를 확인해 주세요. 같은 내용으로 다시 보내면 같은 요청 키를 사용하므로 상품이 중복 등록되지 않습니다.',
  publish:
    '발행 결과를 확인하지 못했습니다. 먼저 반영 여부를 확인해 주세요. 같은 내용으로 다시 보내면 같은 요청 키를 사용하므로 정책이 중복 발행되지 않습니다.',
  deactivate:
    '판매 중지 결과를 확인하지 못했습니다. 먼저 반영 여부를 확인해 주세요. 다시 보내도 같은 요청 키를 사용하므로 중복 처리되지 않습니다.',
  reactivate:
    '판매 재개 결과를 확인하지 못했습니다. 먼저 반영 여부를 확인해 주세요. 다시 보내도 같은 요청 키를 사용하므로 중복 처리되지 않습니다.',
  details:
    '상품 정보 수정 결과를 확인하지 못했습니다. 먼저 반영 여부를 확인해 주세요. 같은 내용으로 다시 보내면 같은 요청 키를 사용하므로 중복 수정되지 않습니다.',
}
const codeMessages: Record<string, string> = {
  POLICY_VERSION_CONFLICT:
    '다른 관리자가 먼저 새 정책을 발행했습니다. 최신 정책을 다시 불러왔으니 변경 내용을 확인한 뒤 다시 발행해 주세요.',
  POLICY_UNCHANGED:
    '현재 정책과 같은 조건은 새 버전으로 발행할 수 없습니다. 바꿀 조건을 수정해 주세요.',
  PRODUCT_NAME_DUPLICATE: duplicateName,
  PRODUCT_INACTIVE: '이미 판매 중지된 상품이라 변경할 수 없습니다. 최신 상태를 다시 불러왔습니다.',
  PRODUCT_NOT_FOUND: '상품을 찾을 수 없습니다. 상품 목록에서 다시 선택해 주세요.',
  PRODUCT_ACTIVE: '이미 판매 중인 상품입니다. 최신 상태를 다시 불러왔습니다.',
  PRODUCT_DETAILS_VERSION_CONFLICT:
    '다른 관리자가 먼저 상품 정보를 수정했습니다. 최신 정보를 다시 불러왔으니 확인한 뒤 다시 수정해 주세요.',
  PRODUCT_DETAILS_UNCHANGED: '현재 상품 정보와 같습니다. 바꿀 상품명이나 설명을 입력해 주세요.',
  IDEMPOTENCY_CONFLICT:
    '같은 요청 키가 다른 내용으로 이미 사용되었습니다. 상품 목록에서 처리 여부를 확인한 뒤 다시 시도해 주세요.',
  VALIDATION_ERROR: '입력 내용을 확인해 주세요. 표시된 항목을 고친 뒤 다시 확인해 주세요.',
  ACCESS_DENIED: '보안 확인 정보를 새로 받았습니다. 내용을 확인한 뒤 다시 시도해 주세요.',
}

export function commandMessage(error: unknown, command: AdminCommand) {
  if (!error) return undefined
  if (isUncertain(error)) return uncertainMessages[command]
  if (
    command === 'reactivate' &&
    error instanceof ApiError &&
    error.code === 'PRODUCT_NAME_DUPLICATE'
  )
    return '판매 중인 다른 상품과 이름이 같아 다시 판매할 수 없습니다. 상품 정보 수정에서 이름을 먼저 바꿔 주세요.'
  return error instanceof ApiError ? codeMessages[error.code] : undefined
}

export function loadMessage(error: unknown) {
  if (!(error instanceof ApiError)) return undefined
  if (error.status === 403)
    return '운영 관리자 권한이 필요합니다. 로그인한 계정의 권한을 확인해 주세요.'
  if (error.status === 404 || error.code === 'INVALID_REQUEST')
    return codeMessages.PRODUCT_NOT_FOUND
  return undefined
}

/** Active product names are unique ignoring case, so a match means such a product is on sale now. */
export function findActiveByName(products: AdminProduct[], name: string) {
  const key = name.trim().toLowerCase()
  return products.find((product) => product.active && product.name.toLowerCase() === key)
}

/** Whether an uncertain publish from `baseVersion` was applied, judged from the version history. */
export function publishOutcome(
  history: PolicyVersion[],
  baseVersion: number,
  terms: PolicyTerms,
): { state: 'applied'; version: number } | { state: 'not-applied' | 'superseded' } {
  const newer = history.filter((policy) => policy.version > baseVersion)
  if (!newer.length) return { state: 'not-applied' }
  const mine = newer.find((policy) => policyChanges(policy, terms).length === 0)
  return mine ? { state: 'applied', version: mine.version } : { state: 'superseded' }
}
