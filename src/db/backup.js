// Full backup & restore of every store. Local-first data should never be
// held hostage — download a JSON file any time, restore it anywhere.
import { getDB } from './db'

const BACKUP_VERSION = 2
const ALL_STORES = ['novels', 'chapters', 'characters', 'notes', 'relationships', 'stats', 'world', 'moodboard', 'meta']

export async function exportBackup() {
  const db = await getDB()
  const out = { app: 'moonscribe', version: BACKUP_VERSION, exportedAt: new Date().toISOString() }
  for (const store of ALL_STORES) {
    out[store] = await db.getAll(store)
  }
  return out
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
      if (row && typeof row === 'object') await tx.objectStore(store).put({ ...row, pendingSync: true })
    }
  }
  await tx.done
}
