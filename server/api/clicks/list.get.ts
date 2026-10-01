import { and, desc, lt } from 'drizzle-orm'
import { ClickListQuerySchema } from '#shared/schemas/click'
import { clicks } from '../../database/schema'

defineRouteMeta({
  openAPI: {
    description: 'List logged clicks (newest first). Requires NUXT_CLICK_LOG.',
    security: [{ bearerAuth: [] }],
  },
})

export default eventHandler(async (event) => {
  const query = await getValidatedQuery(event, ClickListQuerySchema.parse)
  const admin = assertClickAccess(event, query)
  const where = and(clickConditions(query, { searchIp: admin }), query.before !== undefined ? lt(clicks.id, query.before) : undefined)
  const rows = await useClickDb(event).select().from(clicks).where(where).orderBy(desc(clicks.id)).limit(query.limit + 1)
  const hasMore = rows.length > query.limit
  const items = hasMore ? rows.slice(0, query.limit) : rows
  return { clicks: admin ? items : items.map(redactClick), cursor: hasMore ? items.at(-1)!.id : null }
})
