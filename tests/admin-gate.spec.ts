import { env, exports } from 'cloudflare:workers'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { deleteStoredLinks, fetch, postJson, setLinkStoreD1Mode } from './utils'

// Fork tests: admin gate (NUXT_ADMIN_GATE_PATH) hides Sink-owned paths.

const GATE = '/gate-test-path'
const NOT_FOUND = 'https://notfound.example.com/'
const HOME = 'https://home.example.com/'
const createdSlugs: string[] = []

function get(path: string, headers: Record<string, string> = {}) {
  return fetch(path, { redirect: 'manual', headers })
}

beforeAll(async () => {
  await setLinkStoreD1Mode()
  const slug = `gate-${crypto.randomUUID()}`
  const response = await postJson('/api/link/create', { url: 'https://example.com/target', slug })
  expect(response.status).toBe(201)
  createdSlugs.push(slug)
})

afterEach(() => {
  env.NUXT_ADMIN_GATE_PATH = ''
  env.NUXT_NOT_FOUND_REDIRECT = ''
  env.NUXT_PUBLIC_HOME_URL = ''
})

afterAll(async () => {
  await deleteStoredLinks(createdSlugs)
})

function enableGate() {
  env.NUXT_ADMIN_GATE_PATH = GATE
  env.NUXT_NOT_FOUND_REDIRECT = NOT_FOUND
  env.NUXT_PUBLIC_HOME_URL = HOME
}

describe('admin gate', () => {
  it('is a no-op when NUXT_ADMIN_GATE_PATH is unset', async () => {
    const response = await get('/api/verify')
    expect(response.status).toBe(401)
  })

  it('hides dashboard, api and Sink files without the cookie', async () => {
    enableGate()
    for (const path of ['/dashboard', '/dashboard/links', '/api/verify', '/api/link/list', '/sink.png', '/favicon.ico', '/_nuxt/entry.js']) {
      const response = await get(path)
      expect(response.status, path).toBe(302)
      expect(response.headers.get('location'), path).toBe(NOT_FOUND)
    }
  })

  it('redirects / home and serves a neutral robots.txt', async () => {
    enableGate()
    const home = await get('/')
    expect(home.status).toBe(302)
    expect(home.headers.get('location')).toBe(HOME)

    const robots = await (await get('/robots.txt')).text()
    expect(robots).not.toContain('dashboard')
  })

  it('still resolves short links', async () => {
    enableGate()
    const response = await get(`/${createdSlugs[0]}`)
    expect(response.status).toBe(301)
    expect(response.headers.get('location')).toBe('https://example.com/target')
  })

  it('allows the API with the correct bearer token only', async () => {
    enableGate()
    const ok = await get('/api/verify', { Authorization: `Bearer ${import.meta.env.NUXT_SITE_TOKEN}` })
    expect(ok.status).toBe(200)

    const wrong = await get('/api/verify', { Authorization: 'Bearer wrong-token' })
    expect(wrong.status).toBe(302)
    expect(wrong.headers.get('location')).toBe(NOT_FOUND)
  })

  it('sets a cookie at the gate path that unlocks Sink paths', async () => {
    enableGate()
    const gate = await get(GATE)
    expect(gate.status).toBe(302)
    expect(gate.headers.get('location')).toBe('/dashboard')
    const setCookie = gate.headers.get('set-cookie') || ''
    expect(setCookie).toContain('HttpOnly')
    const cookie = setCookie.split(';')[0]!

    const api = await get('/api/verify', { Cookie: cookie })
    expect(api.headers.get('location')).not.toBe(NOT_FOUND)

    const forged = await get('/dashboard', { Cookie: '_g=forged' })
    expect(forged.headers.get('location')).toBe(NOT_FOUND)
  })
})

describe('admin host mode', () => {
  const ADMIN_HOST = 'admin.example.test'

  function onHost(host: string, path: string, headers: Record<string, string> = {}) {
    return exports.default.fetch(new Request(`http://${host}${path}`, { redirect: 'manual', headers }))
  }

  afterEach(() => {
    env.NUXT_ADMIN_HOST = ''
  })

  function enable() {
    env.NUXT_ADMIN_HOST = ADMIN_HOST
    env.NUXT_NOT_FOUND_REDIRECT = NOT_FOUND
    env.NUXT_PUBLIC_HOME_URL = HOME
  }

  it('serves only short links on public hosts', async () => {
    enable()
    for (const path of ['/dashboard', '/dashboard/links', '/api/verify', '/sink.png', '/_nuxt/entry.js']) {
      const response = await onHost('localhost', path)
      expect(response.status, path).toBe(302)
      expect(response.headers.get('location'), path).toBe(NOT_FOUND)
    }
    expect((await onHost('localhost', '/')).headers.get('location')).toBe(HOME)
    const link = await onHost('localhost', `/${createdSlugs[0]}`)
    expect(link.headers.get('location')).toBe('https://example.com/target')
    // Scripts can still use the API with the site token.
    expect((await onHost('localhost', '/api/verify', { Authorization: `Bearer ${import.meta.env.NUXT_SITE_TOKEN}` })).status).toBe(200)
  })

  it('refuses the admin host without an Access token and serves it with one', async () => {
    enable()
    expect((await onHost(ADMIN_HOST, '/dashboard/links')).status).toBe(403)
    expect((await onHost(ADMIN_HOST, '/api/verify')).status).toBe(403)

    // With a (here: unverifiable) Access token the request reaches Sink, which then checks it.
    const api = await onHost(ADMIN_HOST, '/api/verify', { 'Cf-Access-Jwt-Assertion': 'not-a-real-token' })
    expect(api.status).toBe(401)
    const root = await onHost(ADMIN_HOST, '/', { 'Cf-Access-Jwt-Assertion': 'x' })
    expect(root.headers.get('location')).toBe('/dashboard')
  })
})
