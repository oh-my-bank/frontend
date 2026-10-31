import { describe, expect, it } from 'vitest'
import { calculatorInfo, calculatorKinds, isCalculatorKind } from './learning'
import { normalizeDelta, ratePathText, samplePayments, signedWon } from './rateScenario'

describe('rate change input', () => {
  it('sends a signed percentage-point change as the decimal string the API accepts', () => {
    expect(normalizeDelta('1')).toBe('1')
    expect(normalizeDelta('+1.5')).toBe('+1.5')
    expect(normalizeDelta(' -0.25 ')).toBe('-0.25')
    expect(normalizeDelta('−0.5')).toBe('-0.5')
    expect(normalizeDelta('.5%p')).toBe('0.5')
    expect(normalizeDelta('-02.000')).toBe('-2.000')
  })
  it('rejects text that is not a number with at most three decimals', () => {
    expect(normalizeDelta('')).toBeNull()
    expect(normalizeDelta('+')).toBeNull()
    expect(normalizeDelta('1.2345')).toBeNull()
    expect(normalizeDelta('--1')).toBeNull()
    expect(normalizeDelta('1e1')).toBeNull()
    expect(normalizeDelta('일')).toBeNull()
  })
})

describe('comparison text', () => {
  it('signs won differences so a rise and a fall read apart', () => {
    expect(signedWon(423000)).toBe('+423,000원')
    expect(signedWon(-56797902)).toBe('−56,797,902원')
    expect(signedWon(0)).toBe('0원')
  })
  it('describes a rate path by installment range', () => {
    const format = (rate: string) => String(Number(rate))
    expect(
      ratePathText(
        [
          { fromInstallment: 1, toInstallment: 12, annualRate: '4.000' },
          { fromInstallment: 13, toInstallment: 13, annualRate: '5.000' },
        ],
        format,
      ),
    ).toBe('1~12회 4%, 13회 5%')
  })
})

describe('payment line points', () => {
  it('keeps every payment of a short schedule', () => {
    expect(samplePayments([3, 2, 1])).toEqual([
      [1, 3],
      [2, 2],
      [3, 1],
    ])
  })
  it('thins a long schedule but keeps the last installment and both sides of each rate change', () => {
    const payments = Array.from({ length: 360 }, (_, index) => (index < 12 ? 100 : 120))
    const points = samplePayments(payments, [1, 13])
    expect(points.length).toBeLessThanOrEqual(125)
    expect(points[0]).toEqual([1, 100])
    expect(points).toContainEqual([12, 100])
    expect(points).toContainEqual([13, 120])
    expect(points[points.length - 1]).toEqual([360, 120])
    const installments = points.map(([installment]) => installment)
    expect(installments).toEqual([...installments].sort((a, b) => a - b))
  })
})

describe('calculator list', () => {
  it('routes the variable-rate and scenario calculators with their own titles', () => {
    expect(calculatorKinds).toEqual([
      'deposit',
      'savings',
      'loan',
      'dsr',
      'goal',
      'variable-loan',
      'rate-scenario',
    ])
    expect(isCalculatorKind('rate-scenario')).toBe(true)
    expect(isCalculatorKind('rate')).toBe(false)
    expect(calculatorInfo['variable-loan'].title).toBe('거치·변동금리 대출 계산기')
    expect(calculatorInfo['rate-scenario'].concepts.map((concept) => concept.slug)).toContain(
      'base-rate-and-pricing',
    )
  })
})
