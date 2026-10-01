import { env } from 'cloudflare:workers'
import { eq } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { clicks, knownIps } from '../server/database/schema'
import { expandIpv6, parseIpRange } from '../shared/utils/ip'
import { db, deleteStoredLinks, fetch, fetchWithAuth, postJson, setLinkStoreD1Mode } from './utils'

// Fork tests: per-click log (NUXT_CLICK_LOG), visitor cookie, known IPs, click API.

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0'
const createdSlugs: string[] = []

beforeAll(async () => {
  await setLinkStoreD1Mode()
  env.NUXT_CLICK_LOG = 'true'
})

afterEach(() => {
  env.NUXT_GTM_ID = ''
})

afterAll(async () => {
  env.NUXT_CLICK_LOG = 'false'
  await deleteStoredLinks(createdSlugs)
  await db.delete(knownIps)
})

async function createLink(slug: string, url: string, extra: Record<string, unknown> = {}) {
  const response = await postJson('/api/link/create', { url, slug, ...extra })
  expect(response.status).toBe(201)
  createdSlugs.push(slug)
}

function visit(path: string, headers: Record<string, string>) {
  return fetch(path, { redirect: 'manual', headers: { 'Accept-Language': 'en-SG,en;q=0.9', ...headers } })
}

async function waitForClicks(slug: string, count: number) {
  for (let i = 0; i < 50; i++) {
    const rows = await db.select().from(clicks).where(eq(clicks.slug, slug))
    if (rows.length >= count)
      return rows
    await new Promise(resolve => setTimeout(resolve, 20))
  }
  throw new Error(`expected ${count} clicks for ${slug}`)
}

describe('ip helpers', () => {
  it('parses IPv4 and IPv6 ranges', () => {
    expect(parseIpRange('203.0.113.77/24')).toMatchObject({ cidr: '203.0.113.0/24', v4Start: 3405803776, v4End: 3405804031 })
    expect(parseIpRange('203.0.113.7')).toMatchObject({ cidr: '203.0.113.7/32' })
    expect(parseIpRange('2001:db8:1::/48')).toMatchObject({ v6Prefix: '20010db80001' })
    expect(parseIpRange('2001:db8::/50')).toBeNull()
    expect(parseIpRange('not-an-ip')).toBeNull()
    expect(expandIpv6('::1')).toBe(`${'0'.repeat(31)}1`)
    expect(expandIpv6('::ffff:192.0.2.1')).toBe('00000000000000000000ffffc0000201')
  })
})

describe('click log', () => {
  it('records raw click data and sets a visitor cookie', async () => {
    const slug = `cl-${crypto.randomUUID()}`
    await createLink(slug, 'https://example.com/target', { tags: ['pets'] })

    const first = await visit(`/${slug}?s=table-qr`, { 'User-Agent': IPHONE, 'CF-Connecting-IP': '203.0.113.9', 'Referer': 'https://l.instagram.com/' })
    expect(first.status).toBe(301)
    const cookie = (first.headers.get('set-cookie') || '').split(';')[0]!
    expect(cookie).toMatch(/^_v=[0-9a-f-]{36}$/)

    await visit(`/${slug}`, { 'User-Agent': IPHONE, 'CF-Connecting-IP': '203.0.113.9', 'Cookie': cookie })
    const rows = (await waitForClicks(slug, 2)).sort((a, b) => a.id - b.id)

    expect(rows[0]).toMatchObject({
      ip: '203.0.113.9',
      ipV4: 3405803785,
      source: 'table-qr',
      query: 's=table-qr',
      referer: 'https://l.instagram.com/',
      refererHost: 'l.instagram.com',
      inApp: 'instagram',
      deviceType: 'mobile',
      tags: 'pets',
      served: 'redirect',
      destination: 'https://example.com/target',
      newVisitor: true,
      isBot: false,
    })
    expect(rows[1]!.visitorId).toBe(rows[0]!.visitorId)
    expect(rows[1]!.newVisitor).toBe(false)
  })

  it('flags bots with reasons and does not give them a cookie', async () => {
    const slug = `cl-bot-${crypto.randomUUID()}`
    await createLink(slug, 'https://example.com/bot')
    const response = await visit(`/${slug}`, { 'User-Agent': 'curl/8.0', 'CF-Connecting-IP': '198.51.100.1' })
    expect(response.headers.get('set-cookie')).toBeNull()
    const [row] = await waitForClicks(slug, 1)
    expect(row!.isBot).toBe(true)
    expect(row!.botReason).toContain('http-client')
  })

  it('records gtm as the serve mode when the tracking page is used', async () => {
    env.NUXT_GTM_ID = 'GTM-TEST123'
    const slug = `cl-gtm-${crypto.randomUUID()}`
    await createLink(slug, 'https://example.com/gtm')
    await visit(`/${slug}`, { 'User-Agent': IPHONE, 'CF-Connecting-IP': '203.0.113.10' })
    const [row] = await waitForClicks(slug, 1)
    expect(row!.served).toBe('gtm')
  })

  it('labels clicks from known IPs and supports re-applying labels', async () => {
    const created = await postJson('/api/known-ips/create', { cidr: '192.0.2.0/24', label: 'Outlet A wifi', category: 'outlet' })
    expect(created.status).toBe(201)
    expect((await postJson('/api/known-ips/create', { cidr: '192.0.2.5/24', label: 'dup' })).status).toBe(409)
    expect((await postJson('/api/known-ips/create', { cidr: 'nope', label: 'bad' })).status).toBe(400)

    const slug = `cl-known-${crypto.randomUUID()}`
    await createLink(slug, 'https://example.com/known')
    await visit(`/${slug}`, { 'User-Agent': IPHONE, 'CF-Connecting-IP': '192.0.2.44' })
    const [row] = await waitForClicks(slug, 1)
    expect(row).toMatchObject({ knownIpLabel: 'Outlet A wifi', knownIpExclude: true })

    // Excluded by default, visible with known=only
    const excluded = await (await fetchWithAuth(`/api/clicks/list?slug=${slug}`)).json() as { clicks: unknown[] }
    expect(excluded.clicks).toHaveLength(0)
    const only = await (await fetchWithAuth(`/api/clicks/list?slug=${slug}&known=only`)).json() as { clicks: unknown[] }
    expect(only.clicks).toHaveLength(1)

    await db.update(clicks).set({ knownIpId: null, knownIpLabel: null, knownIpExclude: false }).where(eq(clicks.slug, slug))
    const applied = await postJson('/api/known-ips/apply', {})
    expect(applied.status).toBe(200)
    const [relabelled] = await db.select().from(clicks).where(eq(clicks.slug, slug))
    expect(relabelled!.knownIpLabel).toBe('Outlet A wifi')
  })

  it('serves list, summary, breakdown, heatmap and csv export', async () => {
    const slug = `cl-api-${crypto.randomUUID()}`
    await createLink(slug, 'https://example.com/api')
    await visit(`/${slug}`, { 'User-Agent': IPHONE, 'CF-Connecting-IP': '203.0.113.20' })
    await visit(`/${slug}`, { 'User-Agent': IPHONE, 'CF-Connecting-IP': '203.0.113.21' })
    await waitForClicks(slug, 2)

    const summary = await (await fetchWithAuth(`/api/clicks/summary?slug=${slug}`)).json() as Record<string, number>
    expect(summary).toMatchObject({ clicks: 2, ips: 2 })

    const breakdown = await (await fetchWithAuth(`/api/clicks/breakdown?slug=${slug}&dimension=ip`)).json() as { data: { value: string, clicks: number }[] }
    expect(breakdown.data.map(d => d.value).sort()).toEqual(['203.0.113.20', '203.0.113.21'])

    const byIpPrefix = await (await fetchWithAuth(`/api/clicks/list?slug=${slug}&ip=203.0.113.2*`)).json() as { clicks: unknown[] }
    expect(byIpPrefix.clicks).toHaveLength(2)

    const heatmap = await (await fetchWithAuth(`/api/clicks/heatmap?slug=${slug}&tzOffset=480`)).json() as { data: { clicks: number }[] }
    expect(heatmap.data.reduce((sum, d) => sum + d.clicks, 0)).toBe(2)

    const csv = await (await fetchWithAuth(`/api/clicks/export?slug=${slug}`)).text()
    const lines = csv.trim().split('\n')
    expect(lines[0]).toContain('ip,asn,asOrg')
    expect(lines).toHaveLength(3)

    expect((await fetch('/api/clicks/list')).status).toBe(401)
  })
})
