import { won } from '../lib/format'
import { loanDate, type LoanDetail } from '../lib/loans'
import { feeRateLabel, prepaymentTypeLabel } from '../lib/prepayments'
import AppIcon from './AppIcon'
import '../styles/prepayments.css'

/** Recorded prepayments of a loan for the customer and staff screens (L03). Nothing is shown before the first one. */
export default function LoanPrepaymentHistory({ loan }: { loan: LoanDetail }) {
  const items = loan.prepayments ?? []
  if (!items.length) return null
  return (
    <section className="loan-next loan-prepay" aria-labelledby="loan-prepay-history-title">
      <h2 id="loan-prepay-history-title">조기상환 내역</h2>
      <dl className="details-list">
        <div>
          <dt>조기상환 원금 합계</dt>
          <dd>
            {won(loan.prepaidPrincipal ?? items.reduce((sum, item) => sum + item.principal, 0))}
          </dd>
        </div>
        <div>
          <dt>중도상환수수료 합계</dt>
          <dd>{won(loan.prepaymentFees ?? items.reduce((sum, item) => sum + item.fee, 0))}</dd>
        </div>
      </dl>
      <div className="sim-table-wrap">
        <table className="sim-table">
          <caption className="bank-sr-only">조기상환 기록</caption>
          <thead>
            <tr>
              <th scope="col">순번</th>
              <th scope="col">유형</th>
              <th scope="col">상환일 (가상)</th>
              <th scope="col" className="sim-number">
                경과일
              </th>
              <th scope="col" className="sim-number">
                상환 원금
              </th>
              <th scope="col" className="sim-number">
                수수료
              </th>
              <th scope="col" className="sim-number">
                상환 총액
              </th>
              <th scope="col" className="sim-number">
                상환 후 남은 원금
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <th scope="row">{item.sequence}</th>
                <td>{prepaymentTypeLabel(item.type)}</td>
                <td>
                  {loanDate(item.businessDate)}
                  <small className="loan-prepay-note">
                    {item.paidInstallmentsBefore > 0
                      ? ` ${item.paidInstallmentsBefore}회차 납부 후`
                      : ' 실행일'}
                  </small>
                </td>
                <td className="sim-number">{item.elapsedDays.toLocaleString('ko-KR')}일</td>
                <td className="sim-number">{won(item.principal)}</td>
                <td className="sim-number">{won(item.fee)}</td>
                <td className="sim-number">{won(item.totalAmount)}</td>
                <td className="sim-number">{won(item.outstandingAfter)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="bank-section-help">
        <AppIcon name="info" size={14} /> 수수료는 기록 당시 규칙 {items[0].ruleVersion}의 교육용
        가정값(수수료율 {feeRateLabel(items[0].feeRate)}, 면제기간{' '}
        {items[0].exemptionDays.toLocaleString('ko-KR')}일)으로 계산했습니다. 부분상환 뒤의 상환
        일정은 새로 계산한 금액이며, 조기상환 거래는 취소(반대 거래)하지 않습니다.
      </p>
    </section>
  )
}
