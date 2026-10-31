import { describe, expect, it } from 'vitest'
import { ApiError } from './api'
import {
  commandApplied,
  customerReviewStage,
  needsReload,
  readRejection,
  reviewActions,
  reviewCommandMessage,
  reviewLoadMessage,
  ruleResultLabel,
  statusFilter,
  type ReviewDetail,
} from './reviews'

const staff = { id: 'staff-1', name: '심사 담당' }
function detail(
  status: ReviewDetail['status'],
  result?: 'MET' | 'NOT_MET',
  decided?: 'APPROVED' | 'REJECTED',
): ReviewDetail {
  return {
    applicationId: 'app-1',
    status,
    customer: { id: 'customer-1', maskedName: '가****' },
    application: {
      productId: 'product-1',
      productName: '가상 신용대출',
      policyVersion: 1,
      requestedAmount: 10000000,
      termMonths: 24,
      annualInterestRate: '5.125',
      annualIncome: 30000000,
      appliedAt: '2026-10-30T01:00:00Z',
    },
    review: result
      ? {
          startedBy: staff,
          startedAt: '2026-10-30T02:00:00Z',
          evaluation: {
            ruleVersion: 'MOCK_DSR_V1',
            thresholdPercent: 40,
            inputs: {
              requestedAmount: 10000000,
              termMonths: 24,
              annualInterestRate: '5.125',
              annualIncome: 30000000,
            },
            monthlyPayment: 438000,
            annualRepayment: 5256000,
            repaymentRatio: '17.52',
            result,
          },
          decision: decided
            ? {
                result: decided,
                decidedBy: staff,
                decidedAt: '2026-10-30T03:00:00Z',
                approvedTerms: null,
                reasonCode: null,
                reasonMessage: null,
                staffNote: null,
              }
            : null,
        }
      : null,
    history: [],
    notice: '교육용 모의 심사입니다.',
  }
}

describe('review actions', () => {
  it('only offers start before the review and approval only when the rule was met', () => {
    expect(reviewActions(detail('APPLIED'))).toEqual({
      canStart: true,
      canApprove: false,
      canReject: false,
      approvalBlocked: false,
    })
    expect(reviewActions(detail('UNDER_REVIEW', 'MET'))).toMatchObject({
      canStart: false,
      canApprove: true,
      canReject: true,
      approvalBlocked: false,
    })
    // A NOT_MET application can only be rejected, and the page explains why.
    expect(reviewActions(detail('UNDER_REVIEW', 'NOT_MET'))).toMatchObject({
      canApprove: false,
      canReject: true,
      approvalBlocked: true,
    })
  })
  it('offers nothing once decided', () => {
    for (const decided of [
      detail('APPROVED', 'MET', 'APPROVED'),
      detail('REJECTED', 'NOT_MET', 'REJECTED'),
    ]) {
      expect(reviewActions(decided)).toEqual({
        canStart: false,
        canApprove: false,
        canReject: false,
        approvalBlocked: false,
      })
    }
  })
})

describe('rejection form', () => {
  it('requires a reason and a note for a staff decision', () => {
    expect(readRejection('', '', 'MET').errors.reasonCode).toBeDefined()
    expect(readRejection('STAFF_DECISION', '   ', 'MET').errors.staffNote).toBeDefined()
    expect(readRejection('STAFF_DECISION', '  소득 대비 부담  ', 'MET').body).toEqual({
      reasonCode: 'STAFF_DECISION',
      staffNote: '소득 대비 부담',
    })
  })
  it('allows the rule reason only when the rule was not met', () => {
    expect(readRejection('DSR_LIMIT_EXCEEDED', '', 'MET').errors.reasonCode).toBeDefined()
    expect(readRejection('DSR_LIMIT_EXCEEDED', '', 'NOT_MET').body).toEqual({
      reasonCode: 'DSR_LIMIT_EXCEEDED',
      staffNote: null,
    })
  })
  it('counts the 200-character note limit in code points after trimming, like the server', () => {
    expect(readRejection('STAFF_DECISION', ` ${'가'.repeat(200)} `, 'MET').body).toBeDefined()
    expect(readRejection('STAFF_DECISION', '😀'.repeat(200), 'MET').body).toBeDefined()
    expect(readRejection('STAFF_DECISION', '😀'.repeat(201), 'MET').errors.staffNote).toBeDefined()
  })
})

describe('review command results', () => {
  it('treats network and server failures as uncertain and asks to check before retrying', () => {
    expect(reviewCommandMessage(new ApiError('NETWORK_ERROR', 'x'), 'approve')).toContain(
      '반영 여부',
    )
    expect(reviewCommandMessage(new ApiError('HTTP_502', 'x', 502), 'start')).toContain('같은 요청')
  })
  it('reloads the latest detail on a state conflict or rule violation', () => {
    const conflict = new ApiError('APPLICATION_STATE_CONFLICT', 'x', 409)
    expect(needsReload(conflict)).toBe(true)
    expect(needsReload(new ApiError('REVIEW_RULE_NOT_MET', 'x', 409))).toBe(true)
    expect(needsReload(new ApiError('VALIDATION_ERROR', 'x', 400))).toBe(false)
    expect(reviewCommandMessage(conflict, 'approve')).toContain('다른 담당자')
  })
  it('judges an uncertain command from the latest state', () => {
    expect(commandApplied('start', detail('APPLIED'))).toBe(false)
    expect(commandApplied('start', detail('UNDER_REVIEW', 'MET'))).toBe(true)
    expect(commandApplied('approve', detail('UNDER_REVIEW', 'MET'))).toBe(false)
    expect(commandApplied('approve', detail('APPROVED', 'MET', 'APPROVED'))).toBe(true)
    expect(commandApplied('reject', detail('APPROVED', 'MET', 'APPROVED'))).toBe(false)
    expect(commandApplied('reject', detail('REJECTED', 'MET', 'REJECTED'))).toBe(true)
  })
  it('explains missing permission and unknown applications when loading', () => {
    expect(reviewLoadMessage(new ApiError('FORBIDDEN', 'x', 403))).toContain('권한')
    expect(reviewLoadMessage(new ApiError('APPLICATION_NOT_FOUND', 'x', 404))).toContain('찾을 수')
  })
})

describe('list filter and labels', () => {
  it('sends only server statuses as a filter', () => {
    expect(statusFilter('UNDER_REVIEW')).toBe('UNDER_REVIEW')
    expect(statusFilter('AGREED')).toBeNull()
    expect(statusFilter(null)).toBeNull()
    expect(ruleResultLabel(null)).toBe('평가 전')
    expect(ruleResultLabel('NOT_MET')).toBe('기준 미충족')
  })
})

describe('customer review stage', () => {
  it('shows confirmed terms only for an approval and never claims a disbursement', () => {
    const approved = customerReviewStage('APPROVED', {
      result: 'APPROVED',
      decidedAt: '2026-10-30T03:00:00Z',
      approvedTerms: { amount: 10000000, termMonths: 24, annualInterestRate: '5.125' },
      reasonCode: null,
      reasonMessage: null,
      notice: '교육용',
    })
    expect(approved?.tone).toBe('approved')
    expect(approved?.description).toContain('대출금이 지급되거나')
  })
  it('shows the server notice for a rejection and a waiting state before the decision', () => {
    const rejected = customerReviewStage('REJECTED', {
      result: 'REJECTED',
      decidedAt: '2026-10-30T03:00:00Z',
      approvedTerms: null,
      reasonCode: 'STAFF_DECISION',
      reasonMessage: '모의 심사 담당자의 종합 판단으로 승인되지 않았습니다.',
      notice: '교육용',
    })
    expect(rejected?.description).toBe('모의 심사 담당자의 종합 판단으로 승인되지 않았습니다.')
    expect(customerReviewStage('UNDER_REVIEW', null)?.title).toContain('진행 중')
    expect(customerReviewStage('APPLIED', null)?.title).toContain('대기')
    expect(customerReviewStage('AGREED', null)).toBeNull()
  })
})
