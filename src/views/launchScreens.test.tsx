import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AboutPage from './AboutPage'
import NotFoundPage from './NotFoundPage'
import RouteErrorBoundary, {
  RenderErrorFallback,
  isChunkLoadError,
} from '../components/RouteErrorBoundary'
import { routeTitle } from '../lib/pageTitle'

const render = (node: React.ReactNode, path = '/') =>
  renderToStaticMarkup(<MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>)

/** Internal link targets in rendered markup, without query or hash. */
const linkTargets = (html: string) =>
  [...html.matchAll(/href="(\/[^"]*)"/g)].map((match) => match[1].replace(/[?#].*$/, ''))

afterEach(() => vi.restoreAllMocks())

describe('404 screen', () => {
  it('names the unknown path and links only to declared screens', () => {
    const html = render(<NotFoundPage />, '/no-such-page')
    expect(html).toContain('페이지를 찾을 수 없습니다')
    expect(html).toContain('/no-such-page')
    const targets = linkTargets(html)
    expect(targets).toEqual(expect.arrayContaining(['/', '/learn', '/about', '/guide']))
    for (const target of targets) expect(routeTitle(target), target).not.toBeNull()
  })
  it('escapes the requested path instead of rendering it as markup', () => {
    const html = render(<NotFoundPage />, '/%3Cscript%3E')
    expect(html).not.toContain('<script>')
  })
})

describe('service introduction', () => {
  const html = render(<AboutPage />, '/about')
  it('explains purpose, audience, principles and the feature map', () => {
    for (const heading of ['서비스 소개', '목적', '이런 분께', '운영 원칙', '기능 지도'])
      expect(html).toContain(heading)
    for (const principle of [
      '서버가 계산합니다',
      '공식 출처',
      '교육용 가정값',
      '자문·추천이 아닙니다',
      '가상 자금',
      '가상 시간',
    ])
      expect(html).toContain(principle)
  })
  it('links only to routes the app serves', () => {
    const targets = linkTargets(html)
    expect(targets.length).toBeGreaterThan(10)
    for (const target of targets) expect(routeTitle(target), target).not.toBeNull()
  })
  it('marks screens that need an account', () => {
    expect(html).toMatch(/예·적금 모의 운용<small>고객 로그인<\/small>/)
    expect(html).toMatch(/직원 업무<small>직원 계정<\/small>/)
  })
  it('shows no user counts, testimonials or partnerships', () => {
    expect(html).not.toMatch(/\d[\d,]*\s*(명|건|개 기관)|이용자 수|후기|제휴|파트너/)
  })
})

describe('render error boundary', () => {
  it('turns a thrown error into the fallback state', () => {
    const error = new Error('boom')
    expect(RouteErrorBoundary.getDerivedStateFromError(error)).toEqual({ error })
    expect(RouteErrorBoundary.getDerivedStateFromError(undefined).error).toBeInstanceOf(Error)
  })
  it('renders the fallback with reload and home actions while an error is held', () => {
    const boundary = new RouteErrorBoundary({ children: <p>child</p>, resetKey: '/learn' })
    expect(renderToStaticMarkup(<>{boundary.render()}</>)).toBe('<p>child</p>')
    boundary.state = { error: new Error('boom') }
    const html = renderToStaticMarkup(<>{boundary.render()}</>)
    expect(html).toContain('role="alert"')
    expect(html).toContain('화면을 표시하지 못했습니다.')
    expect(html).toContain('새로고침')
    expect(html).toContain('href="/"')
    expect(html).not.toContain('boom')
  })
  it('clears the error when the path changes, not on other updates', () => {
    const boundary = new RouteErrorBoundary({ children: null, resetKey: '/b' })
    const setState = vi.spyOn(boundary, 'setState').mockImplementation(() => {})
    boundary.state = { error: new Error('boom') }
    boundary.componentDidUpdate({ children: null, resetKey: '/b' })
    expect(setState).not.toHaveBeenCalled()
    boundary.componentDidUpdate({ children: null, resetKey: '/a' })
    expect(setState).toHaveBeenCalledWith({ error: null })
  })
  it('explains a missing route chunk after a new deployment', () => {
    const chunk = new TypeError('Failed to fetch dynamically imported module: /assets/LearnPage.js')
    expect(isChunkLoadError(chunk)).toBe(true)
    expect(isChunkLoadError(new Error('boom'))).toBe(false)
    expect(isChunkLoadError('Failed to fetch dynamically imported module')).toBe(false)
    expect(renderToStaticMarkup(<RenderErrorFallback error={chunk} />)).toContain(
      '새 버전이 배포되어',
    )
  })
})
