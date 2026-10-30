import { Link } from 'react-router-dom'
import AppIcon from '../components/AppIcon'
import ProgressSteps from '../components/ProgressSteps'
export default function GuidePage() {
  return (
    <>
      <header className="page-title">
        <h1>이용안내</h1>
        <p>Oh My Bank를 이용하기 전에 확인해 주세요.</p>
      </header>
      <nav className="guide-index" aria-label="이용안내 목차">
        <a href="#service">서비스 구성</a>
        <a href="#application">대출 신청 절차</a>
        <a href="#scope">제공 범위</a>
        <a href="#notice">시뮬레이션 안내</a>
      </nav>
      <section id="service" className="guide-section">
        <div className="section-heading">
          <div>
            <h2>서비스 구성</h2>
            <p>은행업을 배우고, 숫자로 확인하고, 내 전략을 세우고, 가상 시간으로 운용해 봅니다.</p>
          </div>
        </div>
        <dl className="guide-scope">
          <div>
            <dt>
              <Link to="/learn">배우기</Link>
            </dt>
            <dd>
              은행업 개념(분류·핵심 설명·계산 예시·흔한 오해·체크리스트·출처), 개념별 확인 문제,
              은행 <Link to="/glossary">용어 사전</Link>. 로그인 없이 이용합니다.
            </dd>
          </div>
          <div>
            <dt>
              <Link to="/tools">계산기</Link>
            </dt>
            <dd>
              정기예금·적금·대출 상환 일정·DSR·목표 저축. 계산은 서버가 공개 규칙 BANK_RULES_V1로
              하며 로그인 없이 이용합니다.
            </dd>
          </div>
          <div>
            <dt>
              <Link to="/strategy">나의 전략</Link>
            </dt>
            <dd>
              소득·지출·자산·목표·대출을 넣으면 규칙 BANK_STRATEGY_V1이 비상금 → 고금리 대출 →
              목표별 예·적금 순서로 실행 항목을 냅니다. 결과는 저장하지 않습니다.
            </dd>
          </div>
          <div>
            <dt>
              <Link to="/simulation">모의 운용</Link>
            </dt>
            <dd>
              고객 계정으로 로그인한 뒤 가상 자금·가상 날짜로 파킹통장·정기예금·적금에 가입하고
              시간을 진행해 이자·세금·만기·중도해지·적금 미납을 겪어 봅니다.
            </dd>
          </div>
          <div>
            <dt>
              <Link to="/products">은행 업무 체험</Link>
            </dt>
            <dd>
              가상 대출상품 조회·신청과 본인 신청 내역 조회(고객), 직원 업무 안내(심사 담당자),
              상품·정책 관리(운영 관리자).
            </dd>
          </div>
        </dl>
      </section>
      <section id="application" className="guide-section">
        <div className="section-heading">
          <h2>대출 신청 절차</h2>
        </div>
        <ProgressSteps />
        <div className="guide-steps">
          <article>
            <span>01</span>
            <h3>상품 조건 확인</h3>
            <p>대출상품에서 금리, 신청 가능한 금액과 기간, 상환방식을 확인합니다.</p>
            <Link to="/products" className="text-button">
              상품 조회
              <AppIcon name="chevron" size={14} />
            </Link>
          </article>
          <article>
            <span>02</span>
            <h3>신청정보 입력</h3>
            <p>고객 계정으로 로그인한 후 희망 금액·기간과 가상 연 소득을 입력합니다.</p>
          </article>
          <article>
            <span>03</span>
            <h3>접수 내역 확인</h3>
            <p>접수 완료 후 나의 대출에서 신청 조건과 현재 진행 상태를 조회합니다.</p>
            <Link to="/my" className="text-button">
              신청 조회
              <AppIcon name="chevron" size={14} />
            </Link>
          </article>
        </div>
      </section>
      <section id="scope" className="guide-section">
        <div className="section-heading">
          <h2>제공 범위</h2>
        </div>
        <dl className="guide-scope">
          <div>
            <dt>현재 제공</dt>
            <dd>
              은행업 개념 학습·확인 문제·용어 사전, 계산기 5종, 나의 전략, 예·적금 모의 운용, 학습용
              회원가입·로그인, 대출상품 조회·신청, 본인 신청 내역 조회, 운영자 상품 관리
            </dd>
          </div>
          <div>
            <dt>준비 중</dt>
            <dd>대출 약정, 대출 실행, 상환, 대출 거래원장</dd>
          </div>
          <div>
            <dt>다루지 않음</dt>
            <dd>
              실제 금리 수집·비교, 실제 상품 추천·광고·중개, 실제 계좌·이체·인증서, 주식·펀드·외환
              모의투자, 학습 진도 저장
            </dd>
          </div>
        </dl>
      </section>
      <section id="notice" className="guide-section">
        <div className="section-heading">
          <h2>시뮬레이션 이용 안내</h2>
        </div>
        <div className="guide-safety">
          <AppIcon name="shield" size={29} />
          <div>
            <strong>실제 금융거래가 발생하지 않습니다.</strong>
            <p>
              OMB는 은행업 학습용 모의 서비스입니다. 금융상품을 판매·추천하거나 대출을 중개하지
              않으며, 실제 금융기관·신용정보와 연결하지 않습니다.
            </p>
          </div>
        </div>
        <ul className="guide-bullets">
          <li>
            가상의 이름·이메일·소득정보로 이용해 주세요. 실제 개인정보와 금융정보는 입력하지
            않습니다.
          </li>
          <li>
            이자소득세 15.4%, 예금자보호 1억 원, 은행권 DSR 40%는 출처·확인일과 함께 표시한 제도
            수치입니다. 모의 상품 금리·중도해지이율·비상금 기준은 교육용 가정값입니다.
          </li>
          <li>
            계산기와 나의 전략의 결과는 공개된 교육용 규칙의 계산 결과입니다. 실제 은행의
            이자·상환액과 원 단위로 다를 수 있으며 금융 자문이나 상품 추천이 아닙니다.
          </li>
          <li>모의 운용의 계좌·거래는 가상 원장이며 실제 자금이 이동하지 않습니다.</li>
          <li>
            대출 접수 결과가 불분명하면 다시 신청하기 전에 나의 대출에서 신청 내역을 먼저 확인해
            주세요.
          </li>
          <li>다른 사람과 기기를 함께 사용하는 경우 이용 후 로그아웃해 주세요.</li>
        </ul>
      </section>
    </>
  )
}
