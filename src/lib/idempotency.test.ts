import { describe, expect, it } from 'vitest'
import { createRequestIdentity } from './idempotency'

describe('request retry identity', () => {
  it('keeps a request key when the result is unknown and rotates it when amount changes', () => {
    let sequence = 0
    const identity = createRequestIdentity(() => `key-${++sequence}`)
    const body = {
      productId: 'product-1',
      requestedAmount: 1000000,
      termMonths: 12,
      annualIncome: 30000000,
    }
    expect(identity.keyFor(body)).toBe('key-1')
    expect(identity.keyFor({ ...body })).toBe('key-1')
    expect(identity.keyFor({ ...body, requestedAmount: 2000000 })).toBe('key-2')
  })
  it('starts a new request after a completed application', () => {
    let sequence = 0
    const identity = createRequestIdentity(() => `key-${++sequence}`)
    expect(identity.keyFor({ amount: 10 })).toBe('key-1')
    identity.clear()
    expect(identity.keyFor({ amount: 10 })).toBe('key-2')
  })
  it('resends an uncertain policy publication with the same key but not a rebased one', () => {
    let sequence = 0
    const identity = createRequestIdentity(() => `key-${++sequence}`)
    const publication = {
      productId: 'product-1',
      expectedCurrentVersion: 1,
      policy: { annualInterestRate: '4.900', minAmount: 1000000 },
    }
    expect(identity.keyFor(publication)).toBe('key-1')
    // The response was lost: the administrator retries the identical command.
    expect(identity.keyFor(structuredClone(publication))).toBe('key-1')
    // Another administrator published version 2 first; the rebased command is a new change.
    expect(identity.keyFor({ ...publication, expectedCurrentVersion: 2 })).toBe('key-2')
  })
})
