import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../stores/auth'
import { fetchLearningProgress, type LearningProgress } from './learningProgress'

/**
 * The signed-in customer's learning record. Other roles and visitors have none, so nothing is requested for them.
 * `reload` refetches after a graded quiz or a completion change and keeps the current record on screen meanwhile;
 * a record loaded for another account is never returned.
 */
export function useLearningProgress() {
  const { user } = useAuth()
  const customerId = user?.role === 'CUSTOMER' ? user.id : null
  const [loaded, setLoaded] = useState<{ owner: string; progress: LearningProgress } | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [version, setVersion] = useState(0)
  useEffect(() => {
    setError(null)
    if (!customerId) return
    const controller = new AbortController()
    fetchLearningProgress(controller.signal)
      .then((progress) => setLoaded({ owner: customerId, progress }))
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause)
      })
    return () => controller.abort()
  }, [customerId, version])
  const reload = useCallback(() => setVersion((value) => value + 1), [])
  const progress = customerId && loaded?.owner === customerId ? loaded.progress : null
  return {
    customer: !!customerId,
    signedIn: !!user,
    progress,
    error: customerId ? error : null,
    reload,
  }
}
