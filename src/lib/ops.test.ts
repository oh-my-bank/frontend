import { describe, expect, it } from 'vitest'
import { countText, dayLabel, durationText, opsWindow, rejectReasonLabel } from './ops'

describe('staff dashboard display', () => {
  it('keeps the window to the offered choices', () => {
    expect(opsWindow('30')).toBe(30)
    expect(opsWindow('90')).toBe(90)
    expect(opsWindow(null)).toBe(14)
    expect(opsWindow('15')).toBe(14)
    expect(opsWindow('abc')).toBe(14)
    expect(opsWindow('-7')).toBe(14)
  })
  it('reads the mean review time in the largest useful units', () => {
    expect(durationText(null)).toBe('—')
    expect(durationText(0)).toBe('0초')
    expect(durationText(40)).toBe('40초')
    expect(durationText(125)).toBe('2분')
    expect(durationText(7200)).toBe('2시간')
    expect(durationText(7500)).toBe('2시간 5분')
    expect(durationText(86400)).toBe('1일')
    expect(durationText(97200)).toBe('1일 3시간')
  })
  it('labels counts, reasons and Seoul days without time-zone shifts', () => {
    expect(countText(1234)).toBe('1,234건')
    expect(rejectReasonLabel('DSR_LIMIT_EXCEEDED')).toBe('모의 DSR 기준 미충족')
    expect(rejectReasonLabel('OTHER')).toBe('OTHER')
    expect(dayLabel('2026-03-02')).toBe('3. 2.')
    expect(dayLabel('2026-12-31')).toBe('12. 31.')
  })
})
