/**
 * Search engine files generated at build time. A sitemap and the robots `Sitemap:` line need
 * absolute URLs, and the public address is not decided yet, so both come from `VITE_SITE_URL`.
 * Without it the build still ships a robots.txt but no sitemap.xml (see the README).
 */

/** Public, crawlable screens only; every entry must be a route declared in `pageTitle.ts`. */
export const sitemapPaths = [
  '/',
  '/about',
  '/guide',
  '/learn',
  '/glossary',
  '/tools',
  '/tools/deposit',
  '/tools/savings',
  '/tools/loan',
  '/tools/dsr',
  '/tools/goal',
  '/tools/variable-loan',
  '/tools/rate-scenario',
  '/tools/account-plan',
  '/tools/real-rate',
  '/strategy',
  '/bank-lab',
  '/products',
] as const

/** Account, staff and administrator screens; they need a session and carry no public content. */
export const disallowedPaths = [
  '/login',
  '/my',
  '/account',
  '/applications/',
  '/loans/',
  '/simulation',
  '/strategy/saves',
  '/staff',
  '/admin',
  '/api/',
] as const

/** An absolute http(s) origin with an optional base path and no trailing slash, or null. */
export function normalizeSiteUrl(value: string | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new Error(`VITE_SITE_URL must be an absolute URL: ${trimmed}`)
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:')
    throw new Error(`VITE_SITE_URL must use http or https: ${trimmed}`)
  if (url.search || url.hash) throw new Error('VITE_SITE_URL must not have a query or fragment')
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`
}

export function robotsTxt(siteUrl: string | null) {
  const lines = ['User-agent: *', 'Allow: /', ...disallowedPaths.map((path) => `Disallow: ${path}`)]
  if (siteUrl) lines.push('', `Sitemap: ${siteUrl}/sitemap.xml`)
  return `${lines.join('\n')}\n`
}

const escapeXml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function sitemapXml(siteUrl: string, paths: readonly string[] = sitemapPaths) {
  const urls = paths
    .map((path) => `  <url><loc>${escapeXml(`${siteUrl}${path === '/' ? '/' : path}`)}</loc></url>`)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}
