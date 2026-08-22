import { capabilities } from './capabilities'

export type UpdateState = 'idle' | 'checking' | 'up-to-date' | 'available' | 'downloading' | 'ready' | 'installing' | 'offline' | 'error' | 'unconfigured'

export type DesktopUpdate = {
  version: string
  body?: string
  downloadAndInstall: (progress?: (percent: number | null) => void) => Promise<void>
  close: () => Promise<void>
}

export async function currentVersion() {
  if (!capabilities.desktop) return import.meta.env.VITE_APP_VERSION || 'web'
  const { getVersion } = await import('@tauri-apps/api/app')
  return getVersion()
}

export async function checkForDesktopUpdate(): Promise<DesktopUpdate | null> {
  if (!capabilities.nativeUpdater) return null
  if (!navigator.onLine) throw new Error('offline')
  const { check } = await import('@tauri-apps/plugin-updater')
  const update = await check()
  if (!update) return null
  return {
    version: update.version,
    body: update.body,
    async downloadAndInstall(progress) {
      let total = 0
      let downloaded = 0
      await update.downloadAndInstall((event) => {
        if (event.event === 'Started') total = event.data.contentLength || 0
        if (event.event === 'Progress') downloaded += event.data.chunkLength
        progress?.(total > 0 ? Math.min(100, Math.round(downloaded / total * 100)) : null)
      })
    },
    close: () => update.close(),
  }
}

export async function restartAfterUpdate() {
  window.dispatchEvent(new CustomEvent('moonscribe:before-update-restart'))
  await new Promise((resolve) => setTimeout(resolve, 350))
  const { relaunch } = await import('@tauri-apps/plugin-process')
  await relaunch()
}
