import { asc } from 'drizzle-orm'
import { users } from '../../database/schema'

defineRouteMeta({
  openAPI: { description: 'List dashboard users and their roles (admin only).', security: [{ bearerAuth: [] }] },
})

export default eventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const fixedAdmins = String(config.adminEmails || '').split(',').map(item => item.trim().toLowerCase()).filter(Boolean)
  const rows = await useClickDb(event).select().from(users).orderBy(asc(users.email))
  return {
    users: rows.map(row => ({ ...row, role: fixedAdmins.includes(row.email) ? 'admin' : row.role, fixedAdmin: fixedAdmins.includes(row.email) })),
    defaultRole: config.defaultRole || 'editor',
  }
})
