import type { H3Event } from 'h3'

// Fork: adds admin warnings from the destination allow-list to JSON responses of link writes.
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('beforeResponse', (event: H3Event, response: { body?: unknown }) => {
    const warnings = event.context.destinationWarnings as string[] | undefined
    const body = response.body
    if (!warnings?.length || !body || typeof body !== 'object' || Array.isArray(body))
      return
    response.body = { ...body, warnings: [...new Set(warnings)] }
  })
})
