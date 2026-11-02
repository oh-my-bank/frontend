import { describe, expect, it } from 'vitest'
import { documentTitle, routeTitle } from './pageTitle'
import { calculatorInfo, calculatorKinds } from './learning'
import { disallowedPaths, sitemapPaths } from './seo'
import appSource from '../App.tsx?raw'

/** Every `<Route path="...">` in App.tsx, with sample values for its parameters. */
function declaredRoutes() {
  return [...appSource.matchAll(/<Route\s+path="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((path) => path !== '*')
}

describe('route titles', () => {
  it('formats the document title with the service name', () => {
    expect(documentTitle('은행업 학습')).toBe('은행업 학습 | Oh My Bank')
  })
  it('names the main public screens', () => {
    expect(routeTitle('/')).toBe('홈')
    expect(routeTitle('/about')).toBe('서비스 소개')
    expect(routeTitle('/learn')).toBe('은행업 학습')
    expect(routeTitle('/learn/deposit-basics')).toBe('개념 학습')
    expect(routeTitle('/glossary')).toBe('용어 사전')
    expect(routeTitle('/guide')).toBe('이용안내')
    expect(routeTitle('/products/abc')).toBe('대출 신청')
  })
  it('uses the calculator name and falls back for an unknown calculator', () => {
    for (const kind of calculatorKinds)
      expect(routeTitle(`/tools/${kind}`)).toBe(calculatorInfo[kind].title)
    expect(routeTitle('/tools/unknown')).toBe('계산기')
  })
  it('prefers a static segment over a parameter', () => {
    expect(routeTitle('/strategy/saves/compare')).toBe('전략 비교')
    expect(routeTitle('/strategy/saves/s-1')).toBe('저장한 전략')
    expect(routeTitle('/admin/products/new')).toBe('상품 등록')
    expect(routeTitle('/admin/products/p-1')).toBe('상품 상세')
    expect(routeTitle('/admin/products/p-1/policies/new')).toBe('새 정책 발행')
  })
  it('distinguishes login from registration', () => {
    expect(routeTitle('/login')).toBe('로그인')
    expect(routeTitle('/login', '?mode=register')).toBe('회원가입')
    expect(routeTitle('/login', '?redirect=%2Fmy')).toBe('로그인')
  })
  it('returns null for paths no route declares, which the 404 screen renders', () => {
    for (const path of ['/nope', '/learn/a/b', '/admin/unknown', '/products/a/b', '/staffroom'])
      expect(routeTitle(path)).toBeNull()
  })
  it('has a title for every route declared in App.tsx', () => {
    const routes = declaredRoutes()
    expect(routes.length).toBeGreaterThan(30)
    for (const path of routes) {
      const sample = path.replace(/:\w+/g, 'sample')
      expect(routeTitle(sample), path).not.toBeNull()
    }
  })
  it('lists only declared, public routes in the sitemap', () => {
    const routes = declaredRoutes()
    for (const path of sitemapPaths) {
      const declared = routes.includes(path) || routes.includes(path.replace(/[^/]+$/, ':kind'))
      expect(declared, path).toBe(true)
      expect(
        disallowedPaths.some((blocked) => path.startsWith(blocked)),
        path,
      ).toBe(false)
    }
  })
})
