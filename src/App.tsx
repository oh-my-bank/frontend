import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './stores/auth'
import BrandLogo from './components/BrandLogo'
import AppIcon from './components/AppIcon'
import ErrorNotice from './components/ErrorNotice'
import AuthPage from './views/AuthPage'
import DashboardPage from './views/DashboardPage'
import ProductsPage from './views/ProductsPage'
import ProductPage from './views/ProductPage'
import ApplicationPage from './views/ApplicationPage'
import StaffPage from './views/StaffPage'

function Protected({ children, staff = false }: { children: ReactNode; staff?: boolean }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user)
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    )
  if (staff && user.role === 'CUSTOMER') return <Navigate to="/" replace />
  if (!staff && user.role !== 'CUSTOMER') return <Navigate to="/staff" replace />
  return children
}
export default function App() {
  const { user, ready, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState<unknown>(null)
  const role = user
    ? { CUSTOMER: '고객', REVIEWER: '심사 담당자', ADMIN: '운영 관리자' }[user.role]
    : ''
  const pageTitle =
    location.pathname === '/'
      ? '내 대시보드'
      : location.pathname.startsWith('/products/')
        ? '상품 상세 · 대출 신청'
        : location.pathname === '/products'
          ? '금융상품'
          : location.pathname.startsWith('/applications/')
            ? '신청 상세'
            : location.pathname === '/staff'
              ? '직원 업무'
              : '로그인'
  useEffect(() => {
    document.title = `${pageTitle} · Oh My Bank`
    window.scrollTo(0, 0)
  }, [location.pathname, pageTitle])
  async function signOut() {
    setLoggingOut(true)
    setLogoutError(null)
    try {
      await logout()
      navigate('/login', { replace: true })
    } catch (cause) {
      setLogoutError(cause)
    } finally {
      setLoggingOut(false)
    }
  }
  const routeContent =
    !ready || loggingOut ? (
      <div className="empty-state" role="status">
        {loggingOut ? '로그아웃 중…' : '이용 정보를 확인하고 있습니다.'}
      </div>
    ) : (
      <Routes>
        <Route
          path="/login"
          element={
            user ? (
              <Navigate to={user.role === 'CUSTOMER' ? '/' : '/staff'} replace />
            ) : (
              <AuthPage />
            )
          }
        />
        <Route
          path="/"
          element={
            <Protected>
              <DashboardPage />
            </Protected>
          }
        />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/products/:id" element={<ProductPage key={location.pathname} />} />
        <Route
          path="/applications/:id"
          element={
            <Protected>
              <ApplicationPage key={location.pathname} />
            </Protected>
          }
        />
        <Route
          path="/staff"
          element={
            <Protected staff>
              <StaffPage />
            </Protected>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    )
  return (
    <>
      <a className="skip-link" href="#main">
        본문으로 건너뛰기
      </a>
      {location.pathname === '/login' ? (
        <div className="auth-root">{routeContent}</div>
      ) : (
        <div className="app-layout">
          <aside className="sidebar">
            <BrandLogo />
            <div className="workspace-label">MY FINANCIAL WORKSPACE</div>
            <nav className="main-nav" aria-label="주 메뉴">
              {(!user || user.role === 'CUSTOMER') && (
                <NavLink to="/" end>
                  <AppIcon name="grid" />내 대시보드
                </NavLink>
              )}
              <NavLink to="/products">
                <AppIcon name="layers" />
                금융상품
                <span className="nav-dot" />
              </NavLink>
              {user && user.role !== 'CUSTOMER' && (
                <NavLink to="/staff">
                  <AppIcon name="shield" />
                  직원 업무
                </NavLink>
              )}
            </nav>
            <div className="sidebar-note">
              <span className="tiny-label">LEARN BY DOING</span>
              <h3>
                작은 경험이
                <br />
                금융의 이해로.
              </h3>
              <p>
                모든 거래는 가상 데이터로
                <br />
                안전하게 진행됩니다.
              </p>
              <div className="note-orbit">
                <span>OMB</span>
              </div>
            </div>
            <div className="sidebar-bottom">
              <span className="live-dot" />
              금융 시뮬레이션<span className="version">v0.1</span>
            </div>
          </aside>
          <div className="main-shell">
            <header className="topbar">
              <div className="breadcrumb">
                Workspace
                <AppIcon name="chevron" size={14} />
                <strong>{pageTitle}</strong>
              </div>
              {user ? (
                <div className="user-menu">
                  <span className="avatar">{user.name.slice(0, 1)}</span>
                  <div>
                    <strong>{user.name}</strong>
                    <small>{role} 계정</small>
                  </div>
                  <button
                    className="icon-button"
                    disabled={loggingOut}
                    onClick={signOut}
                    aria-label="로그아웃"
                    title="로그아웃"
                  >
                    <AppIcon name="logout" size={18} />
                  </button>
                </div>
              ) : (
                <Link className="button button-dark small" to="/login">
                  로그인
                  <AppIcon name="arrow" size={16} />
                </Link>
              )}
            </header>
            <main id="main" className="main-content">
              <ErrorNotice error={logoutError} />
              {routeContent}
            </main>
            <footer className="page-footer">
              <span>© {new Date().getFullYear()} Oh My Bank</span>
              <span>학습용 가상 금융거래 시뮬레이션 · 실제 대출 및 자금 이동 없음</span>
            </footer>
          </div>
        </div>
      )}
    </>
  )
}
