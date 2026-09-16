import { getDB, listStores } from './db'

// A non-destructive diagnostic for local-first recovery. It reports evidence
// for an operator or support screen; it never repairs or deletes records.
export async function inspectDataIntegrity({ novelId = null, acceptedRecords = [] } = {}) {
  const db = await getDB()
  const stores = listStores().filter((store) => db.objectStoreNames.contains(store))
  const pending = []
  const localKeys = new Set()
  const issues = []
  for (const store of stores) {
    const rows = await db.getAll(store)
    for (const row of rows) {
      if (novelId && row.novelId !== novelId && !(store === 'novels' && row.id === novelId)) continue
      const key = `${store}:${row.id}`
      localKeys.add(key)
      if (row.pendingSync) pending.push(key)
      if (!row.id) issues.push({ kind: 'missing-id', store })
      if (store !== 'novels' && store !== 'accountPreferences' && !row.novelId) issues.push({ kind: 'missing-novel', key })
    }
  }
  const tombstones = await db.getAll('tombstones')
  const relevantTombstones = tombstones.filter((row) => !novelId || row.novelId === novelId)
  for (const tombstone of relevantTombstones) {
    const key = `${tombstone.store}:${String(tombstone.id).slice(`${tombstone.store}:`.length)}`
    if (localKeys.has(key)) issues.push({ kind: 'tombstone-overlaps-local', key })
  }
  const serverKeys = new Set((acceptedRecords || []).map((row) => `${row.store}:${row.id}`))
  const serverMismatches = [...serverKeys].filter((key) => !localKeys.has(key))
  return {
    ok: issues.length === 0 && serverMismatches.length === 0,
    checkedAt: Date.now(),
    stores,
    pendingCount: pending.length,
    tombstoneCount: relevantTombstones.length,
    acceptedCount: serverKeys.size,
    serverMismatches,
    issues,
  }
}
