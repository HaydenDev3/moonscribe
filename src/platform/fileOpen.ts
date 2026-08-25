import { isDesktopRuntime } from '../api/config'

export type DesktopFileOpenHandler = (paths: string[]) => void

export async function readDesktopFile(path: string) {
  if (!isDesktopRuntime()) throw new Error('Desktop file access is unavailable in the browser.')
  const { invoke } = await import('@tauri-apps/api/core')
  const bytes = await invoke<number[]>('native_read_file', { path })
  return new Uint8Array(bytes)
}

export function takePendingDesktopBackup() {
  const path = sessionStorage.getItem('moonscribe:pending-backup-path')
  if (path) sessionStorage.removeItem('moonscribe:pending-backup-path')
  return path
}

/** Listen for files opened through the desktop file associations. */
export async function registerDesktopFileOpen(handler: DesktopFileOpenHandler) {
  if (!isDesktopRuntime()) return () => {}
  const { listen } = await import('@tauri-apps/api/event')
  const unlisten = await listen<string[]>('moonscribe://open-files', (event) => {
    const paths = Array.isArray(event.payload) ? event.payload.filter(Boolean) : []
    if (paths.length) handler(paths)
  })
  return unlisten
}
