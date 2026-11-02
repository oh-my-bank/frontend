import { describe, expect, it } from 'vitest'
import { addNoIndex } from './robotsMeta'

type FakeMeta = {
  attrs: Record<string, string>
  setAttribute: (k: string, v: string) => void
  remove: () => void
}

function fakeDocument(existing = false) {
  const children: FakeMeta[] = []
  const head = {
    querySelector: (selector: string) =>
      selector === 'meta[name="robots"]'
        ? (children.find((meta) => meta.attrs.name === 'robots') ?? null)
        : null,
    appendChild: (meta: FakeMeta) => children.push(meta),
  }
  const createElement = () => {
    const meta: FakeMeta = {
      attrs: {},
      setAttribute: (key, value) => void (meta.attrs[key] = value),
      remove: () => void children.splice(children.indexOf(meta), 1),
    }
    return meta
  }
  const doc = { head, createElement } as unknown as Document
  if (existing) children.push({ ...createElement(), attrs: { name: 'robots', content: 'all' } })
  return { doc, children }
}

describe('noindex on the 404 screen', () => {
  it('adds the tag while shown and removes it when leaving', () => {
    const { doc, children } = fakeDocument()
    const remove = addNoIndex(doc)
    expect(children.map((meta) => meta.attrs)).toEqual([{ name: 'robots', content: 'noindex' }])
    remove()
    expect(children).toHaveLength(0)
  })
  it('does not duplicate or remove a robots tag it did not add', () => {
    const { doc, children } = fakeDocument(true)
    addNoIndex(doc)()
    expect(children.map((meta) => meta.attrs)).toEqual([{ name: 'robots', content: 'all' }])
  })
})
