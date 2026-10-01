import type { SQL } from 'drizzle-orm'
import type { H3Event } from 'h3'
import type { ClickDimension, ClickFilter } from '#shared/schemas/click'
import { and, eq, gte, isNotNull, lte, or, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { clicks } from '../database/schema'

// Fork: shared WHERE / GROUP BY building for the click log API.

export function useClickDb(event: H3Event) {
  return drizzle(event.context.cloudflare.env.DB)
}

const EQUALITY_FILTERS = [
  'slug',
  'asOrg',
  'networkType',
  'country',
  'city',
  'postalCode',
  'deviceType',
  'os',
  'browser',
  'inApp',
  'source',
  'refererHost',
  'served',
  'visitorId',
  'knownIpLabel',
  'language',
] as const

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, char => `\\${char}`)
}

export function clickConditions(filter: ClickFilter, overrides: Partial<Pick<ClickFilter, 'bots' | 'known'>> = {}): SQL | undefined {
  const conditions: (SQL | undefined)[] = []
  if (filter.startAt !== undefined)
    conditions.push(gte(clicks.ts, filter.startAt * 1000))
  if (filter.endAt !== undefined)
    conditions.push(lte(clicks.ts, filter.endAt * 1000 + 999))

  for (const key of EQUALITY_FILTERS) {
    const value = filter[key]
    if (value === undefined)
      continue
    conditions.push(value === '(none)' ? sql`${clicks[key]} is null` : eq(clicks[key], value))
  }
  if (filter.tag)
    conditions.push(sql`(',' || coalesce(${clicks.tags}, '') || ',') like ${`%,${escapeLike(filter.tag)},%`} escape '\\'`)
  if (filter.botReason) {
    conditions.push(filter.botReason === '(none)'
      ? sql`${clicks.botReason} is null`
      : or(eq(clicks.botReason, filter.botReason), sql`(',' || coalesce(${clicks.botReason}, '') || ',') like ${`%,${escapeLike(filter.botReason)},%`} escape '\\'`))
  }
  if (filter.ip) {
    conditions.push(filter.ip.endsWith('*')
      ? sql`${clicks.ip} like ${`${escapeLike(filter.ip.slice(0, -1))}%`} escape '\\'`
      : eq(clicks.ip, filter.ip))
  }
  if (filter.q) {
    const pattern = `%${escapeLike(filter.q)}%`
    conditions.push(or(
      sql`${clicks.ip} like ${pattern} escape '\\'`,
      sql`${clicks.ua} like ${pattern} escape '\\'`,
      sql`${clicks.referer} like ${pattern} escape '\\'`,
      sql`${clicks.asOrg} like ${pattern} escape '\\'`,
      sql`${clicks.slug} like ${pattern} escape '\\'`,
      sql`${clicks.query} like ${pattern} escape '\\'`,
    ))
  }

  const bots = overrides.bots ?? filter.bots
  if (bots === 'exclude')
    conditions.push(eq(clicks.isBot, false))
  else if (bots === 'only')
    conditions.push(eq(clicks.isBot, true))

  const known = overrides.known ?? filter.known
  if (known === 'exclude')
    conditions.push(eq(clicks.knownIpExclude, false))
  else if (known === 'only')
    conditions.push(isNotNull(clicks.knownIpId))

  return and(...conditions.filter(Boolean))
}

/** SQL expression for a breakdown dimension. Time buckets use the client's UTC offset. */
export function dimensionExpression(dimension: ClickDimension, tzOffset: number): SQL {
  const local = sql`(${clicks.ts} / 1000 + ${tzOffset * 60})`
  switch (dimension) {
    case 'hour':
      return sql`cast(strftime('%H', ${local}, 'unixepoch') as integer)`
    case 'weekday':
      return sql`cast(strftime('%w', ${local}, 'unixepoch') as integer)`
    case 'day':
      return sql`strftime('%Y-%m-%d', ${local}, 'unixepoch')`
    case 'tags':
      return sql`coalesce(${clicks.tags}, '')`
    case 'ip':
      return sql`${clicks.ip}`
    default:
      return sql`${clicks[dimension]}`
  }
}

export const CLICK_CSV_COLUMNS = [
  'id',
  'ts',
  'slug',
  'tags',
  'destination',
  'served',
  'ip',
  'asn',
  'asOrg',
  'networkType',
  'country',
  'region',
  'city',
  'postalCode',
  'latitude',
  'longitude',
  'timezone',
  'colo',
  'deviceType',
  'deviceVendor',
  'deviceModel',
  'os',
  'osVersion',
  'browser',
  'browserVersion',
  'inApp',
  'language',
  'referer',
  'refererHost',
  'query',
  'source',
  'visitorId',
  'newVisitor',
  'isBot',
  'botReason',
  'knownIpLabel',
  'knownIpExclude',
  'ua',
] as const

export function toCsvValue(value: unknown): string {
  if (value === null || value === undefined)
    return ''
  if (typeof value === 'number')
    return String(value)
  const text = typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value)
  // Neutralise spreadsheet formula injection and quote when needed.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}
