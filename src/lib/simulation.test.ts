import { describe, expect, it } from 'vitest'
import { ApiError } from './api'
import {
  accountStatus,
  advanceBody,
  installmentStatus,
  productLabel,
  reusesRequestKey,
  simDate,
  simulationErrorMessage,
  simulationPrefill,
  simulationPrefillLocation,
  subscribableProducts,
  transactionTypeLabel,
} from './simulation'
import type { RuleProduct } from './learning'

describe('time advance request', () => {
  it('turns each advance button into the API unit and count', () => {
    expect(advanceBody('7D')).toEqual({ unit: 'DAY', count: 7 })
    expect(advanceBody('12M')).toEqual({ unit: 'MONTH', count: 12 })
  })
  it('sends nothing for a step the screen does not offer', () => {
    expect(advanceBody('2Y')).toBeNull()
  })
})

describe('labels for server codes', () => {
  it('shows an unknown code as itself with a neutral tone', () => {
    expect(accountStatus('FROZEN')).toEqual({ label: 'FROZEN', tone: 'info' })
    expect(installmentStatus('WAIVED')).toEqual({ label: 'WAIVED', tone: 'info' })
    expect(transactionTypeLabel('FEE')).toBe('FEE')
  })
  it('marks a missed installment and an early close as warnings', () => {
    expect(installmentStatus('MISSED').tone).toBe('warn')
    expect(accountStatus('CLOSED_EARLY').tone).toBe('warn')
  })
  it('names rate-table products by kind and term and leaves other codes alone', () => {
    expect(productLabel('TD_12')).toBe('정기예금 12개월')
    expect(productLabel('IS_6')).toBe('적금 6개월')
    expect(productLabel('PARKING')).toBe('파킹통장')
    expect(productLabel('BOND_3')).toBe('BOND_3')
    expect(productLabel(null)).toBe('')
  })
})

describe('sandbox prefill from the strategy screen', () => {
  it('uses router state and defaults the payday to the 25th', () => {
    const { draft, adjusted, prefilled } = simulationPrefill({
      simulationPrefill: { initialCash: 15000000, monthlyIncome: 3200000 },
    })
    expect(draft).toEqual({ initialCash: '15000000', monthlyIncome: '3200000', payday: '25' })
    expect(adjusted).toEqual([])
    expect(prefilled).toBe(true)
  })
  it('falls back to the query kept through a sign-in redirect', () => {
    const { draft } = simulationPrefill(null, '?initialCash=5000000&monthlyIncome=2000000')
    expect(draft).toEqual({ initialCash: '5000000', monthlyIncome: '2000000', payday: '25' })
  })
  it('caps amounts above the sandbox limits and reports which ones', () => {
    const { draft, adjusted } = simulationPrefill({
      simulationPrefill: { initialCash: 5000000000, monthlyIncome: 300000000, payday: 31 },
    })
    expect(draft).toEqual({ initialCash: '1000000000', monthlyIncome: '100000000', payday: '25' })
    expect(adjusted).toEqual(['initialCash', 'monthlyIncome'])
  })
  it('ignores negative, fractional and missing values', () => {
    const { draft, prefilled } = simulationPrefill({
      simulationPrefill: { initialCash: -1, monthlyIncome: 1.5 },
    })
    expect(draft).toEqual({ initialCash: '', monthlyIncome: '', payday: '25' })
    expect(prefilled).toBe(false)
    expect(simulationPrefill(undefined).prefilled).toBe(false)
  })
  it('round-trips the location the strategy screen builds', () => {
    const target = simulationPrefillLocation(12000000, 3000000)
    const [, search] = target.to.split('?')
    expect(simulationPrefill(target.state).draft).toEqual(
      simulationPrefill(null, `?${search}`).draft,
    )
  })
})

describe('idempotency key reuse after a failure', () => {
  it('keeps the key when the outcome is unknown', () => {
    expect(reusesRequestKey(new ApiError('NETWORK_ERROR', 'offline'))).toBe(true)
    expect(reusesRequestKey(new ApiError('HTTP_502', 'bad gateway', 502))).toBe(true)
    expect(reusesRequestKey(new TypeError('failed'))).toBe(true)
  })
  it('starts over after a definite rejection so a fixed balance is not answered from replay', () => {
    expect(reusesRequestKey(new ApiError('INSUFFICIENT_BALANCE', 'short', 409))).toBe(false)
    expect(reusesRequestKey(new ApiError('VALIDATION_ERROR', 'bad', 400))).toBe(false)
  })
})

describe('simulation error guidance', () => {
  it('explains known codes and leaves others to the server message', () => {
    expect(simulationErrorMessage(new ApiError('INSUFFICIENT_BALANCE', 'x', 409))).toContain(
      '파킹통장 잔액',
    )
    expect(simulationErrorMessage(new ApiError('SOMETHING_NEW', 'x', 409))).toBeUndefined()
    expect(simulationErrorMessage(null)).toBeUndefined()
  })
})

describe('products a sandbox can open', () => {
  it('leaves out the parking account and codes outside the TD/IS table', () => {
    const product = (code: string, kind: RuleProduct['kind']): RuleProduct => ({
      code,
      kind,
      name: code,
      termMonths: 12,
      annualRate: '3.000',
      minAmount: 1,
      maxAmount: 2,
      assumption: true,
    })
    const products = [
      product('PARKING', 'PARKING'),
      product('TD_12', 'TIME_DEPOSIT'),
      product('IS_12', 'INSTALLMENT_SAVINGS'),
      product('TD_X', 'TIME_DEPOSIT'),
    ]
    expect(subscribableProducts(products).map((item) => item.code)).toEqual(['TD_12', 'IS_12'])
  })
})

describe('sandbox dates', () => {
  it('shows ISO dates with dots and a dash for none', () => {
    expect(simDate('2026-01-05')).toBe('2026.01.05')
    expect(simDate(null)).toBe('-')
  })
})
