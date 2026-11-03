import { BioPageSchema } from '#shared/schemas/settings'
import { renderBioPage } from '#shared/utils/bio-page'

// Fork: links page ("link in bio"). Served on its path when enabled in the dashboard, and on `/`
// only when NUXT_BIO_HOME=true. Runs before the redirect middleware.
export default eventHandler(async (event) => {
  if (!['GET', 'HEAD'].includes(event.method) || !event.context.cloudflare?.env?.DB)
    return
  const path = event.path.split('?')[0]!.replace(/\/+$/, '') || '/'
  if (path === '/' ? !useRuntimeConfig(event).bioHome : path.includes('/', 1) || path.startsWith('/_') || path.startsWith('/api') || path.startsWith('/dashboard'))
    return

  const { value: page, configured } = await getSetting(event, 'bio', BioPageSchema)
  if (!configured || !page.enabled)
    return
  if (path !== '/' && path.slice(1).toLowerCase() !== page.path.toLowerCase())
    return

  setHeader(event, 'Content-Type', 'text/html; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=60')
  return renderBioPage(page)
})
