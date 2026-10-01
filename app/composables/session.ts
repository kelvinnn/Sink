import type { Role } from '#shared/schemas/admin'

// Fork: the signed-in user's role and what it allows.

export interface DashboardSession {
  email: string
  role: Role
  authMethod: string
  can: { edit: boolean, admin: boolean, seeIps: boolean }
  clickLog: boolean
}

export function useDashboardSession() {
  const session = useState<DashboardSession | null>('dashboard-session', () => null)

  async function load(force = false) {
    if (session.value && !force)
      return session.value
    try {
      session.value = await useAPI<DashboardSession>('/api/session')
    }
    catch {
      session.value = null
    }
    return session.value
  }

  const isAdmin = computed(() => session.value?.can.admin ?? false)
  const canEdit = computed(() => session.value?.can.edit ?? false)
  const canSeeIps = computed(() => session.value?.can.seeIps ?? false)

  return { session, load, isAdmin, canEdit, canSeeIps }
}
