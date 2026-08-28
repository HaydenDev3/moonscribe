import { invoke, isTauri } from '@tauri-apps/api/core'

export type PresenceActivity = { details: string; state: string; startedAt: number }

export function activityForPath(pathname: string): PresenceActivity {
  const startedAt = Date.now()
  if (pathname === '/dashboard' || pathname === '/') return { details: 'Browsing the library', state: 'MoonScribe', startedAt }
  if (/\/design(\/|$)/.test(pathname)) return { details: 'Designing a book', state: 'MoonScribe', startedAt }
  if (/\/(analytics|writing-journal)(\/|$)/.test(pathname)) return { details: 'Reviewing progress', state: 'MoonScribe', startedAt }
  if (/\/media(\/|$)/.test(pathname)) return { details: 'Organising story assets', state: 'MoonScribe', startedAt }
  if (/\/(characters|relationships|world|glossary|moodboard|trash|binder)(\/|$)/.test(pathname)) return { details: 'Planning a story', state: 'MoonScribe', startedAt }
  if (/\/novel(\/|$)/.test(pathname)) return { details: 'Writing', state: 'MoonScribe', startedAt }
  return { details: 'Writing', state: 'MoonScribe', startedAt }
}

let lastKey = ''
let timer: number | undefined
let updateGeneration = 0
let lastError: string | null = null

export async function updateDiscordPresence(enabled: boolean, pathname: string, startedAt: number) {
  if (!isTauri()) return
  const generation = ++updateGeneration
  if (timer) window.clearTimeout(timer)
  await new Promise<void>((resolve) => { timer = window.setTimeout(resolve, 350) })
  if (generation !== updateGeneration) return
  if (!enabled) { lastKey = ''; await invoke('discord_presence_clear').catch(() => {}); return }
  const activity = activityForPath(pathname)
  activity.startedAt = startedAt
  const key = JSON.stringify(activity)
  if (key === lastKey) return
  lastKey = key
  await invoke('discord_presence_set', { details: activity.details, activityState: activity.state, startedAt: activity.startedAt })
    .then(() => { lastError = null })
    .catch((error) => { lastError = error instanceof Error ? error.message : 'Discord is unavailable.' })
}

export async function clearDiscordPresence() {
  if (!isTauri()) return
  updateGeneration += 1
  lastKey = ''
  await invoke('discord_presence_clear').catch((error) => { lastError = error instanceof Error ? error.message : 'Discord is unavailable.' })
}

export async function discordPresenceStatus() {
  if (!isTauri()) return { available: false, connected: false, reason: 'web' }
  return invoke<{ available: boolean; connected: boolean; reason?: string }>('discord_presence_status')
    .then((status) => ({ ...status, reason: status.reason || lastError || undefined }))
    .catch(() => ({ available: false, connected: false, reason: lastError || 'unavailable' }))
}
