import { ApiError } from './api'
import { rate, wonText } from './format'

/** One sandbox in `GET /simulation/sandboxes`, newest first. */
export interface SandboxListItem {
  id: string
  number: number
  status: 'ACTIVE' | 'CLOSED'
  ruleVersion: string
  startDate: string
  currentDate: string
  elapsedDays: number
  closedAt: string | null
  initialCash: number
  salaryReceived: number
  netInterest: number
  totalAssets: number
  accountCount: number
}
export interface SandboxPage {
  items: SandboxListItem[]
  /** Pass as `before` for the next page; `null` on the last page. */
  nextBefore: number | null
}

export interface EarlyCloseLoss {
  elapsedMonths: number
  elapsedDays: number
  appliedRate: string
  actualInterest: number
  actualTax: number
  contractRateInterest: number
  contractRateTax: number
  forgoneInterest: number
  forgoneNetInterest: number
}
export interface PostMaturity {
  maturityDate: string
  payout: number
  monthsAfterMaturity: number
  daysAfterMaturity: number
  appliedRate: string
  interest: number
  tax: number
  netInterest: number
  parkingInterest: number
  parkingTax: number
  parkingNetInterest: number
}
export interface Contribution {
  accountId: string
  name: string
  kind: string
  productCode: string
  annualRate: string
  status: string
  openedOn: string
  maturityDate: string | null
  closedOn: string | null
  /** Money transferred in; `null` for the parking account. */
  principal: number | null
  grossInterest: number
  tax: number
  netInterest: number
  /** Share of the sandbox's after-tax interest in percent, 2 decimals; `null` while it is 0. */
  sharePercent: string | null
  earlyClose: EarlyCloseLoss | null
  postMaturity: PostMaturity | null
}
/** Performance report SIM_REPORT_V1 of `GET /simulation/sandboxes/{id}/report`. */
export interface SimulationReport {
  sandboxId: string
  number: number
  status: 'ACTIVE' | 'CLOSED'
  ruleVersion: string
  reportRuleVersion: string
  startDate: string
  endDate: string
  elapsedDays: number
  totals: {
    initialCash: number
    salaryReceived: number
    contributed: number
    grossInterest: number
    tax: number
    netInterest: number
    finalAssets: number
    parkingBalance: number
    savingsBalance: number
    accruedParkingInterest: string
  }
  earlyClose: {
    count: number
    contractRateInterest: number
    actualInterest: number
    forgoneInterest: number
    forgoneNetInterest: number
  }
  postMaturity: {
    count: number
    interest: number
    netInterest: number
    parkingInterest: number
    parkingNetInterest: number
  }
  contributions: Contribution[]
  parkingRate: string
  postMaturityRule: { minMonths: number; ratioOfContractRate: string }[]
}

export const HISTORY_PAGE_SIZE = 20

export function historyPath(before: number | null, limit = HISTORY_PAGE_SIZE) {
  const query = new URLSearchParams({ limit: String(limit) })
  if (before !== null) query.set('before', String(before))
  return `/simulation/sandboxes?${query.toString()}`
}

export const sandboxStatusLabel = (status: string) =>
  status === 'ACTIVE' ? '진행 중' : status === 'CLOSED' ? '종료' : status

/** `"65.10"` → `65.10%`; no share while the sandbox has earned nothing. */
export const sharePercent = (value: string | null) => (value === null ? '-' : `${value}%`)

/** `0.50` → `약정 금리 × 50%`, the way the screen states a post-maturity tier. */
export function postMaturityTierLabel(
  tier: { minMonths: number; ratioOfContractRate: string },
  next?: { minMonths: number },
) {
  const ratio = Math.round(Number(tier.ratioOfContractRate) * 100)
  const range =
    next === undefined
      ? `만기 후 ${tier.minMonths}개월 이상`
      : tier.minMonths === 0
        ? `만기 후 ${next.minMonths}개월 미만`
        : `만기 후 ${tier.minMonths}개월 이상 ${next.minMonths}개월 미만`
  return { range, rate: `약정 금리 × ${ratio}%` }
}

/**
 * One sentence comparing the post-maturity what-if with the parking estimate, written from the
 * server's numbers only.
 */
export function postMaturitySummary(post: PostMaturity, parkingRate: string): string {
  if (post.daysAfterMaturity === 0)
    return '보고서 기준일이 만기일이라 만기 후 경과 기간이 없습니다.'
  const gap = post.parkingNetInterest - post.netInterest
  const head = `만기 후 ${post.daysAfterMaturity}일 동안 찾지 않고 두었다면 만기후이율 연 ${rate(post.appliedRate)}%로 세후 ${wonText(post.netInterest)}입니다.`
  const parking = `같은 기간 파킹통장 금리(연 ${rate(parkingRate)}%)라면 세후 ${wonText(post.parkingNetInterest)}으로`
  if (gap > 0) return `${head} ${parking} ${wonText(gap)} 더 많습니다.`
  if (gap < 0) return `${head} ${parking} ${wonText(-gap)} 적습니다.`
  return `${head} ${parking} 같습니다.`
}

export function isNotFound(error: unknown) {
  return error instanceof ApiError && error.status === 404
}
