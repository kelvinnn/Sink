import { eq } from 'drizzle-orm'
import { UpdateUserSchema } from '#shared/schemas/admin'
import { users } from '../../database/schema'

defineRouteMeta({
  openAPI: { description: 'Change a user\'s role or disable them (admin only). Creates the user if new.', security: [{ bearerAuth: [] }] },
})

export default eventHandler(async (event) => {
  const body = await readValidatedBody(event, UpdateUserSchema.parse)
  const actor = getActor(event)
  const fixedAdmins = String(useRuntimeConfig(event).adminEmails || '').split(',').map(item => item.trim().toLowerCase()).filter(Boolean)
  if (fixedAdmins.includes(body.email))
    throw createError({ status: 409, statusText: 'This admin is set in NUXT_ADMIN_EMAILS and cannot be changed here' })
  if (body.email === actor.email)
    throw createError({ status: 409, statusText: 'You cannot change your own role' })

  const db = useClickDb(event)
  const [before] = await db.select().from(users).where(eq(users.email, body.email)).limit(1)
  const now = Math.floor(Date.now() / 1000)
  const values = {
    role: body.role ?? before?.role ?? 'editor',
    disabled: body.disabled ?? before?.disabled ?? false,
    updatedBy: actor.email,
  }
  const [after] = before
    ? await db.update(users).set(values).where(eq(users.email, body.email)).returning()
    : await db.insert(users).values({ email: body.email, createdAt: now, ...values }).returning()
  invalidateUserCache(body.email)
  await recordActivitySafe(event, {
    action: before ? 'user.update' : 'user.create',
    targetType: 'user',
    targetId: body.email,
    targetLabel: body.email,
    before: before ? { role: before.role, disabled: before.disabled } : null,
    after: { role: values.role, disabled: values.disabled },
  })
  return { user: after }
})
