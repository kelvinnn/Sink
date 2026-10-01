import { sql } from 'drizzle-orm'
import { ClickFilterSchema } from '#shared/schemas/click'
import { clicks } from '../../database/schema'

defineRouteMeta({
  openAPI: {
    description: 'Click log totals for the current filters, plus bot and known-IP counts.',
    security: [{ bearerAuth: [] }],
  },
})

export default eventHandler(async (event) => {
  const filter = await getValidatedQuery(event, ClickFilterSchema.parse)
  const admin = assertClickAccess(event, filter)
  const db = useClickDb(event)
  const [totals] = await db.select({
    clicks: sql<number>`count(*)`,
    visitors: sql<number>`count(distinct ${clicks.visitorId})`,
    newVisitors: sql<number>`coalesce(sum(case when ${clicks.newVisitor} = 1 then 1 else 0 end), 0)`,
    returningClicks: sql<number>`coalesce(sum(case when ${clicks.newVisitor} = 0 then 1 else 0 end), 0)`,
    ips: sql<number>`count(distinct ${clicks.ip})`,
    networks: sql<number>`count(distinct ${clicks.asOrg})`,
  }).from(clicks).where(clickConditions(filter, { searchIp: admin }))
  const [all] = await db.select({
    bots: sql<number>`coalesce(sum(case when ${clicks.isBot} = 1 then 1 else 0 end), 0)`,
    known: sql<number>`coalesce(sum(case when ${clicks.knownIpExclude} = 1 then 1 else 0 end), 0)`,
  }).from(clicks).where(clickConditions(filter, { bots: 'include', known: 'include', searchIp: admin }))
  return { ...totals, bots: all?.bots ?? 0, known: all?.known ?? 0 }
})
