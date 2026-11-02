import { Link } from 'react-router-dom'
import AppIcon from '../components/AppIcon'
import { calculatorInfo, calculatorKinds } from '../lib/learning'
import '../styles/launch.css'

type MapLink = { to: string; label: string; note?: string }
type MapArea = { icon: string; title: string; text: string; links: MapLink[] }

/** Only routes the app actually serves; `note` says when an account is required. */
const featureMap: MapArea[] = [
  {
    icon: 'book',
    title: '배우기',
    text: '은행업 개념 카드(핵심 설명·계산 예시·흔한 오해·체크리스트·공식 출처)와 확인 문제, 용어 사전',
    links: [
      { to: '/learn', label: '은행업 개념 학습' },
      { to: '/glossary', label: '은행 용어 사전' },
    ],
  },
  {
    icon: 'calculator',
    title: '계산기',
    text: '예금·적금·대출 상환·DSR·목표 저축 등을 서버가 공개 규칙으로 계산합니다.',
    links: [
      { to: '/tools', label: '계산기 안내·규칙·모의 금리표' },
      ...calculatorKinds.map((kind) => ({
        to: `/tools/${kind}`,
        label: calculatorInfo[kind].title,
      })),
      { to: '/bank-lab', label: '은행 경영 시뮬레이터' },
    ],
  },
  {
    icon: 'target',
    title: '나의 전략',
    text: '소득·지출·자산·목표·대출을 넣으면 공개 규칙이 비상금 → 고금리 대출 → 목표별 예·적금 순서로 실행 항목을 냅니다.',
    links: [
      { to: '/strategy', label: '나의 전략 세우기' },
      { to: '/strategy/saves', label: '저장한 전략', note: '로그인' },
    ],
  },
  {
    icon: 'chart',
    title: '모의 운용',
    text: '가상 자금·가상 날짜로 파킹통장·정기예금·적금에 가입하고 시간을 진행해 이자·세금·만기·중도해지를 겪어 봅니다.',
    links: [
      { to: '/simulation', label: '예·적금 모의 운용', note: '고객 로그인' },
      { to: '/simulation/history', label: '지난 모의 운용', note: '고객 로그인' },
    ],
  },
  {
    icon: 'layers',
    title: '은행 업무 체험',
    text: '가상 대출상품 조회·신청과 신청 내역 조회, 직원 계정의 모의 심사·대출 계정 조회, 운영 관리자의 상품·정책 관리',
    links: [
      { to: '/products', label: '대출상품 조회·신청' },
      { to: '/my', label: '나의 대출', note: '고객 로그인' },
      { to: '/staff', label: '직원 업무', note: '직원 계정' },
    ],
  },
  {
    icon: 'info',
    title: '이용안내',
    text: '이용 절차와 제공 범위, 시뮬레이션 이용 시 유의 사항',
    links: [
      { to: '/guide', label: '이용안내' },
      { to: '/guide#scope', label: '서비스 제공 범위' },
    ],
  },
]

const principles: Array<[title: string, text: string]> = [
  [
    '서버가 계산합니다',
    '모든 금액은 원 단위 정수, 금리는 정밀 십진수로 서버가 계산하고 화면은 그 결과만 표시합니다. 결과에는 규칙 버전(예: BANK_RULES_V1, BANK_STRATEGY_V1)을 함께 붙입니다.',
  ],
  [
    '공식 출처를 밝힙니다',
    '이자소득세율·예금자보호 한도·DSR 같은 제도 수치와 학습 콘텐츠에는 금융위원회·금융감독원·예금보험공사·한국은행·국세청 등 공식 기관 출처와 확인일을 답니다.',
  ],
  [
    '가정값은 가정값으로 표시합니다',
    '모의 상품 금리·중도해지이율·비상금 기준처럼 실제 제도가 아닌 값은 "교육용 가정값"으로 표시하며 실제 은행의 금리를 수집하거나 보여 주지 않습니다.',
  ],
  [
    '자문·추천이 아닙니다',
    '계산기와 나의 전략의 결과는 공개된 교육용 규칙의 계산 결과입니다. 실제 금융상품 판매·추천·광고·중개나 투자 자문을 제공하지 않습니다.',
  ],
  [
    '가상 자금만 씁니다',
    '모의 운용과 대출 업무 체험의 계좌·거래는 가상 원장이며 실제 자금이 이동하지 않습니다. 원장은 추가만 하고 취소는 반대 거래로 남깁니다.',
  ],
  [
    '가상 시간으로 진행합니다',
    '모의 운용의 날짜는 화면에서 진행하는 가상 날짜입니다. 만기·이자 결산·회차 상환은 실제 날짜와 관계없이 가상 시간 기준으로 계산합니다.',
  ],
  [
    '실제 정보를 받지 않습니다',
    '가상의 이름·이메일·소득정보로 이용합니다. 실제 개인정보·금융정보·신용정보를 입력하지 말아 주세요.',
  ],
]

/** Public introduction of the service; no user counts, testimonials or partnerships are shown. */
export default function AboutPage() {
  return (
    <>
      <header className="page-title">
        <h1>서비스 소개</h1>
        <p>
          Oh My Bank는 은행업을 배우고, 숫자로 확인하고, 내 전략을 세우고, 가상 시간으로 운용해 보는
          교육용 모의 서비스입니다.
        </p>
      </header>
      <nav className="guide-index" aria-label="서비스 소개 목차">
        <a href="#purpose">목적</a>
        <a href="#audience">이런 분께</a>
        <a href="#principles">운영 원칙</a>
        <a href="#feature-map">기능 지도</a>
      </nav>
      <section id="purpose" className="guide-section" aria-labelledby="about-purpose-title">
        <div className="section-heading">
          <h2 id="about-purpose-title">목적</h2>
        </div>
        <div className="about-flow">
          <ol>
            <li>
              <strong>배우기</strong>
              <span>예금·적금·대출·금리·건전성 등 은행업 개념을 공식 출처와 함께 공부합니다.</span>
            </li>
            <li>
              <strong>계산하기</strong>
              <span>이자·세금·상환액·DSR을 공개 규칙으로 직접 계산해 봅니다.</span>
            </li>
            <li>
              <strong>전략 세우기</strong>
              <span>내 소득·지출·목표를 넣고 규칙이 내는 실행 순서를 확인합니다.</span>
            </li>
            <li>
              <strong>모의 운용</strong>
              <span>가상 자금·가상 시간으로 예·적금과 대출 흐름을 겪어 봅니다.</span>
            </li>
          </ol>
        </div>
      </section>
      <section id="audience" className="guide-section" aria-labelledby="about-audience-title">
        <div className="section-heading">
          <h2 id="about-audience-title">이런 분께</h2>
        </div>
        <ul className="guide-bullets">
          <li>예금·적금·대출이 어떻게 계산되는지 처음 공부하는 학생·사회초년생</li>
          <li>세후 이자·상환액·DSR을 규칙과 함께 직접 확인해 보고 싶은 분</li>
          <li>비상금·대출 상환·저축 목표의 우선순위를 숫자로 정리해 보고 싶은 분</li>
          <li>대출 신청·심사·실행·상환과 상품 정책 관리의 업무 흐름을 체험하려는 학습자</li>
        </ul>
      </section>
      <section id="principles" className="guide-section" aria-labelledby="about-principles-title">
        <div className="section-heading">
          <h2 id="about-principles-title">운영 원칙</h2>
        </div>
        <dl className="guide-scope">
          {principles.map(([title, text]) => (
            <div key={title}>
              <dt>{title}</dt>
              <dd>{text}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section id="feature-map" className="guide-section" aria-labelledby="about-map-title">
        <div className="section-heading">
          <div>
            <h2 id="about-map-title">기능 지도</h2>
            <p>지금 제공하는 화면만 연결합니다.</p>
          </div>
        </div>
        <div className="about-map">
          {featureMap.map((area) => (
            <article key={area.title}>
              <h3>
                <AppIcon name={area.icon} size={22} />
                {area.title}
              </h3>
              <p>{area.text}</p>
              <ul>
                {area.links.map((link) => (
                  <li key={link.to}>
                    <Link to={link.to}>
                      {link.label}
                      {link.note && <small>{link.note}</small>}
                      <AppIcon name="chevron" size={13} />
                    </Link>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
      <section className="guide-section" aria-label="다루지 않는 것">
        <div className="guide-safety">
          <AppIcon name="shield" size={29} />
          <div>
            <strong>실제 금융거래·자문을 제공하지 않습니다.</strong>
            <p>
              실제 금리 수집·비교, 실제 상품 추천·광고·중개, 실제 계좌·이체·인증서, 주식·펀드·외환
              모의투자는 다루지 않습니다. 자세한 유의 사항은{' '}
              <Link to="/guide#notice">시뮬레이션 안내</Link>에서 확인해 주세요.
            </p>
          </div>
        </div>
      </section>
    </>
  )
}
