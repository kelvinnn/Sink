import { BioPageSchema } from '#shared/schemas/settings'

defineRouteMeta({
  openAPI: {
    description: 'Save the links page (admin only). Buttons must point to existing short links; the page path must not be a link slug.',
    security: [{ bearerAuth: [] }],
  },
})

export default eventHandler(async (event) => {
  const page = await readValidatedBody(event, BioPageSchema.parse)
  if (await getAuthoritativeLink(event, normalizeSlug(event, page.path)))
    throw createError({ status: 409, statusText: `"${page.path}" is already a short link; choose another path for the links page` })
  const missing: string[] = []
  for (const button of page.buttons) {
    if (!await getAuthoritativeLink(event, normalizeSlug(event, button.slug)))
      missing.push(button.slug)
  }
  if (missing.length)
    throw createError({ status: 422, statusText: `These buttons point to short links that do not exist: ${missing.join(', ')}`, data: { missing } })

  const before = await getSetting(event, 'bio', BioPageSchema)
  await putSetting(event, 'bio', page)
  await recordActivitySafe(event, {
    action: 'settings.update',
    targetType: 'system',
    targetId: 'bio',
    targetLabel: 'Links page',
    before: before.configured ? settingSnapshot(before.value) : null,
    after: settingSnapshot(page),
  })
  return { page, configured: true }
})
