import type { H3Event } from 'h3'
import type { Role } from '#shared/schemas/admin'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { ROLE_RANK } from '#shared/schemas/admin'
import { users } from '../database/schema'

// Fork: roles (admin / editor / viewer) on top of Sink's authentication.
// - Site token and Access service tokens are always admin.
// - Access users get the role stored in `users`; unknown users are created with the default role.
// - Emails in NUXT_ADMIN_EMAILS are always admin (cannot be locked out).

export interface Actor {
  email: string
  role: Role
  authMethod: string
}

interface CachedUser { role: Role, disabled: boolean, lastSeenAt: number | null, at: number }
const userCache = new Map<string, CachedUser>()
const CACHE_MS = 30_000
const LAST_SEEN_INTERVAL_S = 15 * 60

export function invalidateUserCache(email?: string) {
  if (email)
    userCache.delete(email.toLowerCase())
  else
    userCache.clear()
}

function parseList(value: unknown): string[] {
  return String(value || '').split(',').map(item => item.trim().toLowerCase()).filter(Boolean)
}

function isRole(value: unknown): value is Role {
  return value === 'admin' || value === 'editor' || value === 'viewer'
}

/** Route → minimum role. First match wins; unknown routes need viewer for GET and admin otherwise. */
const ROUTE_RULES: [method: string | null, prefix: string, role: Role][] = [
  // admin only
  [null, '/api/known-ips/', 'admin'],
  [null, '/api/users/', 'admin'],
  [null, '/api/clicks/export', 'admin'],
  [null, '/api/activity/list', 'admin'],
  [null, '/api/activity/baseline', 'admin'],
  [null, '/api/link/import', 'admin'],
  [null, '/api/link/export', 'admin'],
  [null, '/api/link/migration/', 'admin'],
  [null, '/api/link/lock', 'admin'],
  [null, '/api/link/unlock', 'admin'],
  [null, '/api/backup', 'admin'],
  [null, '/api/mcp', 'admin'],
  // editor
  [null, '/api/link/create', 'editor'],
  [null, '/api/link/edit', 'editor'],
  [null, '/api/link/delete', 'editor'],
  [null, '/api/link/upsert', 'editor'],
  [null, '/api/link/restore', 'editor'],
  [null, '/api/link/revert', 'editor'],
  [null, '/api/link/ai', 'editor'],
  [null, '/api/link/og-ai', 'editor'],
  [null, '/api/link/check', 'editor'],
  [null, '/api/upload/', 'editor'],
  // read-style POST
  ['POST', '/api/link/search', 'viewer'],
]

export function requiredRole(method: string, pathname: string): Role {
  for (const [ruleMethod, prefix, role] of ROUTE_RULES) {
    if ((ruleMethod === null || ruleMethod === method) && pathname.startsWith(prefix))
      return role
  }
  return method === 'GET' || method === 'HEAD' || method === 'OPTIONS' ? 'viewer' : 'admin'
}

export function hasRole(role: Role | undefined, needed: Role): boolean {
  return !!role && ROLE_RANK[role] >= ROLE_RANK[needed]
}

/** Resolves the caller's role and stores it on event.context.role. Throws 403 for disabled users. */
export async function resolveRole(event: H3Event): Promise<Role> {
  const authMethod = event.context.authMethod as string | undefined
  if (authMethod !== 'access-user') {
    event.context.role = 'admin'
    return 'admin'
  }

  const config = useRuntimeConfig(event)
  const email = String(event.context.userEmail || '').toLowerCase()
  const allowedDomains = parseList(config.allowedEmailDomains)
  if (allowedDomains.length && !allowedDomains.includes(email.split('@')[1] || ''))
    throw createError({ status: 403, statusText: 'This account is not allowed' })

  const isConfiguredAdmin = parseList(config.adminEmails).includes(email)
  const now = Math.floor(Date.now() / 1000)
  const db = drizzle(event.context.cloudflare.env.DB)

  let cached = userCache.get(email)
  if (!cached || Date.now() - cached.at > CACHE_MS) {
    const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1)
    if (row) {
      cached = { role: row.role, disabled: row.disabled, lastSeenAt: row.lastSeenAt, at: Date.now() }
    }
    else {
      const defaultRole = isRole(config.defaultRole) ? config.defaultRole : 'editor'
      const role: Role = isConfiguredAdmin ? 'admin' : defaultRole
      await db.insert(users).values({ email, role, createdAt: now, lastSeenAt: now }).onConflictDoNothing()
      cached = { role, disabled: false, lastSeenAt: now, at: Date.now() }
    }
    userCache.set(email, cached)
  }

  if (cached.disabled && !isConfiguredAdmin)
    throw createError({ status: 403, statusText: 'This account has been disabled' })

  if (!cached.lastSeenAt || now - cached.lastSeenAt > LAST_SEEN_INTERVAL_S) {
    cached.lastSeenAt = now
    const touch = db.update(users).set({ lastSeenAt: now }).where(eq(users.email, email)).catch(() => {})
    event.context.cloudflare.context?.waitUntil?.(touch)
  }

  const role: Role = isConfiguredAdmin ? 'admin' : cached.role
  event.context.role = role
  return role
}

export function getActor(event: H3Event): Actor {
  return {
    email: String(event.context.userEmail || 'system').toLowerCase(),
    role: isRole(event.context.role) ? event.context.role : 'admin',
    authMethod: String(event.context.authMethod || 'system'),
  }
}

export function isAdmin(event: H3Event): boolean {
  return getActor(event).role === 'admin'
}

export function requireRole(event: H3Event, needed: Role): void {
  if (!hasRole(getActor(event).role, needed))
    throw createError({ status: 403, statusText: `Requires the ${needed} role` })
}
