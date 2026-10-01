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
  await useClickDb(event).delete(knownIps).where(eq(knownIps.id, id))
  invalidateKnownIpCache()
  return { ok: true }
})
