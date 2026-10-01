import { eq } from 'drizzle-orm'
import { DeleteKnownIpSchema } from '#shared/schemas/click'
import { knownIps } from '../../database/schema'

defineRouteMeta({
  openAPI: {
    description: 'Delete a known IP / range. Re-run apply to update labels on past clicks.',
    security: [{ bearerAuth: [] }],
  },
})

export default eventHandler(async (event) => {
  const { id } = await readValidatedBody(event, DeleteKnownIpSchema.parse)
  const [removed] = await useClickDb(event).delete(knownIps).where(eq(knownIps.id, id)).returning()
  if (removed)
    await recordActivitySafe(event, { action: 'known_ip.delete', targetType: 'known_ip', targetId: String(removed.id), targetLabel: removed.cidr, before: { label: removed.label, category: removed.category, exclude: removed.exclude, note: removed.note } })
  invalidateKnownIpCache()
  return { ok: true }
})
