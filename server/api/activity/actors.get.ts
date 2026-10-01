import { and, asc, eq, inArray, notInArray } from 'drizzle-orm'
import { LinkActorsQuerySchema } from '#shared/schemas/admin'
import { activity } from '../../database/schema'

defineRouteMeta({
  openAPI: { description: 'Who created and last changed each of the given links.', security: [{ bearerAuth: [] }] },
})

interface ActorInfo { by: string, at: number, action: string }

export default eventHandler(async (event) => {
  const { ids } = await getValidatedQuery(event, LinkActorsQuerySchema.parse)
  const linkIds = [...new Set(ids.split(',').map(id => id.trim()).filter(Boolean))].slice(0, 200)
  const result: Record<string, { created: ActorInfo | null, updated: ActorInfo | null, changes: number }> = {}
  const db = useClickDb(event)
  for (let i = 0; i < linkIds.length; i += 50) {
    const rows = await db.select({
      targetId: activity.targetId,
      actorEmail: activity.actorEmail,
      ts: activity.ts,
      action: activity.action,
    }).from(activity).where(and(
      eq(activity.targetType, 'link'),
      inArray(activity.targetId, linkIds.slice(i, i + 50)),
      notInArray(activity.action, ['link.lock', 'link.unlock']),
    )).orderBy(asc(activity.id))
    for (const row of rows) {
      const info = { by: row.actorEmail, at: row.ts, action: row.action }
      const entry = result[row.targetId!] ??= { created: info, updated: null, changes: 0 }
      if (entry.created !== info) {
        entry.updated = info
        entry.changes++
      }
    }
  }
  return { actors: result }
})
