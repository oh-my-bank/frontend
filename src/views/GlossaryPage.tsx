import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  categoryLabel,
  categoryLabels,
  fetchGlossary,
  glossarySearch,
  type CategoryCode,
  type Term,
} from '../lib/learning'
import AppIcon from '../components/AppIcon'
import ErrorNotice from '../components/ErrorNotice'
import '../styles/learning.css'

export default function GlossaryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const q = searchParams.get('q') ?? ''
  const category = searchParams.get('category') ?? ''
  const [items, setItems] = useState<Term[] | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [pending, setPending] = useState(true)
  const [reload, setReload] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setPending(true)
    setError(null)
    // Waits for a short pause in typing so every keystroke does not become a request.
    const timer = window.setTimeout(() => {
      fetchGlossary(q, category, controller.signal)
        .then((result) => setItems(result.items))
        .catch((cause) => {
          if (!controller.signal.aborted) setError(cause)
        })
        .finally(() => {
          if (!controller.signal.aborted) setPending(false)
        })
    }, 250)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [q, category, reload])
  const update = (nextQ: string, nextCategory: string) =>
    setSearchParams(glossarySearch(nextQ, nextCategory), {
      replace: true,
      state: { keepScroll: true },
    })
  return (
    <>
      <header className="page-title">
        <div>
          <h1>용어 사전</h1>
          <p>은행 거래와 제도에서 쓰는 말을 가나다순으로 찾아봅니다.</p>
        </div>
        <Link to="/learn" className="button button-outline small">
          <AppIcon name="book" size={17} />
          개념 학습
        </Link>
      </header>
      <form className="glossary-search" role="search" onSubmit={(event) => event.preventDefault()}>
        <label htmlFor="glossary-q">용어 검색</label>
        <div className="glossary-search-input">
          <AppIcon name="search" size={19} />
          <input
            id="glossary-q"
            type="search"
            value={q}
            onChange={(event) => update(event.target.value, category)}
            placeholder="예: 예금자보호, DSR, 중도해지"
            aria-describedby="glossary-q-help"
            autoComplete="off"
          />
        </div>
        <p className="form-help" id="glossary-q-help">
          용어·영문 표기·정의에서 찾습니다. 대소문자는 구분하지 않습니다.
        </p>
      </form>
      <div className="glossary-filter" role="group" aria-label="분류 선택">
        <button type="button" aria-pressed={category === ''} onClick={() => update(q, '')}>
          전체
        </button>
        {(Object.keys(categoryLabels) as CategoryCode[]).map((code) => (
          <button
            key={code}
            type="button"
            aria-pressed={category === code}
            onClick={() => update(q, code)}
          >
            {categoryLabels[code]}
          </button>
        ))}
      </div>
      <p className="glossary-count" role="status" aria-live="polite">
        {pending
          ? '용어를 찾고 있습니다.'
          : items
            ? `${category ? `${categoryLabel(category)} · ` : ''}${q.trim() ? `‘${q.trim()}’ ` : ''}용어 ${items.length}개`
            : ''}
      </p>
      {error ? (
        <>
          <ErrorNotice error={error} message="용어를 불러오지 못했습니다." />
          <button
            type="button"
            className="button button-outline small"
            onClick={() => setReload((value) => value + 1)}
          >
            다시 불러오기
          </button>
        </>
      ) : items === null ? (
        <div className="empty-state">용어를 불러오고 있습니다.</div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <h2>찾는 용어가 없습니다.</h2>
          <p>다른 말로 찾거나 분류를 ‘전체’로 바꿔 보세요.</p>
        </div>
      ) : (
        <dl className={`glossary-list${pending ? ' stale' : ''}`}>
          {items.map((term) => (
            <div key={term.slug} id={`term-${term.slug}`}>
              <dt>
                <strong>{term.term}</strong>
                {term.english && <span lang="en">{term.english}</span>}
                <span className="learn-category-tag">{categoryLabel(term.category)}</span>
              </dt>
              <dd>
                <p>{term.definition}</p>
                {term.example && (
                  <p className="glossary-example">
                    <span>예</span>
                    {term.example}
                  </p>
                )}
                {term.relatedConcept && (
                  <Link to={`/learn/${term.relatedConcept}`} className="text-button">
                    관련 개념 읽기
                    <AppIcon name="chevron" size={13} />
                  </Link>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </>
  )
}
