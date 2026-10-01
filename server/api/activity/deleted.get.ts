import { and, desc, eq, inArray } from 'drizzle-orm'
import { DeletedLinksQuerySchema } from '#shared/schemas/admin'
import { activity, links } from '../../database/schema'

defineRouteMeta({
  openAPI: { description: 'Deleted links that can be restored, newest first.', security: [{ bearerAuth: [] }] },
})

export default eventHandler(async (event) => {
  const { limit } = await getValidatedQuery(event, DeletedLinksQuerySchema.parse)
  const db = useClickDb(event)
  const deletions = await db.select().from(activity).where(and(eq(activity.targetType, 'link'), eq(activity.action, 'link.delete'))).orderBy(desc(activity.id)).limit(500)
  // Latest deletion per link id.
  const latest = new Map<string, typeof deletions[number]>()
  for (const row of deletions) {
    if (row.targetId && !latest.has(row.targetId))
      latest.set(row.targetId, row)
  }
  const ids = [...latest.keys()]
  const slugs = [...new Set([...latest.values()].map(row => row.targetLabel).filter((slug): slug is string => !!slug))]
  const chunk = <T>(items: T[]) => Array.from({ length: Math.ceil(items.length / 50) }, (_, i) => items.slice(i * 50, i * 50 + 50))
  const liveIds = new Set<string>()
  for (const part of chunk(ids)) {
    for (const row of await db.select({ id: links.id }).from(links).where(inArray(links.id, part)))
      liveIds.add(row.id)
  }
  const takenSlugs = new Set<string>()
  for (const part of chunk(slugs)) {
    for (const row of await db.select({ slug: links.slug }).from(links).where(inArray(links.slug, part)))
      takenSlugs.add(row.slug)
  }
  const admin = isAdmin(event)
  const deleted = [...latest.values()]
    .filter(row => !liveIds.has(row.targetId!))
    .slice(0, limit)
    .map(row => ({
      activityId: row.id,
      linkId: row.targetId,
      slug: row.targetLabel,
      deletedAt: row.ts,
      deletedBy: row.actorEmail,
      ip: admin ? row.ip : null,
      link: maskSnapshot(row.before),
      slugTaken: !!row.targetLabel && takenSlugs.has(row.targetLabel),
    }))
  return { deleted }
})
