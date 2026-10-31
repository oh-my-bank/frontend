import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  fetchConcepts,
  levelLabel,
  relatedToolLinks,
  type Category,
  type ConceptSummary,
} from '../lib/learning'
import { fetchLearningPath, pathTotals, type LearningPath } from '../lib/learningPath'
import { anchorId } from '../lib/navigation'
import AppIcon from '../components/AppIcon'
import ErrorNotice from '../components/ErrorNotice'
import '../styles/learning.css'

export default function LearnPage() {
  const [data, setData] = useState<{ categories: Category[]; items: ConceptSummary[] } | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [reload, setReload] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setError(null)
    fetchConcepts(controller.signal)
      .then(setData)
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause)
      })
    return () => controller.abort()
  }, [reload])
  // The path is loaded separately so a failure only hides the path, not the concept list.
  const [path, setPath] = useState<LearningPath | null>(null)
  const [pathError, setPathError] = useState<unknown>(null)
  useEffect(() => {
    const controller = new AbortController()
    fetchLearningPath(controller.signal)
      .then(setPath)
      .catch((cause) => {
        if (!controller.signal.aborted) setPathError(cause)
      })
    return () => controller.abort()
  }, [])
  const location = useLocation()
  // The list arrives after the router's hash scroll, so a category link is followed here.
  useEffect(() => {
    const id = data ? anchorId(location.hash) : null
    if (id) document.getElementById(id)?.scrollIntoView()
  }, [data, location.hash])
  return (
    <>
      <header className="page-title">
        <div>
          <h1>은행업 학습</h1>
          <p>
            은행이 하는 일부터 예금·대출·금리·규제·소비자 보호까지, 분류별 개념을 읽고 확인 문제로
            점검합니다. 개념마다 공식 기관 출처를 달았습니다.
          </p>
        </div>
        <Link to="/glossary" className="button button-outline small">
          <AppIcon name="list" size={17} />
          용어 사전
        </Link>
      </header>
      {error ? (
        <>
          <ErrorNotice error={error} message="개념 목록을 불러오지 못했습니다." />
          <button
            type="button"
            className="button button-outline small"
            onClick={() => setReload((value) => value + 1)}
          >
            다시 불러오기
          </button>
        </>
      ) : !data ? (
        <div className="empty-state" role="status">
          개념 목록을 불러오고 있습니다.
        </div>
      ) : data.items.length === 0 ? (
        <div className="empty-state">아직 공개된 개념이 없습니다.</div>
      ) : (
        <>
          <nav className="learn-category-index" aria-label="학습 분류">
            {path && <a href="#learning-path">권장 학습 경로</a>}
            {data.categories.map((category) => (
              <a key={category.code} href={`#category-${category.code}`}>
                {category.label}
              </a>
            ))}
          </nav>
          {path ? (
            <LearningPathSection path={path} />
          ) : pathError ? (
            <p className="form-help learn-path-error">
              권장 학습 경로를 불러오지 못했습니다. 아래 분류별 목록으로 학습할 수 있습니다.
            </p>
          ) : null}
          {data.categories.map((category) => {
            const items = data.items.filter((item) => item.category === category.code)
            if (!items.length) return null
            return (
              <section
                key={category.code}
                id={`category-${category.code}`}
                className="learn-category"
                aria-labelledby={`category-${category.code}-title`}
              >
                <div className="learn-category-heading">
                  <h2 id={`category-${category.code}-title`}>{category.label}</h2>
                  <p>{category.description}</p>
                </div>
                <ol className="learn-concept-list">
                  {items.map((item) => (
                    <li key={item.slug}>
                      <Link to={`/learn/${item.slug}`}>
                        <span className="learn-concept-meta">
                          <span className={`learn-level ${item.level.toLowerCase()}`}>
                            {levelLabel(item.level)}
                          </span>
                          <span>{item.readMinutes}분 읽기</span>
                          <span>확인 문제 {item.questionCount}문항</span>
                        </span>
                        <strong>{item.title}</strong>
                        <span className="learn-concept-summary">{item.summary}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </section>
            )
          })}
        </>
      )}
    </>
  )
}

function LearningPathSection({ path }: { path: LearningPath }) {
  return (
    <section id="learning-path" className="learn-path" aria-labelledby="learning-path-title">
      <div className="learn-category-heading">
        <h2 id="learning-path-title">{path.title}</h2>
        <p>{pathTotals(path)}</p>
      </div>
      {path.description && <p className="learn-path-description">{path.description}</p>}
      <ol className="learn-path-stages">
        {path.stages.map((stage) => (
          <li key={stage.code} className="learn-path-stage">
            <div className="learn-path-stage-heading">
              <span className="learn-path-step" aria-hidden="true">
                {stage.order}
              </span>
              <div>
                <h3>
                  <span className="learn-sr-only">{stage.order}단계 </span>
                  {stage.title}
                </h3>
                <p>{stage.goal}</p>
                <span className="learn-concept-meta">
                  {pathTotals({ ...stage, conceptCount: stage.concepts.length })}
                </span>
              </div>
            </div>
            <ol className="learn-path-concepts">
              {stage.concepts.map((concept) => (
                <li key={concept.slug}>
                  <Link to={`/learn/${concept.slug}`}>
                    <span className="learn-path-order">{concept.order}</span>
                    <span className="learn-path-concept-title">{concept.title}</span>
                    <span className={`learn-level ${concept.level.toLowerCase()}`}>
                      {levelLabel(concept.level)}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
            {stage.practice.length > 0 && (
              <ul className="learn-path-practice" aria-label={`${stage.title} 직접 해 보기`}>
                {stage.practice.map((tool) => (
                  <li key={tool}>
                    <Link to={relatedToolLinks[tool].to}>
                      {relatedToolLinks[tool].label}
                      {tool === 'simulation' && <small> 고객 로그인</small>}
                      <AppIcon name="chevron" size={14} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
