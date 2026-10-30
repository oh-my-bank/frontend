import { describe, expect, it } from 'vitest'
import { ApiError } from './api'
import {
  commandMessage,
  fieldErrorsFrom,
  findActiveByName,
  isUncertain,
  orderedErrors,
  policyChanges,
  policyForm,
  publishOutcome,
  readPolicy,
  readProduct,
  rebasePolicyForm,
  type PolicyForm,
} from './adminProducts'
import type { AdminProduct, PolicyTerms, PolicyVersion } from '../types'

const terms: PolicyTerms = {
  annualInterestRate: '5.200',
  minAmount: 1000000,
  maxAmount: 50000000,
  minTermMonths: 12,
  maxTermMonths: 60,
  repaymentMethod: 'EQUAL_PRINCIPAL_AND_INTEREST',
  explanationVersion: 'simulation-v1',
}
const form = (changes: Partial<PolicyForm> = {}): PolicyForm => ({
  ...policyForm(terms),
  ...changes,
})
const version = (number: number, changes: Partial<PolicyTerms> = {}): PolicyVersion => ({
  ...terms,
  ...changes,
  version: number,
  createdAt: '2026-10-30T01:00:00Z',
})

describe('policy terms input', () => {
  it('sends the server’s normalized terms, accepting grouped won amounts', () => {
    expect(
      readPolicy(
        form({ annualInterestRate: ' 5.2 ', minAmount: '1,000,000', maxAmount: '50000000' }),
      ),
    ).toEqual({ errors: {}, terms })
  })
  it('accepts only 0~100 with at most three decimals, like the server', () => {
    for (const rate of ['0', '0.5', '5.125', '99.999', '100', '100.000']) {
      expect(readPolicy(form({ annualInterestRate: rate })).errors).toEqual({})
    }
    for (const rate of ['100.001', '101', '05', '1.2345', '-1', '+1', '1e2', '.5', '5.', '５']) {
      expect(readPolicy(form({ annualInterestRate: rate })).errors).toHaveProperty(
        'policy.annualInterestRate',
      )
    }
  })
  it('limits amounts and terms to the application API ceilings and whole numbers', () => {
    expect(readPolicy(form({ maxAmount: '10,000,000,000' })).errors).toEqual({})
    for (const amount of ['0', '10,000,000,001', '1,0000', '1.5', '100만']) {
      expect(readPolicy(form({ minAmount: amount })).errors).toHaveProperty('policy.minAmount')
    }
    expect(readPolicy(form({ minTermMonths: '1', maxTermMonths: '600' })).errors).toEqual({})
    expect(readPolicy(form({ maxTermMonths: '601' })).errors).toHaveProperty('policy.maxTermMonths')
  })
  it('reports a reversed range on the maximum input, the key the server uses', () => {
    const { errors, terms: sent } = readPolicy(
      form({ minAmount: '2,000', maxAmount: '1,000', minTermMonths: '24', maxTermMonths: '12' }),
    )
    expect(sent).toBeUndefined()
    expect(errors).toEqual({
      'policy.maxAmount': '최대 금액은 최소 금액 이상이어야 합니다.',
      'policy.maxTermMonths': '최대 기간은 최소 기간 이상이어야 합니다.',
    })
  })
  it('requires a product name and description that are not blank and within limits', () => {
    expect(readProduct('  ', '', form()).errors).toMatchObject({
      name: '상품명을 입력해 주세요.',
      description: '상품 설명을 입력해 주세요.',
    })
    expect(readProduct('가'.repeat(101), 'x', form()).errors).toHaveProperty('name')
    expect(readProduct(' OMB 대출 ', ' 설명 ', form()).input).toEqual({
      name: 'OMB 대출',
      description: '설명',
      policy: terms,
    })
  })
  it('orders errors like the form so the first invalid input receives focus', () => {
    const { errors } = readProduct('', 'x', form({ maxAmount: '1', explanationVersion: 'a b' }))
    expect(
      orderedErrors({ ...errors, 'policy.repaymentMethod': 'x' }).map(([path]) => path),
    ).toEqual(['name', 'policy.maxAmount', 'policy.explanationVersion', 'policy.repaymentMethod'])
  })
})

describe('policy publication', () => {
  it('lists only changed terms and treats 5.2 and 5.200 as the same rate', () => {
    expect(policyChanges(terms, { ...terms, annualInterestRate: '5.2' })).toEqual([])
    expect(
      policyChanges(terms, { ...terms, annualInterestRate: '4.900', maxAmount: 30000000 }),
    ).toEqual([
      { label: '연이율', before: '연 5.2%', after: '연 4.9%' },
      { label: '최대 금액', before: '5,000만원', after: '3,000만원' },
    ])
  })
  it('rebases on a newer policy without reverting the other administrator’s change', () => {
    const mine = form({ annualInterestRate: '4.5' })
    const latest = { ...terms, maxAmount: 30000000, explanationVersion: 'simulation-v2' }
    expect(rebasePolicyForm(mine, terms, latest)).toEqual({
      ...policyForm(latest),
      annualInterestRate: '4.5',
    })
    // An input this administrator left invalid is kept for them to correct.
    expect(rebasePolicyForm(form({ minAmount: 'abc' }), terms, latest).minAmount).toBe('abc')
  })
  it('judges an uncertain publication from the history instead of sending a new key', () => {
    const sent = { ...terms, annualInterestRate: '4.900' }
    expect(publishOutcome([version(1)], 1, sent)).toEqual({ state: 'not-applied' })
    expect(publishOutcome([version(2, sent), version(1)], 1, sent)).toEqual({
      state: 'applied',
      version: 2,
    })
    // Applied, then another administrator published again on top of it.
    expect(
      publishOutcome([version(3, { maxAmount: 1 }), version(2, sent), version(1)], 1, sent),
    ).toEqual({ state: 'applied', version: 2 })
    expect(publishOutcome([version(2, { maxAmount: 1 }), version(1)], 1, sent)).toEqual({
      state: 'superseded',
    })
  })
})

describe('administrator errors', () => {
  const apiError = (status: number, code: string, fieldErrors: Record<string, string> = {}) =>
    new ApiError(code, 'server message', status, 'trace', fieldErrors)

  it('treats only a missing or failed response as an uncertain change', () => {
    expect(isUncertain(new ApiError('NETWORK_ERROR', 'offline'))).toBe(true)
    expect(isUncertain(apiError(500, 'INTERNAL_ERROR'))).toBe(true)
    expect(isUncertain(apiError(502, 'HTTP_502'))).toBe(true)
    expect(isUncertain(new SyntaxError('Unexpected end of JSON input'))).toBe(true)
    for (const [status, code] of [
      [400, 'VALIDATION_ERROR'],
      [403, 'ACCESS_DENIED'],
      [409, 'POLICY_VERSION_CONFLICT'],
    ] as const)
      expect(isUncertain(apiError(status, code))).toBe(false)
  })
  it('maps server field errors to inputs and replaces English validator defaults', () => {
    expect(
      fieldErrorsFrom(
        apiError(400, 'VALIDATION_ERROR', {
          'policy.maxAmount': '최대 금액은 최소 금액 이상이어야 합니다.',
          'policy.minTermMonths': 'must be greater than or equal to 1',
          name: 'must not be blank',
        }),
      ),
    ).toEqual({
      'policy.maxAmount': '최대 금액은 최소 금액 이상이어야 합니다.',
      'policy.minTermMonths': '1개월부터 600개월까지 정수로 입력해 주세요.',
      name: '상품명은 공백이 아닌 100자 이내로 입력해 주세요.',
    })
    expect(fieldErrorsFrom(apiError(409, 'PRODUCT_NAME_DUPLICATE'))).toEqual({
      name: '판매 중인 상품 중 같은 이름이 있습니다. 다른 상품명을 입력해 주세요.',
    })
  })
  it('explains each conflict and an uncertain result for the command that was sent', () => {
    expect(commandMessage(apiError(409, 'POLICY_VERSION_CONFLICT'), 'publish')).toContain(
      '최신 정책을 다시 불러왔으니',
    )
    expect(commandMessage(apiError(409, 'POLICY_UNCHANGED'), 'publish')).toContain(
      '현재 정책과 같은 조건',
    )
    expect(commandMessage(apiError(409, 'PRODUCT_INACTIVE'), 'deactivate')).toContain(
      '이미 판매 중지된 상품',
    )
    expect(commandMessage(new ApiError('NETWORK_ERROR', 'offline'), 'create')).toContain(
      '같은 요청 키를 사용하므로 상품이 중복 등록되지 않습니다',
    )
    expect(commandMessage(apiError(400, 'INVALID_REQUEST'), 'create')).toBeUndefined()
  })
  it('finds a product on sale with the same name ignoring case, as the server compares names', () => {
    const product = (name: string, active: boolean) =>
      ({ id: name, name, active }) as unknown as AdminProduct
    const products = [product('OMB Loan', false), product('omb loan', true)]
    expect(findActiveByName(products, ' OMB LOAN ')?.id).toBe('omb loan')
    expect(findActiveByName([product('OMB Loan', false)], 'OMB Loan')).toBeUndefined()
  })
})
