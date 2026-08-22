import { invoke, isTauri } from '@tauri-apps/api/core'

export async function readDesktopCredential(key: string) {
  if (!isTauri()) return null
  return invoke<string | null>('credential_get', { key })
}

export async function writeDesktopCredential(key: string, value: string | null) {
  if (!isTauri()) return false
  await invoke('credential_set', { key, value })
  return true
}

export function hasDesktopCredentialVault() {
  return isTauri()
}
