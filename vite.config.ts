import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { normalizeSiteUrl, robotsTxt, sitemapXml } from './src/lib/seo.ts'

/** robots.txt always; sitemap.xml and og:url only when the public address is configured. */
function searchFiles(siteUrl: string | null): Plugin {
  return {
    name: 'omb-search-files',
    apply: 'build',
    transformIndexHtml() {
      return siteUrl
        ? [{ tag: 'meta', attrs: { property: 'og:url', content: `${siteUrl}/` }, injectTo: 'head' }]
        : []
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robotsTxt(siteUrl) })
      if (siteUrl)
        this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemapXml(siteUrl) })
      else this.warn('VITE_SITE_URL is not set, so sitemap.xml was not generated (see README).')
    },
  }
}

export default defineConfig(({ mode }) => {
  const siteUrl = normalizeSiteUrl(loadEnv(mode, '.', 'VITE_').VITE_SITE_URL)
  return {
    plugins: [react(), searchFiles(siteUrl)],
    build: {
      rolldownOptions: {
        output: {
          // React and the router change only with dependency updates, so they cache on their own.
          codeSplitting: {
            groups: [{ name: 'react-vendor', test: /[\\/]node_modules[\\/]/ }],
          },
        },
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: { '/api': 'http://127.0.0.1:8080', '/actuator': 'http://127.0.0.1:8080' },
    },
  }
})
