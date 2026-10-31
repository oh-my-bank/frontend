import { Link } from 'react-router-dom'
import { useLearningProgress } from '../lib/useLearningProgress'
import ContinueLearningCard from './ContinueLearningCard'

/** "이어서 학습" on the customer's own page: the saved learning record, or a link to start when it cannot be loaded. */
export default function MyLearningSection() {
  const record = useLearningProgress()
  if (!record.customer) return null
  if (record.progress) return <ContinueLearningCard progress={record.progress} />
  if (record.error)
    return (
      <p className="notice learn-progress-notice">
        학습 기록을 불러오지 못했습니다. <Link to="/learn">은행업 학습</Link>에서 개념을 이어서 볼
        수 있습니다.
      </p>
    )
  return null
}
