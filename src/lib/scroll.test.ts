import { afterEach, describe, expect, it, vi } from 'vitest'
import { scrollToElementWhenReady } from './scroll'

class FakeObserver {
  static last: FakeObserver | null = null
  disconnected = false
  constructor(readonly callback: () => void) {
    FakeObserver.last = this
  }
  observe() {}
  disconnect() {
    this.disconnected = true
  }
}

function stubDom(elements: Map<string, { scrollIntoView: () => void }>) {
  vi.stubGlobal('document', { body: {}, getElementById: (id: string) => elements.get(id) ?? null })
  vi.stubGlobal('window', { setTimeout, clearTimeout })
  vi.stubGlobal('MutationObserver', FakeObserver)
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  FakeObserver.last = null
})

describe('scrolling to an anchor of a lazily loaded screen', () => {
  it('scrolls at once when the anchor already exists', () => {
    const target = { scrollIntoView: vi.fn() }
    stubDom(new Map([['notice', target]]))
    scrollToElementWhenReady('notice')
    expect(target.scrollIntoView).toHaveBeenCalledOnce()
    expect(FakeObserver.last).toBeNull()
  })
  it('waits for the anchor to render and then stops observing', () => {
    const elements = new Map<string, { scrollIntoView: () => void }>()
    stubDom(elements)
    scrollToElementWhenReady('rules')
    const observer = FakeObserver.last!
    observer.callback()
    expect(observer.disconnected).toBe(false)
    const target = { scrollIntoView: vi.fn() }
    elements.set('rules', target)
    observer.callback()
    expect(target.scrollIntoView).toHaveBeenCalledOnce()
    expect(observer.disconnected).toBe(true)
  })
  it('gives up after the timeout or when cleaned up', () => {
    vi.useFakeTimers()
    stubDom(new Map())
    scrollToElementWhenReady('missing', undefined, 1000)
    const timedOut = FakeObserver.last!
    vi.advanceTimersByTime(1000)
    expect(timedOut.disconnected).toBe(true)
    const stop = scrollToElementWhenReady('missing')
    stop()
    expect(FakeObserver.last!.disconnected).toBe(true)
  })
})
