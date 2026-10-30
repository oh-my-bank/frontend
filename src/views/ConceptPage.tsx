import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../lib/api'
import {
  fetchConcept,
  gradeQuiz,
  levelLabel,
  paragraphs,
  relatedToolLinks,
  type ConceptDetail,
  type QuizQuestion,
  type QuizResult,
} from '../lib/learning'
import AppIcon from '../components/AppIcon'
import ErrorNotice from '../components/ErrorNotice'
import SourceList from '../components/SourceList'
import '../styles/learning.css'

const optionMark = ['①', '②', '③', '④', '⑤', '⑥']

function Quiz({ slug, questions }: { slug: string; questions: QuizQuestion[] }) {
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [result, setResult] = useState<QuizResult | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const answered = Object.keys(answers).length
  async function submit() {
    setPending(true)
    setError(null)
    try {
      const graded = await gradeQuiz(
        slug,
        Object.entries(answers).map(([questionId, optionIndex]) => ({ questionId, optionIndex })),
      )
      setResult(graded)
      requestAnimationFrame(() => document.getElementById('quiz-score')?.focus())
    } catch (cause) {
      setError(cause)
    } finally {
      setPending(false)
    }
  }
  function retry() {
    setAnswers({})
    setResult(null)
    setError(null)
    requestAnimationFrame(() => document.getElementById('quiz-title')?.focus())
  }
  return (
    <section className="learn-quiz" aria-labelledby="quiz-title">
      <h2 id="quiz-title" tabIndex={-1}>
        확인 문제
      </h2>
      <p className="form-help">
        보기를 고르고 채점을 누르면 서버가 정답과 해설을 알려 줍니다. 채점 결과는 저장하지 않습니다.
      </p>
      {result && (
        <p className="learn-quiz-score" id="quiz-score" tabIndex={-1} role="status">
          {result.total}문항 중 <strong>{result.correct}문항</strong>을 맞혔습니다.
        </p>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        {questions.map((question, number) => {
          const graded = result?.results.find((item) => item.questionId === question.id)
          return (
            <fieldset
              key={question.id}
              className={`learn-question${graded ? (graded.correct ? ' correct' : ' wrong') : ''}`}
              disabled={!!result || pending}
            >
              <legend>
                <span>문제 {number + 1}</span>
                {question.question}
              </legend>
              <div className="learn-options">
                {question.options.map((option, index) => {
                  const isAnswer = graded?.answerIndex === index
                  const isSelected =
                    (graded ? graded.selectedIndex : answers[question.id]) === index
                  return (
                    <label
                      key={index}
                      className={
                        graded && isAnswer ? 'answer' : graded && isSelected ? 'selected-wrong' : ''
                      }
                    >
                      <input
                        type="radio"
                        name={question.id}
                        checked={isSelected}
                        onChange={() =>
                          setAnswers((current) => ({ ...current, [question.id]: index }))
                        }
                      />
                      <span>
                        {optionMark[index] ?? `${index + 1}.`} {option}
                      </span>
                      {graded && isAnswer && <em className="learn-option-tag">정답</em>}
                      {graded && isSelected && !isAnswer && (
                        <em className="learn-option-tag wrong">내 선택</em>
                      )}
                    </label>
                  )
                })}
              </div>
              {graded && (
                <div className="learn-explanation">
                  <strong>
                    {graded.correct
                      ? '정답입니다.'
                      : graded.selectedIndex === null
                        ? '답하지 않아 오답으로 채점했습니다.'
                        : '오답입니다.'}
                  </strong>
                  <p>{graded.explanation}</p>
                </div>
              )}
            </fieldset>
          )
        })}
        <ErrorNotice error={error} />
        {result ? (
          <button type="button" className="button button-outline" onClick={retry}>
            다시 풀기
          </button>
        ) : (
          <div className="learn-quiz-actions">
            <span>
              {questions.length}문항 중 {answered}문항 선택
            </span>
            <button type="submit" className="button button-primary" disabled={pending}>
              {pending ? '채점 중…' : '채점하기'}
            </button>
          </div>
        )}
      </form>
    </section>
  )
}

export default function ConceptPage() {
  const { slug = '' } = useParams<{ slug: string }>()
  const [concept, setConcept] = useState<ConceptDetail | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [reload, setReload] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setError(null)
    fetchConcept(slug, controller.signal)
      .then((detail) => {
        setConcept(detail)
        document.title = `${detail.title} | Oh My Bank`
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause)
      })
    return () => controller.abort()
  }, [slug, reload])
  if (error instanceof ApiError && error.code === 'CONCEPT_NOT_FOUND')
    return (
      <div className="empty-state">
        <h2>찾는 개념이 없습니다.</h2>
        <p>주소를 확인하거나 개념 목록에서 다시 골라 주세요.</p>
        <Link to="/learn" className="button button-outline">
          개념 목록
        </Link>
      </div>
    )
  if (error)
    return (
      <>
        <ErrorNotice error={error} message="개념을 불러오지 못했습니다." />
        <button
          type="button"
          className="button button-outline small"
          onClick={() => setReload((value) => value + 1)}
        >
          다시 불러오기
        </button>
      </>
    )
  if (!concept)
    return (
      <div className="empty-state" role="status">
        개념을 불러오고 있습니다.
      </div>
    )
  return (
    <article className="learn-article">
      <Link to="/learn" className="back-link">
        <AppIcon name="chevron" size={13} />
        은행업 학습 목록
      </Link>
      <header className="learn-article-heading">
        <span className="learn-concept-meta">
          <span className="learn-category-tag">{concept.categoryLabel}</span>
          <span className={`learn-level ${concept.level.toLowerCase()}`}>
            {levelLabel(concept.level)}
          </span>
          <span>{concept.readMinutes}분 읽기</span>
        </span>
        <h1>{concept.title}</h1>
        <p>{concept.summary}</p>
      </header>
      <div className="learn-article-body">
        <div className="learn-article-main">
          {concept.sections.map((section, index) => (
            <section key={index} className="learn-section">
              <h2>{section.heading}</h2>
              {paragraphs(section.body).map((paragraph, paragraphIndex) => (
                <p key={paragraphIndex}>{paragraph}</p>
              ))}
            </section>
          ))}
          {concept.example && (
            <section className="learn-example" aria-labelledby="learn-example-title">
              <h2 id="learn-example-title">계산 예시 · {concept.example.title}</h2>
              {paragraphs(concept.example.body).map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
              {concept.example.rows.length > 0 && (
                <table className="learn-example-table">
                  <caption className="bank-product-sr-only">{concept.example.title}</caption>
                  <tbody>
                    {concept.example.rows.map((row, index) => (
                      <tr key={index}>
                        <th scope="row">{row.label}</th>
                        <td>{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          )}
          {concept.misconceptions.length > 0 && (
            <section className="learn-section" aria-labelledby="learn-myth-title">
              <h2 id="learn-myth-title">흔한 오해</h2>
              <dl className="learn-myths">
                {concept.misconceptions.map((item, index) => (
                  <div key={index}>
                    <dt>
                      <span>오해</span>
                      {item.myth}
                    </dt>
                    <dd>
                      <span>사실</span>
                      {item.fact}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          {concept.checklist.length > 0 && (
            <section className="learn-section" aria-labelledby="learn-checklist-title">
              <h2 id="learn-checklist-title">확인할 것</h2>
              <ul className="learn-checklist">
                {concept.checklist.map((item, index) => (
                  <li key={index}>
                    <AppIcon name="check" size={17} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {concept.quiz.length > 0 && <Quiz slug={concept.slug} questions={concept.quiz} />}
        </div>
        <aside className="learn-article-aside" aria-label="관련 정보">
          {concept.relatedTerms.length > 0 && (
            <section>
              <h2>관련 용어</h2>
              <ul className="learn-term-links">
                {concept.relatedTerms.map((term) => (
                  <li key={term.slug}>
                    <Link to={`/glossary?q=${encodeURIComponent(term.term)}`}>{term.term}</Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {concept.relatedTools.length > 0 && (
            <section>
              <h2>직접 해 보기</h2>
              <ul className="learn-tool-links">
                {concept.relatedTools.map((tool) => (
                  <li key={tool}>
                    <Link to={relatedToolLinks[tool].to}>
                      {relatedToolLinks[tool].label}
                      {tool === 'simulation' && <small> 고객 로그인</small>}
                      <AppIcon name="chevron" size={14} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section>
            <h2>출처</h2>
            <SourceList sources={concept.sources} />
            <p className="form-help">콘텐츠 버전 {concept.contentVersion}</p>
          </section>
        </aside>
      </div>
      <nav className="learn-pager" aria-label="이전·다음 개념">
        {concept.previous ? (
          <Link to={`/learn/${concept.previous.slug}`} rel="prev">
            <span>이전 개념</span>
            <strong>{concept.previous.title}</strong>
          </Link>
        ) : (
          <span />
        )}
        {concept.next ? (
          <Link to={`/learn/${concept.next.slug}`} rel="next" className="next">
            <span>다음 개념</span>
            <strong>{concept.next.title}</strong>
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </article>
  )
}
