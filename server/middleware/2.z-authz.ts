// Fork: role check for every authenticated API request. Runs right after 2.auth.ts
// (which has already rejected unauthenticated requests).
export default eventHandler(async (event) => {
  if (!event.path.startsWith('/api/') || !event.context.authMethod)
    return

  const role = await resolveRole(event)
  const needed = requiredRole(event.method, getRequestURL(event).pathname)
  if (!hasRole(role, needed)) {
    throw createError({
      status: 403,
      statusText: `Requires the ${needed} role`,
    })
  }

  // Record exports of link data made through upstream routes (first page only).
  const { pathname, searchParams } = getRequestURL(event)
  if (pathname === '/api/link/export' && !searchParams.get('cursor'))
    await recordActivitySafe(event, { action: 'links.export', targetType: 'links', note: searchParams.get('status') || undefined })
  else if (pathname === '/api/backup' && event.method === 'POST')
    await recordActivitySafe(event, { action: 'links.backup', targetType: 'links' })
})
