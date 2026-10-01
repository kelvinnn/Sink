// Fork: load the user's role for dashboard pages and keep non-admins out of admin pages.
const ADMIN_PAGES = ['/dashboard/activity', '/dashboard/users', '/dashboard/known-ips', '/dashboard/migrate']

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server || !to.path.startsWith('/dashboard') || to.path === '/dashboard/login')
    return

  const { load } = useDashboardSession()
  const session = await load()
  if (session && !session.can.admin && ADMIN_PAGES.includes(to.path))
    return navigateTo('/dashboard/links')
})
