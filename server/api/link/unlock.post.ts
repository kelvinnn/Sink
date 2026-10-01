import { eq } from 'drizzle-orm'
import { UnlockLinkSchema } from '#shared/schemas/admin'
import { linkLocks } from '../../database/schema'

defineRouteMeta({
  openAPI: { description: 'Remove a link lock (admin only).', security: [{ bearerAuth: [] }] },
})

export default eventHandler(async (event) => {
  const { slug } = await readValidatedBody(event, UnlockLinkSchema.parse)
  const link = await getAnyAuthoritativeLink(event, normalizeSlug(event, slug))
  if (!link)
    throw createError({ status: 404, statusText: 'Link not found' })
  const removed = await useClickDb(event).delete(linkLocks).where(eq(linkLocks.linkId, link.id)).returning()
  if (removed.length)
    await recordActivitySafe(event, { action: 'link.unlock', targetType: 'link', targetId: link.id, targetLabel: link.slug })
  return { unlocked: removed.length > 0 }
})
