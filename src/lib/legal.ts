import { request } from './api'

/** Terms, privacy policy and service notice (L04). The server owns the texts and their versions. */
export type LegalCode = 'TERMS' | 'PRIVACY' | 'NOTICE'
export const legalPaths: Record<LegalCode, string> = {
  TERMS: '/terms',
  PRIVACY: '/privacy',
  NOTICE: '/notice',
}

export interface LegalSummaryItem {
  label: string
  text: string
}
export interface LegalOperator {
  configured: boolean
  name: string | null
  contact: string | null
  privacyOfficerName: string | null
  privacyOfficerContact: string | null
}
export interface LegalDocumentSummary {
  code: string
  version: string
  title: string
  effectiveDate: string
  legalReviewed: boolean
  requiredForSignup: boolean
  consentLabel: string | null
  summary: LegalSummaryItem[]
}
export interface LegalDocumentList {
  items: LegalDocumentSummary[]
  operator: LegalOperator
}
export interface LegalDocument extends LegalDocumentSummary {
  current: boolean
  format: 'MARKDOWN'
  content: string
  contentSha256: string
  versions: { version: string; effectiveDate: string; current: boolean }[]
  operator: LegalOperator
}
export interface Agreement {
  code: string
  version: string
}
export interface AgreementRecord extends Agreement {
  title: string
  agreedAt: string
}

export const fetchLegalDocuments = (signal?: AbortSignal) =>
  request<LegalDocumentList>('/legal/documents', signal ? { signal } : {})

export const fetchLegalDocument = (code: LegalCode, version?: string, signal?: AbortSignal) =>
  request<LegalDocument>(
    `/legal/documents/${code}${version ? `?version=${encodeURIComponent(version)}` : ''}`,
    signal ? { signal } : {},
  )

export const fetchMyAgreements = (signal?: AbortSignal) =>
  request<{ items: AgreementRecord[] }>('/account/agreements', signal ? { signal } : {})

export const isLegalCode = (value: string): value is LegalCode => Object.hasOwn(legalPaths, value)

/** Documents a new member must agree to, in server order. */
export const requiredDocuments = (list: LegalDocumentList | null) =>
  list ? list.items.filter((item) => item.requiredForSignup) : []

/** The request's agreements: the exact versions shown on the form, only for boxes that are checked. */
export function agreementPayload(
  required: LegalDocumentSummary[],
  checked: Record<string, boolean>,
): Agreement[] {
  return required
    .filter((doc) => checked[doc.code])
    .map((doc) => ({ code: doc.code, version: doc.version }))
}

/** Required documents whose box is still empty. The server checks the same rule and answers 400. */
export const missingAgreements = (
  required: LegalDocumentSummary[],
  checked: Record<string, boolean>,
) => required.filter((doc) => !checked[doc.code])

/** Sign-up errors that mean the agreement list must be shown again rather than the user fields. */
export const agreementErrorCodes = [
  'AGREEMENT_REQUIRED',
  'AGREEMENT_VERSION_MISMATCH',
  'AGREEMENT_INVALID',
] as const

export const legalPath = (code: string) => (isLegalCode(code) ? legalPaths[code] : '/notice')

// --- A deliberately small Markdown reader --------------------------------------------------
// The legal texts use headings, paragraphs, bullet/numbered lists and pipe tables only. Parsing
// them into plain data and rendering with React elements keeps every character as text, so no
// HTML from the document can reach the page and no Markdown dependency is needed.

export type MarkdownBlock =
  | { kind: 'heading'; level: 1 | 2 | 3; text: string; id: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'table'; header: string[]; rows: string[][] }

const heading = /^(#{1,3})\s+(.+)$/
const bullet = /^[-*]\s+(.+)$/
const numbered = /^\d+\.\s+(.+)$/
const separatorCell = /^:?-{3,}:?$/

function cells(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  return trimmed.split('|').map((cell) => cell.trim())
}

export function parseMarkdown(source: string): MarkdownBlock[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const blocks: MarkdownBlock[] = []
  let headings = 0
  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()
    if (!line) {
      i++
      continue
    }
    const h = heading.exec(line)
    if (h) {
      blocks.push({
        kind: 'heading',
        level: h[1].length as 1 | 2 | 3,
        text: h[2].trim(),
        id: `section-${++headings}`,
      })
      i++
      continue
    }
    if (line.startsWith('|')) {
      const rows: string[][] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(cells(lines[i++]))
      const [header = [], second, ...rest] = rows
      const hasSeparator = !!second && second.every((cell) => separatorCell.test(cell))
      blocks.push({
        kind: 'table',
        header,
        rows: hasSeparator ? rest : second ? [second, ...rest] : [],
      })
      continue
    }
    const listMatch = bullet.exec(line) ?? numbered.exec(line)
    if (listMatch) {
      const ordered = !bullet.test(line)
      const pattern = ordered ? numbered : bullet
      const items: string[] = []
      while (i < lines.length) {
        const match = pattern.exec(lines[i].trim())
        if (!match) break
        items.push(match[1].trim())
        i++
      }
      blocks.push({ kind: 'list', ordered, items })
      continue
    }
    const text: string[] = []
    while (i < lines.length) {
      const next = lines[i].trim()
      if (
        !next ||
        heading.test(next) ||
        next.startsWith('|') ||
        bullet.test(next) ||
        numbered.test(next)
      )
        break
      text.push(next)
      i++
    }
    blocks.push({ kind: 'paragraph', text: text.join(' ') })
  }
  return blocks
}
