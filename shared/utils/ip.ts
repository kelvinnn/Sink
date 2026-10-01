// Fork: IP helpers for the click log and known-IP ranges.

export function ipv4ToInt(ip: string): number | null {
  const parts = ip.trim().split('.')
  if (parts.length !== 4)
    return null
  let value = 0
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part))
      return null
    const n = Number(part)
    if (n > 255)
      return null
    value = value * 256 + n
  }
  return value
}

/** Expands an IPv6 address to 32 lowercase hex characters, or null if invalid. */
export function expandIpv6(ip: string): string | null {
  let value = ip.trim().toLowerCase()
  if (!value.includes(':'))
    return null
  // Embedded IPv4 (e.g. ::ffff:203.0.113.7)
  const v4Match = value.match(/(\d{1,3}(?:\.\d{1,3}){3})$/)
  if (v4Match) {
    const v4 = ipv4ToInt(v4Match[1]!)
    if (v4 === null)
      return null
    value = `${value.slice(0, -v4Match[1]!.length)}${(v4 >>> 16).toString(16)}:${(v4 & 0xFFFF).toString(16)}`
  }
  const halves = value.split('::')
  if (halves.length > 2)
    return null
  const head = halves[0] ? halves[0].split(':') : []
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : []
  const missing = 8 - head.length - tail.length
  if (halves.length === 1 ? missing !== 0 : missing < 1)
    return null
  const zeros: string[] = Array.from<string>({ length: halves.length === 2 ? missing : 0 }).fill('0')
  const groups = [...head, ...zeros, ...tail]
  if (groups.length !== 8 || groups.some(g => !/^[0-9a-f]{1,4}$/.test(g)))
    return null
  return groups.map(g => g.padStart(4, '0')).join('')
}

export interface ParsedRange {
  cidr: string
  v4Start: number | null
  v4End: number | null
  v6Prefix: string | null
}

/**
 * Parses an IP or CIDR range. IPv4 accepts any prefix length; IPv6 prefix lengths must be a
 * multiple of 4 (matched on leading hex nibbles). A bare address is treated as /32 or /128.
 */
export function parseIpRange(input: string): ParsedRange | null {
  const [address = '', prefixText] = input.trim().split('/')
  const v4 = ipv4ToInt(address)
  if (v4 !== null) {
    const prefix = prefixText === undefined ? 32 : Number(prefixText)
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32)
      return null
    const size = 2 ** (32 - prefix)
    const start = Math.floor(v4 / size) * size
    return { cidr: `${intToIpv4(start)}/${prefix}`, v4Start: start, v4End: start + size - 1, v6Prefix: null }
  }
  const v6 = expandIpv6(address)
  if (v6 !== null) {
    const prefix = prefixText === undefined ? 128 : Number(prefixText)
    if (!Number.isInteger(prefix) || prefix < 4 || prefix > 128 || prefix % 4 !== 0)
      return null
    const nibbles = v6.slice(0, prefix / 4)
    return { cidr: `${compressIpv6(nibbles.padEnd(32, '0'))}/${prefix}`, v4Start: null, v4End: null, v6Prefix: nibbles }
  }
  return null
}

export function intToIpv4(value: number): string {
  return [24, 16, 8, 0].map(shift => Math.floor(value / 2 ** shift) % 256).join('.')
}

function compressIpv6(hex: string): string {
  const groups = hex.match(/.{4}/g)!.map(g => g.replace(/^0+(?=.)/, ''))
  // Collapse the longest run of zero groups.
  let bestStart = -1
  let bestLen = 0
  for (let i = 0; i < 8;) {
    if (groups[i] !== '0') {
      i++
      continue
    }
    let j = i
    while (j < 8 && groups[j] === '0') j++
    if (j - i > bestLen) {
      bestStart = i
      bestLen = j - i
    }
    i = j
  }
  if (bestLen < 2)
    return groups.join(':')
  return `${groups.slice(0, bestStart).join(':')}::${groups.slice(bestStart + bestLen).join(':')}`
}

/** True when the parsed IP (v4 int or expanded v6) falls in the range. */
export function ipInRange(ip: { v4: number | null, v6: string | null }, range: Pick<ParsedRange, 'v4Start' | 'v4End' | 'v6Prefix'>): boolean {
  if (ip.v4 !== null && range.v4Start !== null && range.v4End !== null)
    return ip.v4 >= range.v4Start && ip.v4 <= range.v4End
  if (ip.v6 !== null && range.v6Prefix)
    return ip.v6.startsWith(range.v6Prefix)
  return false
}
