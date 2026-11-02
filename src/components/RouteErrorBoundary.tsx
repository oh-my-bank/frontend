import { Component, type ErrorInfo, type ReactNode } from 'react'
import AppIcon from './AppIcon'
import '../styles/launch.css'

/** A route chunk that no longer exists on the server, usually because a new version was deployed. */
export function isChunkLoadError(error: unknown) {
  if (!(error instanceof Error)) return false
  return (
    error.name === 'ChunkLoadError' ||
    /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i.test(
      error.message,
    )
  )
}

/**
 * Shown when a screen fails to render. It uses plain links and a full reload instead of router
 * navigation, so it also works when the router itself or a lazily loaded chunk is what failed.
 */
export function RenderErrorFallback({ error }: { error: unknown }) {
  const chunk = isChunkLoadError(error)
  return (
    <section className="empty-state route-error" role="alert" aria-labelledby="route-error-title">
      <AppIcon name="info" size={32} />
      <h2 id="route-error-title">화면을 표시하지 못했습니다.</h2>
      <p>
        {chunk
          ? '새 버전이 배포되어 화면 파일을 불러오지 못했을 수 있습니다. 새로고침하면 최신 화면을 불러옵니다.'
          : '일시적인 오류로 화면을 그리지 못했습니다. 새로고침하거나 홈으로 이동해 다시 시도해 주세요.'}
        <br />
        입력하던 내용은 저장되지 않았을 수 있습니다. 가상 거래는 서버 기록을 다시 조회해 확인해
        주세요.
      </p>
      <div className="route-error-actions">
        <button
          type="button"
          className="button button-primary"
          onClick={() => window.location.reload()}
        >
          새로고침
        </button>
        <a href="/" className="button button-outline">
          홈으로 이동
        </a>
      </div>
    </section>
  )
}

type Props = { children: ReactNode; resetKey?: string }
type State = { error: unknown }

/**
 * Catches render errors below it. A new `resetKey` (path and query) clears the error. A failed lazy
 * chunk stays failed until a reload because React caches the rejected import, hence the fallback
 * offers reloading first.
 */
export default class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: unknown): State {
    return { error: error ?? new Error('Unknown render error') }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('Screen render failed', error, info.componentStack)
  }

  componentDidUpdate(previous: Props) {
    if (this.state.error && previous.resetKey !== this.props.resetKey)
      this.setState({ error: null })
  }

  render() {
    if (this.state.error) return <RenderErrorFallback error={this.state.error} />
    return this.props.children
  }
}
