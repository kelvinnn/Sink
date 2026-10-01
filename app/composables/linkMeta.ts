// Fork: "created by / edited by" and lock state for link cards, fetched in batches.

export interface LinkActorInfo { by: string, at: number, action: string }
export interface LinkActors { created: LinkActorInfo | null, updated: LinkActorInfo | null, changes: number }
export interface LinkLock { linkId: string, slug: string, lockedBy: string, lockedAt: number, expiresAt: number | null, reason: string | null }

const actors = reactive<Record<string, LinkActors | null>>({})
const locks = reactive<Record<string, LinkLock | null>>({})
const pending = new Set<string>()
let timer: ReturnType<typeof setTimeout> | undefined

async function flush() {
  timer = undefined
  const ids = [...pending]
  pending.clear()
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100)
    const query = { ids: batch.join(',') }
    try {
      const [actorResult, lockResult] = await Promise.all([
        useAPI<{ actors: Record<string, LinkActors> }>('/api/activity/actors', { query }),
        useAPI<{ locks: LinkLock[] }>('/api/locks/list', { query }),
      ])
      const lockById = new Map(lockResult.locks.map(lock => [lock.linkId, lock]))
      for (const id of batch) {
        actors[id] = actorResult.actors[id] ?? null
        locks[id] = lockById.get(id) ?? null
      }
    }
    catch {
      // Leave entries undefined; the card simply shows no meta line.
    }
  }
}

export function useLinkMeta() {
  function request(id: string, force = false) {
    if (!id || (!force && id in actors))
      return
    pending.add(id)
    timer ??= setTimeout(flush, 30)
  }

  return {
    actors: readonly(actors) as Readonly<Record<string, LinkActors | null>>,
    locks: readonly(locks) as Readonly<Record<string, LinkLock | null>>,
    request,
    refresh: (id: string) => request(id, true),
  }
}

/** Short name for an actor email: "kelvin" for kelvin@example.com, "API" for the site token. */
export function actorName(email: string): string {
  if (email.startsWith('root@') || email === 'system')
    return 'API'
  return email.split('@')[0] || email
}

const IGNORED_DIFF_KEYS = new Set(['updatedAt', 'createdAt', 'id'])

/** Field-level differences between two link snapshots. */
export function snapshotDiff(before: Record<string, unknown> | null, after: Record<string, unknown> | null): { key: string, from: string, to: string }[] {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])
  const show = (value: unknown) => value === undefined || value === null || value === '' ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value)
  return [...keys]
    .filter(key => !IGNORED_DIFF_KEYS.has(key))
    .filter(key => JSON.stringify(before?.[key] ?? null) !== JSON.stringify(after?.[key] ?? null))
    .map(key => ({ key, from: show(before?.[key]), to: show(after?.[key]) }))
}
