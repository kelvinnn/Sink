# Fork notes

Fork of [miantiao-me/Sink](https://github.com/miantiao-me/Sink) with a few small, opt-in additions. The changes are kept small so upstream merges stay easy (`git fetch upstream && git merge upstream/master`).

| Change | Setting | Files |
|---|---|---|
| Slugs may contain `.`, `_` and `/` (e.g. `shop/sale`, `menu.pdf`); reserved slugs match on the first path segment; `api` is reserved | — | `app/app.config.ts`, `shared/schemas/link.ts`, `server/middleware/1.redirect.ts` |
| GTM tracking page before redirect, skipped for bots, non-GET, and links with skip tags. It pushes `shortlink_view` (slug, tags, destination host) to the dataLayer and fires a synthetic mousedown so the GA4/Ads linker can add `_gl` | `NUXT_GTM_ID`, `NUXT_GTM_SKIP_TAGS`, `NUXT_GTM_MAX_DELAY_MS` | `server/utils/tracking-page.ts`, `server/middleware/1.redirect.ts`, `nuxt.config.ts` |
| Admin gate: hides the dashboard, API and static files until a secret path is visited; `/api` also accepts the site token as bearer | `NUXT_ADMIN_GATE_PATH` | `worker/`, `wrangler.jsonc` (`main`, `assets.run_worker_first`), `package.json` deploy scripts |
| `workers_dev` and `preview_urls` disabled, so the Worker is only reachable on its custom domain | — | `wrangler.jsonc` |
| Tests | — | `tests/tracking-page.spec.ts`, `tests/admin-gate.spec.ts` |

Everything is off by default, so behaviour matches upstream until the settings are set.
