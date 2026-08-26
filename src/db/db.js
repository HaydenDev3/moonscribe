// IndexedDB setup. Local-first by default, sync-ready.
// Every record carries a `rev` and a `pendingSync` flag so the sync engine
// knows what to push. Deletes write tombstones instead of vanishing.
import { openDB } from 'idb'
import { clearNativeMirrorFailure, flushNativeMirrorFailures, mirrorNativeDelete, mirrorNativeRecord, queueNativeMirrorFailure } from '../platform/nativeStorage'
import { isDesktopRuntime } from '../api/config'
import { NativeDatabase } from '../platform/nativeDatabase'

const environment = import.meta.env.VITE_MOONSCRIBE_ENV || (import.meta.env.DEV ? 'development' : 'production')
const DB_VERSION = 11

const STORES = ['novels', 'chapters', 'folders', 'characters', 'notes', 'relationships', 'stats', 'world', 'moodboard', 'projectFiles', 'workspacePreferences', 'accountPreferences', 'glossary', 'annotations', 'branches', 'suggestions', 'research', 'storyThreads', 'sceneChecklists', 'betaPackages', 'tombstones', 'meta', 'snapshots']

let dbPromise = null
let legacyDbPromise = null
let nativeHydrationPromise = null
let activeProfile = typeof localStorage !== 'undefined' ? localStorage.getItem('moonscribe:profile') || 'local' : 'local'

export async function switchDatabaseProfile(profile) {
  const safeProfile = String(profile || '').replace(/[^a-zA-Z0-9_-]/g, '') || 'local'
  if (safeProfile === activeProfile) return
  if (dbPromise) (await dbPromise).close?.()
  if (legacyDbPromise) (await legacyDbPromise).close?.()
  dbPromise = null
  legacyDbPromise = null
  nativeHydrationPromise = null
  activeProfile = safeProfile
  localStorage.setItem('moonscribe:profile', safeProfile)
}

function getLegacyDB() {
  if (!legacyDbPromise) {
    legacyDbPromise = openDB(`moonscribe:${environment}:${activeProfile}`, DB_VERSION, {
      upgrade(db) {
        const defs = {
          novels: { keyPath: 'id' },
          chapters: { keyPath: 'id', index: 'by-novel' },
          folders: { keyPath: 'id', index: 'by-novel' },
          characters: { keyPath: 'id', index: 'by-novel' },
          notes: { keyPath: 'id', index: 'by-novel' },
          relationships: { keyPath: 'id', index: 'by-novel' },
          stats: { keyPath: 'id', index: 'by-novel' },
          world: { keyPath: 'id', index: 'by-novel' },
          moodboard: { keyPath: 'id', index: 'by-novel' },
          projectFiles: { keyPath: 'id', index: 'by-novel' },
          workspacePreferences: { keyPath: 'id', index: 'by-novel' },
          accountPreferences: { keyPath: 'id' },
          glossary: { keyPath: 'id', index: 'by-novel' },
          annotations: { keyPath: 'id', index: 'by-novel' },
          branches: { keyPath: 'id', index: 'by-novel' },
          suggestions: { keyPath: 'id', index: 'by-novel' },
          research: { keyPath: 'id', index: 'by-novel' },
          storyThreads: { keyPath: 'id', index: 'by-novel' },
          sceneChecklists: { keyPath: 'id', index: 'by-novel' },
          betaPackages: { keyPath: 'id', index: 'by-novel' },
          tombstones: { keyPath: 'id' },
          meta: { keyPath: 'key' },
          snapshots: { keyPath: 'id', index: 'by-chapter' }
        }
        for (const [name, spec] of Object.entries(defs)) {
          if (!db.objectStoreNames.contains(name)) {
            const s = db.createObjectStore(name, { keyPath: spec.keyPath })
            const INDEX_FIELDS = { 'by-novel': 'novelId', 'by-chapter': 'chapterId' }
            if (spec.index) s.createIndex(spec.index, INDEX_FIELDS[spec.index] ?? spec.index)
          }
        }
      }
    })
  }
  return legacyDbPromise
}

export function getDB() {
  if (!dbPromise) {
    if (isDesktopRuntime()) {
      dbPromise = flushNativeMirrorFailures().then(() => NativeDatabase.open(activeProfile, STORES, getLegacyDB))
      nativeHydrationPromise = dbPromise
    } else {
      dbPromise = getLegacyDB()
    }
  }
  return dbPromise
}

export async function waitForNativeHydration() {
  // Initialise the authoritative native repository before startup readers run.
  getDB()
  await nativeHydrationPromise
}

export function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

// ---- sync-aware write layer ----

// Marks a freshly written record as needing a push.
export function markDirty(record, prev) {
  const now = Date.now()
  return {
    ...record,
    rev: (prev?.rev || record.rev || 0) + 1,
    pendingSync: true,
    updatedAt: record.updatedAt ?? now
  }
}

// Writes a record through the dirty layer. If `sync: false`, the record is
// saved but never pushed (used for cosmetic touches like lastOpened).
export async function putRecord(storeName, record, { sync = true } = {}) {
  const db = await getDB()
  const prev = await db.get(storeName, record.id)
  const next = sync ? markDirty(record, prev) : record
  await db.put(storeName, next)
  // Desktop keeps the IndexedDB-compatible immediate path while also writing
  // a durable SQLite copy through the native bridge. A failed mirror must not
  // make a local edit appear unsaved; the sync/recovery layer owns retries.
  if (isDesktopRuntime() && !db.native) {
    try {
      await mirrorNativeRecord(storeName, next.id, next, next.updatedAt || Date.now())
      clearNativeMirrorFailure(storeName, next.id)
    } catch {
      // IndexedDB remains the immediate recovery copy; the sync/recovery layer
      // can still surface a queued native mirror failure on the next startup.
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('moonscribe:native-mirror-failed', { detail: { store: storeName, id: next.id } }))
      queueNativeMirrorFailure({ kind: 'put', store: storeName, id: next.id, payload: next, updatedAt: next.updatedAt || Date.now() })
    }
  }
  const liveNovelId = next.novelId || (storeName === 'novels' ? next.id : null)
  if (sync && typeof window !== 'undefined' && liveNovelId) {
    window.dispatchEvent(new CustomEvent('moonscribe:record-written', {
      detail: { store: storeName, id: next.id, novelId: liveNovelId, updatedAt: next.updatedAt, deleted: false, payload: next }
    }))
  }
  return next
}

// Deletes a record and leaves a tombstone for sync. Returns the tombstone.
export async function removeRecord(storeName, id, novelId = null, { sync = true } = {}) {
  const db = await getDB()
  await db.delete(storeName, id)
  if (isDesktopRuntime() && !db.native) {
    try {
      await mirrorNativeDelete(storeName, id, Date.now())
      clearNativeMirrorFailure(storeName, id)
    } catch {
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('moonscribe:native-mirror-failed', { detail: { store: storeName, id } }))
      queueNativeMirrorFailure({ kind: 'delete', store: storeName, id, updatedAt: Date.now() })
    }
  }
  if (!sync) return null
  const now = Date.now()
  const tomb = await db.get('tombstones', `${storeName}:${id}`)
  const row = {
    id: `${storeName}:${id}`,
    store: storeName,
    novelId,
    deletedAt: now,
    rev: (tomb?.rev || 0) + 1,
    pendingSync: true
  }
  await db.put('tombstones', row)
  if (typeof window !== 'undefined' && novelId) {
    window.dispatchEvent(new CustomEvent('moonscribe:record-written', {
      detail: { store: storeName, id, novelId, updatedAt: now, deleted: true, payload: null }
    }))
  }
  return row
}

export function listStores() {
  // 'stats' is derived, per-device tracking data (daily word deltas) and is
  // deliberately not synced — each device counts its own writing.
  //
  // 'snapshots' power local replay only. They are intentionally device-local:
  // pushing them bloats sync traffic and, more importantly, older builds would
  // fail their whole sync batch before shared novels could even pull down.
  return STORES.filter((s) => s !== 'tombstones' && s !== 'meta' && s !== 'stats' && s !== 'snapshots')
}
