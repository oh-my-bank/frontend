import { matchPath } from 'react-router-dom'
import { calculatorInfo, isCalculatorKind } from './learning'

export const siteName = 'Oh My Bank'
export const notFoundTitle = '페이지를 찾을 수 없음'

type TitleRule = readonly [pattern: string, title: string | ((params: Params) => string)]
type Params = Readonly<Record<string, string | undefined>>

/**
 * Every route the app declares, with the title shown in the tab and breadcrumb. A path that matches
 * none of them is rendered by the 404 screen, so a new route needs a line here as well.
 */
const titleRules: readonly TitleRule[] = [
  ['/', '홈'],
  ['/about', '서비스 소개'],
  ['/guide', '이용안내'],
  ['/learn', '은행업 학습'],
  ['/learn/:slug', '개념 학습'],
  ['/glossary', '용어 사전'],
  ['/tools', '계산기'],
  [
    '/tools/:kind',
    ({ kind = '' }) => (isCalculatorKind(kind) ? calculatorInfo[kind].title : '계산기'),
  ],
  ['/strategy', '나의 전략'],
  ['/bank-lab', '은행 경영 시뮬레이터'],
  ['/strategy/saves', '내 전략'],
  ['/strategy/saves/compare', '전략 비교'],
  ['/strategy/saves/:id', '저장한 전략'],
  ['/simulation', '모의 운용'],
  ['/simulation/accounts/:id', '모의 계좌 상세'],
  ['/simulation/history', '지난 모의 운용'],
  ['/simulation/history/:id', '모의 운용 리포트'],
  ['/login', '로그인'],
  ['/my', '나의 대출'],
  ['/products', '대출상품'],
  ['/products/:id', '대출 신청'],
  ['/applications/:id', '신청 내역'],
  ['/loans/:id', '대출 상세'],
  ['/staff', '직원업무'],
  ['/account', '내 정보'],
  ['/staff/dashboard', '운영 현황'],
  ['/staff/reviews', '대출 심사'],
  ['/staff/reviews/:id', '심사 상세'],
  ['/staff/loans', '대출 계정 조회'],
  ['/staff/loans/:id', '대출 계정 상세'],
  ['/admin', '상품관리'],
  ['/admin/products', '상품관리'],
  ['/admin/audit', '감사 로그'],
  ['/admin/products/new', '상품 등록'],
  ['/admin/products/:id', '상품 상세'],
  ['/admin/products/:id/policies/new', '새 정책 발행'],
]

/** The title of a declared route, or null when the path is unknown (the 404 screen). */
export function routeTitle(pathname: string, search = ''): string | null {
  // Static segments rank above dynamic ones, as React Router does (`/saves/compare` over `/:id`).
  let best: { title: string; score: number } | null = null
  for (const [pattern, title] of titleRules) {
    const match = matchPath({ path: pattern, end: true }, pathname)
    if (!match) continue
    const score = pattern.split('/').filter((part) => part && !part.startsWith(':')).length
    if (best && best.score >= score) continue
    best = { title: typeof title === 'string' ? title : title(match.params), score }
  }
  if (best?.title === '로그인' && new URLSearchParams(search).get('mode') === 'register')
    return '회원가입'
  return best?.title ?? null
}

export function documentTitle(title: string) {
  return `${title} | ${siteName}`
}
