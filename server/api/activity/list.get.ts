import { and, desc, eq, like, lt, sql } from 'drizzle-orm'
import { ActivityListQuerySchema } from '#shared/schemas/admin'
import { activity } from '../../database/schema'

defineRouteMeta({
  openAPI: { description: 'Activity log: who did what and when (admin only).', security: [{ bearerAuth: [] }] },
})

export default eventHandler(async (event) => {
  const query = await getValidatedQuery(event, ActivityListQuerySchema.parse)
  const escapeLike = (value: string) => value.replace(/[\\%_]/g, char => `\\${char}`)
  const where = and(
    query.before !== undefined ? lt(activity.id, query.before) : undefined,
    query.actor ? eq(activity.actorEmail, query.actor.toLowerCase()) : undefined,
    query.targetType ? eq(activity.targetType, query.targetType) : undefined,
    query.action
      ? (query.action.endsWith('*') ? like(activity.action, `${query.action.slice(0, -1)}%`) : eq(activity.action, query.action))
      : undefined,
    query.q ? sql`${activity.targetLabel} like ${`%${escapeLike(query.q)}%`} escape '\\'` : undefined,
  )
  const rows = await useClickDb(event).select().from(activity).where(where).orderBy(desc(activity.id)).limit(query.limit + 1)
  const hasMore = rows.length > query.limit
  const items = (hasMore ? rows.slice(0, query.limit) : rows).map(row => ({ ...row, before: maskSnapshot(row.before), after: maskSnapshot(row.after) }))
  return { activity: items, cursor: hasMore ? items.at(-1)!.id : null }
})
