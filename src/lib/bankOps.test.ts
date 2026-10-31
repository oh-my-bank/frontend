import { describe, expect, it } from 'vitest'
import { bankAmount, checkStatus, eokToWon, normalizeSignedRate, wonToEok } from './bankOps'

describe('amounts typed in 억원', () => {
  it('converts to whole won without floating point error', () => {
    expect(eokToWon('500,000')).toBe(50_000_000_000_000)
    expect(eokToWon('6,000')).toBe(600_000_000_000)
    expect(eokToWon('0.0001')).toBe(10_000)
    expect(eokToWon('1.1')).toBe(110_000_000)
    expect(eokToWon('.5')).toBe(50_000_000)
    expect(eokToWon('10,000,000')).toBe(1_000_000_000_000_000)
  })
  it('rejects text that is not a non-negative amount with at most four decimals', () => {
    expect(eokToWon('')).toBeNull()
    expect(eokToWon('.')).toBeNull()
    expect(eokToWon('-1')).toBeNull()
    expect(eokToWon('1.00001')).toBeNull()
    expect(eokToWon('1e3')).toBeNull()
    expect(eokToWon('99999999999')).toBeNull()
  })
  it('fills the form from whole won and reads back the same amount', () => {
    expect(wonToEok(115_000_000_000_000)).toBe('1,150,000')
    expect(wonToEok(12_345_670_000)).toBe('123.4567')
    expect(wonToEok(150_000_000)).toBe('1.5')
    for (const won of [600_000_000_000, 12_345_670_000, 10_000])
      expect(eokToWon(wonToEok(won))).toBe(won)
  })
})

describe('signed base rate change', () => {
  it('keeps the sign and at most three decimals', () => {
    expect(normalizeSignedRate('1')).toBe('1')
    expect(normalizeSignedRate('+1.25')).toBe('1.25')
    expect(normalizeSignedRate('-0.5%p')).toBe('-0.5')
    expect(normalizeSignedRate('−3')).toBe('-3')
    expect(normalizeSignedRate('-.75')).toBe('-0.75')
  })
  it('rejects malformed changes', () => {
    expect(normalizeSignedRate('')).toBeNull()
    expect(normalizeSignedRate('-')).toBeNull()
    expect(normalizeSignedRate('1.2345')).toBeNull()
    expect(normalizeSignedRate('--1')).toBeNull()
  })
})

describe('bank-scale amounts', () => {
  it('reads 조 and 억 units and keeps negative profits visible', () => {
    expect(bankAmount(1_460_000_000_000)).toBe('1조 4,600억원')
    expect(bankAmount(140_000_000_000_000)).toBe('140조원')
    expect(bankAmount(855_000_000_000)).toBe('8,550억원')
    expect(bankAmount(150_000_000)).toBe('1.5억원')
    expect(bankAmount(-57_509)).toBe('−57,509원')
  })
})

describe('check status', () => {
  const check = {
    code: 'LCR_MINIMUM',
    label: 'LCR 최저 기준',
    valuePercent: null,
    thresholdPercent: '100.00',
    comparison: 'MIN' as const,
    basis: 'REGULATION' as const,
    met: null,
  }
  it('names unmet minimums, exceeded maximums and values that cannot be computed', () => {
    expect(checkStatus(check).label).toBe('산출 불가')
    expect(checkStatus({ ...check, met: false }).label).toBe('기준 미달')
    expect(checkStatus({ ...check, comparison: 'MAX', met: false }).label).toBe('기준 초과')
    expect(checkStatus({ ...check, met: true }).tone).toBe('approved')
  })
})
