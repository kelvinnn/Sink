import { BioPageSchema } from '#shared/schemas/settings'

defineRouteMeta({
  openAPI: {
    description: 'Links page ("link in bio") settings: title, logo, colours and ordered short-link buttons.',
    security: [{ bearerAuth: [] }],
  },
})

export default eventHandler(async (event) => {
  const setting = await getSetting(event, 'bio', BioPageSchema)
  return { page: setting.value, configured: setting.configured, updatedAt: setting.updatedAt, updatedBy: setting.updatedBy, home: !!useRuntimeConfig(event).bioHome }
})
