import { eq, sql } from 'drizzle-orm'
import { clicks, knownIps } from '../../database/schema'

defineRouteMeta({
  openAPI: {
    description: 'Re-label all logged clicks against the current known IP list.',
    security: [{ bearerAuth: [] }],
  },
})

export default eventHandler(async (event) => {
  const db = useClickDb(event)
  const ranges = await db.select().from(knownIps)
  // Broadest first so more specific ranges overwrite them.
  ranges.sort((a, b) => {
    const size = (r: typeof a) => r.v4Start !== null ? r.v4End! - r.v4Start : 2 ** (128 - (r.v6Prefix?.length || 0) * 4)
    return size(b) - size(a)
  })
  await db.update(clicks).set({ knownIpId: null, knownIpLabel: null, knownIpExclude: false })
  let labelled = 0
  for (const range of ranges) {
    const where = range.v4Start !== null
      ? sql`${clicks.ipV4} between ${range.v4Start} and ${range.v4End}`
      : sql`substr(${clicks.ipV6}, 1, ${range.v6Prefix!.length}) = ${range.v6Prefix}`
    const result = await db.update(clicks).set({ knownIpId: range.id, knownIpLabel: range.label, knownIpExclude: range.exclude }).where(where)
    labelled += result.meta?.changes ?? 0
  }
  const [{ total } = { total: 0 }] = await db.select({ total: sql<number>`count(*)` }).from(clicks).where(eq(clicks.knownIpExclude, true))
  invalidateKnownIpCache()
  return { ranges: ranges.length, updates: labelled, excludedClicks: total }
})
