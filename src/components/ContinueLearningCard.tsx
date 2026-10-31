import { Link } from 'react-router-dom'
import { continueReasonLabel, type LearningProgress } from '../lib/learningProgress'
import AppIcon from './AppIcon'
import '../styles/learning-progress.css'

/** The customer's real learning counts and the concept to study next (R05). Counts come only from saved records. */
export default function ContinueLearningCard({
  progress,
  headingLevel = 2,
}: {
  progress: LearningProgress
  headingLevel?: 2 | 3
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  const next = progress.continueWith
  return (
    <section className="learn-progress-card" aria-labelledby="learn-progress-title">
      <div className="learn-progress-head">
        <Heading id="learn-progress-title">나의 학습 기록</Heading>
        <span>고객 계정에 저장된 학습 완료 표시와 서버 채점 결과로 집계합니다.</span>
      </div>
      <dl className="learn-progress-counts">
        <div>
          <dt>학습 완료</dt>
          <dd>
            {progress.completedCount}
            <small>/ {progress.totalConcepts}개</small>
          </dd>
        </div>
        <div>
          <dt>확인 문제 만점</dt>
          <dd>
            {progress.masteredCount}
            <small>개</small>
          </dd>
        </div>
        <div>
          <dt>문제를 푼 개념</dt>
          <dd>
            {progress.attemptedCount}
            <small>개</small>
          </dd>
        </div>
      </dl>
      {next ? (
        <Link to={`/learn/${next.slug}`} className="learn-progress-next">
          <span>이어서 학습 · {continueReasonLabel(next.reason)}</span>
          <strong>{next.title}</strong>
          <AppIcon name="chevron" size={15} />
        </Link>
      ) : (
        <p className="learn-progress-done">모든 개념을 학습 완료로 표시했거나 만점을 받았습니다.</p>
      )}
    </section>
  )
}
