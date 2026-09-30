import { env } from 'cloudflare:workers'
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
