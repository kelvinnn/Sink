# Fork notes

Fork of [miantiao-me/Sink](https://github.com/miantiao-me/Sink) with a few small, opt-in additions. The changes are kept small so upstream merges stay easy (`git fetch upstream && git merge upstream/master`).

| Change | Setting | Files |
|---|---|---|
| Slugs may contain `.`, `_` and `/` (e.g. `shop/sale`, `menu.pdf`); reserved slugs match on the first path segment; `api` is reserved | — | `app/app.config.ts`, `shared/schemas/link.ts`, `server/middleware/1.redirect.ts` |
| GTM tracking page before redirect, skipped for bots, non-GET, and links with skip tags. It pushes `shortlink_view` (slug, tags, destination host) to the dataLayer and fires a synthetic mousedown so the GA4/Ads linker can add `_gl` | `NUXT_GTM_ID`, `NUXT_GTM_SKIP_TAGS`, `NUXT_GTM_MAX_DELAY_MS` | `server/utils/tracking-page.ts`, `server/middleware/1.redirect.ts`, `nuxt.config.ts` |
| Admin gate: hides the dashboard, API and static files until a secret path is visited; `/api` also accepts the site token as bearer | `NUXT_ADMIN_GATE_PATH` | `worker/`, `wrangler.jsonc` (`main`, `assets.run_worker_first`), `package.json` deploy scripts |
| `workers_dev` and `preview_urls` disabled, so the Worker is only reachable on its custom domain | — | `wrangler.jsonc` |
| Fix: import file input was always disabled when `previewMode` is the default empty string (Vue treats `""` as true for `disabled`) | — | `app/components/dashboard/migrate/ImportForm.vue` |
| With `redirectWithQuery`, the destination is only rebuilt when the request has a query string, so stored URLs are not re-encoded | — | `server/middleware/1.redirect.ts` |
| Per-click log in D1 (`clicks` table): raw IP, ASN/network + type (isp/datacenter/relay/corporate-proxy), location, device, in-app browser, referrer, query/source, serve mode, bot flag + reasons, first-party visitor cookie. Daily retention cleanup | `NUXT_CLICK_LOG`, `NUXT_CLICK_LOG_RETENTION_DAYS`, `NUXT_VISITOR_COOKIE(_ENABLED)` | `server/utils/click-log.ts`, `server/utils/click-query.ts`, `server/api/clicks/*`, `server/plugins/click-log-retention.ts`, `shared/schemas/click.ts`, `shared/utils/ip.ts`, `drizzle/0006_*` |
| Known IPs (`known_ips` table): label IPs/CIDR ranges, exclude from stats, re-apply to past clicks | — | `server/api/known-ips/*` |
| Dashboard pages: Clicks (filters, summary, weekday×hour heatmap, breakdowns, raw log, CSV export) and Known IPs | — | `app/pages/dashboard/{clicks,known-ips}.vue`, `app/components/dashboard/{clicks,known-ips}/*`, `app/composables/clicks.ts`, `i18n/locales/*/clicks.json` (English text in all locales for now) |
| Links list / detail: "Clicks" menu item opens the click log filtered to that link; Clicks filters, period and toggles are kept in the URL | — | `app/components/dashboard/links/Link.vue`, `app/composables/clicks.ts` |
| README: fork section at the top (between `FORK-README` markers); upstream README kept verbatim below it | — | `README.md` |
| Roles (admin / editor / viewer) for Cloudflare Access users; central route permission map; `users` table and Users page; IPs, visitor ids and CSV export admin-only | `NUXT_ADMIN_EMAILS`, `NUXT_DEFAULT_ROLE`, `NUXT_ALLOWED_EMAIL_DOMAINS` | `server/middleware/2.z-authz.ts`, `server/utils/authz.ts`, `server/api/session.get.ts`, `server/api/users/*`, `shared/schemas/admin.ts`, `app/composables/session.ts`, `app/middleware/session.global.ts`, `app/pages/dashboard/users.vue` |
| Activity log (`activity` table, append-only, before/after link snapshots); soft delete with restore (same link id); revert to any version; created-by / edited-by on link cards; Activity, Deleted links and per-link History views. Hooks live in the four link write functions of `server/utils/link-store.ts` (the only upstream file touched for this) | — | `server/utils/activity.ts`, `server/api/activity/*`, `server/api/link/{restore,revert}.post.ts`, `app/pages/dashboard/{activity,deleted}.vue`, `app/components/dashboard/links/{History,Meta}.vue`, `app/composables/linkMeta.ts`, `drizzle/0007_*` |
| Link locks (`link_locks` table) with optional expiry and reason; editors get HTTP 423 on locked links | — | `server/api/link/{lock,unlock}.post.ts`, `server/api/locks/list.get.ts`, `app/components/dashboard/links/{LockForm,LockModal}.vue` |
| Admin host mode for the gate: dashboard, API and assets only on `NUXT_ADMIN_HOST` (behind Cloudflare Access); public hosts only redirect | `NUXT_ADMIN_HOST`, `NUXT_ADMIN_REQUIRE_ACCESS` | `worker/admin-gate.mjs` |
| Tests | — | `tests/tracking-page.spec.ts`, `tests/admin-gate.spec.ts`, `tests/click-log.spec.ts`, `tests/admin.spec.ts` |

Everything is off by default, so behaviour matches upstream until the settings are set.
