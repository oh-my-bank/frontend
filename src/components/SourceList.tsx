import type { Source } from '../lib/learning'
import '../styles/banking-products.css'
import '../styles/learning.css'

/** Official sources with publisher and checked date; each opens in a new window. */
export default function SourceList({ sources }: { sources: Source[] }) {
  return (
    <ul className="learn-sources">
      {sources.map((source) => (
        <li key={source.url}>
          <a href={source.url} target="_blank" rel="noreferrer">
            {source.title}
            <span className="bank-product-sr-only"> (새 창에서 열림)</span>
          </a>
          <span>
            {source.publisher} · 확인일 {source.checkedOn}
          </span>
        </li>
      ))}
    </ul>
  )
}
