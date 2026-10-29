import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './stores/auth'
import BrandLogo from './components/BrandLogo'
import AppIcon from './components/AppIcon'
import ErrorNotice from './components/ErrorNotice'
import HomePage from './views/HomePage'
import GuidePage from './views/GuidePage'
import AuthPage from './views/AuthPage'
import DashboardPage from './views/DashboardPage'
import ProductsPage from './views/ProductsPage'
import ProductPage from './views/ProductPage'
import ApplicationPage from './views/ApplicationPage'
import StaffPage from './views/StaffPage'
import { anchorId, destinationAfterAuthentication } from './lib/navigation'
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
  if (staff && user.role === 'CUSTOMER') return <Navigate to="/my" replace />
  if (!staff && user.role !== 'CUSTOMER') return <Navigate to="/staff" replace />
  return children
}
export default function App() {
  const { user, ready, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState<unknown>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const staff = !!user && user.role !== 'CUSTOMER'
  const role = user
    ? { CUSTOMER: '고객', REVIEWER: '심사 담당자', ADMIN: '운영 관리자' }[user.role]
    : ''
  const title =
    location.pathname === '/'
      ? '홈'
      : location.pathname === '/my'
        ? '나의 대출'
        : location.pathname === '/products'
          ? '대출상품'
          : location.pathname.startsWith('/products/')
            ? '대출 신청'
            : location.pathname.startsWith('/applications/')
              ? '신청 내역'
              : location.pathname === '/guide'
                ? '이용안내'
                : location.pathname === '/staff'
                  ? '직원업무'
                  : new URLSearchParams(location.search).get('mode') === 'register'
                    ? '회원가입'
                    : '로그인'
  useEffect(() => {
    document.title = `${title} | Oh My Bank`
    setMenuOpen(false)
    if (!ready) return
    if (!location.hash) window.scrollTo(0, 0)
    else {
      const id = anchorId(location.hash)
      const target = id ? document.getElementById(id) : null
      target?.scrollIntoView()
    }
  }, [location.pathname, location.hash, location.key, title, ready])
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (menuOpen) {
      dialog.showModal()
      const oldOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        dialog.close()
        document.body.style.overflow = oldOverflow
      }
    }
    dialog.close()
  }, [menuOpen])
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
  function closeMenu() {
    setMenuOpen(false)
    menuButton.current?.focus()
  }
  return (
    <div className="bank-site">
      <a className="skip-link" href="#main">
        본문 바로가기
      </a>
      <header className="bank-header">
        <div className="bank-utility content-width">
          <span className="bank-simulation">금융거래 시뮬레이션</span>
          <div>
            {user ? (
              <>
                <span className="utility-user">
                  <strong>{user.name}</strong>님<span className="utility-role">{role}</span>
                </span>
                <button disabled={loggingOut} onClick={signOut}>
                  {loggingOut ? '로그아웃 중' : '로그아웃'}
                </button>
              </>
            ) : (
              <>
                <Link to="/login">로그인</Link>
                <Link to="/login?mode=register">회원가입</Link>
              </>
            )}
            <Link to="/guide" className="utility-guide">
              이용안내
            </Link>
          </div>
        </div>
        <div className="bank-gnb content-width">
          <BrandLogo />
          <nav aria-label="주 메뉴" className="bank-main-nav">
            <NavLink to="/products">금융상품</NavLink>
            <NavLink to={staff ? '/staff' : '/my'}>{staff ? '직원업무' : '신청조회'}</NavLink>
            <NavLink to="/guide">이용안내</NavLink>
          </nav>
          <button
            className="all-menu-button"
            ref={menuButton}
            aria-label="전체메뉴"
            aria-expanded={menuOpen}
            aria-controls="all-menu"
            onClick={() => setMenuOpen(true)}
          >
            <AppIcon name="menu" size={25} />
            <span>전체메뉴</span>
          </button>
        </div>
      </header>
      <dialog
        id="all-menu"
        ref={dialogRef}
        className="all-menu-dialog"
        aria-labelledby="all-menu-title"
        onCancel={() => setMenuOpen(false)}
        onClose={() => setMenuOpen(false)}
      >
        <div className="all-menu-heading">
          <h2 id="all-menu-title">전체메뉴</h2>
          <button onClick={closeMenu} aria-label="전체메뉴 닫기">
            <AppIcon name="close" size={25} />
          </button>
        </div>
        <div
          className="all-menu-grid"
          onClick={(event) => {
            if ((event.target as Element).closest('a')) closeMenu()
          }}
        >
          <section>
            <h3>금융상품</h3>
            <Link to="/products">대출상품 조회</Link>
            <Link to="/products">대출 신청</Link>
          </section>
          <section>
            <h3>{staff ? '직원 업무' : '나의 대출'}</h3>
            <Link to={staff ? '/staff' : '/my'}>{staff ? '업무 범위 확인' : '신청 내역 조회'}</Link>
            <Link to="/guide#application">신청 절차 안내</Link>
          </section>
          <section>
            <h3>이용안내</h3>
            <Link to="/guide#notice">시뮬레이션 안내</Link>
            <Link to="/guide#scope">서비스 제공 범위</Link>
            {!user && <Link to="/login?mode=register">회원가입</Link>}
          </section>
        </div>
      </dialog>
      <main
        id="main"
        className={`bank-main content-width ${location.pathname === '/' ? 'home-main' : ''}`}
        tabIndex={-1}
      >
        {location.pathname !== '/' && (
          <div className="bank-breadcrumb" aria-label="현재 위치">
            <Link to="/" aria-label="홈">
              <AppIcon name="home" size={14} />
            </Link>
            <AppIcon name="chevron" size={12} />
            <span>{title}</span>
          </div>
        )}
        <ErrorNotice error={logoutError} />
        {!ready || loggingOut ? (
          <div className="empty-state" role="status">
            {loggingOut ? '로그아웃 중입니다.' : '이용 정보를 확인하고 있습니다.'}
          </div>
        ) : (
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/guide" element={<GuidePage />} />
            <Route
              path="/login"
              element={
                user ? (
                  <Navigate
                    to={destinationAfterAuthentication(
                      new URLSearchParams(location.search).get('redirect'),
                      user.role,
                      new URLSearchParams(location.search).get('mode') === 'register',
                    )}
                    replace
                  />
                ) : (
                  <AuthPage />
                )
              }
            />
            <Route
              path="/my"
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
        )}
      </main>
      <footer className="bank-footer">
        <div className="content-width">
          <nav className="footer-links" aria-label="하단 메뉴">
            <Link to="/guide#notice">시뮬레이션 안내</Link>
            <Link to="/guide#application">이용 방법</Link>
            <Link to="/products">상품안내</Link>
            <Link to={staff ? '/staff' : '/my'}>{staff ? '직원업무' : '신청조회'}</Link>
          </nav>
          <div className="footer-bottom">
            <div>
              <strong>Oh My Bank</strong>
              <p>금융업무 학습을 위한 가상 금융거래 서비스</p>
              <small>© {new Date().getFullYear()} Oh My Bank. All rights reserved.</small>
            </div>
            <p className="footer-disclaimer">
              실제 금융상품 판매·대출 중개·자금 이동을 제공하지 않습니다.
              <br />
              실제 개인정보와 금융정보는 입력하지 마세요.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
