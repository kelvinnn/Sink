import type { H3Event } from 'h3'
import type { z } from 'zod'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { settings } from '../database/schema'

// Fork: dashboard-wide settings (one JSON document per key in D1), cached briefly per isolate.

export interface StoredSetting<T> {
  value: T
  configured: boolean
  updatedAt: number | null
  updatedBy: string | null
}

const CACHE_MS = 30_000
const cache = new Map<string, { at: number, row: { value: Record<string, unknown>, updatedAt: number, updatedBy: string | null } | null }>()

export function invalidateSettingsCache(key?: string) {
  if (key)
    cache.delete(key)
  else
    cache.clear()
}

/** Reads a setting; falls back to the schema defaults when it was never saved or no longer validates. */
export async function getSetting<S extends z.ZodTypeAny>(event: H3Event, key: string, schema: S): Promise<StoredSetting<z.output<S>>> {
  let cached = cache.get(key)
  if (!cached || Date.now() - cached.at > CACHE_MS) {
    const db = drizzle(event.context.cloudflare.env.DB)
    const [row] = await db.select().from(settings).where(eq(settings.key, key)).limit(1)
    cached = { at: Date.now(), row: row ? { value: row.value, updatedAt: row.updatedAt, updatedBy: row.updatedBy } : null }
    cache.set(key, cached)
  }
  const parsed = cached.row ? schema.safeParse(cached.row.value) : null
  if (parsed?.success)
    return { value: parsed.data, configured: true, updatedAt: cached.row!.updatedAt, updatedBy: cached.row!.updatedBy }
  return { value: schema.parse({}), configured: false, updatedAt: null, updatedBy: null }
}

export async function putSetting(event: H3Event, key: string, value: Record<string, unknown>): Promise<void> {
  const db = drizzle(event.context.cloudflare.env.DB)
  const row = { key, value, updatedAt: Date.now(), updatedBy: getActor(event).email }
  await db.insert(settings).values(row).onConflictDoUpdate({ target: settings.key, set: { value: row.value, updatedAt: row.updatedAt, updatedBy: row.updatedBy } })
  invalidateSettingsCache(key)
}

/** Activity snapshot without large inline images. */
export function settingSnapshot(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).map(([field, item]) => [
    field,
    typeof item === 'string' && item.startsWith('data:') ? `(image, ${Math.round(item.length * 0.75 / 1024)} KB)` : item,
  ]))
}
