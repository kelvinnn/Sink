import { LockLinkSchema } from '#shared/schemas/admin'
import { linkLocks } from '../../database/schema'

defineRouteMeta({
  openAPI: { description: 'Lock a link so only admins can change or delete it, optionally until a date (admin only).', security: [{ bearerAuth: [] }] },
})

export default eventHandler(async (event) => {
  const body = await readValidatedBody(event, LockLinkSchema.parse)
  const now = Math.floor(Date.now() / 1000)
  if (body.expiresAt !== undefined && body.expiresAt <= now)
    throw createError({ status: 400, statusText: 'The lock expiry must be in the future' })
  const link = await getAnyAuthoritativeLink(event, normalizeSlug(event, body.slug))
  if (!link)
    throw createError({ status: 404, statusText: 'Link not found' })

  const values = { slug: link.slug, lockedBy: getActor(event).email, lockedAt: now, expiresAt: body.expiresAt ?? null, reason: body.reason || null }
  const [lock] = await useClickDb(event).insert(linkLocks).values({ linkId: link.id, ...values }).onConflictDoUpdate({ target: linkLocks.linkId, set: values }).returning()
  await recordActivitySafe(event, {
    action: 'link.lock',
    targetType: 'link',
    targetId: link.id,
    targetLabel: link.slug,
    note: [body.expiresAt ? `until ${new Date(body.expiresAt * 1000).toISOString()}` : 'until unlocked', body.reason].filter(Boolean).join(' · '),
  })
  return { lock }
})
