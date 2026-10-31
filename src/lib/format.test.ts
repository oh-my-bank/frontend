import { describe, expect, it } from 'vitest'
import { isReviewApproved, koreanWon, rate } from './format'

describe('amount and rate display', () => {
  it('reads whole-won amounts exactly in Korean units', () => {
    expect(koreanWon(10000000000)).toBe('100억원')
    expect(koreanWon(50000000)).toBe('5,000만원')
    expect(koreanWon(1234567)).toBe('123만 4,567원')
    expect(koreanWon(100050000)).toBe('1억 5만원')
    expect(koreanWon(120050000)).toBe('1억 2,005만원')
    expect(koreanWon(1)).toBe('1원')
    expect(koreanWon(0)).toBe('0원')
  })
  it('shows a three-decimal policy rate without rounding it to two decimals', () => {
    expect(rate('5.125')).toBe('5.125')
    expect(rate('4.900')).toBe('4.9')
    expect(rate('6.000')).toBe('6.0')
  })
})

describe('review approval', () => {
  it('counts approved applications that moved on to agreement and repayment', () => {
    for (const status of ['APPROVED', 'AGREED', 'EXECUTED', 'REPAYING', 'PAID_OFF', 'WITHDRAWN'])
      expect(isReviewApproved(status)).toBe(true)
    for (const status of ['APPLIED', 'UNDER_REVIEW', 'REJECTED'])
      expect(isReviewApproved(status)).toBe(false)
  })
})
