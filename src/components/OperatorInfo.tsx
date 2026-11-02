import type { LegalOperator } from '../lib/legal'

/** Operator and privacy officer details come from launch settings; until all are set the screen says so. */
export default function OperatorInfo({ operator }: { operator: LegalOperator }) {
  return (
    <section className="legal-operator" aria-labelledby="legal-operator-title">
      <h2 id="legal-operator-title">운영자 정보</h2>
      {operator.configured ? (
        <dl className="details-list">
          <div>
            <dt>운영자</dt>
            <dd>{operator.name}</dd>
          </div>
          <div>
            <dt>문의 연락처</dt>
            <dd className="legal-wrap">{operator.contact}</dd>
          </div>
          <div>
            <dt>개인정보 보호책임자</dt>
            <dd>{operator.privacyOfficerName}</dd>
          </div>
          <div>
            <dt>보호책임자 연락처</dt>
            <dd className="legal-wrap">{operator.privacyOfficerContact}</dd>
          </div>
        </dl>
      ) : (
        <p className="legal-pending" role="status">
          운영자 정보 준비 중입니다. 운영자·연락처·개인정보 보호책임자는 서비스 공개 전에 확정해
          이곳에 표시합니다.
        </p>
      )}
    </section>
  )
}
