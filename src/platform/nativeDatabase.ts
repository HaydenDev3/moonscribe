import { exportNativeRecords, mirrorNativeDelete, mirrorNativeRecord, type NativeRecord } from './nativeStorage'

const SYSTEM_STORE = '__system'
const SEP = '::'

type LegacyDatabase = {
  getAll(store: string): Promise<any[]>
}

function recordKey(value: any) {
  return String(value?.id ?? value?.key ?? '')
}

function fieldForIndex(index: string) {
  if (index === 'by-novel') return 'novelId'
  if (index === 'by-chapter') return 'chapterId'
  return index
}

export class NativeDatabase {
  readonly native = true
  readonly objectStoreNames: { contains: (name: string) => boolean; [Symbol.iterator]: () => Iterator<string> }
  private readonly records = new Map<string, Map<string, any>>()

  private constructor(private readonly profile: string, stores: string[]) {
    this.objectStoreNames = {
      contains: (name) => stores.includes(name),
      [Symbol.iterator]: () => stores[Symbol.iterator](),
    }
    for (const store of stores) this.records.set(store, new Map())
  }

  static async open(profile: string, stores: string[], legacy: () => Promise<LegacyDatabase>) {
    const database = new NativeDatabase(profile, stores)
    const rows = await exportNativeRecords()
    const markerId = `migration:${profile}:v1`
    const migrated = rows.some((row) => row.store === SYSTEM_STORE && row.id === markerId && !row.deleted)
    const scopedPrefix = `${profile}${SEP}`

    for (const row of rows) {
      if (!row.store.startsWith(scopedPrefix)) continue
      database.applyNativeRow({ ...row, store: row.store.slice(scopedPrefix.length) })
    }

    if (!migrated) {
      const legacyDb = await legacy()
      for (const store of stores) {
        const candidates = new Map<string, any>()
        for (const row of rows.filter((item) => item.store === store && !item.deleted)) {
          if (row.payload) candidates.set(row.id, row.payload)
        }
        for (const value of await legacyDb.getAll(store)) {
          const key = recordKey(value)
          if (!key) continue
          const current = candidates.get(key)
          if (!current || Number(value.updatedAt || 0) >= Number(current.updatedAt || 0)) candidates.set(key, value)
        }
        for (const [key, value] of candidates) await database.put(store, value, key)
      }
      await mirrorNativeRecord(SYSTEM_STORE, markerId, { id: markerId, profile, migratedAt: Date.now() }, Date.now())
    }
    return database
  }

  private nativeStore(store: string) { return `${this.profile}${SEP}${store}` }

  private applyNativeRow(row: NativeRecord) {
    if (!this.records.has(row.store)) return
    if (row.deleted) this.records.get(row.store)!.delete(row.id)
    else this.records.get(row.store)!.set(row.id, globalThis.structuredClone(row.payload))
  }

  async get(store: string, key: string) {
    const value = this.records.get(store)?.get(String(key))
    return value == null ? undefined : globalThis.structuredClone(value)
  }

  async getAll(store: string) {
    return [...(this.records.get(store)?.values() || [])].map((value) => globalThis.structuredClone(value))
  }

  async getAllFromIndex(store: string, index: string, query?: unknown) {
    const field = fieldForIndex(index)
    const values = await this.getAll(store)
    return query === undefined ? values : values.filter((value) => value?.[field] === query)
  }

  async put(store: string, value: any, explicitKey?: string) {
    const key = String(explicitKey ?? recordKey(value))
    if (!key) throw new Error(`Native record in ${store} has no key.`)
    const copy = globalThis.structuredClone(value)
    await mirrorNativeRecord(this.nativeStore(store), key, copy, Number(copy.updatedAt || copy.ts || Date.now()))
    this.records.get(store)?.set(key, copy)
    return key
  }

  async add(store: string, value: any, explicitKey?: string) {
    const key = String(explicitKey ?? recordKey(value))
    if (this.records.get(store)?.has(key)) throw new Error(`Record ${key} already exists in ${store}.`)
    return this.put(store, value, key)
  }

  async delete(store: string, key: string) {
    await mirrorNativeDelete(this.nativeStore(store), String(key), Date.now())
    this.records.get(store)?.delete(String(key))
  }

  transaction(stores: string | string[], _mode: 'readonly' | 'readwrite' = 'readonly') {
    const names = Array.isArray(stores) ? stores : [stores]
    const objectStore = (name: string) => this.storeFacade(name)
    return { objectStore, store: names.length === 1 ? objectStore(names[0]) : undefined, done: Promise.resolve() }
  }

  private storeFacade(store: string) {
    const openCursor = async (index?: string, query?: unknown) => {
      const rows = index ? await this.getAllFromIndex(store, index, query) : await this.getAll(store)
      const cursorAt = (position: number): any => {
        const value = rows[position]
        if (!value) return null
        const key = recordKey(value)
        return {
          value,
          primaryKey: key,
          delete: () => this.delete(store, key),
          update: async (next: any) => { rows[position] = globalThis.structuredClone(next); await this.put(store, next, key) },
          continue: async () => cursorAt(position + 1),
        }
      }
      return cursorAt(0)
    }
    return {
      get: (key: string) => this.get(store, key),
      getAll: () => this.getAll(store),
      put: (value: any, key?: string) => this.put(store, value, key),
      add: (value: any, key?: string) => this.add(store, value, key),
      delete: (key: string) => this.delete(store, key),
      clear: async () => { for (const key of [...(this.records.get(store)?.keys() || [])]) await this.delete(store, key) },
      openCursor: () => openCursor(),
      index: (index: string) => ({ openCursor: (query?: unknown) => openCursor(index, query) }),
    }
  }
}
