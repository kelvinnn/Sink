import { env } from 'cloudflare:workers'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { settings } from '../server/database/schema'
import { BioPageSchema } from '../shared/schemas/settings'
import { renderBioPage } from '../shared/utils/bio-page'
import { db, deleteStoredLinks, fetch, postJson, setLinkStoreD1Mode } from './utils'

// Fork tests: links page ("link in bio").

const slugs = [`bio-a-${crypto.randomUUID().slice(0, 8)}`, `bio-b/${crypto.randomUUID().slice(0, 8)}`]
const path = `hello-${crypto.randomUUID().slice(0, 8)}`

beforeAll(async () => {
  await setLinkStoreD1Mode()
  for (const slug of slugs)
    expect((await postJson('/api/link/create', { url: `https://example.com/${slug}`, slug })).status).toBe(201)
})

afterAll(async () => {
  env.NUXT_BIO_HOME = ''
  await deleteStoredLinks(slugs)
  await db.delete(settings).where(eq(settings.key, 'bio'))
})

describe('links page', () => {
  it('renders escaped, ordered short-link buttons', () => {
    const html = renderBioPage(BioPageSchema.parse({ title: 'Pies & <more>', buttons: [{ label: 'Order "now"', slug: 'order' }, { label: 'AMK', slug: '/wa/amk/' }] }))
    expect(html).toContain('<h1>Pies &amp; &lt;more&gt;</h1>')
    expect(html).toContain('<a class="button" href="/order">Order &quot;now&quot;</a>')
    expect(html.indexOf('/order')).toBeLessThan(html.indexOf('/wa/amk'))
  })

  it('validates buttons and the path, then serves the page only when enabled', async () => {
    const page = { enabled: true, path, title: 'Test kitchen', buttons: [{ label: 'First', slug: slugs[0] }, { label: 'Second', slug: slugs[1] }] }
    expect((await postJson('/api/settings/bio', { ...page, buttons: [{ label: 'Nope', slug: 'does-not-exist-xyz' }] })).status).toBe(422)
    expect((await postJson('/api/settings/bio', { ...page, path: slugs[0] })).status).toBe(409)
    expect((await postJson('/api/settings/bio', { ...page, enabled: false })).status).toBe(200)
    expect((await fetch(`/${path}`, { redirect: 'manual' })).headers.get('content-type') || '').not.toContain('text/html; charset=utf-8')

    expect((await postJson('/api/settings/bio', page)).status).toBe(200)
    const response = await fetch(`/${path}`, { redirect: 'manual' })
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toContain('Test kitchen')
    expect(html).toContain(`href="/${slugs[0]}"`)
    expect(html).toContain(`href="/${slugs[1]}"`)

    // Short links keep working, and the home page is untouched unless NUXT_BIO_HOME is on.
    expect((await fetch(`/${slugs[0]}`, { redirect: 'manual' })).headers.get('location')).toBe(`https://example.com/${slugs[0]}`)
    expect(await (await fetch('/', { redirect: 'manual' })).text()).not.toContain('Test kitchen')
    env.NUXT_BIO_HOME = 'true'
    expect(await (await fetch('/', { redirect: 'manual' })).text()).toContain('Test kitchen')
  })
})
