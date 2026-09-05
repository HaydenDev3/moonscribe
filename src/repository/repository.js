// Stable local repository boundary. Domain modules should depend on this
// contract instead of knowing whether the active store is IndexedDB or SQLite.
import { getDB, putRecord, removeRecord, listStores, switchDatabaseProfile } from '../db/db'

export const REPOSITORY_SCHEMA_VERSION = 1

export function createRepository({ database = null } = {}) {
  const open = async () => database || getDB()
  return {
    version: REPOSITORY_SCHEMA_VERSION,
    stores: listStores,
    get: async (store, id) => (await open()).get(store, id),
    list: async (store, { index = null, query = undefined } = {}) => {
      const db = await open()
      return index ? db.getAllFromIndex(store, index, query) : db.getAll(store)
    },
    put: (store, record, options) => putRecord(store, record, options),
    delete: (store, id, novelId, options) => removeRecord(store, id, novelId, options),
    transaction: async (stores, mode, callback) => {
      const db = await open()
      const tx = db.transaction(stores, mode)
      const result = await callback(tx)
      await tx.done
      return result
    },
    switchProfile: switchDatabaseProfile,
  }
}

export const repository = createRepository()
