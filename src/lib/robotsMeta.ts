/**
 * Adds `<meta name="robots" content="noindex">` while a screen is shown and returns its removal.
 * The server answers every unknown path with index.html and HTTP 200 (a soft 404), so the 404
 * screen tells crawlers not to index it. An existing robots tag is left alone.
 */
export function addNoIndex(doc: Document = document): () => void {
  if (doc.head.querySelector('meta[name="robots"]')) return () => {}
  const meta = doc.createElement('meta')
  meta.setAttribute('name', 'robots')
  meta.setAttribute('content', 'noindex')
  doc.head.appendChild(meta)
  return () => meta.remove()
}
