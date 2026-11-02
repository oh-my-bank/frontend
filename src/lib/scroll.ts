/**
 * Scrolls to the element with the given id. Route screens load as separate chunks and often render
 * their sections after a request, so when the target is not there yet this waits for it to appear
 * (up to `timeoutMs`) instead of giving up. Returns a cleanup that stops waiting.
 */
export function scrollToElementWhenReady(
  id: string,
  root: Node = document.body,
  timeoutMs = 5000,
): () => void {
  const existing = document.getElementById(id)
  if (existing) {
    existing.scrollIntoView()
    return () => {}
  }
  const observer = new MutationObserver(() => {
    const target = document.getElementById(id)
    if (!target) return
    stop()
    target.scrollIntoView()
  })
  const timer = window.setTimeout(() => stop(), timeoutMs)
  function stop() {
    observer.disconnect()
    window.clearTimeout(timer)
  }
  observer.observe(root, { childList: true, subtree: true })
  return stop
}
