import { and, desc, eq } from 'drizzle-orm'
import { LinkHistoryQuerySchema } from '#shared/schemas/admin'
import { activity } from '../../database/schema'

defineRouteMeta({
  openAPI: { description: 'Change history of one link (by slug or id), newest first.', security: [{ bearerAuth: [] }] },
})

export default eventHandler(async (event) => {
  const query = await getValidatedQuery(event, LinkHistoryQuerySchema.parse)
  const db = useClickDb(event)
  let linkId = query.id
  if (!linkId && query.slug) {
    const slug = normalizeSlug(event, query.slug)
    const current = await getAnyAuthoritativeLink(event, slug)
    if (current) {
      linkId = current.id
    }
    else {
      // Deleted link: take the id from its most recent entry under this slug.
      const [last] = await db.select({ targetId: activity.targetId }).from(activity).where(and(eq(activity.targetType, 'link'), eq(activity.targetLabel, slug))).orderBy(desc(activity.id)).limit(1)
      linkId = last?.targetId ?? undefined
    }
  }
  if (!linkId)
    return { history: [] }
  const rows = await db.select().from(activity).where(and(eq(activity.targetType, 'link'), eq(activity.targetId, linkId))).orderBy(desc(activity.id)).limit(query.limit)
  const admin = isAdmin(event)
  return {
    history: rows.map(row => ({
      ...row,
      ip: admin ? row.ip : null,
      before: maskSnapshot(row.before),
      after: maskSnapshot(row.after),
    })),
  }
})
