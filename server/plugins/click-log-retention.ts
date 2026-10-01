/// <reference path="../../worker-configuration.d.ts" />
import { lt } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { clicks } from '../database/schema'

// Fork: delete click log rows older than NUXT_CLICK_LOG_RETENTION_DAYS on the daily cron.
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('cloudflare:scheduled', async (event) => {
    const config = useRuntimeConfig()
    const days = Number(config.clickLogRetentionDays)
    if (!config.clickLog || !Number.isFinite(days) || days <= 0)
      return
    const env = event.env as Cloudflare.Env
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
    const result = await drizzle(env.DB).delete(clicks).where(lt(clicks.ts, cutoff))
    console.info({ event: 'click_log.retention', days, deleted: result.meta?.changes ?? 0 })
  })
})
