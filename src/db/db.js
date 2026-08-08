// IndexedDB setup. Local-first by default, sync-ready.
// Every record carries a `rev` and a `pendingSync` flag so the sync engine
// knows what to push. Deletes write tombstones instead of vanishing.
import { openDB } from 'idb'

const DB_NAME = 'moonscribe'
const DB_VERSION = 2

const STORES = ['novels', 'chapters', 'characters', 'notes', 'relationships', 'stats', 'world', 'moodboard', 'tombstones', 'meta']

let dbPromise = null

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const defs = {
          novels: { keyPath: 'id' },
          chapters: { keyPath: 'id', index: 'by-novel' },
          characters: { keyPath: 'id', index: 'by-novel' },
          notes: { keyPath: 'id', index: 'by-novel' },
          relationships: { keyPath: 'id', index: 'by-novel' },
          stats: { keyPath: 'id', index: 'by-novel' },
          world: { keyPath: 'id', index: 'by-novel' },
          moodboard: { keyPath: 'id', index: 'by-novel' },
          tombstones: { keyPath: 'id' },
          meta: { keyPath: 'key' }
        }
        for (const [name, spec] of Object.entries(defs)) {
          if (!db.objectStoreNames.contains(name)) {
            const s = db.createObjectStore(name, { keyPath: spec.keyPath })
            if (spec.index) s.createIndex(spec.index, spec.index === 'by-novel' ? 'novelId' : spec.index)
          }
        }
      }
    })
  }
  return dbPromise
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
  return next
}

// Deletes a record and leaves a tombstone for sync. Returns the tombstone.
export async function removeRecord(storeName, id, novelId = null, { sync = true } = {}) {
  const db = await getDB()
  await db.delete(storeName, id)
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
  return row
}

export function listStores() {
  // 'stats' is derived, per-device tracking data (daily word deltas) and is
  // deliberately not synced — each device counts its own writing.
  return STORES.filter((s) => s !== 'tombstones' && s !== 'meta' && s !== 'stats')
}
