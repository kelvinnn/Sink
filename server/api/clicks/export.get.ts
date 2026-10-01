import { desc } from 'drizzle-orm'
import { ClickExportQuerySchema } from '#shared/schemas/click'
import { clicks } from '../../database/schema'

defineRouteMeta({
  openAPI: {
    description: 'Export logged clicks as CSV (raw values, newest first).',
    security: [{ bearerAuth: [] }],
  },
})

export default eventHandler(async (event) => {
  const query = await getValidatedQuery(event, ClickExportQuerySchema.parse)
  const db = useClickDb(event)
  const where = clickConditions(query)
  const lines: string[] = [CLICK_CSV_COLUMNS.join(',')]
  const pageSize = 1000
  let offset = 0
  while (offset < query.limit) {
    const rows = await db.select().from(clicks).where(where).orderBy(desc(clicks.id)).limit(Math.min(pageSize, query.limit - offset)).offset(offset)
    for (const row of rows) {
      const record = { ...row, ts: new Date(row.ts).toISOString() } as Record<string, unknown>
      lines.push(CLICK_CSV_COLUMNS.map(column => toCsvValue(record[column])).join(','))
    }
    if (rows.length < pageSize)
      break
    offset += rows.length
  }
  await recordActivitySafe(event, { action: 'clicks.export', targetType: 'clicks', targetLabel: `${lines.length - 1} rows`, note: JSON.stringify(Object.fromEntries(Object.entries(query).filter(([, value]) => value !== undefined))) })
  setHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
  setHeader(event, 'Content-Disposition', `attachment; filename="clicks-${new Date().toISOString().slice(0, 10)}.csv"`)
  setHeader(event, 'Cache-Control', 'no-store')
  return `${lines.join('\n')}\n`
})
