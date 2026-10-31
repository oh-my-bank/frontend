import { request } from './api'

/** `GET /api/v1/ops/summary`: aggregates of stored rows only, readable by REVIEWER and ADMIN. */
export interface OpsSummary {
  generatedAt: string
  timeZone: string
  days: number
  from: string
  to: string
  applications: {
    total: number
    byStatus: { status: string; count: number }[]
    byProduct: { productId: string; productName: string; count: number }[]
  }
  reviews: {
    started: number
    inReview: number
    decided: number
    approved: number
    rejected: number
    ruleMet: number
    ruleNotMet: number
    rejectReasons: { reasonCode: string; count: number }[]
    /** Approved / decided with one decimal, null until a review is decided. */
    approvalRatePercent: string | null
    averageDecisionSeconds: number | null
  }
  daily: { date: string; received: number; decided: number }[]
}

export const OPS_WINDOWS = [7, 14, 30, 90] as const
export const DEFAULT_OPS_WINDOW = 14

export function fetchOpsSummary(days: number, signal?: AbortSignal) {
  return request<OpsSummary>(`/ops/summary?days=${days}`, { signal })
}

/** A window from the address bar, falling back to the default for anything the screen does not offer. */
export function opsWindow(value: string | null): number {
  const days = Number(value)
  return (OPS_WINDOWS as readonly number[]).includes(days) ? days : DEFAULT_OPS_WINDOW
}

export const countText = (value: number) => `${new Intl.NumberFormat('ko-KR').format(value)}건`

/** Mean review time in the largest units that keep it readable, e.g. 1일 3시간, 2시간 5분, 40초. */
export function durationText(seconds: number | null): string {
  if (seconds === null) return '—'
  const day = Math.floor(seconds / 86400)
  const hour = Math.floor((seconds % 86400) / 3600)
  const minute = Math.floor((seconds % 3600) / 60)
  if (day > 0) return hour > 0 ? `${day}일 ${hour}시간` : `${day}일`
  if (hour > 0) return minute > 0 ? `${hour}시간 ${minute}분` : `${hour}시간`
  if (minute > 0) return `${minute}분`
  return `${seconds}초`
}

export const rejectReasonLabel = (code: string) =>
  ({ DSR_LIMIT_EXCEEDED: '모의 DSR 기준 미충족', STAFF_DECISION: '담당자 종합 판단' })[code] ?? code

/** `2026-03-02` → `3. 2.` style short Seoul day without shifting it through a local time zone. */
export function dayLabel(date: string): string {
  const [, month, day] = date.split('-').map(Number)
  return `${month}. ${day}.`
}
