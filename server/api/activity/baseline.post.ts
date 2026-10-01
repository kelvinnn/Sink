import { eq } from 'drizzle-orm'
import { activity } from '../../database/schema'

defineRouteMeta({
  openAPI: { description: 'Record a starting snapshot for every link that has no history yet (admin only).', security: [{ bearerAuth: [] }] },
})

export default eventHandler(async (event) => {
  const db = useClickDb(event)
  const known = new Set((await db.selectDistinct({ targetId: activity.targetId }).from(activity).where(eq(activity.targetType, 'link'))).map(row => row.targetId))
  const pending = []
  let total = 0
  for await (const link of iterateAllAuthoritativeLinks(event.context.cloudflare.env)) {
    total++
    if (!known.has(link.id))
      pending.push({ action: 'link.baseline', targetType: 'link' as const, targetId: link.id, targetLabel: link.slug, before: null, after: linkSnapshot(link), note: 'Existing link when history was enabled' })
  }
  await recordActivities(event, pending)
  return { links: total, recorded: pending.length }
})
