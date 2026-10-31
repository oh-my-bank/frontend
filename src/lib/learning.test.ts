import { describe, expect, it } from 'vitest'
import {
  glossarySearch,
  normalizeRate,
  paragraphs,
  parseWholeNumber,
  visibleScheduleIndexes,
} from './learning'
import { pathTotals } from './learningPath'

describe('rate input', () => {
  it('sends the typed rate as a decimal string the API accepts', () => {
    expect(normalizeRate('3')).toBe('3')
    expect(normalizeRate(' 3.5 ')).toBe('3.5')
    expect(normalizeRate('5.125')).toBe('5.125')
    expect(normalizeRate('.5')).toBe('0.5')
    expect(normalizeRate('03.0')).toBe('3.0')
    expect(normalizeRate('2.8%')).toBe('2.8')
  })
  it('rejects text that is not a non-negative rate with at most three decimals', () => {
    expect(normalizeRate('')).toBeNull()
    expect(normalizeRate('.')).toBeNull()
    expect(normalizeRate('-1')).toBeNull()
    expect(normalizeRate('3.1234')).toBeNull()
    expect(normalizeRate('1e2')).toBeNull()
    expect(normalizeRate('삼')).toBeNull()
  })
})

describe('amount input', () => {
  it('reads whole numbers typed with thousands separators', () => {
    expect(parseWholeNumber('10,000,000')).toBe(10000000)
    expect(parseWholeNumber(' 500 000 ')).toBe(500000)
    expect(parseWholeNumber('0')).toBe(0)
  })
  it('rejects decimals, signs, blanks and unsafe integers', () => {
    expect(parseWholeNumber('')).toBeNull()
    expect(parseWholeNumber('1.5')).toBeNull()
    expect(parseWholeNumber('-1')).toBeNull()
    expect(parseWholeNumber('99999999999999999')).toBeNull()
  })
})

describe('glossary query string', () => {
  it('omits a blank search and the all-categories filter', () => {
    expect(glossarySearch('', '')).toBe('')
    expect(glossarySearch('   ', '')).toBe('')
    expect(glossarySearch('', 'LOANS')).toBe('?category=LOANS')
  })
  it('encodes the search text and keeps the category', () => {
    expect(glossarySearch('예금 보호', 'PROTECTION')).toBe(
      '?q=%EC%98%88%EA%B8%88+%EB%B3%B4%ED%98%B8&category=PROTECTION',
    )
    expect(new URLSearchParams(glossarySearch('DSR&LTV', '')).get('q')).toBe('DSR&LTV')
  })
})

describe('loan schedule rows', () => {
  it('shows every installment of a short schedule', () => {
    expect(visibleScheduleIndexes(13, false)).toHaveLength(13)
    expect(visibleScheduleIndexes(0, false)).toEqual([])
  })
  it('shows the first twelve and the last installment of a long schedule until expanded', () => {
    expect(visibleScheduleIndexes(36, false)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 35])
    expect(visibleScheduleIndexes(36, true)).toHaveLength(36)
  })
})

describe('content paragraphs', () => {
  it('splits a body at blank lines and drops empty paragraphs', () => {
    expect(paragraphs('첫 문단이다.\n\n둘째 문단이다.\n  \n셋째.\n\n')).toEqual([
      '첫 문단이다.',
      '둘째 문단이다.',
      '셋째.',
    ])
  })
})

describe('learning path totals', () => {
  it('summarises a stage or the whole path in one line', () => {
    expect(pathTotals({ conceptCount: 3, readMinutes: 15, questionCount: 9 })).toBe(
      '개념 3개 · 15분 · 확인 문제 9문항',
    )
  })
})
