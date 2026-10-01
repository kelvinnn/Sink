import { asc } from 'drizzle-orm'
import { knownIps } from '../../database/schema'

defineRouteMeta({
  openAPI: {
    description: 'List known IPs / ranges used to label clicks.',
    security: [{ bearerAuth: [] }],
  },
})

export default eventHandler(async (event) => {
  const rows = await useClickDb(event).select().from(knownIps).orderBy(asc(knownIps.label))
  return { knownIps: rows }
})
