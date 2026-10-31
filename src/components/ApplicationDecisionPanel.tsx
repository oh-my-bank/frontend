import { dateTime, rate, won } from '../lib/format'
import { customerReviewStage } from '../lib/reviews'
import type { LoanApplication } from '../types'
import AppIcon from './AppIcon'
import '../styles/staff-reviews.css'

/** The mock review result of the customer's own application, from the server's `decision`. */
export default function ApplicationDecisionPanel({
  application,
}: {
  application: LoanApplication
}) {
  const decision = application.decision
  const stage = customerReviewStage(application.status, decision)
  if (!stage) return null
  return (
    <section
      className={`bank-statement bank-decision bank-decision-${stage.tone}`}
      aria-labelledby="bank-decision-title"
    >
      <div className="bank-statement-heading">
        <div>
          <span>모의 심사 결과</span>
          <h2 id="bank-decision-title">{stage.title}</h2>
        </div>
        {decision && (
          <span className="bank-decision-date">{dateTime(decision.decidedAt)} 결정</span>
        )}
      </div>
      <div className="bank-statement-body">
        <p>{stage.description}</p>
        {decision?.approvedTerms && (
          <dl className="details-list bank-decision-terms">
            <div>
              <dt>확정 금액</dt>
              <dd>{won(decision.approvedTerms.amount)}</dd>
            </div>
            <div>
              <dt>확정 기간</dt>
              <dd>{decision.approvedTerms.termMonths}개월</dd>
            </div>
            <div>
              <dt>확정 금리</dt>
              <dd>연 {rate(decision.approvedTerms.annualInterestRate)}%</dd>
            </div>
          </dl>
        )}
        <p className="bank-section-help">
          <AppIcon name="info" size={14} />{' '}
          {decision?.notice ??
            '교육용 모의 심사입니다. 실제 신용평가나 금융기관의 대출 심사 기준이 아닙니다.'}
        </p>
      </div>
    </section>
  )
}
