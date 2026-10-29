import { describe, expect, it } from 'vitest'
import { destinationAfterAuthentication } from './navigation'

describe('authentication destinations', () => {
  it('preserves an internal customer destination and defaults to the dashboard', () => {
    expect(destinationAfterAuthentication('/products/product-one', 'CUSTOMER')).toBe(
      '/products/product-one',
    )
    expect(destinationAfterAuthentication(null, 'CUSTOMER')).toBe('/')
  })
  it('rejects external URLs and browser-normalized backslash or control-character URLs', () => {
    for (const redirect of [
      'https://example.com',
      '//example.com',
      '/\\example.com',
      '/\n/example.com',
      '/\t/example.com',
    ]) {
      expect(destinationAfterAuthentication(redirect, 'CUSTOMER')).toBe('/')
    }
  })
  it('routes staff to their workspace and new customers away from another account’s old record', () => {
    expect(destinationAfterAuthentication('/applications/old-record', 'REVIEWER')).toBe('/staff')
    expect(destinationAfterAuthentication('/products', 'ADMIN')).toBe('/staff')
    expect(destinationAfterAuthentication('/applications/old-record', 'CUSTOMER', true)).toBe('/')
  })
})
