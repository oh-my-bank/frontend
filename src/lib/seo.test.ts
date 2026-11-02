import { describe, expect, it } from 'vitest'
import { calculatorKinds } from './learning'
import { normalizeSiteUrl, robotsTxt, sitemapPaths, sitemapXml } from './seo'

describe('search engine files', () => {
  it('normalizes the configured site address', () => {
    expect(normalizeSiteUrl(undefined)).toBeNull()
    expect(normalizeSiteUrl('  ')).toBeNull()
    expect(normalizeSiteUrl('https://bank.example/')).toBe('https://bank.example')
    expect(normalizeSiteUrl('https://example.org/omb/')).toBe('https://example.org/omb')
  })
  it('rejects addresses a sitemap cannot use', () => {
    expect(() => normalizeSiteUrl('/relative')).toThrow()
    expect(() => normalizeSiteUrl('ftp://bank.example')).toThrow()
    expect(() => normalizeSiteUrl('https://bank.example/?a=1')).toThrow()
  })
  it('blocks private areas and adds the sitemap line only with an address', () => {
    const without = robotsTxt(null)
    expect(without).toContain('User-agent: *')
    for (const path of ['/my', '/account', '/staff', '/admin', '/simulation', '/api/'])
      expect(without).toContain(`Disallow: ${path}\n`)
    expect(without).not.toContain('Sitemap:')
    expect(robotsTxt('https://bank.example')).toContain('Sitemap: https://bank.example/sitemap.xml')
  })
  it('writes absolute URLs for the public screens', () => {
    const xml = sitemapXml('https://bank.example')
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(xml).toContain('<loc>https://bank.example/</loc>')
    expect(xml).toContain('<loc>https://bank.example/about</loc>')
    expect(xml.match(/<url>/g)).toHaveLength(sitemapPaths.length)
    expect(sitemapXml('https://a.example', ['/x?a=1&b=2'])).toContain('/x?a=1&amp;b=2')
  })
  it('includes every calculator', () => {
    for (const kind of calculatorKinds) expect(sitemapPaths).toContain(`/tools/${kind}`)
  })
})
