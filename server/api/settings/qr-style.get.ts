import { QrStyleSchema } from '#shared/schemas/settings'

defineRouteMeta({
  openAPI: {
    description: 'Default QR code style used for every link (colours, dot and corner style, error correction, centre logo, scan marker).',
    security: [{ bearerAuth: [] }],
  },
})

export default eventHandler(async (event) => {
  const setting = await getSetting(event, 'qr-style', QrStyleSchema)
  return { style: setting.value, configured: setting.configured, updatedAt: setting.updatedAt, updatedBy: setting.updatedBy }
})
