import { request } from './api'
import type { CategoryCode } from './learning'

/** Contract: requirement R05 (docs-out/R05-learning-progress.md). CUSTOMER only; scores are graded and stored by the server. */
export interface ConceptProgress {
  slug: string
  title: string
  category: CategoryCode
  order: number
  questionCount: number
  completed: boolean
  completedAt: string | null
  attempts: number
  bestCorrect: number | null
  bestTotal: number | null
  /** The best score was graded against an older content version and no longer counts as mastered. */
  stale: boolean
  mastered: boolean
  lastCorrect: number | null
  lastTotal: number | null
  lastAttemptedAt: string | null
}
export interface CategoryProgress {
  code: CategoryCode
  label: string
  total: number
  completed: number
  mastered: number
}
export interface LearningProgress {
  totalConcepts: number
  completedCount: number
  masteredCount: number
  attemptedCount: number
  categories: CategoryProgress[]
  items: ConceptProgress[]
  continueWith: { slug: string; title: string; reason: 'IN_PROGRESS' | 'NEXT_IN_ORDER' } | null
}

export const fetchLearningProgress = (signal?: AbortSignal) =>
  request<LearningProgress>('/learning/progress', { signal })
const completionPath = (slug: string) =>
  `/learning/progress/concepts/${encodeURIComponent(slug)}/completion`
/** Repeatable marks: sending the same one twice changes nothing, so no idempotency key is needed. */
export const markConceptCompleted = (slug: string) =>
  request<ConceptProgress>(completionPath(slug), { method: 'PUT' })
export const clearConceptCompleted = (slug: string) =>
  request<ConceptProgress>(completionPath(slug), { method: 'DELETE' })

/** Short status labels for a concept row, in display order; empty before any record exists. */
export function progressBadges(item: ConceptProgress | undefined): string[] {
  if (!item) return []
  const badges: string[] = []
  if (item.completed) badges.push('학습 완료')
  if (item.mastered) badges.push('만점')
  else if (item.bestCorrect !== null && item.bestTotal !== null)
    badges.push(
      item.stale
        ? `이전 버전 최고 ${item.bestCorrect}/${item.bestTotal}`
        : `최고 ${item.bestCorrect}/${item.bestTotal}`,
    )
  return badges
}

export const continueReasonLabel = (reason: 'IN_PROGRESS' | 'NEXT_IN_ORDER') =>
  reason === 'IN_PROGRESS' ? '최근에 문제를 푼 개념' : '아직 학습하지 않은 다음 개념'
