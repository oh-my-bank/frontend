import { describe, expect, it } from 'vitest'
import { anchorId, destinationAfterAuthentication } from './navigation'

describe('authentication destinations', () => {
  it('preserves an internal customer destination and defaults to the dashboard', () => {
    expect(destinationAfterAuthentication('/products/product-one', 'CUSTOMER')).toBe(
      '/products/product-one',
    )
    expect(destinationAfterAuthentication(null, 'CUSTOMER')).toBe('/my')
    expect(destinationAfterAuthentication('/', 'CUSTOMER')).toBe('/my')
  })
  it('resolves guide anchors without throwing on malformed URL encoding', () => {
    expect(anchorId('#scope')).toBe('scope')
    expect(anchorId('#%EC%95%88%EB%82%B4')).toBe('안내')
    expect(anchorId('#%E0%A4%A')).toBeNull()
    expect(anchorId('scope')).toBeNull()
  })
  it('rejects external URLs and browser-normalized backslash or control-character URLs', () => {
    for (const redirect of [
      'https://example.com',
      '//example.com',
      '/\\example.com',
      '/\n/example.com',
      '/\t/example.com',
    ]) {
      expect(destinationAfterAuthentication(redirect, 'CUSTOMER')).toBe('/my')
    }
  })
  it('routes staff to their workspace and new customers away from another account’s old record', () => {
    expect(destinationAfterAuthentication('/applications/old-record', 'REVIEWER')).toBe('/staff')
    expect(destinationAfterAuthentication('/products', 'ADMIN')).toBe('/staff')
    expect(destinationAfterAuthentication('/applications/old-record', 'CUSTOMER', true)).toBe('/my')
  })
})
