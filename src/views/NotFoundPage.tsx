import { Link, useLocation } from 'react-router-dom'
import AppIcon from '../components/AppIcon'
import '../styles/launch.css'

/** Rendered for any path the app does not declare, instead of silently redirecting home. */
export default function NotFoundPage() {
  const { pathname } = useLocation()
  return (
    <>
      <header className="page-title">
        <h1>페이지를 찾을 수 없습니다</h1>
        <p>주소가 바뀌었거나 제공하지 않는 화면입니다.</p>
      </header>
      <section className="empty-state not-found" aria-labelledby="not-found-title">
        <AppIcon name="search" size={32} />
        <h2 id="not-found-title">요청한 주소에 해당하는 화면이 없습니다.</h2>
        <p>
          입력한 주소 <code className="monospace">{pathname}</code>를 확인해 주세요. 아래에서 제공
          중인 기능으로 이동할 수 있습니다.
        </p>
        <nav className="not-found-links" aria-label="주요 화면 바로가기">
          <Link to="/" className="button button-primary">
            홈으로 이동
          </Link>
          <Link to="/learn" className="button button-outline">
            은행업 학습
          </Link>
          <Link to="/tools" className="button button-outline">
            계산기
          </Link>
          <Link to="/about" className="button button-outline">
            서비스 소개
          </Link>
          <Link to="/guide" className="button button-outline">
            이용안내
          </Link>
        </nav>
      </section>
    </>
  )
}
