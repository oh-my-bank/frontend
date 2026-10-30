import { Link, NavLink, Navigate, useParams } from 'react-router-dom'
import { calculatorInfo, calculatorKinds, isCalculatorKind } from '../../lib/learning'
import AppIcon from '../../components/AppIcon'
import { ConceptLinks } from './parts'
import DepositTool from './DepositTool'
import SavingsTool from './SavingsTool'
import LoanTool from './LoanTool'
import DsrTool from './DsrTool'
import GoalTool from './GoalTool'
import '../../styles/banking-products.css'
import '../../styles/tools.css'

const tools = {
  deposit: DepositTool,
  savings: SavingsTool,
  loan: LoanTool,
  dsr: DsrTool,
  goal: GoalTool,
}

export default function CalculatorPage() {
  const { kind } = useParams<{ kind: string }>()
  if (!isCalculatorKind(kind)) return <Navigate to="/tools" replace />
  const info = calculatorInfo[kind]
  const Tool = tools[kind]
  return (
    <>
      <header className="page-title">
        <div>
          <h1>{info.title}</h1>
          <p>{info.summary}</p>
        </div>
        <Link to="/tools#rules" className="text-button">
          계산 규칙·금리표 보기
          <AppIcon name="chevron" size={14} />
        </Link>
      </header>
      <nav className="tool-tabs" aria-label="계산기 선택">
        {calculatorKinds.map((item) => (
          <NavLink key={item} to={`/tools/${item}`}>
            {calculatorInfo[item].title.replace(' 계산기', '')}
          </NavLink>
        ))}
      </nav>
      <p className="tool-disclaimer">
        <AppIcon name="info" size={16} />
        결과는 OMB 교육용 규칙으로 서버가 계산한 값입니다. 실제 은행의 이자·상환액과 원 단위로 다를
        수 있으며 금융 자문이 아닙니다.
      </p>
      <Tool />
      <ConceptLinks concepts={info.concepts} />
    </>
  )
}
