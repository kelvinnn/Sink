import { sql } from 'drizzle-orm'
import { ClickFilterSchema } from '#shared/schemas/click'
import { clicks } from '../../database/schema'

defineRouteMeta({
  openAPI: {
    description: 'Clicks by weekday (0 = Sunday) and hour in the client UTC offset.',
    security: [{ bearerAuth: [] }],
  },
})

export default eventHandler(async (event) => {
  const filter = await getValidatedQuery(event, ClickFilterSchema.parse)
  const weekday = dimensionExpression('weekday', filter.tzOffset)
  const hour = dimensionExpression('hour', filter.tzOffset)
  const rows = await useClickDb(event).select({
    weekday: sql<number>`${weekday}`,
    hour: sql<number>`${hour}`,
    clicks: sql<number>`count(*)`,
    visitors: sql<number>`count(distinct ${clicks.visitorId})`,
  }).from(clicks).where(clickConditions(filter)).groupBy(weekday, hour)
  return { data: rows }
})
