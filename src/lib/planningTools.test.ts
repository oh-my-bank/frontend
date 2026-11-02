import { describe, expect, it } from 'vitest'
import { calculatorInfo, isCalculatorKind, relatedToolLinks } from './learning'
import {
  allocationChartNote,
  monthsToTargetText,
  normalizeSignedRate,
  pairedAmount,
  signedPercent,
} from './planningTools'

describe('signed rate input', () => {
  it('sends inflation, including deflation, as the decimal string the API accepts', () => {
    expect(normalizeSignedRate('2')).toBe('2')
    expect(normalizeSignedRate(' -1.5% ')).toBe('-1.5')
    expect(normalizeSignedRate('−0.25')).toBe('-0.25')
    expect(normalizeSignedRate('+3')).toBe('3')
    expect(normalizeSignedRate('.5')).toBe('0.5')
    expect(normalizeSignedRate('02.000')).toBe('2.000')
  })
  it('rejects text that is not a number with at most three decimals', () => {
    expect(normalizeSignedRate('')).toBeNull()
    expect(normalizeSignedRate('-')).toBeNull()
    expect(normalizeSignedRate('1.2345')).toBeNull()
    expect(normalizeSignedRate('--1')).toBeNull()
    expect(normalizeSignedRate('일')).toBeNull()
  })
  it('shows server percentages with a typographic minus', () => {
    expect(signedPercent('-1.270')).toBe('−1.270')
    expect(signedPercent('0.527')).toBe('0.527')
  })
})

describe('optional principal and term', () => {
  it('sends both or neither', () => {
    expect(pairedAmount(null, null)).toEqual({})
    expect(pairedAmount(10_000_000, 12)).toEqual({ principal: 10_000_000, termMonths: 12 })
    expect(pairedAmount(10_000_000, null)).toEqual({ error: 'termMonths' })
    expect(pairedAmount(null, 12)).toEqual({ error: 'principal' })
  })
})

describe('account plan text', () => {
  it('reads months to the target, including counts beyond 32-bit integers', () => {
    expect(monthsToTargetText(null)).toBe('여유자금이 없어 도달할 수 없음')
    expect(monthsToTargetText(0)).toBe('이미 도달')
    expect(monthsToTargetText(12)).toBe('12개월')
    expect(monthsToTargetText(11_999_999_988)).toBe('11,999,999,988개월')
  })
  it('says what the full bar is when spending exceeds income', () => {
    expect(allocationChartNote(0)).toContain('막대 전체가 월 소득')
    expect(allocationChartNote(200_000)).toContain('막대 전체가 월 지출 합계')
  })
})

describe('calculator registration', () => {
  it('routes both calculators with titles and existing concept links', () => {
    expect(isCalculatorKind('account-plan')).toBe(true)
    expect(isCalculatorKind('real-rate')).toBe(true)
    expect(calculatorInfo['account-plan'].title).toBe('계좌 설계 계산기')
    expect(calculatorInfo['real-rate'].title).toBe('실질금리 계산기')
    expect(calculatorInfo['account-plan'].concepts.map((c) => c.slug)).toContain('saving-strategy')
    expect(calculatorInfo['real-rate'].concepts.map((c) => c.slug)).toContain('interest-tax')
  })
  it('lets learning content point at both calculators', () => {
    expect(relatedToolLinks['account-plan'].to).toBe('/tools/account-plan')
    expect(relatedToolLinks['real-rate'].to).toBe('/tools/real-rate')
  })
})
