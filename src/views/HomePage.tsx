import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../stores/auth'
import { request } from '../lib/api'
import {
  calculatorInfo,
  calculatorKinds,
  fetchConcepts,
  type Category,
  type ConceptSummary,
} from '../lib/learning'
import type { Product } from '../types'
import ProductCard from '../components/ProductCard'
import AppIcon from '../components/AppIcon'
import '../styles/learning.css'

const journey = [
  {
    icon: 'book',
    title: '배우기',
    text: '은행이 돈을 버는 방법, 예금·대출·금리·규제를 개념과 확인 문제로',
    to: '/learn',
    link: '은행업 학습',
  },
  {
    icon: 'calculator',
    title: '계산하기',
    text: '이자·세금·상환 일정·DSR을 공개된 규칙으로 직접 계산',
    to: '/tools',
    link: '계산기',
  },
  {
    icon: 'target',
    title: '전략 세우기',
    text: '소득·지출·목표·대출을 넣고 비상금부터 차례로 배분',
    to: '/strategy',
    link: '나의 전략',
  },
  {
    icon: 'chart',
    title: '운용해 보기',
    text: '가상 자금과 가상 날짜로 예·적금에 가입하고 시간을 진행',
    to: '/simulation',
    link: '모의 운용',
  },
]

function LearningMap() {
  const [data, setData] = useState<{ categories: Category[]; items: ConceptSummary[] } | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    fetchConcepts(controller.signal)
      .then(setData)
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true)
      })
    return () => controller.abort()
  }, [])
  if (failed)
    return (
      <div className="notice">
        학습 지도를 불러오지 못했습니다. <Link to="/learn">은행업 학습에서 다시 확인하기</Link>
      </div>
    )
  if (!data)
    return (
      <div className="empty-state" role="status">
        학습 지도를 불러오고 있습니다.
      </div>
    )
  if (!data.items.length) return <div className="empty-state">아직 공개된 개념이 없습니다.</div>
  return (
    <div className="home-learning-map">
      {data.categories.map((category) => {
        const items = data.items.filter((item) => item.category === category.code)
        if (!items.length) return null
        return (
          <section key={category.code} aria-labelledby={`map-${category.code}`}>
            <h3 id={`map-${category.code}`}>
              <Link to={`/learn#category-${category.code}`}>{category.label}</Link>
            </h3>
            <p>{category.description}</p>
            <ul>
              {items.map((item) => (
                <li key={item.slug}>
                  <Link to={`/learn/${item.slug}`}>{item.title}</Link>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

function BankingIllustration() {
  return (
    <svg className="banking-illustration" viewBox="0 0 380 300" fill="none" aria-hidden="true">
      <ellipse cx="192" cy="263" rx="147" ry="17" fill="#daeae3" />
      <path d="M76 241V123L179 65l103 58v118H76Z" fill="#fff" stroke="#b9d5c8" strokeWidth="2" />
      <path
        d="m63 125 116-67 117 67"
        stroke="#198577"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M98 139h162v20H98z" fill="#dfede6" />
      <path d="M114 172v64m42-64v64m46-64v64m43-64v64" stroke="#60a28f" strokeWidth="15" />
      <path d="M68 245h223v10H68z" fill="#248878" />
      <path
        d="m167 107 10 9 19-23"
        stroke="#258977"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M285 216c-6-35-1-62 18-87 17 34 17 62-7 87" fill="#84b19b" />
      <path d="M292 229c-29-5-47-19-50-42 31-1 49 11 53 35" fill="#b7cdb0" />
      <path d="M293 198v48" stroke="#4b8771" strokeWidth="3" strokeLinecap="round" />
      <path d="M271 230h47l-6 29h-35l-6-29Z" fill="#f0d48e" />
      <circle cx="86" cy="72" r="22" fill="#f6d36e" />
      <path
        d="M75 72h22m-18-6 4 14 4-13 5 13 4-14"
        stroke="#a4802c"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M319 88h14m-7-7v14M51 170h11m-5-5v10"
        stroke="#9ec4af"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
export default function HomePage() {
  const { user } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [pending, setPending] = useState(true)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    void request<{ items: Product[] }>('/loan-products', { signal: controller.signal })
      .then((result) => setProducts(result.items))
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true)
      })
      .finally(() => {
        if (!controller.signal.aborted) setPending(false)
      })
    return () => controller.abort()
  }, [])
  const staff = !!user && user.role !== 'CUSTOMER'
  return (
    <>
      <section className="bank-home-top">
        <div className="bank-welcome-banner">
          <div className="welcome-copy">
            <span className="home-kicker">은행업 학습·모의 서비스</span>
            <h1>
              은행을 이해하고,
              <br />
              <strong>내 돈의 계획을 직접 세워 보세요.</strong>
            </h1>
            <p>
              은행업 개념을 배우고 예금·대출을 계산한 뒤,
              <br />
              나의 전략을 세워 가상 시간으로 예·적금을 운용해 봅니다.
            </p>
            <Link to="/learn" className="banner-link">
              은행업 학습 시작하기
              <AppIcon name="arrow" size={18} />
            </Link>
          </div>
          <BankingIllustration />
          <span className="banner-footnote">
            가상 자금·가상 시간으로 진행하는 교육용 서비스입니다.
          </span>
        </div>
        <aside className="bank-quick-panel home-journey" aria-labelledby="journey-title">
          <div className="quick-panel-title">
            <h2 id="journey-title">이렇게 배워 갑니다</h2>
          </div>
          <ol>
            {journey.map((step) => (
              <li key={step.to}>
                <AppIcon name={step.icon} size={24} />
                <div>
                  <strong>{step.title}</strong>
                  <span>{step.text}</span>
                  <Link to={step.to}>
                    {step.link}
                    {step.to === '/simulation' && <small>고객 로그인</small>}
                    <AppIcon name="chevron" size={13} />
                  </Link>
                </div>
              </li>
            ))}
          </ol>
        </aside>
      </section>
      <section className="home-section" aria-labelledby="home-map-title">
        <div className="section-heading">
          <div>
            <span className="section-caption">분류별 개념과 확인 문제</span>
            <h2 id="home-map-title">은행업 학습 지도</h2>
          </div>
          <Link to="/glossary" className="text-button">
            용어 사전
            <AppIcon name="chevron" size={15} />
          </Link>
        </div>
        <LearningMap />
      </section>
      <section className="home-section" aria-labelledby="home-tools-title">
        <div className="section-heading">
          <div>
            <span className="section-caption">결과는 서버가 공개 규칙으로 계산합니다</span>
            <h2 id="home-tools-title">계산기</h2>
          </div>
          <Link to="/tools#rules" className="text-button">
            계산 규칙·모의 금리표
            <AppIcon name="chevron" size={15} />
          </Link>
        </div>
        <ul className="home-tools">
          {calculatorKinds.map((kind) => (
            <li key={kind}>
              <Link to={`/tools/${kind}`}>
                <strong>{calculatorInfo[kind].title}</strong>
                <span>{calculatorInfo[kind].summary}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section className="home-section home-plan" aria-label="나의 전략과 모의 운용">
        <article>
          <h2>
            <AppIcon name="target" size={22} />
            나의 전략
          </h2>
          <p>
            월 소득·지출, 보유 자산, 목표와 대출을 입력하면 공개 규칙 BANK_STRATEGY_V1이 비상금 →
            고금리 대출 상환 → 목표별 예·적금 순서로 실행 항목을 냅니다. 로그인 없이 쓸 수 있고
            결과는 저장하지 않습니다.
          </p>
          <p className="home-plan-note">규칙에 따른 계산 결과이며 실제 상품 추천이 아닙니다.</p>
          <Link to="/strategy" className="button button-primary">
            나의 전략 세우기
            <AppIcon name="arrow" size={17} />
          </Link>
        </article>
        <article>
          <h2>
            <AppIcon name="chart" size={22} />
            모의 운용
            <span className="status-badge">고객 로그인 필요</span>
          </h2>
          <p>
            가상 자금으로 파킹통장·정기예금·적금에 가입하고 하루 또는 한 달씩 가상 날짜를
            진행합니다. 이자 결산과 세금, 만기 지급, 중도해지, 적금 미납을 거래 기록으로 확인합니다.
          </p>
          <p className="home-plan-note">
            {staff
              ? '직원 계정은 이용할 수 없습니다. 고객 계정으로 로그인해 주세요.'
              : '실제 계좌·이체가 아닌 가상 원장입니다.'}
          </p>
          {user ? (
            !staff && (
              <Link to="/simulation" className="button button-outline">
                모의 운용 시작하기
                <AppIcon name="arrow" size={17} />
              </Link>
            )
          ) : (
            <Link to="/login?redirect=%2Fsimulation" className="button button-outline">
              로그인하고 시작하기
              <AppIcon name="arrow" size={17} />
            </Link>
          )}
        </article>
      </section>
      <section className="home-product-section" aria-labelledby="home-products-title">
        <div className="section-heading">
          <div>
            <span className="section-caption">가상 대출상품 조회·신청과 신청 내역 조회</span>
            <h2 id="home-products-title">은행 업무 체험 · 대출 창구</h2>
          </div>
          <Link to="/products" className="text-button">
            전체 상품 보기
            <AppIcon name="plus" size={17} />
          </Link>
        </div>
        {pending ? (
          <div className="empty-state" role="status">
            상품을 불러오고 있습니다.
          </div>
        ) : failed ? (
          <div className="notice">
            상품 정보를 불러오지 못했습니다. <Link to="/products">상품 조회에서 다시 확인하기</Link>
          </div>
        ) : products.length ? (
          <div className="product-grid">
            {products.slice(0, 3).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="empty-state">현재 신청 가능한 상품이 없습니다.</div>
        )}
      </section>
      <section className="home-bottom-grid">
        <div className="bank-notice-board">
          <div className="section-heading">
            <h2>이용 안내</h2>
            <Link to="/guide" className="text-button" aria-label="이용 안내 더 보기">
              <AppIcon name="plus" size={20} />
            </Link>
          </div>
          <ul>
            <li>
              <Link to="/guide#notice">
                <span>실제 개인정보와 금융정보를 입력하지 마세요.</span>
                <AppIcon name="chevron" size={15} />
              </Link>
            </li>
            <li>
              <Link to="/guide#service">
                <span>배우기·계산기·전략·모의 운용 이용 방법</span>
                <AppIcon name="chevron" size={15} />
              </Link>
            </li>
            <li>
              <Link to={staff ? '/staff' : '/my'}>
                <span>{staff ? '직원 업무 범위 확인' : '나의 대출 신청 내역 조회'}</span>
                <AppIcon name="chevron" size={15} />
              </Link>
            </li>
          </ul>
        </div>
        <div className="home-help-panel">
          <AppIcon name="shield" size={35} />
          <div>
            <h2>제도 수치와 교육용 가정값을 나눕니다</h2>
            <p>
              세율·예금자보호·DSR은 출처와 확인일을 달고,
              <br />
              모의 상품 금리는 교육용 가정값으로 표시합니다.
            </p>
            <Link to="/tools#rules" className="text-button">
              규칙과 출처 보기
              <AppIcon name="arrow" size={16} />
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
