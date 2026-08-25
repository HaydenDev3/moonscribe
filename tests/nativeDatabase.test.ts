import { beforeEach, describe, expect, it, vi } from 'vitest'

const nativeRows: any[] = []

vi.mock('../src/platform/nativeStorage', () => ({
  exportNativeRecords: vi.fn(async () => nativeRows.map((row) => globalThis.structuredClone(row))),
  mirrorNativeRecord: vi.fn(async (store, id, payload, updatedAt) => {
    const index = nativeRows.findIndex((row) => row.store === store && row.id === id)
    const row = { store, id, payload: globalThis.structuredClone(payload), updatedAt, deleted: false }
    if (index >= 0) nativeRows[index] = row
    else nativeRows.push(row)
  }),
  mirrorNativeDelete: vi.fn(async (store, id, updatedAt) => {
    const index = nativeRows.findIndex((row) => row.store === store && row.id === id)
    const row = { store, id, payload: {}, updatedAt, deleted: true }
    if (index >= 0) nativeRows[index] = row
    else nativeRows.push(row)
  }),
}))

import { NativeDatabase } from '../src/platform/nativeDatabase'

describe('desktop native database', () => {
  beforeEach(() => { nativeRows.length = 0 })

  it('migrates the legacy repository once and then reads from profile-scoped native records', async () => {
    let legacyReads = 0
    const legacy = async () => ({ getAll: async (store: string) => { legacyReads += 1; return store === 'chapters' ? [{ id: 'c1', novelId: 'n1', title: 'Opening', updatedAt: 10 }] : [] } })
    const first = await NativeDatabase.open('local', ['chapters', 'meta'], legacy)
    expect((await first.get('chapters', 'c1')).title).toBe('Opening')
    expect(nativeRows.some((row) => row.store === 'local::chapters' && row.id === 'c1')).toBe(true)
    expect(legacyReads).toBe(2)

    const second = await NativeDatabase.open('local', ['chapters', 'meta'], async () => { throw new Error('legacy storage should not reopen') })
    expect((await second.getAllFromIndex('chapters', 'by-novel', 'n1'))).toHaveLength(1)
  })

  it('persists puts, deletes, clears, and cursor updates through native storage', async () => {
    nativeRows.push({ store: '__system', id: 'migration:local:v1', payload: {}, updatedAt: 1, deleted: false })
    const db = await NativeDatabase.open('local', ['chapters'], async () => { throw new Error('not used') })
    await db.put('chapters', { id: 'c1', novelId: 'n1', title: 'Draft', updatedAt: 1 })
    const store = db.transaction('chapters', 'readwrite').objectStore('chapters')
    const cursor = await store.index('by-novel').openCursor('n1')
    await cursor.update({ ...cursor.value, title: 'Revised', updatedAt: 2 })
    expect((await db.get('chapters', 'c1')).title).toBe('Revised')
    await store.clear()
    expect(await db.getAll('chapters')).toEqual([])
    expect(nativeRows.find((row) => row.store === 'local::chapters' && row.id === 'c1')?.deleted).toBe(true)
  })
})
