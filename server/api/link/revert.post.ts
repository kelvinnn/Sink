import { and, eq } from 'drizzle-orm'
import { RevertLinkSchema } from '#shared/schemas/admin'
import { StoredLinkSchema } from '#shared/schemas/link'
import { activity } from '../../database/schema'

defineRouteMeta({
  openAPI: { description: 'Return a link to the version saved in an activity entry.', security: [{ bearerAuth: [] }] },
})

export default eventHandler(async (event) => {
  assertLinkWritesAllowed(event, 'edit')
  const { activityId } = await readValidatedBody(event, RevertLinkSchema.parse)
  const [entry] = await useClickDb(event).select().from(activity).where(and(eq(activity.id, activityId), eq(activity.targetType, 'link'))).limit(1)
  const parsed = StoredLinkSchema.safeParse(entry?.after)
  if (!entry || !parsed.success)
    throw createError({ status: 404, statusText: 'This entry has no version to return to' })

  const current = await getAnyAuthoritativeLink(event, parsed.data.slug)
  if (!current)
    throw createError({ status: 404, statusText: 'The link no longer exists. Restore it first.' })
  if (current.id !== parsed.data.id)
    throw createError({ status: 409, statusText: 'A different link now uses this slug' })

  const link = { ...parsed.data, updatedAt: Math.floor(Date.now() / 1000) }
  setLinkActivityAction(event, 'link.revert', `Reverted to activity #${activityId}`)
  if (!await updateLink(event, link, { id: current.id, updatedAt: current.updatedAt }))
    throw createError({ status: 409, statusText: 'The link changed while reverting. Try again.' })
  return { link: sanitizeLinkPassword(link), shortLink: buildShortLink(event, link.slug) }
})
