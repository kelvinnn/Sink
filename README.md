<!-- FORK-README:START (this block is fork-only; the upstream README continues unchanged below) -->

# ⚡ Sink — with retargeting pixels and a raw click log

**A self-hosted link shortener on Cloudflare Workers that fires Google Tag Manager, Meta Pixel and Google Ads retargeting tags on every redirect, and keeps a raw, per-click log with IP address, ISP, device, source and bot detection.**

> [!NOTE]
> This is a **fork of [miantiao-me/Sink](https://github.com/miantiao-me/Sink)**, the excellent serverless link shortener. All credit for Sink itself goes to its author and contributors. This fork adds the features below, **all opt-in**: with none of the settings set, it behaves exactly like upstream. It is kept merge-compatible with upstream.

## Why this fork

Hosted shorteners such as Bitly, Short.io, Rebrandly and Dub typically put retargeting pixels and detailed click data on paid plans, or don't offer them at all. Sink is free to run on Cloudflare's free tier, but redirects instantly, so no browser tag can fire. This fork adds the marketing and data features while keeping everything else about Sink.

| | Upstream Sink | This fork |
|---|---|---|
| Retargeting pixels on redirect (GTM → Meta Pixel, Google Ads, GA4, TikTok, …) | — | ✅ |
| Raw per-click log: IP, ISP / ASN, postal-code area, device, in-app browser, referrer, source | — | ✅ |
| New vs returning visitors (first-party cookie) | — | ✅ |
| Bot, link-preview and email-scanner detection with reasons | Basic | ✅ |
| Known IPs: label and exclude your own networks (shops, office, agency) | — | ✅ |
| Clicks dashboard: filters, weekday × hour heatmap, breakdowns, CSV export | — | ✅ |
| Slugs with `/` and `.` (`menu/lunch`, `price-list.pdf`) | — | ✅ |
| Team access: Cloudflare Access sign-in with admin / editor / viewer roles | Single shared admin | ✅ |
| Activity log: who created, changed or deleted what, and when | — | ✅ |
| Restore deleted links and revert to any earlier version | — | ✅ |
| Link locks (optionally until a date) for links on printed materials | — | ✅ |
| Hidden admin: dashboard, API and assets invisible on your public short domain | — | ✅ |
| Everything in Sink: analytics, QR codes, AI slugs, geo / device routing, import / export, MCP | ✅ | ✅ |

## What it adds

### 🎯 Retargeting pixels on redirect
Set `NUXT_GTM_ID` and each visit gets a tiny page that loads your Google Tag Manager container, then redirects. Run Meta Pixel, Google Ads remarketing, GA4 or any other tag from GTM, so you can build ad audiences even when the destination is a site you don't control (delivery apps, marketplaces, WhatsApp, Google Maps, forms).

- Pushes a `shortlink_view` event with the slug, tags and destination host to the `dataLayer`, for per-link and per-tag audiences
- Bots and link previewers skip the page and get a plain redirect
- Links tagged `internal` or `hiring` (configurable) never fire pixels, so staff and job applicants stay out of your audiences
- Cross-domain GA4 / Ads linker support (`_gl`) for your own destinations

### 🧾 Raw click log
Set `NUXT_CLICK_LOG=true` and every visit is stored as one row in your own D1 database:

- **Network:** full IP (IPv4 / IPv6), ASN, ISP / organisation, network type (ISP, data centre, privacy relay, corporate proxy)
- **Place:** country, region, city, postal code, coordinates, timezone
- **Device:** type, vendor, model, OS, browser, and the **in-app browser** (Instagram, Facebook, TikTok, WhatsApp, WeChat, LINE, …)
- **Source:** full referrer, raw query string, and a source tag from `?src=` or `utm_source` (`?s=` also works, but GA4 treats `s` as a site-search term)
- **Visitor:** first-party cookie ID, new vs returning
- **Quality:** bot flag with reasons (preview bot, data-centre network, HTTP client, headless browser)
- Automatic retention (`NUXT_CLICK_LOG_RETENTION_DAYS`, default 183) and CSV export

### 📊 Clicks dashboard
A new **Clicks** page: period, bot and known-IP filters; search; totals; a weekday × hour heatmap; breakdowns by link, tag, source, referrer, in-app browser, network, IP, visitor, device, location and time (click any row to filter); the raw log; CSV export. Filters live in the URL, and every link has a **Clicks** shortcut.

### 🛡️ Known IPs
Label IP addresses or CIDR ranges (shop Wi-Fi, office, agency) and exclude them from stats. Labels can be re-applied to past clicks.

### 👥 Team access, roles and an audit trail
Put the dashboard behind [Cloudflare Access](https://docs.sink.cool/configuration/cloudflare-access) and each person signs in as themselves (Google, one-time email code, SSO).

- **Roles:** *admin* (everything), *editor* (create, edit, delete and restore links; statistics without IPs) and *viewer* (read-only). New users get `NUXT_DEFAULT_ROLE`; emails in `NUXT_ADMIN_EMAILS` are always admin. A **Users** page changes roles or disables people.
- **Activity log:** every create, edit, delete, import, restore, revert, lock, role change and data export is recorded with who, when, from which IP and a before / after snapshot. Entries are append-only.
- **Soft delete and history:** deleting a link saves its full version first. A **Deleted links** page restores it with the same id, so its statistics continue. Each link has a **History** with field-level changes and *Return to this version*.
- **Created by / edited by** on every link card.
- **Link locks:** an admin can lock a link, until unlocked or until a date, with a reason. Editors cannot change or delete a locked link. Made for links printed on menus, packaging and signage.
- **Privacy by role:** raw IPs, visitor ids and CSV export are admin-only.

### 🕶️ Hidden admin
Set `NUXT_ADMIN_HOST` (for example `admin.example.com`, behind Cloudflare Access) and the dashboard, API and static files are served only there. Your public short domain answers every other path like an unknown link. Alternatively, `NUXT_ADMIN_GATE_PATH` unlocks the dashboard through a secret path. Either way `robots.txt` is neutral, `workers.dev` and preview URLs are off, and the redirect page carries no branding.

### 🔧 Smaller changes
- Slugs may contain `.`, `_` and `/`
- Stored destination URLs are never re-encoded
- Fix for the link import form being disabled by default

## Fork settings

| Variable | Default | Purpose |
|---|---|---|
| `NUXT_GTM_ID` | *(empty)* | GTM container to load before redirecting. Empty = plain redirects |
| `NUXT_GTM_SKIP_TAGS` | `internal,hiring` | Link tags that never get the tracking page |
| `NUXT_GTM_MAX_DELAY_MS` | `2000` | Longest wait before redirecting |
| `NUXT_CLICK_LOG` | `false` | Store one row per click in D1 |
| `NUXT_CLICK_LOG_RETENTION_DAYS` | `183` | Delete click rows older than this (daily) |
| `NUXT_VISITOR_COOKIE` / `NUXT_VISITOR_COOKIE_ENABLED` | `_v` / `true` | First-party visitor cookie |
| `NUXT_ADMIN_HOST` | *(empty)* | Hostname that serves the dashboard (put it behind Cloudflare Access). Other hostnames only redirect |
| `NUXT_ADMIN_EMAILS` | *(empty)* | Comma-separated emails that are always admin |
| `NUXT_DEFAULT_ROLE` | `editor` | Role for new Access users: `admin`, `editor` or `viewer` |
| `NUXT_ALLOWED_EMAIL_DOMAINS` | *(empty)* | Optional extra check on top of the Access policy |
| `NUXT_ADMIN_GATE_PATH` | *(empty)* | Alternative to the admin host: secret path that unlocks the dashboard. Set it as a secret |

Deploy exactly as upstream ([Workers guide](https://docs.sink.cool/deployment/workers)), then add the variables you want under **Worker → Settings → Variables and Secrets**. For a GTM page that behaves like classic redirects, also set `NUXT_REDIRECT_STATUS_CODE=302` and `NUXT_REDIRECT_WITH_QUERY=true`.

> [!IMPORTANT]
> Retargeting tags, IP logging and visitor cookies process personal data. Tell your visitors in your privacy notice, and check the rules that apply to you (GDPR, PDPA, CCPA, …).

File-by-file changes and upstream-sync notes: **[FORK.md](./FORK.md)**. Licence: AGPL-3.0, same as upstream.

<!-- FORK-README:END -->

---

> The original Sink README follows, unchanged.

# ⚡ Sink

**A Simple, Speedy, Secure, and Serverless Link Shortener with Analytics, Running Entirely on Cloudflare.**

[Website](https://sink.cool) · [Documentation](https://docs.sink.cool) · [API Reference](https://sink.cool/_docs/scalar)

<a href="https://trendshift.io/repositories/20331" target="_blank">
  <img
    src="https://trendshift.io/api/badge/repositories/20331"
    alt="miantiao-me/Sink | Trendshift"
    width="250"
    height="55"
  />
</a>
<a href="https://news.ycombinator.com/item?id=40843683" target="_blank">
  <img
    src="https://hackernews-badge.vercel.app/api?id=40843683"
    alt="Featured on Hacker News"
    width="250"
    height="55"
  />
</a>
<a href="https://hellogithub.com/repository/57771fd91d1542c7a470959b677a9944" target="_blank">
  <img
    src="https://abroad.hellogithub.com/v1/widgets/recommend.svg?rid=57771fd91d1542c7a470959b677a9944&claim_uid=qi74Zp23wYKeAVB&theme=neutral"
    alt="Featured｜HelloGitHub"
    width="250"
    height="55"
  />
</a>
<a href="https://www.uneed.best/tool/sink" target="_blank">
  <img
    src="https://www.uneed.best/POTW1.png"
    alt="Uneed Badge"
    width="250"
    height="55"
  />
</a>

[<img src="https://devin.ai/assets/deepwiki-badge.png" alt="DeepWiki" height="20"/>](https://deepwiki.com/miantiao-me/Sink)
![Cloudflare](https://img.shields.io/badge/Cloudflare-F69652?style=flat&logo=cloudflare&logoColor=white)
![Nuxt](https://img.shields.io/badge/Nuxt-00DC82?style=flat&logo=nuxtdotjs&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-06B6D4?style=flat&logo=tailwindcss&logoColor=white)
![shadcn/ui](https://img.shields.io/badge/shadcn/ui-000000?style=flat&logo=shadcnui&logoColor=white)
![License](https://img.shields.io/badge/License-AGPL--3.0-blue?style=flat)

![Hero](./public/image.png)

---

## ✨ Features

- **🔗 URL Shortening:** Compress your URLs to their minimal length.
- **📈 Analytics:** Monitor link analytics and gather insightful statistics.
- **☁️ Serverless:** Deploy without the need for traditional servers.
- **🎨 Customizable Slug:** Support personalized slugs, UTM parameters, and optional case-sensitive slug matching through configuration.
- **🪄 AI Assistance:** Optionally use Cloudflare Workers AI to generate slugs and OpenGraph metadata from page content.
- **⏰ Link Control:** Set expirations, passwords, and unsafe-link warning pages.
- **📱 Smart Routing:** Redirect visitors by device or country.
- **🖼️ Social Preview:** Customize social previews with titles, descriptions, and images.
- **📊 Near-real-time Analytics:** Display a live 3D globe and event logs using 10-second analytics polling and client-side replay, not SSE or WebSocket.
- **🔲 QR Code:** Generate QR codes for your short links.
- **📦 Import/Export:** Transfer links via JSON and export access analytics via CSV.
- **🌍 Multi-language:** Full i18n support for dashboard and redirect pages.

> [!TIP]
> **Who is Sink for?**
>
> Sink focuses on **individuals and small teams** who want a simple, self-hosted shortener on Cloudflare.
>
> For professional / business needs (managed service, multi-user, SLA, and more), use **[S.EE](https://sink.cool/see)**.

## 🪧 Demo

Experience the demo at [Sink.Cool](https://sink.cool/dashboard). Log in using the Site Token below:

```txt
Site Token: SinkCool
```

<details>
  <summary><b>Screenshots</b></summary>
  <img alt="Analytics" src="./docs/images/sink.cool_dashboard.png"/>
  <img alt="Links" src="./docs/images/sink.cool_dashboard_links.png"/>
  <img alt="Link Analytics" src="./docs/images/sink.cool_dashboard_link_slug.png"/>
</details>

## 🔀 Sibling versions

Sink and [Slite](https://github.com/miantiao-me/Slite) are sibling versions of the same link-management and analytics project. Sink runs on Cloudflare's serverless platform, while Slite runs as a local Node.js 24+/Docker process. They keep features, API contracts, and file organization compatible with each other wherever practical. Neither version is a legacy branch, and Slite is not a fork replacement for Sink.

## 🧱 Technologies Used

- **Framework**: [Nuxt 4](https://nuxt.com/)
- **Database**: [Cloudflare D1](https://developers.cloudflare.com/d1/) is the authoritative link store; [Workers KV](https://developers.cloudflare.com/kv/) is a write-through read cache
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/)
- **Analytics Engine**: [Cloudflare Workers Analytics Engine](https://developers.cloudflare.com/analytics/)
- **Object Storage**: [Cloudflare R2](https://developers.cloudflare.com/r2/) for optional logical JSON snapshots
- **AI**: Optional [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/)
- **UI Components**: [shadcn-vue](https://www.shadcn-vue.com/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Deployment**: [Cloudflare](https://www.cloudflare.com/)

## 🚗 Roadmap [WIP]

We welcome your contributions and PRs.

- [x] Browser Extension - [Sink Tool](https://github.com/zhuzhuyule/sink-extension)
- [x] Chrome Extension - [Sink Quick Shorten](https://chromewebstore.google.com/detail/sink-quick-shorten/emlojomjpenjgkaphajcokijobpkejih)
- [x] Raycast Extension - [Raycast-Sink](https://github.com/foru17/raycast-sink)
- [x] Apple Shortcuts - [Sink Shortcuts](https://s.search1api.com/sink001)
- [x] iOS App - [Sink](https://apps.apple.com/app/id6745417598)
- [x] Enhanced Link Management (with Cloudflare D1)
- [x] Analytics Enhancements (Multi-link filtering)
- [x] Dashboard Performance Optimization (Infinite loading)
- [x] API, migration, backup, and redirect tests

## 🏗️ Deployment

> Video tutorial: [Watch here](https://www.youtube.com/watch?v=MkU23U2VE9E)

We currently support deployment to [Cloudflare Workers](https://docs.sink.cool/deployment/workers) (recommended) and [Cloudflare Pages](https://docs.sink.cool/deployment/pages) (deprecated).

## ⚒️ Configuration

[Configuration Docs](https://docs.sink.cool/configuration/)

## 🔌 API

[API Docs](https://docs.sink.cool/api/) · [Live Scalar Reference for the public demo instance](https://sink.cool/_docs/scalar)

## 🤖 AI Skills

Install Sink AI Skills for enhanced coding assistance:

```bash
npx skills add miantiao-me/sink
```

## 🧰 MCP

Sink serves a built-in MCP endpoint at `POST /api/mcp`, using the official `@modelcontextprotocol/server` SDK v2, serving modern clients over the per-request transport and 2025-era clients over a stateless fallback with JSON responses.

> Replace the domain below with your own instance, and use the `NUXT_SITE_TOKEN` from your instance's environment variables as the bearer token.

```sh
claude mcp add --transport http sink https://sink.cool/api/mcp --header "Authorization: Bearer SinkCool"
```

Any client that supports an HTTP transport with custom headers can connect the same way:

```json
{
  "mcpServers": {
    "sink": {
      "type": "http",
      "url": "https://sink.cool/api/mcp",
      "headers": {
        "Authorization": "Bearer SinkCool"
      }
    }
  }
}
```

It exposes tools for managing links (list, search, read, count, tag, create, update, upsert, delete) and for reading analytics (counters, views over time, and top values per dimension). See the [integrations documentation](https://docs.sink.cool/integrations/) for the full list.

## 🙋🏻 FAQs

[FAQs](https://docs.sink.cool/faqs)

## 💖 Credits

1. [**Cloudflare**](https://www.cloudflare.com/)
2. [**NuxtHub**](https://hub.nuxt.com/)
3. [**Astroship**](https://astroship.web3templates.com/)
4. [**Tailark**](https://tailark.com/)

## 📄 License

[AGPL-3.0-only](LICENSE) © [miantiao-me](https://github.com/miantiao-me)

## ☕ Sponsor

1. [Follow Me on X (Twitter)](https://404.li/x).
2. [Become a sponsor on GitHub](https://github.com/sponsors/miantiao-me).
