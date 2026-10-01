import type { ClickDimension } from '#shared/schemas/click'
import { defineStore } from 'pinia'

// Fork: state for the Clicks dashboard page.

export type ClickRangePreset = 'today' | '7d' | '30d' | '90d' | '180d'
export type ClickTriState = 'include' | 'exclude' | 'only'

export interface ClickRow {
  id: number
  ts: number
  slug: string
  tags: string | null
  destination: string | null
  served: string | null
  ip: string | null
  asn: number | null
  asOrg: string | null
  networkType: string | null
  country: string | null
  region: string | null
  city: string | null
  postalCode: string | null
  deviceType: string | null
  deviceVendor: string | null
  deviceModel: string | null
  os: string | null
  osVersion: string | null
  browser: string | null
  browserVersion: string | null
  inApp: string | null
  language: string | null
  referer: string | null
  refererHost: string | null
  query: string | null
  source: string | null
  visitorId: string | null
  newVisitor: boolean | null
  isBot: boolean
  botReason: string | null
  knownIpLabel: string | null
  knownIpExclude: boolean
  ua: string | null
}

export interface ClickBreakdownRow {
  value: string | number | null
  clicks: number
  visitors: number
  ips: number
  lastSeen: number
}

const RANGE_DAYS: Record<ClickRangePreset, number> = { 'today': 0, '7d': 7, '30d': 30, '90d': 90, '180d': 180 }

function rangeFor(preset: ClickRangePreset) {
  const now = new Date()
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  if (preset !== 'today')
    start.setDate(start.getDate() - RANGE_DAYS[preset] + 1)
  return { startAt: Math.floor(start.getTime() / 1000), endAt: Math.floor(now.getTime() / 1000) }
}

export const useDashboardClicksStore = defineStore('dashboard-clicks', () => {
  const preset = ref<ClickRangePreset>('7d')
  const filters = ref<Partial<Record<ClickDimension | 'q', string>>>({})
  const bots = ref<ClickTriState>('exclude')
  const known = ref<ClickTriState>('exclude')
  const refreshKey = ref(0)
  const tzOffset = -new Date().getTimezoneOffset()

  const query = computed(() => {
    const { startAt, endAt } = rangeFor(preset.value)
    // Time-bucket dimensions are display-only; they are not filterable server-side.
    const filterEntries = Object.entries(filters.value).filter(([key, value]) => value !== undefined && !['hour', 'weekday', 'day'].includes(key))
    return {
      startAt,
      endAt,
      bots: bots.value,
      known: known.value,
      tzOffset,
      ...Object.fromEntries(filterEntries.map(([key, value]) => [key === 'tags' ? 'tag' : key, value])),
      _r: refreshKey.value,
    }
  })

  function setFilter(key: ClickDimension | 'q', value: string | undefined) {
    const next = { ...filters.value }
    if (value === undefined || value === '')
      delete next[key]
    else
      next[key] = value
    filters.value = next
  }

  function clearFilters() {
    filters.value = {}
  }

  function refresh() {
    refreshKey.value++
  }

  return { preset, filters, bots, known, tzOffset, query, setFilter, clearFilters, refresh }
})
