import { describe, expect, it } from 'vitest'
import {
  agreementPayload,
  isLegalCode,
  legalPath,
  missingAgreements,
  parseMarkdown,
  requiredDocuments,
  type LegalDocumentList,
} from './legal'

const list: LegalDocumentList = {
  items: [
    {
      code: 'TERMS',
      version: 'TERMS_V1',
      title: '이용약관',
      effectiveDate: '2026-11-02',
      legalReviewed: false,
      requiredForSignup: true,
      consentLabel: '[필수] 이용약관에 동의합니다.',
      summary: [],
    },
    {
      code: 'PRIVACY',
      version: 'PRIVACY_V1',
      title: '개인정보 처리방침',
      effectiveDate: '2026-11-02',
      legalReviewed: false,
      requiredForSignup: true,
      consentLabel: '[필수] 개인정보 수집·이용에 동의합니다.',
      summary: [{ label: '수집 항목', text: '이메일, 이름, 비밀번호' }],
    },
    {
      code: 'NOTICE',
      version: 'NOTICE_V1',
      title: '서비스 고지',
      effectiveDate: '2026-11-02',
      legalReviewed: false,
      requiredForSignup: false,
      consentLabel: null,
      summary: [],
    },
  ],
  operator: {
    configured: false,
    name: null,
    contact: null,
    privacyOfficerName: null,
    privacyOfficerContact: null,
  },
}

describe('sign-up agreements', () => {
  const required = requiredDocuments(list)
  it('asks only for the documents the server marks as required', () => {
    expect(required.map((doc) => doc.code)).toEqual(['TERMS', 'PRIVACY'])
    expect(requiredDocuments(null)).toEqual([])
  })
  it('sends the exact versions shown for checked boxes only', () => {
    expect(agreementPayload(required, { TERMS: true, PRIVACY: true, NOTICE: true })).toEqual([
      { code: 'TERMS', version: 'TERMS_V1' },
      { code: 'PRIVACY', version: 'PRIVACY_V1' },
    ])
    expect(agreementPayload(required, { PRIVACY: true })).toEqual([
      { code: 'PRIVACY', version: 'PRIVACY_V1' },
    ])
  })
  it('lists unchecked required documents so the form can block the submit', () => {
    expect(missingAgreements(required, {}).map((doc) => doc.code)).toEqual(['TERMS', 'PRIVACY'])
    expect(missingAgreements(required, { TERMS: true, PRIVACY: false }).map((d) => d.code)).toEqual(
      ['PRIVACY'],
    )
    expect(missingAgreements(required, { TERMS: true, PRIVACY: true })).toEqual([])
  })
  it('maps document codes to their public pages', () => {
    expect(legalPath('TERMS')).toBe('/terms')
    expect(legalPath('PRIVACY')).toBe('/privacy')
    expect(legalPath('UNKNOWN')).toBe('/notice')
    expect(isLegalCode('NOTICE')).toBe(true)
    expect(isLegalCode('toString')).toBe(false)
  })
})

describe('legal Markdown reader', () => {
  it('reads headings, joined paragraphs, both list kinds and pipe tables', () => {
    const blocks = parseMarkdown(
      [
        '# 제목',
        '',
        '첫 줄',
        '이어지는 줄',
        '',
        '## 1. 목적',
        '- 가',
        '- 나',
        '1. 하나',
        '2. 둘',
        '',
        '| 구분 | 항목 |',
        '| --- | --- |',
        '| 회원 | 이메일, 이름 |',
      ].join('\r\n'),
    )
    expect(blocks).toEqual([
      { kind: 'heading', level: 1, text: '제목', id: 'section-1' },
      { kind: 'paragraph', text: '첫 줄 이어지는 줄' },
      { kind: 'heading', level: 2, text: '1. 목적', id: 'section-2' },
      { kind: 'list', ordered: false, items: ['가', '나'] },
      { kind: 'list', ordered: true, items: ['하나', '둘'] },
      { kind: 'table', header: ['구분', '항목'], rows: [['회원', '이메일, 이름']] },
    ])
  })
  it('keeps markup-looking text as plain text instead of HTML', () => {
    const blocks = parseMarkdown('<script>alert(1)</script> **굵게** [링크](javascript:x)')
    expect(blocks).toEqual([
      { kind: 'paragraph', text: '<script>alert(1)</script> **굵게** [링크](javascript:x)' },
    ])
  })
  it('treats four or more hashes and a table without a separator conservatively', () => {
    expect(parseMarkdown('#### 깊은 제목')).toEqual([{ kind: 'paragraph', text: '#### 깊은 제목' }])
    expect(parseMarkdown('| a | b |\n| c | d |')).toEqual([
      { kind: 'table', header: ['a', 'b'], rows: [['c', 'd']] },
    ])
  })
})
