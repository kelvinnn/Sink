// Admin gate: hides the Sink dashboard, API and static files behind a secret path.
//
// Enabled only when NUXT_ADMIN_GATE_PATH is set (e.g. "/x7k2q9"). Visiting that path sets a
// signed cookie and opens the dashboard. Without the cookie (or, for /api, without the correct
// bearer token), Sink-owned paths behave like an unknown slug: redirect to NUXT_NOT_FOUND_REDIRECT
// (or 404). `/` redirects to NUXT_PUBLIC_HOME_URL. Requires assets.run_worker_first so static
// files pass through here.

const COOKIE = '_g'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30
const SINK_PATH_PREFIXES = ['/dashboard', '/api', '/_nuxt', '/_docs', '/_i18n', '/__nuxt']
// Top-level static files shipped in public/ (plus build output). Anything with these names is Sink-owned.
const SINK_FILES = new Set([
  '/_headers',
  '/apple-touch-icon.png',
  '/banner.png',
  '/colos.json',
  '/countries.geojson',
  '/favicon.ico',
  '/icon-192.png',
  '/icon.png',
  '/image.png',
  '/index.html',
  '/sink.png',
  '/sphere.bin',
  '/world.json',
  '/200.html',
  '/404.html',
])

function isSinkPath(pathname) {
  const lower = pathname.toLowerCase()
  return SINK_FILES.has(lower) || SINK_PATH_PREFIXES.some(p => lower === p || lower.startsWith(`${p}/`))
}

async function gateToken(secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('admin-gate-v1'))
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('')
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length)
    return false
  let diff = 0
  for (let i = 0; i < a.length; i++)
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function readCookie(request, name) {
  const header = request.headers.get('cookie') || ''
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name)
      return v.join('=')
  }
  return null
}

function notFound(env) {
  const target = env.NUXT_NOT_FOUND_REDIRECT
  if (target)
    return new Response(null, { status: 302, headers: { 'Location': target, 'Cache-Control': 'no-store' } })
  return new Response('Not Found', { status: 404, headers: { 'Cache-Control': 'no-store' } })
}

/** Wraps a Worker handler (e.g. the Nitro build) with the admin gate. */
export function withAdminGate(inner) {
  return {
    ...inner,
    async fetch(request, env, context) {
      const gatePath = env.NUXT_ADMIN_GATE_PATH
      const secret = env.NUXT_SITE_TOKEN
      if (!gatePath || !secret)
        return inner.fetch(request, env, context)

      const url = new URL(request.url)
      const { pathname } = url
      const expected = await gateToken(secret)

      if (pathname === gatePath) {
        const secure = url.protocol === 'https:' ? '; Secure' : ''
        return new Response(null, {
          status: 302,
          headers: {
            'Location': '/dashboard',
            'Cache-Control': 'no-store',
            'Set-Cookie': `${COOKIE}=${expected}; Path=/; Max-Age=${COOKIE_MAX_AGE}; HttpOnly; SameSite=Lax${secure}`,
          },
        })
      }

      const hasCookie = timingSafeEqual(readCookie(request, COOKIE), expected)
      if (hasCookie)
        return inner.fetch(request, env, context)

      if (pathname === '/robots.txt')
        return new Response('User-agent: *\nAllow: /\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })

      if (pathname === '/') {
        const home = env.NUXT_PUBLIC_HOME_URL || env.NUXT_HOME_URL
        return home
          ? new Response(null, { status: 302, headers: { 'Location': home, 'Cache-Control': 'no-store' } })
          : notFound(env)
      }

      if (isSinkPath(pathname)) {
        const auth = request.headers.get('authorization') || ''
        const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : ''
        const isApi = pathname.toLowerCase() === '/api' || pathname.toLowerCase().startsWith('/api/')
        if (isApi && timingSafeEqual(bearer, secret))
          return inner.fetch(request, env, context)
        return notFound(env)
      }

      return inner.fetch(request, env, context)
    },
  }
}
