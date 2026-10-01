import { env } from 'cloudflare:workers'
import { eq, inArray } from 'drizzle-orm'
import { exportJWK, generateKeyPair, SignJWT } from 'jose'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { activity, clicks, linkLocks, users } from '../server/database/schema'
import { db, deleteStoredLinks, fetch, fetchWithAuth, setLinkStoreD1Mode } from './utils'

// Fork tests: roles, activity log, restore / revert, link locks, click redaction.

const TEAM = 'https://roles-test.cloudflareaccess.com'
const AUD = 'roles-test-audience'
const KID = 'roles-test-key'
const ADMIN = 'boss@example.com'
const EDITOR = 'ed@example.com'
const VIEWER = 'vi@example.com'
const createdSlugs: string[] = []
let privateKey: CryptoKey
let fetchSpy: ReturnType<typeof vi.spyOn>

beforeAll(async () => {
  await setLinkStoreD1Mode()
  const keyPair = await generateKeyPair('RS256', { extractable: true })
  privateKey = keyPair.privateKey
  const jwks = { keys: [{ ...await exportJWK(keyPair.publicKey), alg: 'RS256', kid: KID, use: 'sig' }] }
  const realFetch = globalThis.fetch
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (url.startsWith(`${TEAM}/cdn-cgi/access/certs`))
      return Promise.resolve(Response.json(jwks))
    return realFetch(input as RequestInfo, init)
  })
  env.NUXT_CF_ACCESS_TEAM_DOMAIN = TEAM
  env.NUXT_CF_ACCESS_AUD = AUD
  env.NUXT_ADMIN_EMAILS = ADMIN
  env.NUXT_CLICK_LOG = 'true'
})

afterAll(async () => {
  fetchSpy.mockRestore()
  env.NUXT_CF_ACCESS_TEAM_DOMAIN = ''
  env.NUXT_CF_ACCESS_AUD = ''
  env.NUXT_ADMIN_EMAILS = ''
  env.NUXT_CLICK_LOG = 'false'
  await deleteStoredLinks(createdSlugs)
  await db.delete(users).where(inArray(users.email, [ADMIN, EDITOR, VIEWER, 'gone@example.com']))
  await db.delete(linkLocks)
})

async function tokenFor(email: string) {
  const now = Math.floor(Date.now() / 1000)
  return await new SignJWT({ type: 'app', sub: `id-${email}`, email })
    .setProtectedHeader({ alg: 'RS256', kid: KID })
    .setIssuedAt(now)
    .setNotBefore(now)
    .setIssuer(TEAM)
    .setAudience(AUD)
    .setExpirationTime(now + 300)
    .sign(privateKey)
}

async function as(email: string, path: string, options: { method?: string, body?: unknown } = {}) {
  return fetch(path, {
    method: options.method || 'GET',
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    headers: {
      'Cf-Access-Jwt-Assertion': await tokenFor(email),
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
  })
}

function newSlug(prefix: string) {
  const slug = `${prefix}-${crypto.randomUUID()}`
  createdSlugs.push(slug)
  return slug
}

describe('roles', () => {
  it('maps identities to roles', async () => {
    expect(await (await as(ADMIN, '/api/session')).json()).toMatchObject({ email: ADMIN, role: 'admin', can: { admin: true, seeIps: true } })
    expect(await (await as(EDITOR, '/api/session')).json()).toMatchObject({ email: EDITOR, role: 'editor', can: { edit: true, admin: false, seeIps: false } })
    expect(await (await fetchWithAuth('/api/session')).json()).toMatchObject({ role: 'admin', authMethod: 'site-token' })
    const [row] = await db.select().from(users).where(eq(users.email, EDITOR))
    expect(row).toMatchObject({ role: 'editor', disabled: false })
  })

  it('keeps admin-only routes from editors', async () => {
    for (const path of ['/api/known-ips/list', '/api/users/list', '/api/activity/list', '/api/link/export', '/api/clicks/export']) {
      expect((await as(EDITOR, path)).status, path).toBe(403)
      expect((await as(ADMIN, path)).status, path).toBe(200)
    }
    expect((await as(EDITOR, '/api/link/lock', { method: 'POST', body: { slug: 'x' } })).status).toBe(403)
  })

  it('lets admins change roles; viewers are read-only; disabled users are refused', async () => {
    expect((await as(ADMIN, '/api/users/update', { method: 'POST', body: { email: VIEWER, role: 'viewer' } })).status).toBe(200)
    expect((await as(VIEWER, '/api/link/list')).status).toBe(200)
    expect((await as(VIEWER, '/api/link/create', { method: 'POST', body: { url: 'https://example.com', slug: newSlug('viewer') } })).status).toBe(403)

    expect((await as(ADMIN, '/api/users/update', { method: 'POST', body: { email: 'gone@example.com', disabled: true } })).status).toBe(200)
    expect((await as('gone@example.com', '/api/link/list')).status).toBe(403)

    // The configured admin cannot be demoted, and nobody can change themselves.
    expect((await as(ADMIN, '/api/users/update', { method: 'POST', body: { email: ADMIN, role: 'viewer' } })).status).toBe(409)
  })
})

describe('activity, restore and revert', () => {
  it('records who created, edited and deleted a link, and restores it with the same id', async () => {
    const slug = newSlug('hist')
    const created = await as(EDITOR, '/api/link/create', { method: 'POST', body: { url: 'https://example.com/v1', slug } })
    expect(created.status).toBe(201)
    const { link } = await created.json() as { link: { id: string, slug: string } }

    expect((await as(EDITOR, '/api/link/edit', { method: 'PUT', body: { url: 'https://example.com/v2', slug } })).status).toBe(201)
    expect((await as(ADMIN, '/api/link/delete', { method: 'POST', body: { slug } })).status).toBeLessThan(300)
    expect((await fetch(`/${slug}`, { redirect: 'manual' })).headers.get('location')).not.toBe('https://example.com/v2')

    const history = (await (await as(EDITOR, `/api/activity/link?id=${link.id}`)).json() as { history: { id: number, action: string, actorEmail: string, ip: string | null, before: any, after: any }[] }).history
    expect(history.map(h => [h.action, h.actorEmail])).toEqual([['link.delete', ADMIN], ['link.update', EDITOR], ['link.create', EDITOR]])
    expect(history[1]).toMatchObject({ before: { url: 'https://example.com/v1' }, after: { url: 'https://example.com/v2' } })
    expect(history[0]!.before).toMatchObject({ url: 'https://example.com/v2' })

    const deleted = (await (await as(EDITOR, '/api/activity/deleted')).json() as { deleted: { activityId: number, slug: string, deletedBy: string }[] }).deleted
    const entry = deleted.find(d => d.slug === slug)!
    expect(entry).toMatchObject({ deletedBy: ADMIN })

    const restored = await as(EDITOR, '/api/link/restore', { method: 'POST', body: { activityId: entry.activityId } })
    expect(restored.status).toBe(200)
    expect(((await restored.json()) as { link: { id: string } }).link.id).toBe(link.id)
    expect((await fetch(`/${slug}`, { redirect: 'manual' })).headers.get('location')).toBe('https://example.com/v2')
    // Restoring twice fails: the slug is in use again.
    expect((await as(EDITOR, '/api/link/restore', { method: 'POST', body: { activityId: entry.activityId } })).status).toBe(409)

    // Revert to the first version.
    const createEntry = history.find(h => h.action === 'link.create')!
    expect((await as(EDITOR, '/api/link/revert', { method: 'POST', body: { activityId: createEntry.id } })).status).toBe(200)
    expect((await fetch(`/${slug}`, { redirect: 'manual' })).headers.get('location')).toBe('https://example.com/v1')

    const actors = (await (await as(VIEWER, `/api/activity/actors?ids=${link.id}`)).json() as { actors: Record<string, { created: { by: string }, updated: { by: string, action: string }, changes: number }> }).actors
    expect(actors[link.id]).toMatchObject({ created: { by: EDITOR }, updated: { by: EDITOR, action: 'link.revert' } })

    const log = (await (await as(ADMIN, `/api/activity/list?q=${slug}`)).json() as { activity: { action: string }[] }).activity
    expect(log.map(a => a.action)).toEqual(['link.revert', 'link.restore', 'link.delete', 'link.update', 'link.create'])
  })

  it('records a baseline for links without history', async () => {
    const slug = newSlug('base')
    const created = await (await as(EDITOR, '/api/link/create', { method: 'POST', body: { url: 'https://example.com/base', slug } })).json() as { link: { id: string } }
    await db.delete(activity).where(eq(activity.targetId, created.link.id))
    const result = await (await as(ADMIN, '/api/activity/baseline', { method: 'POST', body: {} })).json() as { recorded: number }
    expect(result.recorded).toBeGreaterThanOrEqual(1)
    const rows = await db.select().from(activity).where(eq(activity.targetId, created.link.id))
    expect(rows.map(r => r.action)).toEqual(['link.baseline'])
  })
})

describe('link locks', () => {
  it('blocks editors on locked links, with optional expiry', async () => {
    const slug = newSlug('lock')
    const { link } = await (await as(EDITOR, '/api/link/create', { method: 'POST', body: { url: 'https://example.com/locked', slug } })).json() as { link: { id: string } }

    expect((await as(ADMIN, '/api/link/lock', { method: 'POST', body: { slug, expiresAt: 1000 } })).status).toBe(400)
    expect((await as(ADMIN, '/api/link/lock', { method: 'POST', body: { slug, reason: 'Printed on table QR' } })).status).toBe(200)

    const locks = (await (await as(VIEWER, `/api/locks/list?ids=${link.id}`)).json() as { locks: { linkId: string, expiresAt: number | null, reason: string }[] }).locks
    expect(locks).toMatchObject([{ linkId: link.id, expiresAt: null, reason: 'Printed on table QR' }])

    expect((await as(EDITOR, '/api/link/edit', { method: 'PUT', body: { url: 'https://example.com/hijack', slug } })).status).toBe(423)
    expect((await as(EDITOR, '/api/link/delete', { method: 'POST', body: { slug } })).status).toBe(423)
    expect((await fetch(`/${slug}`, { redirect: 'manual' })).headers.get('location')).toBe('https://example.com/locked')
    // Admins can still edit.
    expect((await as(ADMIN, '/api/link/edit', { method: 'PUT', body: { url: 'https://example.com/admin-edit', slug } })).status).toBe(201)

    // An expired lock no longer applies.
    await db.update(linkLocks).set({ expiresAt: Math.floor(Date.now() / 1000) - 10 }).where(eq(linkLocks.linkId, link.id))
    expect((await as(EDITOR, '/api/link/edit', { method: 'PUT', body: { url: 'https://example.com/after-expiry', slug } })).status).toBe(201)

    // Lock with a future expiry, then unlock.
    const future = Math.floor(Date.now() / 1000) + 3600
    expect((await as(ADMIN, '/api/link/lock', { method: 'POST', body: { slug, expiresAt: future } })).status).toBe(200)
    expect((await as(EDITOR, '/api/link/edit', { method: 'PUT', body: { url: 'https://example.com/nope', slug } })).status).toBe(423)
    expect((await as(ADMIN, '/api/link/unlock', { method: 'POST', body: { slug } })).status).toBe(200)
    expect((await as(EDITOR, '/api/link/edit', { method: 'PUT', body: { url: 'https://example.com/unlocked', slug } })).status).toBe(201)

    const actions = (await (await as(ADMIN, `/api/activity/list?q=${slug}&action=link.lock`)).json() as { activity: { action: string }[] }).activity
    expect(actions).toHaveLength(2)
  })
})

describe('click log privacy', () => {
  it('hides IPs and visitor ids from non-admins', async () => {
    const slug = newSlug('priv')
    await as(EDITOR, '/api/link/create', { method: 'POST', body: { url: 'https://example.com/priv', slug } })
    await fetch(`/${slug}`, { redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1', 'Accept-Language': 'en', 'CF-Connecting-IP': '203.0.113.55' } })
    for (let i = 0; i < 50 && !(await db.select().from(clicks).where(eq(clicks.slug, slug))).length; i++)
      await new Promise(resolve => setTimeout(resolve, 20))

    const adminRows = (await (await as(ADMIN, `/api/clicks/list?slug=${slug}`)).json() as { clicks: { ip: string, visitorId: string }[] }).clicks
    expect(adminRows[0]).toMatchObject({ ip: '203.0.113.55' })
    expect(adminRows[0]!.visitorId).toMatch(/^[0-9a-f-]{36}$/)

    const editorRows = (await (await as(EDITOR, `/api/clicks/list?slug=${slug}`)).json() as { clicks: { ip: null, visitorId: string, ipV4: null }[] }).clicks
    expect(editorRows[0]).toMatchObject({ ip: null, ipV4: null, visitorId: 'hidden' })

    expect((await as(EDITOR, `/api/clicks/breakdown?slug=${slug}&dimension=ip`)).status).toBe(403)
    expect((await as(EDITOR, `/api/clicks/list?ip=203.0.113.55`)).status).toBe(403)
    expect((await as(EDITOR, `/api/clicks/breakdown?slug=${slug}&dimension=deviceType`)).status).toBe(200)
    // Searching by IP text finds nothing for editors.
    expect(((await (await as(EDITOR, `/api/clicks/list?slug=${slug}&q=203.0.113`)).json()) as { clicks: unknown[] }).clicks).toHaveLength(0)
  })
})
