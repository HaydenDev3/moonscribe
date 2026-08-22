import { getDB, listStores, uid } from './db'
import { setMeta } from './meta'
import { toWire, fromWire } from '../sync/serialize'
import { switchDatabaseProfile } from './db'

// Guest migration is deliberately additive: every guest record receives a new
// identity before it enters the account profile, so it cannot overwrite a
// cloud record with a coincidentally matching local id.
export async function migrateGuestToAccount(accountId) {
  const guestDB = await getDB()
  const snapshot = { app: 'moonscribe', version: 1, createdAt: new Date().toISOString(), stores: {} }
  for (const store of listStores()) snapshot.stores[store] = await Promise.all((await guestDB.getAll(store)).map(toWire))
  const guestMeta = await guestDB.get('meta', 'guestMergeBackup')
  if (!guestMeta) await guestDB.put('meta', { key: 'guestMergeBackup', value: snapshot })
  const maps = new Map()
  for (const store of listStores()) {
    maps.set(store, new Map((snapshot.stores[store] || []).filter((row) => row?.id).map((row) => [row.id, uid()])))
  }
  await switchDatabaseProfile(accountId)
  const accountDB = await getDB()
  const stores = listStores()
  const tx = accountDB.transaction(stores, 'readwrite')
  for (const store of stores) {
    for (const wire of snapshot.stores[store] || []) {
      const row = fromWire(wire)
      const next = { ...row, id: maps.get(store).get(row.id) || uid(), pendingSync: true, updatedAt: Date.now() }
      if (next.novelId && maps.get('novels')?.has(next.novelId)) next.novelId = maps.get('novels').get(next.novelId)
      if (next.chapterId && maps.get('chapters')?.has(next.chapterId)) next.chapterId = maps.get('chapters').get(next.chapterId)
      await tx.objectStore(store).put(next)
    }
  }
  await tx.done
  await setMeta('guestMode', false)
  await setMeta('guestMigratedAt', Date.now())
  return { novels: snapshot.stores.novels?.length || 0, records: Object.values(snapshot.stores).reduce((sum, rows) => sum + rows.length, 0) }
}
