import { request } from './api'
import type { CategoryCode, Level, RelatedTool } from './learning'

/** Contract: GET /api/v1/learning/path (R06). Concepts are numbered in path order. */
export interface PathConcept {
  slug: string
  order: number
  category: CategoryCode
  categoryLabel: string
  level: Level
  title: string
  readMinutes: number
  questionCount: number
}
export interface PathStage {
  order: number
  code: string
  title: string
  goal: string
  concepts: PathConcept[]
  practice: RelatedTool[]
  readMinutes: number
  questionCount: number
}
export interface LearningPath {
  code: string
  title: string
  description: string | null
  stages: PathStage[]
  conceptCount: number
  readMinutes: number
  questionCount: number
}

export const fetchLearningPath = (signal?: AbortSignal) =>
  request<LearningPath>('/learning/path', { signal })

/** One line of totals for a stage or the whole path, e.g. "개념 3개 · 15분 · 확인 문제 9문항". */
export function pathTotals(totals: {
  conceptCount: number
  readMinutes: number
  questionCount: number
}): string {
  return `개념 ${totals.conceptCount}개 · ${totals.readMinutes}분 · 확인 문제 ${totals.questionCount}문항`
}
