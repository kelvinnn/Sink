import { desc, sql } from 'drizzle-orm'
import { ClickBreakdownQuerySchema } from '#shared/schemas/click'
import { clicks } from '../../database/schema'

defineRouteMeta({
  openAPI: {
    description: 'Group logged clicks by a dimension (link, network, device, hour, ...).',
    security: [{ bearerAuth: [] }],
  },
})

export default eventHandler(async (event) => {
  const query = await getValidatedQuery(event, ClickBreakdownQuerySchema.parse)
  const value = dimensionExpression(query.dimension, query.tzOffset)
  const count = sql<number>`count(*)`
  const isTime = ['hour', 'weekday', 'day'].includes(query.dimension)
  const rows = await useClickDb(event).select({
    value: sql<string | number | null>`${value}`,
    clicks: count,
    visitors: sql<number>`count(distinct ${clicks.visitorId})`,
    ips: sql<number>`count(distinct ${clicks.ip})`,
    lastSeen: sql<number>`max(${clicks.ts})`,
  }).from(clicks).where(clickConditions(query)).groupBy(value).orderBy(isTime ? value : desc(count)).limit(query.limit)
  return { dimension: query.dimension, data: rows }
})
