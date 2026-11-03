import type { H3Event } from 'h3'
import type { Link } from '#shared/schemas/link'
import { disallowedHosts, parseAllowedHosts } from '#shared/utils/destination-hosts'

// Fork: enforce NUXT_ALLOWED_DESTINATION_HOSTS on link writes.
// Editors and viewers get HTTP 422; admins may save, and the response carries `warnings`.

export function assertDestinationAllowed(event: H3Event, link: Link, previous?: Link | null): void {
  const allowed = parseAllowedHosts(useRuntimeConfig(event).allowedDestinationHosts)
  const hosts = disallowedHosts(link, allowed, previous)
  if (!hosts.length)
    return
  const message = `Destination ${hosts.length > 1 ? 'hosts' : 'host'} not on the allow-list: ${hosts.join(', ')}. Allowed: ${allowed.join(', ')} (and their subdomains).`
  if (!isAdmin(event))
    throw createError({ status: 422, statusText: message, data: { code: 'destination_not_allowed', hosts, allowed } })
  const warnings = (event.context.destinationWarnings ||= []) as string[]
  warnings.push(`${link.slug}: ${message}`)
}
