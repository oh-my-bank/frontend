import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { compactWon, rate, wonText } from '../lib/format'
import {
  calculatorInfo,
  calculatorKinds,
  fetchRules,
  productKindLabels,
  type Rules,
} from '../lib/learning'
import AppIcon from '../components/AppIcon'
import ErrorNotice from '../components/ErrorNotice'
import SourceList from '../components/SourceList'
import '../styles/banking-products.css'
import '../styles/tools.css'

export default function ToolsPage() {
  const [rules, setRules] = useState<Rules | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [reload, setReload] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setError(null)
    fetchRules(controller.signal)
      .then(setRules)
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause)
      })
    return () => controller.abort()
  }, [reload])
  return (
    <>
      <header className="page-title">
        <div>
          <h1>계산기</h1>
          <p>
            예금·적금·대출·DSR·목표 저축과 거치·변동금리, 금리 시나리오를 숫자로 확인합니다. 모든
            계산은 공개된 규칙으로 서버가 하고, 화면은 그 결과만 보여 줍니다.
          </p>
        </div>
      </header>
      <ul className="tools-hub">
        {calculatorKinds.map((kind) => (
          <li key={kind}>
            <Link to={`/tools/${kind}`}>
              <AppIcon name="calculator" size={24} />
              <strong>{calculatorInfo[kind].title}</strong>
              <span>{calculatorInfo[kind].summary}</span>
            </Link>
          </li>
        ))}
      </ul>
      <section id="rules" className="guide-section" aria-labelledby="rules-title">
        <div className="section-heading">
          <div>
            <h2 id="rules-title">계산 규칙과 모의 금리표</h2>
            <p>제도 수치는 출처·확인일과 함께, 모의 상품 금리는 교육용 가정값으로 구분합니다.</p>
          </div>
          {rules && <span className="tool-rule-tag">규칙 {rules.ruleVersion}</span>}
        </div>
        {error ? (
          <>
            <ErrorNotice error={error} message="계산 규칙을 불러오지 못했습니다." />
            <button
              type="button"
              className="button button-outline small"
              onClick={() => setReload((value) => value + 1)}
            >
              다시 불러오기
            </button>
          </>
        ) : !rules ? (
          <div className="empty-state" role="status">
            계산 규칙을 불러오고 있습니다.
          </div>
        ) : (
          <>
            <h3 className="tools-subheading">제도 수치</h3>
            <div className="tool-table-wrap">
              <table className="tool-table">
                <caption className="bank-product-sr-only">제도 수치</caption>
                <thead>
                  <tr>
                    <th scope="col">항목</th>
                    <th scope="col">값</th>
                    <th scope="col">성격</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">이자소득 원천징수</th>
                    <td>
                      소득세 {rules.incomeTaxPercent}% + 지방소득세(소득세의{' '}
                      {rules.localTaxPercentOfIncomeTax}%) = {rules.totalTaxPercent}%
                    </td>
                    <td>제도</td>
                  </tr>
                  <tr>
                    <th scope="row">예금자보호 한도</th>
                    <td>
                      1인·1금융회사 원금+이자 {compactWon(rules.depositProtectionLimit)}(
                      {wonText(rules.depositProtectionLimit)})
                    </td>
                    <td>제도</td>
                  </tr>
                  <tr>
                    <th scope="row">차주단위 DSR 한도</th>
                    <td>은행권 {rules.dsrThresholdPercent}%</td>
                    <td>제도(산정 방식은 교육용 단순화)</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <SourceList sources={rules.sources} />
            <h3 className="tools-subheading">
              모의 상품 금리표 <span className="tool-assumption">교육용 가정값</span>
            </h3>
            <p className="form-help">
              특정 은행·시점의 고시 금리가 아닙니다. 나의 전략과 모의 운용이 같은 금리표를 씁니다.
            </p>
            <div className="tool-table-wrap">
              <table className="tool-table">
                <caption className="bank-product-sr-only">모의 상품 금리표</caption>
                <thead>
                  <tr>
                    <th scope="col">상품</th>
                    <th scope="col">종류</th>
                    <th scope="col">기간</th>
                    <th scope="col">연이율</th>
                    <th scope="col">가입 금액</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.products.map((product) => (
                    <tr key={product.code}>
                      <th scope="row">
                        {product.name}
                        {product.assumption && (
                          <span className="tool-assumption small">가정값</span>
                        )}
                      </th>
                      <td>{productKindLabels[product.kind]}</td>
                      <td>{product.termMonths ? `${product.termMonths}개월` : '-'}</td>
                      <td>연 {rate(product.annualRate)}%</td>
                      <td>
                        {product.kind === 'INSTALLMENT_SAVINGS' ? '월 ' : ''}
                        {compactWon(product.minAmount)} ~ {compactWon(product.maxAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3 className="tools-subheading">
              중도해지이율 <span className="tool-assumption">교육용 가정값</span>
            </h3>
            <div className="tool-table-wrap">
              <table className="tool-table">
                <caption className="bank-product-sr-only">중도해지이율</caption>
                <thead>
                  <tr>
                    <th scope="col">경과 기간</th>
                    <th scope="col">적용 이율</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.earlyTermination.map((rule, index) => {
                    const next = rules.earlyTermination[index + 1]
                    return (
                      <tr key={rule.minMonths}>
                        <th scope="row">
                          {rule.minMonths === 0 ? '가입 후' : `${rule.minMonths}개월 이상`}
                          {next ? ` ${next.minMonths}개월 미만` : ''}
                        </th>
                        <td>
                          {rule.fixedRate !== null
                            ? `연 ${rate(rule.fixedRate)}%`
                            : `약정 금리 × ${Math.round(Number(rule.ratioOfContractRate) * 100)}%`}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </>
  )
}
