import { eq } from 'drizzle-orm'
import { CreateKnownIpSchema } from '#shared/schemas/click'
import { parseIpRange } from '#shared/utils/ip'
import { knownIps } from '../../database/schema'

defineRouteMeta({
  openAPI: {
    description: 'Add a known IP or CIDR range (e.g. an outlet\'s Wi-Fi). Re-run apply to label past clicks.',
    security: [{ bearerAuth: [] }],
  },
})

export default eventHandler(async (event) => {
  const body = await readValidatedBody(event, CreateKnownIpSchema.parse)
  const range = parseIpRange(body.cidr)!
  const db = useClickDb(event)
  const [existing] = await db.select({ id: knownIps.id }).from(knownIps).where(eq(knownIps.cidr, range.cidr)).limit(1)
  if (existing)
    throw createError({ status: 409, statusText: `${range.cidr} already exists` })
  const [row] = await db.insert(knownIps).values({
    cidr: range.cidr,
    label: body.label,
    category: body.category,
    exclude: body.exclude,
    note: body.note || null,
    v4Start: range.v4Start,
    v4End: range.v4End,
    v6Prefix: range.v6Prefix,
    createdAt: Math.floor(Date.now() / 1000),
  }).returning()
  invalidateKnownIpCache()
  setResponseStatus(event, 201)
  return { knownIp: row }
})
