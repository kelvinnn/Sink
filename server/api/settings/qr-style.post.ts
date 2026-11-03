import { QrStyleSchema } from '#shared/schemas/settings'

defineRouteMeta({
  openAPI: {
    description: 'Save the default QR code style (admin only).',
    security: [{ bearerAuth: [] }],
  },
})

export default eventHandler(async (event) => {
  const style = await readValidatedBody(event, QrStyleSchema.parse)
  const before = await getSetting(event, 'qr-style', QrStyleSchema)
  await putSetting(event, 'qr-style', style)
  await recordActivitySafe(event, {
    action: 'settings.update',
    targetType: 'system',
    targetId: 'qr-style',
    targetLabel: 'QR style',
    before: before.configured ? settingSnapshot(before.value) : null,
    after: settingSnapshot(style),
  })
  return { style, configured: true }
})
