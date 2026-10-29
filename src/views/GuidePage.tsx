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
        <a href="#application">신청 절차</a>
        <a href="#scope">제공 서비스</a>
        <a href="#notice">시뮬레이션 안내</a>
      </nav>
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
          <h2>이용 가능한 서비스</h2>
        </div>
        <dl className="guide-scope">
          <div>
            <dt>현재 제공</dt>
            <dd>학습용 회원가입·로그인, 상품 조회, 대출 신청, 본인 신청 내역 조회</dd>
          </div>
          <div>
            <dt>준비 중</dt>
            <dd>모의 심사, 약정, 대출 실행, 상환, 거래원장 및 운영 관리</dd>
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
              OMB는 금융업무 학습용 서비스입니다. 금융상품을 판매하거나 대출을 중개하지 않으며, 실제
              금융기관·신용정보와 연결하지 않습니다.
            </p>
          </div>
        </div>
        <ul className="guide-bullets">
          <li>
            가상의 이름·이메일·소득정보로 이용해 주세요. 실제 개인정보와 금융정보는 입력하지
            않습니다.
          </li>
          <li>상품 조건과 향후 모의 심사 결과는 실제 대출 가능 여부를 판단하는 자료가 아닙니다.</li>
          <li>
            접수 결과가 불분명하면 다시 신청하기 전에 나의 대출에서 신청 내역을 먼저 확인해 주세요.
          </li>
          <li>다른 사람과 기기를 함께 사용하는 경우 이용 후 로그아웃해 주세요.</li>
        </ul>
      </section>
    </>
  )
}
