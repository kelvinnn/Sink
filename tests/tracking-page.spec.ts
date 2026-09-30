import { env } from 'cloudflare:workers'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { deleteStoredLinks, fetch, postJson, setLinkStoreD1Mode } from './utils'

// Fork tests: GTM tracking page, slugs with `/` and `.`, reserved first segments.

const BROWSER_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const createdSlugs: string[] = []

beforeAll(async () => {
  await setLinkStoreD1Mode()
})

afterEach(() => {
  env.NUXT_GTM_ID = ''
  env.NUXT_NOT_FOUND_REDIRECT = ''
})

afterAll(async () => {
  await deleteStoredLinks(createdSlugs)
})

async function createLink(slug: string, url: string, extra: Record<string, unknown> = {}) {
  const response = await postJson('/api/link/create', { url, slug, ...extra })
  expect(response.status).toBe(201)
  createdSlugs.push(slug)
}

function get(path: string, ua = BROWSER_UA) {
  return fetch(path, { redirect: 'manual', headers: { 'User-Agent': ua } })
}

describe('slugs with / and .', () => {
  it('creates and resolves nested and dotted slugs', async () => {
    const id = crypto.randomUUID().slice(0, 8)
    await createLink(`shop/t${id}`, 'https://example.com/shop/')
    await createLink(`menu${id}.pdf`, 'https://example.com/menu.pdf')

    const nested = await get(`/shop/t${id}`)
    expect(nested.status).toBe(301)
    expect(nested.headers.get('location')).toBe('https://example.com/shop/')

    const dotted = await get(`/menu${id}.pdf`)
    expect(dotted.status).toBe(301)
    expect(dotted.headers.get('location')).toBe('https://example.com/menu.pdf')
  })

  it('rejects slugs whose first segment is reserved', async () => {
    for (const slug of ['api/foo', 'dashboard/links', 'API/x']) {
      const response = await postJson('/api/link/create', { url: 'https://example.com', slug })
      expect(response.status, slug).toBe(400)
    }
  })

  it('does not treat /dashboard/** as a slug even with a not-found redirect', async () => {
    env.NUXT_NOT_FOUND_REDIRECT = 'https://notfound.example.com/'
    const response = await get('/dashboard/links')
    expect(response.headers.get('location')).not.toBe('https://notfound.example.com/')
  })
})

describe('redirect with query', () => {
  afterEach(() => {
    env.NUXT_REDIRECT_WITH_QUERY = 'false'
  })

  it('keeps the stored URL byte-for-byte when there is no incoming query', async () => {
    env.NUXT_REDIRECT_WITH_QUERY = 'true'
    const slug = `rwq-${crypto.randomUUID()}`
    const url = 'https://example.com/p?a[0]=x&t=%2CO%2CP-R'
    await createLink(slug, url)
    expect((await get(`/${slug}`)).headers.get('location')).toBe(url)

    const withQuery = (await get(`/${slug}?utm_source=qr`)).headers.get('location')!
    expect(new URL(withQuery).searchParams.get('utm_source')).toBe('qr')
  })
})

describe('gTM tracking page', () => {
  it('redirects normally when NUXT_GTM_ID is unset', async () => {
    const slug = `gtm-off-${crypto.randomUUID()}`
    await createLink(slug, 'https://example.com/off')
    const response = await get(`/${slug}`)
    expect(response.status).toBe(301)
  })

  it('serves the tracking page with the container and escaped target', async () => {
    env.NUXT_GTM_ID = 'GTM-TEST123'
    const slug = `gtm-on-${crypto.randomUUID()}`
    await createLink(slug, 'https://example.com/a?b=1&c=</script>', { tags: ['pets'] })

    const response = await get(`/${slug}`)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')
    expect(response.headers.get('cache-control')).toBe('no-store')

    const html = await response.text()
    expect(html).toContain('googletagmanager.com/gtm.js?id=')
    expect(html).toContain('"GTM-TEST123"')
    expect(html).toContain('"shortlink_slug":')
    expect(html).toContain('"shortlink_tags":"pets"')
    expect(html).not.toContain('c=</script>')
    expect(html).toContain('location.replace')
  })

  it('skips the tracking page for internal and hiring tags', async () => {
    env.NUXT_GTM_ID = 'GTM-TEST123'
    for (const tag of ['internal', 'hiring']) {
      const slug = `gtm-${tag}-${crypto.randomUUID()}`
      await createLink(slug, 'https://docs.google.com/x', { tags: [tag] })
      const response = await get(`/${slug}`)
      expect(response.status, tag).toBe(301)
    }
  })

  it('skips the tracking page for bots', async () => {
    env.NUXT_GTM_ID = 'GTM-TEST123'
    const slug = `gtm-bot-${crypto.randomUUID()}`
    await createLink(slug, 'https://example.com/bot')
    for (const ua of ['Googlebot/2.1 (+http://www.google.com/bot.html)', 'curl/8.0', '']) {
      const response = await get(`/${slug}`, ua)
      expect(response.status, ua || '(empty UA)').toBe(301)
    }
  })
})
