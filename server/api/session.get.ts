defineRouteMeta({
  openAPI: {
    description: 'Current user, role and what the role may do.',
    security: [{ bearerAuth: [] }],
  },
})

export default eventHandler((event) => {
  const actor = getActor(event)
  return {
    email: actor.email,
    role: actor.role,
    authMethod: actor.authMethod,
    can: {
      edit: hasRole(actor.role, 'editor'),
      admin: actor.role === 'admin',
      seeIps: actor.role === 'admin',
    },
    clickLog: !!useRuntimeConfig(event).clickLog,
  }
})
