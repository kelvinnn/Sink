import type { QrStyle } from '#shared/schemas/settings'

// Fork: the dashboard-wide default QR style (admin setting), loaded once per session.

export interface QrStyleState {
  style: QrStyle
  configured: boolean
  updatedAt: number | null
  updatedBy: string | null
}

export function useQrStyle() {
  const state = useState<QrStyleState | null>('qr-style', () => null)
  let pending: Promise<QrStyleState | null> | null = null

  async function load(force = false) {
    if (state.value && !force)
      return state.value
    pending ??= useAPI<QrStyleState>('/api/settings/qr-style')
      .then(result => (state.value = result))
      .catch(() => null)
      .finally(() => (pending = null))
    return pending
  }

  async function save(style: QrStyle) {
    await useAPI('/api/settings/qr-style', { method: 'POST', body: style })
    return load(true)
  }

  return { state, load, save }
}
