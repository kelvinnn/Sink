import type { H3Event } from 'h3'
import type { Link } from '#shared/schemas/link'
import { and, eq, gt, isNull, or } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { activity, linkLocks } from '../database/schema'

// Fork: append-only activity log and link locks.

export interface ActivityInput {
  action: string
  targetType: 'link' | 'known_ip' | 'user' | 'clicks' | 'links' | 'system'
  targetId?: string | null
  targetLabel?: string | null
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
  note?: string | null
}

function activityDb(event: H3Event) {
  return drizzle(event.context.cloudflare.env.DB)
}

/** Writes one activity entry. Throws on failure so callers can decide whether to continue. */
export async function recordActivity(event: H3Event, input: ActivityInput): Promise<void> {
  const actor = getActor(event)
  await activityDb(event).insert(activity).values({
    ts: Date.now(),
    actorEmail: actor.email,
    actorRole: actor.role,
    authMethod: actor.authMethod,
    ip: getHeader(event, 'cf-connecting-ip') || getRequestIP(event, { xForwardedFor: true }) || null,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId ?? null,
    targetLabel: input.targetLabel ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
    note: input.note ?? null,
  })
}

/** Same as recordActivity but never throws (the change itself already happened). */
export async function recordActivitySafe(event: H3Event, input: ActivityInput): Promise<void> {
  try {
    await recordActivity(event, input)
  }
  catch (error) {
    console.error({ event: 'activity.write.failed', action: input.action, target: input.targetLabel, message: String(error) })
  }
}

export function linkSnapshot(link: Link): Record<string, unknown> {
  return JSON.parse(JSON.stringify(link)) as Record<string, unknown>
}

/** Link action override for the current request (e.g. link.restore instead of link.create). */
export function setLinkActivityAction(event: H3Event, action: string, note?: string) {
  event.context.linkActivityAction = action
  event.context.linkActivityNote = note
}

export function linkActivityAction(event: H3Event, fallback: string): { action: string, note: string | null } {
  return {
    action: typeof event.context.linkActivityAction === 'string' ? event.context.linkActivityAction : fallback,
    note: typeof event.context.linkActivityNote === 'string' ? event.context.linkActivityNote : null,
  }
}

// ---- locks -------------------------------------------------------------

export function activeLockCondition(now = Math.floor(Date.now() / 1000)) {
  return or(isNull(linkLocks.expiresAt), gt(linkLocks.expiresAt, now))
}

export async function getActiveLock(event: H3Event, link: Pick<Link, 'id' | 'slug'>) {
  const [lock] = await activityDb(event).select().from(linkLocks).where(and(eq(linkLocks.linkId, link.id), activeLockCondition())).limit(1)
  return lock ?? null
}

/** Editors and viewers cannot change or delete a locked link. */
export async function assertLinkUnlocked(event: H3Event, link: Pick<Link, 'id' | 'slug'>): Promise<void> {
  if (isAdmin(event))
    return
  const lock = await getActiveLock(event, link)
  if (lock) {
    throw createError({
      status: 423,
      statusText: lock.expiresAt
        ? `This link is locked until ${new Date(lock.expiresAt * 1000).toISOString().slice(0, 10)}`
        : 'This link is locked',
    })
  }
}

/** Hides stored password hashes when snapshots are sent to the dashboard. */
export function maskSnapshot(snapshot: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!snapshot || !snapshot.password)
    return snapshot
  return { ...snapshot, password: '********' }
}

export async function recordActivities(event: H3Event, inputs: ActivityInput[]): Promise<void> {
  if (!inputs.length)
    return
  const actor = getActor(event)
  const ip = getHeader(event, 'cf-connecting-ip') || getRequestIP(event, { xForwardedFor: true }) || null
  const ts = Date.now()
  const rows = inputs.map(input => ({
    ts,
    actorEmail: actor.email,
    actorRole: actor.role,
    authMethod: actor.authMethod,
    ip,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId ?? null,
    targetLabel: input.targetLabel ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
    note: input.note ?? null,
  }))
  const db = activityDb(event)
  // D1 limits bound parameters per statement; 13 columns → keep chunks small.
  for (let i = 0; i < rows.length; i += 7)
    await db.insert(activity).values(rows.slice(i, i + 7))
}
