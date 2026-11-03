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

  // Never let a settings read failure get in the way of a redirect.
  const setting = await getSetting(event, 'bio', BioPageSchema).catch((error) => {
    console.error({ event: 'bio.settings.read.failed', message: String(error) })
    return null
  })
  if (!setting?.configured || !setting.value.enabled)
    return
  const page = setting.value
  if (path !== '/' && path.slice(1).toLowerCase() !== page.path.toLowerCase())
    return

  setHeader(event, 'Content-Type', 'text/html; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=60')
  return renderBioPage(page)
})
