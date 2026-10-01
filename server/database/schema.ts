import type { Link } from '../../shared/schemas/link'
import { sql } from 'drizzle-orm'
import { index, integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const links = sqliteTable('links', {
  slug: text().primaryKey(),
  id: text().notNull(),
  url: text().notNull(),
  comment: text(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  expiration: integer(),
  title: text(),
  description: text(),
  image: text(),
  apple: text(),
  google: text(),
  cloaking: integer({ mode: 'boolean' }),
  redirectWithQuery: integer('redirect_with_query', { mode: 'boolean' }),
  proxy: integer({ mode: 'boolean' }),
  password: text(),
  unsafe: integer({ mode: 'boolean' }),
  geo: text({ mode: 'json' }).$type<Link['geo']>(),
  normalizedUrl: text('normalized_url').notNull(),
  effectiveExpiresAt: integer('effective_expires_at'),
}, table => [
  index('links_created_at_slug_idx').on(table.createdAt, table.slug),
  index('links_created_at_desc_slug_idx').on(sql`${table.createdAt} desc`, table.slug),
  index('links_normalized_url_idx').on(table.normalizedUrl),
  index('links_id_idx').on(table.id),
])

export const tags = sqliteTable('tags', {
  name: text().primaryKey(),
})

export const linkTags = sqliteTable('link_tags', {
  linkSlug: text('link_slug').notNull().references(() => links.slug, { onDelete: 'cascade' }),
  tagName: text('tag_name').notNull().references(() => tags.name, { onDelete: 'cascade' }),
}, table => [
  primaryKey({ columns: [table.linkSlug, table.tagName] }),
  index('link_tags_tag_name_link_slug_idx').on(table.tagName, table.linkSlug),
])

export const linkTombstones = sqliteTable('link_tombstones', {
  slug: text().primaryKey(),
  deletedAt: integer('deleted_at').notNull(),
})

export const linkMigrationRuns = sqliteTable('link_migration_runs', {
  id: text().primaryKey(),
  expectedCursor: text('expected_cursor'),
  scanned: integer().notNull().default(0),
  inserted: integer().notNull().default(0),
  skipped: integer().notNull().default(0),
  expired: integer().notNull().default(0),
  force: integer({ mode: 'boolean' }).notNull(),
  status: text({ enum: ['running', 'completed'] }).notNull().default('running'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, table => [
  index('link_migration_runs_status_updated_at_desc_created_at_desc_id_desc_idx').on(
    table.status,
    sql`${table.updatedAt} desc`,
    sql`${table.createdAt} desc`,
    sql`${table.id} desc`,
  ),
])

// Fork: per-click log (NUXT_CLICK_LOG=true). One row per short-link visit, raw values.
export const clicks = sqliteTable('clicks', {
  id: integer().primaryKey({ autoIncrement: true }),
  ts: integer().notNull(), // unix milliseconds
  linkId: text('link_id'),
  slug: text().notNull(),
  tags: text(), // comma-separated link tags at click time
  destination: text(),
  served: text(), // gtm | redirect | preview | proxy | cloak
  ip: text(),
  ipV4: integer('ip_v4'), // IPv4 as an unsigned integer, for range matching
  ipV6: text('ip_v6'), // IPv6 expanded to 32 hex chars, for prefix matching
  asn: integer(),
  asOrg: text('as_org'),
  networkType: text('network_type'), // isp | datacenter | relay
  country: text(),
  region: text(),
  city: text(),
  postalCode: text('postal_code'),
  latitude: real(),
  longitude: real(),
  timezone: text(),
  colo: text(),
  ua: text(),
  browser: text(),
  browserVersion: text('browser_version'),
  os: text(),
  osVersion: text('os_version'),
  deviceType: text('device_type'), // mobile | tablet | desktop | ...
  deviceVendor: text('device_vendor'),
  deviceModel: text('device_model'),
  inApp: text('in_app'), // instagram | facebook | tiktok | ...
  language: text(),
  referer: text(),
  refererHost: text('referer_host'),
  query: text(), // raw incoming query string
  source: text(), // ?s= or utm_source
  visitorId: text('visitor_id'),
  newVisitor: integer('new_visitor', { mode: 'boolean' }),
  isBot: integer('is_bot', { mode: 'boolean' }).notNull().default(false),
  botReason: text('bot_reason'),
  knownIpId: integer('known_ip_id'),
  knownIpLabel: text('known_ip_label'),
  knownIpExclude: integer('known_ip_exclude', { mode: 'boolean' }).notNull().default(false),
}, table => [
  index('clicks_ts_idx').on(table.ts),
  index('clicks_slug_ts_idx').on(table.slug, table.ts),
  index('clicks_ip_idx').on(table.ip),
  index('clicks_ip_v4_idx').on(table.ipV4),
  index('clicks_visitor_id_idx').on(table.visitorId),
])

// Fork: labelled IPs / ranges (outlets, office, agency, ...). Matched when clicks are written.
export const knownIps = sqliteTable('known_ips', {
  id: integer().primaryKey({ autoIncrement: true }),
  cidr: text().notNull().unique(), // e.g. 203.0.113.7/32, 203.0.113.0/24, 2001:db8:1::/48
  label: text().notNull(),
  category: text().notNull().default('other'),
  exclude: integer({ mode: 'boolean' }).notNull().default(true),
  note: text(),
  v4Start: integer('v4_start'),
  v4End: integer('v4_end'),
  v6Prefix: text('v6_prefix'), // leading hex nibbles of the expanded address
  createdAt: integer('created_at').notNull(),
})
