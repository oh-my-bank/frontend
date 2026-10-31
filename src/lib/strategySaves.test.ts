import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildStrategyRequest, type StrategyRequest } from './strategy'
import {
  clearPendingInput,
  comparePath,
  deltaText,
  draftFromRequest,
  metricUnit,
  peekPendingInput,
  saveNameError,
  stashPendingInput,
} from './strategySaves'

const saved: StrategyRequest = {
  monthlyIncome: 3200000,
  monthlyExpense: 2000000,
  liquidAssets: 15000000,
  emergencyMonths: 6,
  taxFree: false,
  goals: [{ name: '여행 자금', targetAmount: 3000000, months: 5 }],
  loans: [{ name: '신용대출', balance: 3000000, annualRate: '7.500' }],
}

describe('saved strategy helpers', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('checks the name with the server rule', () => {
    expect(saveNameError('   ')).toBe('전략 이름을 입력해 주세요.')
    expect(saveNameError(' '.repeat(3) + '가'.repeat(40) + ' ')).toBeNull()
    expect(saveNameError('가'.repeat(41))).toContain('40자')
  })
  it('turns a saved input back into a draft that rebuilds the same request', () => {
    const draft = draftFromRequest(saved)
    expect(draft.monthlyIncome).toBe('3200000')
    expect(draft.goals[0]).toMatchObject({
      name: '여행 자금',
      targetAmount: '3000000',
      months: '5',
    })
    expect(buildStrategyRequest(draft)).toEqual({ request: saved, errors: {} })
  })
  it('signs the comparison delta and picks the unit', () => {
    expect(deltaText(200000, 'won')).toBe('+200,000원')
    expect(deltaText(-1200000, 'won')).toBe('−1,200,000원')
    expect(deltaText(0, 'won')).toBe('차이 없음')
    expect(deltaText(1, metricUnit('warningCount'))).toBe('+1개')
    expect(metricUnit('monthlySurplus')).toBe('won')
  })
  it('builds the compare location from two ids', () => {
    expect(comparePath('a', 'b')).toBe('/strategy/saves/compare?left=a&right=b')
  })
  it('keeps the pending input across the login detour and tolerates missing storage', () => {
    const store = new Map<string, string>()
    vi.stubGlobal('window', {
      sessionStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => store.set(key, value),
        removeItem: (key: string) => store.delete(key),
      },
    })
    stashPendingInput(saved)
    expect(peekPendingInput()).toEqual(saved)
    expect(peekPendingInput()).toEqual(saved)
    clearPendingInput()
    expect(peekPendingInput()).toBeNull()
    vi.stubGlobal('window', {
      sessionStorage: {
        getItem: () => {
          throw new Error('blocked')
        },
        setItem: () => {
          throw new Error('blocked')
        },
        removeItem: () => {
          throw new Error('blocked')
        },
      },
    })
    expect(() => stashPendingInput(saved)).not.toThrow()
    expect(peekPendingInput()).toBeNull()
    expect(() => clearPendingInput()).not.toThrow()
  })
})
