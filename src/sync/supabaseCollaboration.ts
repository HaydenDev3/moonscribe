import { supabase } from '../lib/supabase'
import { getConfig, getPresenceSessionId } from './engine'

export type CollaborationStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline' | 'access_expired' | 'revoked' | 'host_offline' | 'resyncing' | 'error'

export type CollaborationPresence = {
  sessionId: string
  userId: string
  username?: string
  avatar?: string | null
  chapterId?: string | null
  tabId?: string | null
  tabName?: string
  workspace?: string
  activity?: 'viewing' | 'writing'
  status?: 'online' | 'idle' | 'dnd'
  lineNumber?: number | null
  cursorOffset?: number | null
  selectionFrom?: number | null
  selectionTo?: number | null
  lastSeenAt?: number
  clientVersion?: string
}

let realtimeUnavailableUntil = 0

async function realtimeToken(novelId: string) {
  if (Date.now() < realtimeUnavailableUntil) return null
  const cfg = await getConfig()
  const response = await fetch(`${cfg.server}/api/shares/realtime-token?novelId=${encodeURIComponent(novelId)}`, { headers: { Authorization: `Bearer ${cfg.token}` } })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.error || 'Realtime collaboration is unavailable.') as Error & { status?: number }
    error.status = response.status
    if (response.status === 503) realtimeUnavailableUntil = Date.now() + 60_000
    throw error
  }
  return data
}

export async function subscribeSupabasePresence(novelId: string, presence: CollaborationPresence, handlers: {
  onPeople?: (people: CollaborationPresence[]) => void
  onStatus?: (status: CollaborationStatus, detail?: string) => void
} = {}) {
  if (!supabase) return null
  const sessionId = getPresenceSessionId()
  let tokenData = await realtimeToken(novelId)
  if (!tokenData) return null
  supabase.realtime.setAuth(tokenData.token)
  let refreshTimer: ReturnType<typeof setTimeout> | null = null
  const channel = supabase.channel(`share:${novelId}`, { config: { presence: { key: sessionId } } })
  const publish = async (next: CollaborationPresence) => {
    await channel.track({ ...next, userId: tokenData.profile?.id || next.userId, username: tokenData.profile?.username || next.username, avatar: tokenData.profile?.avatar || next.avatar, sessionId, lastSeenAt: Date.now() })
  }
  channel.on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState<CollaborationPresence>()
    const people = Object.values(state).flat().filter((item) => item.sessionId !== sessionId)
    handlers.onPeople?.(people)
  })
  channel.on('presence', { event: 'join' }, () => handlers.onPeople?.(Object.values(channel.presenceState<CollaborationPresence>()).flat().filter((item) => item.sessionId !== sessionId)))
  channel.on('presence', { event: 'leave' }, () => handlers.onPeople?.(Object.values(channel.presenceState<CollaborationPresence>()).flat().filter((item) => item.sessionId !== sessionId)))
  handlers.onStatus?.('connecting')
  channel.subscribe((value) => {
    if (value === 'SUBSCRIBED') {
      handlers.onStatus?.('connected')
      publish(presence).catch(() => {})
    } else if (value === 'CHANNEL_ERROR') handlers.onStatus?.('error', 'Realtime channel error')
    else if (value === 'TIMED_OUT') handlers.onStatus?.('reconnecting')
    else if (value === 'CLOSED') handlers.onStatus?.('offline')
  })
  const scheduleRefresh = () => {
    refreshTimer = setTimeout(async () => {
      try {
        tokenData = await realtimeToken(novelId)
        supabase.realtime.setAuth(tokenData.token)
        await channel.subscribe()
        handlers.onStatus?.('connected')
      } catch (error) {
        const code = (error as Error & { status?: number }).status
        handlers.onStatus?.(code === 401 || code === 403 ? 'access_expired' : 'reconnecting', (error as Error).message)
      }
      scheduleRefresh()
    }, Math.max(30_000, Number(tokenData.expiresAt || Date.now() + 240_000) - Date.now() - 30_000))
  }
  scheduleRefresh()
  return {
    publish,
    async close() {
      if (refreshTimer) clearTimeout(refreshTimer)
      await channel.untrack().catch(() => {})
      await supabase.removeChannel(channel)
    },
  }
}
