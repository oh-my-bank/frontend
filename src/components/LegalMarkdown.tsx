import { parseMarkdown, type MarkdownBlock } from '../lib/legal'

/** Renders the server's legal Markdown as React text nodes; the document's own title is shown by the page. */
export default function LegalMarkdown({ source }: { source: string }) {
  const blocks = parseMarkdown(source).filter(
    (block) => !(block.kind === 'heading' && block.level === 1),
  )
  const sections = blocks.filter(
    (block): block is Extract<MarkdownBlock, { kind: 'heading' }> =>
      block.kind === 'heading' && block.level === 2,
  )
  return (
    <div className="legal-body">
      {sections.length >= 4 && (
        <nav className="legal-toc" aria-label="문서 목차">
          <strong>목차</strong>
          <ul>
            {sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`}>{section.text}</a>
              </li>
            ))}
          </ul>
        </nav>
      )}
      {blocks.map((block, index) => {
        switch (block.kind) {
          case 'heading':
            return block.level === 2 ? (
              <h2 key={index} id={block.id}>
                {block.text}
              </h2>
            ) : (
              <h3 key={index} id={block.id}>
                {block.text}
              </h3>
            )
          case 'paragraph':
            return <p key={index}>{block.text}</p>
          case 'list': {
            const items = block.items.map((item, n) => <li key={n}>{item}</li>)
            return block.ordered ? <ol key={index}>{items}</ol> : <ul key={index}>{items}</ul>
          }
          case 'table':
            return (
              <div className="legal-table-wrap" key={index}>
                <table className="legal-table">
                  <thead>
                    <tr>
                      {block.header.map((cell, n) => (
                        <th key={n} scope="col">
                          {cell}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, r) => (
                      <tr key={r}>
                        {row.map((cell, n) => (
                          <td key={n} data-label={block.header[n] ?? ''}>
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
        }
      })}
    </div>
  )
}
