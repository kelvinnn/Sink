import type { Role } from '#shared/schemas/admin'

// Fork: the signed-in user's role and what it allows.

export interface DashboardSession {
  email: string
  role: Role
  authMethod: string
  can: { edit: boolean, admin: boolean, seeIps: boolean }
  clickLog: boolean
  shortLinkOrigin: string | null
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

/** Origin and host used to show, copy and encode short links (may differ from the dashboard's own host). */
export function useShortLinkBase() {
  const { session } = useDashboardSession()
  const requestUrl = useRequestURL()
  const origin = computed(() => session.value?.shortLinkOrigin || requestUrl.origin)
  const host = computed(() => {
    try {
      return new URL(origin.value).host
    }
    catch {
      return requestUrl.host
    }
  })
  return { origin, host }
}
