import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ApiError } from '../lib/api'
import { fetchLegalDocument, legalPaths, type LegalCode, type LegalDocument } from '../lib/legal'
import ErrorNotice from '../components/ErrorNotice'
import LegalMarkdown from '../components/LegalMarkdown'
import OperatorInfo from '../components/OperatorInfo'
import '../styles/banking-products.css'
import '../styles/legal.css'

const otherDocuments: { code: LegalCode; label: string }[] = [
  { code: 'TERMS', label: '이용약관' },
  { code: 'PRIVACY', label: '개인정보 처리방침' },
  { code: 'NOTICE', label: '서비스 고지' },
]

/** Public page for one legal document; `?version=` shows an earlier published version. */
export default function LegalDocumentPage({ code }: { code: LegalCode }) {
  const [params] = useSearchParams()
  const version = params.get('version') ?? undefined
  const [doc, setDoc] = useState<LegalDocument | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setDoc(null)
    setError(null)
    fetchLegalDocument(code, version, controller.signal)
      .then(setDoc)
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause)
      })
    return () => controller.abort()
  }, [code, version, reload])

  const title = otherDocuments.find((item) => item.code === code)?.label ?? '서비스 문서'
  return (
    <>
      <header className="page-title">
        <h1>{doc?.title ?? title}</h1>
        <p>Oh My Bank는 은행업을 배우는 교육용 모의 서비스입니다.</p>
      </header>
      <nav className="legal-tabs" aria-label="서비스 문서">
        {otherDocuments.map((item) => (
          <Link
            key={item.code}
            to={legalPaths[item.code]}
            aria-current={item.code === code ? 'page' : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {error ? (
        <>
          <ErrorNotice
            error={error}
            message={
              error instanceof ApiError && error.status === 404
                ? '요청한 문서 버전이 없습니다.'
                : '문서를 불러오지 못했습니다.'
            }
          />
          {error instanceof ApiError && error.status === 404 ? (
            <Link className="button button-outline small" to={legalPaths[code]}>
              현재 버전 보기
            </Link>
          ) : (
            <button className="button button-outline small" onClick={() => setReload((n) => n + 1)}>
              다시 불러오기
            </button>
          )}
        </>
      ) : !doc ? (
        <div className="empty-state" role="status">
          문서를 불러오고 있습니다.
        </div>
      ) : (
        <article className="legal-document">
          <dl className="legal-meta" aria-label="문서 정보">
            <div>
              <dt>버전</dt>
              <dd>{doc.version}</dd>
            </div>
            <div>
              <dt>시행일</dt>
              <dd>{doc.effectiveDate}</dd>
            </div>
            <div>
              <dt>상태</dt>
              <dd>{doc.current ? '현재 적용 중' : '이전 버전'}</dd>
            </div>
          </dl>
          {!doc.legalReviewed && (
            <p className="notice legal-draft" role="note">
              이 문서는 법률 검토 전 초안입니다. 서비스 공개 전에 검토를 거쳐 새 버전으로 발행할 수
              있습니다.
            </p>
          )}
          {!doc.current && (
            <p className="notice" role="note">
              이전 버전을 보고 있습니다. <Link to={legalPaths[code]}>현재 버전 보기</Link>
            </p>
          )}
          <LegalMarkdown source={doc.content} />
          {doc.versions.length > 1 && (
            <section className="legal-versions" aria-labelledby="legal-versions-title">
              <h2 id="legal-versions-title">버전 이력</h2>
              <ul>
                {doc.versions.map((item) => (
                  <li key={item.version}>
                    <Link to={`${legalPaths[code]}?version=${encodeURIComponent(item.version)}`}>
                      {item.version}
                    </Link>{' '}
                    · 시행일 {item.effectiveDate}
                    {item.current ? ' · 현재' : ''}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <OperatorInfo operator={doc.operator} />
        </article>
      )}
    </>
  )
}
