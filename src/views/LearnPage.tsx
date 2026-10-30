import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { fetchConcepts, levelLabel, type Category, type ConceptSummary } from '../lib/learning'
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
            {data.categories.map((category) => (
              <a key={category.code} href={`#category-${category.code}`}>
                {category.label}
              </a>
            ))}
          </nav>
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
