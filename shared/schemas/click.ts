import { z } from 'zod'
import { parseIpRange } from '../utils/ip'

// Fork: click log query contracts.

const optionalText = z.string().trim().min(1).max(256).optional()
const triState = z.enum(['include', 'exclude', 'only'])

export const CLICK_DIMENSIONS = [
  'slug',
  'tags',
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
  'ip',
  'visitorId',
  'knownIpLabel',
  'botReason',
  'language',
  'hour',
  'weekday',
  'day',
] as const

export type ClickDimension = typeof CLICK_DIMENSIONS[number]

export const ClickFilterSchema = z.object({
  startAt: z.coerce.number().int().optional().describe('Unix seconds (inclusive).'),
  endAt: z.coerce.number().int().optional().describe('Unix seconds (inclusive).'),
  slug: optionalText,
  tag: optionalText,
  ip: optionalText.describe('Exact IP, or a prefix ending with * (e.g. 203.0.113.*).'),
  asOrg: optionalText,
  networkType: optionalText,
  country: optionalText,
  city: optionalText,
  postalCode: optionalText,
  deviceType: optionalText,
  os: optionalText,
  browser: optionalText,
  inApp: optionalText,
  source: optionalText,
  refererHost: optionalText,
  served: optionalText,
  visitorId: optionalText,
  knownIpLabel: optionalText,
  botReason: optionalText,
  language: optionalText,
  q: optionalText.describe('Substring search across IP, user agent, referrer, network and slug.'),
  bots: triState.default('exclude'),
  known: triState.default('exclude').describe('Known IPs marked "exclude": include, exclude or only.'),
  tzOffset: z.coerce.number().int().min(-840).max(840).default(0).describe('Minutes east of UTC for hour/weekday/day grouping.'),
})

export type ClickFilter = z.infer<typeof ClickFilterSchema>

export const ClickListQuerySchema = ClickFilterSchema.extend({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  before: z.coerce.number().int().optional().describe('Return clicks with id lower than this (pagination cursor).'),
})

export const ClickBreakdownQuerySchema = ClickFilterSchema.extend({
  dimension: z.enum(CLICK_DIMENSIONS),
  limit: z.coerce.number().int().min(1).max(500).default(50),
})

export const ClickExportQuerySchema = ClickFilterSchema.extend({
  limit: z.coerce.number().int().min(1).max(100_000).default(50_000),
})

export const KNOWN_IP_CATEGORIES = ['outlet', 'office', 'staff', 'agency', 'partner', 'suspicious', 'other'] as const

export const CreateKnownIpSchema = z.object({
  cidr: z.string().trim().min(2).max(64).refine(value => parseIpRange(value) !== null, 'Enter an IP address or CIDR range (IPv6 prefixes in multiples of 4)'),
  label: z.string().trim().min(1).max(64),
  category: z.enum(KNOWN_IP_CATEGORIES).default('other'),
  exclude: z.boolean().default(true),
  note: z.string().trim().max(512).optional(),
})

export const DeleteKnownIpSchema = z.object({
  id: z.number().int().positive(),
})
