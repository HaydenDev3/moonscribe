// Full backup & restore of every store. Local-first data should never be
// held hostage — download a JSON file any time, restore it anywhere.
import { getDB } from './db'
import { toWire, fromWire } from '../sync/serialize'

const BACKUP_VERSION = 3
const ALL_STORES = ['novels', 'chapters', 'characters', 'notes', 'relationships', 'stats', 'world', 'moodboard', 'glossary', 'annotations', 'branches', 'suggestions', 'meta']

export async function exportBackup() {
  const db = await getDB()
  const out = { app: 'moonscribe', version: BACKUP_VERSION, exportedAt: new Date().toISOString() }
  for (const store of ALL_STORES) {
    const rows = await db.getAll(store)
    out[store] = await Promise.all(rows.map((row) => toWire(row)))
  }
  return out
}

// Permanent, irreversible erase of every store — the "delete all my data"
// control. Clears content, tombstones and settings alike.
export async function wipeEverything() {
  const db = await getDB()
  const stores = [...ALL_STORES, 'tombstones'].filter((s) => db.objectStoreNames.contains(s))
  const tx = db.transaction(stores, 'readwrite')
  for (const store of stores) await tx.objectStore(store).clear()
  await tx.done
}

export async function importBackup(data) {
  if (!data || data.app !== 'moonscribe') throw new Error('Not a Moonscribe backup')
  const db = await getDB()
  const stores = ALL_STORES.filter((s) => db.objectStoreNames.contains(s))
  const tx = db.transaction(stores, 'readwrite')
  for (const store of stores) {
    await tx.objectStore(store).clear()
    const rows = Array.isArray(data[store]) ? data[store] : []
    for (const row of rows) {
      if (row && typeof row === 'object') {
        const restored = fromWire(row)
        await tx.objectStore(store).put({ ...restored, pendingSync: true })
      }
    }
  }
  await tx.done
}
