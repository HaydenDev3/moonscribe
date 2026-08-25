import { getDB, putRecord, removeRecord } from './db'

// Recoverable trash. Deleting chapters, characters, notes or worldbuilding
// items soft-deletes them (sets `trashedAt`) instead of removing them; they
// can be restored or purged from the Trash view. Records older than the TTL
// are swept quietly on app boot.
export const TRASH_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export const TRASHABLE = ['chapters', 'characters', 'notes', 'world', 'glossary', 'projectFiles']

// Shared soft-delete used by the per-store `trash*` helpers.
export async function trashRecord(storeName, id) {
  const db = await getDB()
  const rec = await db.get(storeName, id)
  if (!rec) return null
  const next = { ...rec, id: rec.id, trashedAt: Date.now() }
  return putRecord(storeName, next)
}

export async function listTrash(novelId) {
  const db = await getDB()
  const out = []
  for (const store of TRASHABLE) {
    const all = await db.getAllFromIndex(store, 'by-novel', novelId)
    for (const rec of all) {
      if (rec.trashedAt) out.push({ store, rec })
    }
  }
  return out.sort((a, b) => (b.rec.trashedAt || 0) - (a.rec.trashedAt || 0))
}

export async function restoreTrashed(store, id) {
  const db = await getDB()
  const rec = await db.get(store, id)
  if (!rec) return null
  const next = { ...rec, id: rec.id }
  delete next.trashedAt
  return putRecord(store, next)
}

// Permanent removal — the only way out of the trash.
export async function purgeTrashed(store, id) {
  const db = await getDB()
  const rec = await db.get(store, id)
  if (!rec) return
  await db.delete(store, id)
  await removeRecord(store, id, rec.novelId)
}

export async function emptyTrash(novelId) {
  const items = await listTrash(novelId)
  for (const { store, rec } of items) await purgeTrashed(store, rec.id)
  return items.length
}

// Quiet background sweep so trashed items never linger forever.
export async function purgeExpired(ttlMs = TRASH_TTL_MS) {
  const db = await getDB()
  const cutoff = Date.now() - ttlMs
  let removed = 0
  for (const store of TRASHABLE) {
    const all = await db.getAll(store)
    for (const rec of all) {
      if (rec.trashedAt && rec.trashedAt < cutoff) {
        await db.delete(store, rec.id)
        await removeRecord(store, rec.id, rec.novelId)
        removed++
      }
    }
  }
  return removed
}
