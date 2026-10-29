import { describe, expect, it } from 'vitest'
import { createApplicationRequest } from './idempotency'

describe('application retry identity', () => {
  it('keeps a request key when the result is unknown and rotates it when amount changes', () => {
    let sequence = 0
    const identity = createApplicationRequest(() => `key-${++sequence}`)
    const body = { productId: 'product-1', requestedAmount: 1000000, termMonths: 12, annualIncome: 30000000 }
    expect(identity.keyFor(body)).toBe('key-1')
    expect(identity.keyFor({ ...body })).toBe('key-1')
    expect(identity.keyFor({ ...body, requestedAmount: 2000000 })).toBe('key-2')
  })
  it('starts a new request after a completed application', () => {
    let sequence = 0
    const identity = createApplicationRequest(() => `key-${++sequence}`)
    expect(identity.keyFor({ amount: 10 })).toBe('key-1')
    identity.clear()
    expect(identity.keyFor({ amount: 10 })).toBe('key-2')
  })
})
