import { isDesktopRuntime } from '../api/config'

type Invoke = (command: string, args?: Record<string, unknown>) => Promise<unknown>

let invokePromise: Promise<Invoke | null> | null = null

async function getInvoke(): Promise<Invoke | null> {
  if (!isDesktopRuntime()) return null
  if (!invokePromise) {
    invokePromise = import('@tauri-apps/api/core').then(({ invoke }) => invoke as Invoke).catch(() => null)
  }
  return invokePromise
}

export async function mirrorNativeRecord(store: string, id: string, payload: unknown, updatedAt = Date.now()) {
  const invoke = await getInvoke()
  if (!invoke) return
  await invoke('native_storage_put', { store, id, payload: JSON.stringify(payload), updatedAt })
}

export async function mirrorNativeDelete(store: string, id: string, updatedAt = Date.now()) {
  const invoke = await getInvoke()
  if (!invoke) return
  await invoke('native_storage_delete', { store, id, updatedAt })
}

const NATIVE_RETRY_KEY = 'moonscribe:native-mirror-retries'

export function pendingNativeMirrorFailures() {
  try { return JSON.parse(localStorage.getItem(NATIVE_RETRY_KEY) || '[]').length } catch { return 0 }
}

export function queueNativeMirrorFailure(operation: { kind: 'put' | 'delete'; store: string; id: string; payload?: unknown; updatedAt: number }) {
  try {
    const current = JSON.parse(localStorage.getItem(NATIVE_RETRY_KEY) || '[]')
    const next = [...current.filter((item) => !(item.store === operation.store && item.id === operation.id)), operation]
    localStorage.setItem(NATIVE_RETRY_KEY, JSON.stringify(next.slice(-250)))
  } catch { /* storage may be unavailable during locked startup */ }
}

export function clearNativeMirrorFailure(store: string, id: string) {
  try {
    const current = JSON.parse(localStorage.getItem(NATIVE_RETRY_KEY) || '[]')
    const remaining = current.filter((item) => !(item.store === store && item.id === id))
    if (remaining.length) localStorage.setItem(NATIVE_RETRY_KEY, JSON.stringify(remaining))
    else localStorage.removeItem(NATIVE_RETRY_KEY)
  } catch { /* best effort */ }
}

export async function flushNativeMirrorFailures() {
  let pending
  try { pending = JSON.parse(localStorage.getItem(NATIVE_RETRY_KEY) || '[]') } catch { return 0 }
  if (!pending.length) return 0
  const remaining = []
  for (const operation of pending) {
    try {
      if (operation.kind === 'delete') await mirrorNativeDelete(operation.store, operation.id, operation.updatedAt)
      else await mirrorNativeRecord(operation.store, operation.id, operation.payload, operation.updatedAt)
    } catch { remaining.push(operation) }
  }
  try { localStorage.setItem(NATIVE_RETRY_KEY, JSON.stringify(remaining)) } catch { /* best effort */ }
  return pending.length - remaining.length
}

export async function nativeStorageStatus() {
  const invoke = await getInvoke()
  if (!invoke) return { ready: false, records: 0 }
  return invoke('native_storage_status') as Promise<{ ready: boolean; records: number }>
}

export async function getNativeRecord(store: string, id: string): Promise<NativeRecord | null> {
  const invoke = await getInvoke()
  if (!invoke) return null
  return (await invoke('native_storage_get', { store, id })) as NativeRecord | null
}

export type NativeRecord = {
  store: string
  id: string
  payload: Record<string, unknown>
  updatedAt: number
  deleted: boolean
}

export async function exportNativeRecords(): Promise<NativeRecord[]> {
  const invoke = await getInvoke()
  if (!invoke) return []
  return ((await invoke('native_storage_export')) as NativeRecord[]) || []
}

export async function backupNativeStorage() {
  const invoke = await getInvoke()
  if (!invoke) return null
  return invoke('native_storage_backup') as Promise<string>
}

export async function restoreNativeStorage(backupName: string) {
  const invoke = await getInvoke()
  if (!invoke) return null
  return invoke('native_storage_restore', { backupName }) as Promise<string>
}

export async function listNativeBackups(): Promise<string[]> {
  const invoke = await getInvoke()
  if (!invoke) return []
  return ((await invoke('native_storage_list_backups')) as string[]) || []
}
