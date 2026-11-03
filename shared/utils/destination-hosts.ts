// Fork: destination allow-list (NUXT_ALLOWED_DESTINATION_HOSTS).

export function parseAllowedHosts(value: unknown): string[] {
  return String(value || '')
    .split(',')
    .map(host => host.trim().toLowerCase().replace(/^\*\./, '').replace(/\.$/, ''))
    .filter(Boolean)
}

/** True when the host is on the list or a subdomain of a listed host. An empty list allows everything. */
export function isHostAllowed(host: string, allowed: string[]): boolean {
  if (!allowed.length)
    return true
  const name = host.toLowerCase().replace(/\.$/, '')
  return allowed.some(entry => name === entry || name.endsWith(`.${entry}`))
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase()
  }
  catch {
    return null
  }
}

/** Hosts of every destination of a link: main URL, app-store URLs and geo routes. */
export function destinationHosts(link: { url?: string, apple?: string, google?: string, geo?: Record<string, string> }): string[] {
  const urls = [link.url, link.apple, link.google, ...Object.values(link.geo || {})].filter((url): url is string => !!url)
  return [...new Set(urls.map(hostOf).filter((host): host is string => !!host))]
}

/** Destination hosts that are not allowed, ignoring hosts the previous version already had. */
export function disallowedHosts(link: Parameters<typeof destinationHosts>[0], allowed: string[], previous?: Parameters<typeof destinationHosts>[0] | null): string[] {
  if (!allowed.length)
    return []
  const grandfathered = new Set(previous ? destinationHosts(previous) : [])
  return destinationHosts(link).filter(host => !isHostAllowed(host, allowed) && !grandfathered.has(host))
}
