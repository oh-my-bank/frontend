import { describe, expect, it } from 'vitest'
import { ApiError } from './api'
import {
  actionLabel,
  auditLoadMessage,
  auditQuery,
  emptyFilter,
  filterFromParams,
  filterToParams,
  hasFilter,
  roleLabel,
  stateParts,
  targetLink,
  validateFilter,
} from './auditLogs'

const id = '10000000-0000-0000-0000-000000000003'

describe('audit log filter', () => {
  it('turns Seoul calendar days into an inclusive start and an exclusive next-midnight end', () => {
    const query = new URLSearchParams(
      auditQuery({ ...emptyFilter, fromDate: '2026-10-01', toDate: '2026-10-31' }).slice(1),
    )
    expect(query.get('from')).toBe('2026-09-30T15:00:00.000Z')
    expect(query.get('to')).toBe('2026-10-31T15:00:00.000Z')
    expect(query.get('limit')).toBe('50')
    expect(query.has('cursor')).toBe(false)
  })

  it('crosses month and year ends for the exclusive end', () => {
    const query = new URLSearchParams(
      auditQuery({ ...emptyFilter, toDate: '2026-12-31' }, 'abc', 10).slice(1),
    )
    expect(query.get('to')).toBe('2026-12-31T15:00:00.000Z')
    expect(query.get('cursor')).toBe('abc')
    expect(query.get('limit')).toBe('10')
  })

  it('sends only filled filters and trims ids', () => {
    const query = auditQuery({
      ...emptyFilter,
      action: 'PRODUCT_CREATED',
      targetType: 'LOAN_PRODUCT',
      actorId: ` ${id.toUpperCase()} `,
    })
    expect(query).toBe(`?action=PRODUCT_CREATED&targetType=LOAN_PRODUCT&actorId=${id}&limit=50`)
  })

  it('validates dates and ids before calling the server', () => {
    expect(validateFilter(emptyFilter)).toEqual({})
    expect(
      validateFilter({ ...emptyFilter, fromDate: '2026-10-02', toDate: '2026-10-01' }),
    ).toEqual({
      toDate: '종료일은 시작일과 같거나 뒤여야 합니다.',
    })
    expect(
      validateFilter({ ...emptyFilter, fromDate: '2026-10-02', toDate: '2026-10-02' }),
    ).toEqual({})
    expect(validateFilter({ ...emptyFilter, fromDate: '2026-10-02' })).toEqual({})
    expect(
      Object.keys(
        validateFilter({ ...emptyFilter, fromDate: '10/02', actorId: '12', targetId: 'x' }),
      ),
    ).toEqual(['fromDate', 'actorId', 'targetId'])
  })

  it('round-trips the applied filter through the address', () => {
    const filter = {
      ...emptyFilter,
      fromDate: '2026-10-01',
      targetId: id,
      action: 'REVIEW_STARTED',
    }
    const params = filterToParams(filter)
    expect(params.toString()).toBe(`from=2026-10-01&action=REVIEW_STARTED&targetId=${id}`)
    expect(filterFromParams(params)).toEqual(filter)
    expect(hasFilter(filterFromParams(new URLSearchParams()))).toBe(false)
    expect(hasFilter(filter)).toBe(true)
  })
})

describe('audit log display', () => {
  it('labels known codes and keeps unknown codes readable', () => {
    expect(actionLabel('PRODUCT_POLICY_PUBLISHED')).toBe('정책 버전 발행')
    expect(actionLabel('LOAN_EXECUTED')).toBe('LOAN_EXECUTED')
    expect(roleLabel('REVIEWER')).toBe('심사 담당자')
    expect(roleLabel(null)).toBe('알 수 없음')
  })

  it('splits stored states and links only targets with an administrator screen', () => {
    expect(stateParts('status=ACTIVE;policyVersion=1')).toEqual([
      'status=ACTIVE',
      'policyVersion=1',
    ])
    expect(stateParts('APPLIED')).toEqual(['APPLIED'])
    expect(stateParts(null)).toEqual([])
    expect(targetLink({ targetType: 'LOAN_PRODUCT', targetId: id })).toBe(`/admin/products/${id}`)
    expect(targetLink({ targetType: 'LOAN_APPLICATION', targetId: id })).toBeNull()
  })

  it('explains permission, cursor and query errors', () => {
    expect(auditLoadMessage(new ApiError('ACCESS_DENIED', 'x', 403))).toContain('운영 관리자 권한')
    expect(
      auditLoadMessage(new ApiError('VALIDATION_ERROR', 'x', 400, 't', { cursor: 'bad' })),
    ).toContain('처음부터 다시 조회')
    expect(auditLoadMessage(new ApiError('INVALID_REQUEST', 'x', 400))).toContain('조회 조건')
    expect(auditLoadMessage(new ApiError('INTERNAL_ERROR', 'x', 500))).toBeUndefined()
    expect(auditLoadMessage(new Error('x'))).toBeUndefined()
  })
})
