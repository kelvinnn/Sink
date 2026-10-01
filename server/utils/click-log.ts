import type { H3Event } from 'h3'
import type { Link } from '#shared/schemas/link'
import { drizzle } from 'drizzle-orm/d1'
import { UAParser } from 'ua-parser-js'
import { CLIs, Crawlers, Emails, ExtraDevices, Fetchers, InApps } from 'ua-parser-js/extensions'
import { parseURL } from 'ufo'
import { expandIpv6, ipInRange, ipv4ToInt } from '#shared/utils/ip'
import { clicks, knownIps } from '../database/schema'

// Fork: per-click log with raw request data (NUXT_CLICK_LOG=true).

export type ServeMode = 'gtm' | 'redirect' | 'preview' | 'proxy' | 'cloak'

// Cloud / hosting networks: traffic from here is almost always automated
// (email link scanners such as Microsoft Safe Links, previewers, crawlers).
const DATACENTER_ASNS = new Set([
  8068,
  8069,
  8075, // Microsoft
  15169,
  19527,
  396982, // Google
  16509,
  14618, // Amazon
  14061, // DigitalOcean
  24940, // Hetzner
  16276, // OVH
  63949, // Akamai Connected Cloud (Linode)
  20473, // Vultr
  31898, // Oracle
  45102,
  37963, // Alibaba
  132203,
  45090, // Tencent
  12876, // Scaleway
  51167, // Contabo
  60781,
  28753, // Leaseweb
  32934, // Meta (link preview fetchers)
  26211, // Proofpoint
  13238, // Yandex
])
const DATACENTER_ORG = /amazon|aws|google cloud|microsoft|azure|digitalocean|hetzner|ovh|linode|vultr|choopa|oracle|alibaba|tencent|scaleway|contabo|leaseweb|proofpoint|mimecast|barracuda|facebook|meta platforms|hosting|datacenter|data center|server/i
// Privacy relays and consumer VPNs: real people, location is approximate.
const RELAY_ASNS = new Set([
  13335, // Cloudflare (WARP, iCloud Private Relay)
  36183, // Akamai Private Relay
  54113, // Fastly (iCloud Private Relay)
])
// Corporate secure web gateways: real office workers browsing through a cloud proxy.
const CORPORATE_PROXY_ASNS = new Set([22616, 53813, 62044]) // Zscaler
const CORPORATE_PROXY_ORG = /zscaler|netskope|forcepoint|menlo security|cisco umbrella|opendns/i

const PREVIEW_UA = /facebookexternalhit|facebot|whatsapp\/|telegrambot|slackbot|discordbot|twitterbot|linkedinbot|skypeuripreview|embedly|pinterestbot|redditbot|applebot|vkshare|kakaotalk-scrap|iframely|bitlybot|googleother|google-inspectiontool|microsoft office|ms-office|outlook-ios|skype/i
const HEADLESS_UA = /headless|phantomjs|puppeteer|playwright|selenium|lighthouse|pingdom|uptimerobot/i
const CLIENT_UA = /curl\/|wget|python-requests|python-urllib|aiohttp|go-http-client|okhttp|java\/|axios|node-fetch|undici|libwww|httpclient|scrapy|postman/i
const STRONG_BOT_REASONS = new Set(['verified-bot', 'crawler-ua', 'preview-ua', 'headless', 'http-client', 'datacenter', 'no-ua'])

const IN_APP_PATTERNS: [string, RegExp][] = [
  ['messenger', /FBAN\/Messenger|MessengerForiOS|Orca-Android/i],
  ['instagram', /Instagram/i],
  ['threads', /Barcelona/],
  ['facebook', /FBAN|FBAV|FB_IAB|FBIOS|FB4A/],
  ['tiktok', /musical_ly|TikTok|BytedanceWebview|trill_/i],
  ['whatsapp', /WhatsApp/i],
  ['telegram', /Telegram/i],
  ['line', /\bLine\//],
  ['wechat', /MicroMessenger/i],
  ['snapchat', /Snapchat/i],
  ['twitter', /Twitter/i],
  ['linkedin', /LinkedInApp/i],
  ['pinterest', /Pinterest/i],
  ['xiaohongshu', /xhsdiscover|discover\/\d/i],
  ['google-app', /\bGSA\//],
]

function classifyNetwork(asn: number | undefined, asOrg: string): 'isp' | 'datacenter' | 'relay' | 'corporate-proxy' {
  if (asn && RELAY_ASNS.has(asn))
    return 'relay'
  if ((asn && CORPORATE_PROXY_ASNS.has(asn)) || CORPORATE_PROXY_ORG.test(asOrg))
    return 'corporate-proxy'
  if ((asn && DATACENTER_ASNS.has(asn)) || DATACENTER_ORG.test(asOrg))
    return 'datacenter'
  return 'isp'
}

function detectInApp(ua: string, parsed: ReturnType<UAParser['getResult']>): string | null {
  for (const [name, pattern] of IN_APP_PATTERNS) {
    if (pattern.test(ua))
      return name
  }
  if (parsed.browser.type === 'inapp' && parsed.browser.name)
    return parsed.browser.name.toLowerCase().replace(/\s+/g, '-')
  return null
}

interface KnownIpRow { id: number, label: string, exclude: boolean, v4Start: number | null, v4End: number | null, v6Prefix: string | null }
let knownIpCache: { at: number, rows: KnownIpRow[] } | null = null

export function invalidateKnownIpCache() {
  knownIpCache = null
}

async function loadKnownIps(db: ReturnType<typeof drizzle>): Promise<KnownIpRow[]> {
  if (knownIpCache && Date.now() - knownIpCache.at < 60_000)
    return knownIpCache.rows
  const rows = await db.select({
    id: knownIps.id,
    label: knownIps.label,
    exclude: knownIps.exclude,
    v4Start: knownIps.v4Start,
    v4End: knownIps.v4End,
    v6Prefix: knownIps.v6Prefix,
  }).from(knownIps)
  knownIpCache = { at: Date.now(), rows }
  return rows
}

/** Most specific known range for an IP (smallest IPv4 range / longest IPv6 prefix). */
export function matchKnownIp<T extends Omit<KnownIpRow, 'id' | 'label' | 'exclude'>>(ip: { v4: number | null, v6: string | null }, rows: T[]): T | undefined {
  return rows
    .filter(row => ipInRange(ip, row))
    .sort((a, b) => {
      if (a.v4Start !== null && b.v4Start !== null)
        return (a.v4End! - a.v4Start) - (b.v4End! - b.v4Start)
      return (b.v6Prefix?.length || 0) - (a.v6Prefix?.length || 0)
    })[0]
}

function getVisitorCookieName(event: H3Event): string {
  return String(useRuntimeConfig(event).visitorCookie || '_v')
}

/**
 * Collects the click synchronously (and sets the visitor cookie on the response), then writes
 * it to D1 after the response is sent. No-op unless NUXT_CLICK_LOG is enabled.
 */
export function logClick(event: H3Event, link: Link, destination: string, served: ServeMode): void {
  const config = useRuntimeConfig(event)
  if (!config.clickLog || !event.context.cloudflare?.env?.DB)
    return

  try {
    const cf = (event.context.cloudflare.request?.cf || {}) as Record<string, any>
    const ua = getHeader(event, 'user-agent') || ''
    const parsed = new UAParser(ua, {
      // @ts-expect-error extension typings
      browser: [Crawlers.browser || [], CLIs.browser || [], Emails.browser || [], Fetchers.browser || [], InApps.browser || []].flat(),
      // @ts-expect-error extension typings
      device: [ExtraDevices.device || []].flat(),
    }).getResult()

    const ip = getHeader(event, 'cf-connecting-ip') || getHeader(event, 'x-real-ip') || getRequestIP(event, { xForwardedFor: true }) || ''
    const v4 = ipv4ToInt(ip)
    const v6 = v4 === null ? expandIpv6(ip) : null
    const asn = typeof cf.asn === 'number' ? cf.asn : undefined
    const asOrg = String(cf.asOrganization || '')
    const networkType = classifyNetwork(asn, asOrg)
    const language = getHeader(event, 'accept-language') || ''

    const reasons: string[] = []
    if (cf.botManagement?.verifiedBot)
      reasons.push('verified-bot')
    if (!ua)
      reasons.push('no-ua')
    if (['crawler', 'fetcher', 'cli'].includes(parsed.browser.type || '') || /bot|spider|crawl/i.test(parsed.browser.name || ''))
      reasons.push('crawler-ua')
    if (PREVIEW_UA.test(ua))
      reasons.push('preview-ua')
    if (HEADLESS_UA.test(ua))
      reasons.push('headless')
    if (CLIENT_UA.test(ua))
      reasons.push('http-client')
    if (networkType === 'datacenter')
      reasons.push('datacenter')
    if (!language)
      reasons.push('no-language') // weak signal only
    const isBot = reasons.some(reason => STRONG_BOT_REASONS.has(reason))

    // Visitor cookie: first-party, set on the redirect / tracking response itself.
    const cookieName = getVisitorCookieName(event)
    let visitorId = getCookie(event, cookieName) || null
    const newVisitor = !visitorId
    if (!visitorId && !isBot && config.visitorCookieEnabled !== false) {
      visitorId = crypto.randomUUID()
      setCookie(event, cookieName, visitorId, {
        path: '/',
        maxAge: 60 * 60 * 24 * 400,
        httpOnly: true,
        sameSite: 'lax',
        secure: getRequestProtocol(event) === 'https',
      })
    }

    const referer = getHeader(event, 'referer') || ''
    const query = getRequestURL(event).search.replace(/^\?/, '')
    const params = new URLSearchParams(query)
    const source = params.get('s') || params.get('src') || params.get('utm_source') || null

    const row = {
      ts: Date.now(),
      linkId: link.id || null,
      slug: link.slug,
      tags: (link.tags || []).join(',') || null,
      destination,
      served,
      ip: ip || null,
      ipV4: v4,
      ipV6: v6,
      asn: asn ?? null,
      asOrg: asOrg || null,
      networkType,
      country: cf.country || null,
      region: cf.region || null,
      city: cf.city || null,
      postalCode: cf.postalCode || null,
      latitude: cf.latitude ? Number(cf.latitude) : null,
      longitude: cf.longitude ? Number(cf.longitude) : null,
      timezone: cf.timezone || null,
      colo: cf.colo || null,
      ua: ua || null,
      browser: parsed.browser.name || null,
      browserVersion: parsed.browser.version || null,
      os: parsed.os.name || null,
      osVersion: parsed.os.version || null,
      deviceType: parsed.device.type || (parsed.os.name && /windows|mac os|linux|chrome os/i.test(parsed.os.name) ? 'desktop' : null),
      deviceVendor: parsed.device.vendor || null,
      deviceModel: parsed.device.model || null,
      inApp: detectInApp(ua, parsed),
      language: language || null,
      referer: referer || null,
      refererHost: parseURL(referer).host || null,
      query: query || null,
      source,
      visitorId,
      newVisitor: visitorId ? newVisitor : null,
      isBot,
      botReason: reasons.join(',') || null,
      knownIpId: null as number | null,
      knownIpLabel: null as string | null,
      knownIpExclude: false,
    }

    const db = drizzle(event.context.cloudflare.env.DB)
    const write = (async () => {
      const match = matchKnownIp({ v4, v6 }, await loadKnownIps(db))
      if (match) {
        row.knownIpId = match.id
        row.knownIpLabel = match.label
        row.knownIpExclude = match.exclude
      }
      await db.insert(clicks).values(row)
    })().catch((error) => {
      console.error({ event: 'click_log.write.failed', message: String(error) })
    })
    const waitUntil = event.context.cloudflare.context?.waitUntil?.bind(event.context.cloudflare.context)
    if (waitUntil)
      waitUntil(write)
  }
  catch (error) {
    console.error({ event: 'click_log.collect.failed', message: String(error) })
  }
}
