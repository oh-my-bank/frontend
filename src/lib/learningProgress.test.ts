import { describe, expect, it } from 'vitest'
import { continueReasonLabel, progressBadges, type ConceptProgress } from './learningProgress'

const base: ConceptProgress = {
  slug: 'time-deposits',
  title: '정기예금',
  category: 'DEPOSITS',
  order: 5,
  questionCount: 3,
  completed: false,
  completedAt: null,
  attempts: 0,
  bestCorrect: null,
  bestTotal: null,
  stale: false,
  mastered: false,
  lastCorrect: null,
  lastTotal: null,
  lastAttemptedAt: null,
}

describe('learning progress badges', () => {
  it('shows nothing before the first record', () => {
    expect(progressBadges(undefined)).toEqual([])
    expect(progressBadges(base)).toEqual([])
  })
  it('shows the best server-graded score until it is perfect', () => {
    expect(progressBadges({ ...base, attempts: 2, bestCorrect: 2, bestTotal: 3 })).toEqual([
      '최고 2/3',
    ])
    expect(
      progressBadges({ ...base, attempts: 3, bestCorrect: 3, bestTotal: 3, mastered: true }),
    ).toEqual(['만점'])
  })
  it('marks a best score from an older content version and lists completion first', () => {
    expect(
      progressBadges({ ...base, completed: true, bestCorrect: 3, bestTotal: 3, stale: true }),
    ).toEqual(['학습 완료', '이전 버전 최고 3/3'])
  })
  it('explains why a concept is suggested next', () => {
    expect(continueReasonLabel('IN_PROGRESS')).toBe('최근에 문제를 푼 개념')
    expect(continueReasonLabel('NEXT_IN_ORDER')).toBe('아직 학습하지 않은 다음 개념')
  })
})
