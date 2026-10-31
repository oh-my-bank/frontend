import { describe, expect, it } from 'vitest'
import { ApiError } from './api'
import {
  historyPath,
  isNotFound,
  postMaturitySummary,
  postMaturityTierLabel,
  sandboxStatusLabel,
  sharePercent,
  type PostMaturity,
} from './simulationHistory'

// Golden value S2 of docs/domain/banking-rules.md 5.6: the 12-month deposit of G16, 74 days after maturity.
const s2: PostMaturity = {
  maturityDate: '2027-01-05',
  payout: 5126900,
  monthsAfterMaturity: 2,
  daysAfterMaturity: 74,
  appliedRate: '0.900',
  interest: 9354,
  tax: 1430,
  netInterest: 7924,
  parkingInterest: 20788,
  parkingTax: 3200,
  parkingNetInterest: 17588,
}

describe('history paging', () => {
  it('asks for the first page without a cursor and later pages before the last number', () => {
    expect(historyPath(null)).toBe('/simulation/sandboxes?limit=20')
    expect(historyPath(3, 10)).toBe('/simulation/sandboxes?limit=10&before=3')
  })
  it('labels sandbox states and shows an unknown one as itself', () => {
    expect(sandboxStatusLabel('ACTIVE')).toBe('진행 중')
    expect(sandboxStatusLabel('CLOSED')).toBe('종료')
    expect(sandboxStatusLabel('ARCHIVED')).toBe('ARCHIVED')
  })
  it('treats only a 404 as a missing record', () => {
    expect(isNotFound(new ApiError('SANDBOX_NOT_FOUND', 'x', 404))).toBe(true)
    expect(isNotFound(new ApiError('HTTP_500', 'x', 500))).toBe(false)
  })
})

describe('report wording', () => {
  it('shows the server share as is and nothing before any interest', () => {
    expect(sharePercent('65.10')).toBe('65.10%')
    expect(sharePercent(null)).toBe('-')
  })
  it('states each post-maturity tier as a range and a share of the contract rate', () => {
    const tiers = [
      { minMonths: 0, ratioOfContractRate: '0.50' },
      { minMonths: 1, ratioOfContractRate: '0.30' },
      { minMonths: 3, ratioOfContractRate: '0.20' },
    ]
    expect(postMaturityTierLabel(tiers[0], tiers[1])).toEqual({
      range: '만기 후 1개월 미만',
      rate: '약정 금리 × 50%',
    })
    expect(postMaturityTierLabel(tiers[1], tiers[2])).toEqual({
      range: '만기 후 1개월 이상 3개월 미만',
      rate: '약정 금리 × 30%',
    })
    expect(postMaturityTierLabel(tiers[2])).toEqual({
      range: '만기 후 3개월 이상',
      rate: '약정 금리 × 20%',
    })
  })
  it('compares the post-maturity what-if with the parking estimate from server numbers', () => {
    expect(postMaturitySummary(s2, '2.000')).toBe(
      '만기 후 74일 동안 찾지 않고 두었다면 만기후이율 연 0.9%로 세후 7,924원입니다. 같은 기간 파킹통장 금리(연 2.0%)라면 세후 17,588원으로 9,664원 더 많습니다.',
    )
    expect(postMaturitySummary({ ...s2, parkingNetInterest: 7000 }, '2.000')).toMatch(
      /924원 적습니다\.$/,
    )
    expect(postMaturitySummary({ ...s2, daysAfterMaturity: 0 }, '2.000')).toContain(
      '경과 기간이 없습니다',
    )
  })
})
