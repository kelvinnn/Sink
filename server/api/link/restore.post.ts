import { and, eq } from 'drizzle-orm'
import { RestoreLinkSchema } from '#shared/schemas/admin'
import { StoredLinkSchema } from '#shared/schemas/link'
import { activity } from '../../database/schema'

defineRouteMeta({
  openAPI: { description: 'Restore a deleted link from its saved version (same id, so its analytics continue).', security: [{ bearerAuth: [] }] },
})

export default eventHandler(async (event) => {
  assertLinkWritesAllowed(event, 'create')
  const { activityId } = await readValidatedBody(event, RestoreLinkSchema.parse)
  const [entry] = await useClickDb(event).select().from(activity).where(and(eq(activity.id, activityId), eq(activity.targetType, 'link'), eq(activity.action, 'link.delete'))).limit(1)
  const parsed = StoredLinkSchema.safeParse(entry?.before)
  if (!entry || !parsed.success)
    throw createError({ status: 404, statusText: 'No restorable version found' })

  const link = { ...parsed.data, updatedAt: Math.floor(Date.now() / 1000) }
  setLinkActivityAction(event, 'link.restore', `Restored from activity #${activityId}`)
  if (!await createLink(event, link))
    throw createError({ status: 409, statusText: `The slug "${link.slug}" is already in use` })
  return { link: sanitizeLinkPassword(link), shortLink: buildShortLink(event, link.slug) }
})
