import { and, inArray } from 'drizzle-orm'
import { LinkLocksQuerySchema } from '#shared/schemas/admin'
import { linkLocks } from '../../database/schema'

defineRouteMeta({
  openAPI: { description: 'Active link locks, optionally for specific link ids.', security: [{ bearerAuth: [] }] },
})

export default eventHandler(async (event) => {
  const { ids } = await getValidatedQuery(event, LinkLocksQuerySchema.parse)
  const linkIds = ids ? [...new Set(ids.split(',').map(id => id.trim()).filter(Boolean))].slice(0, 200) : null
  const db = useClickDb(event)
  if (linkIds && !linkIds.length)
    return { locks: [] }
  const locks = []
  if (linkIds) {
    for (let i = 0; i < linkIds.length; i += 50)
      locks.push(...await db.select().from(linkLocks).where(and(inArray(linkLocks.linkId, linkIds.slice(i, i + 50)), activeLockCondition())))
  }
  else {
    locks.push(...await db.select().from(linkLocks).where(activeLockCondition()))
  }
  return { locks }
})
