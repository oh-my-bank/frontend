import { describe, expect, it } from 'vitest'
import { anchorId, destinationAfterAuthentication } from './navigation'

describe('authentication destinations', () => {
  it('returns every role to its own account page', () => {
    for (const role of ['CUSTOMER', 'REVIEWER', 'ADMIN'] as const)
      expect(destinationAfterAuthentication('/account', role)).toBe('/account')
  })
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
    expect(destinationAfterAuthentication(null, 'ADMIN')).toBe('/staff')
    expect(destinationAfterAuthentication('/applications/old-record', 'CUSTOMER', true)).toBe('/my')
  })
  it('lets a new customer continue only to the simulation start screen with its plan prefill', () => {
    expect(
      destinationAfterAuthentication('/simulation?initialCash=15000000', 'CUSTOMER', true),
    ).toBe('/simulation?initialCash=15000000')
    expect(destinationAfterAuthentication('/simulation', 'CUSTOMER', true)).toBe('/simulation')
    expect(destinationAfterAuthentication('/simulation/accounts/old', 'CUSTOMER', true)).toBe('/my')
    expect(destinationAfterAuthentication('/simulationx', 'CUSTOMER', true)).toBe('/my')
  })
  it('returns an administrator to product management after the session expired there', () => {
    expect(destinationAfterAuthentication('/admin/products/product-one', 'ADMIN')).toBe(
      '/admin/products/product-one',
    )
    expect(destinationAfterAuthentication('/admin/products', 'ADMIN')).toBe('/admin/products')
    // A reviewer keeps the staff guide: product management is not part of the role.
    expect(destinationAfterAuthentication('/admin/products', 'REVIEWER')).toBe('/staff')
    for (const redirect of [
      '/administrator',
      '//admin/products',
      '/admin\\products',
      '/admin/\n',
    ]) {
      expect(destinationAfterAuthentication(redirect, 'ADMIN')).toBe('/staff')
    }
  })
})
