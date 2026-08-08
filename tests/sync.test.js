// Tests for the sync engine: dirty tracking, serialization, LWW merge,
// tombstone handling, and push/pull against a mocked server.
import { beforeEach, describe, it, expect, vi, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import { getDB } from '../src/db/db'
import { createNovel, updateNovel } from '../src/db/novels'
import { createChapter, updateChapter, deleteChapter } from '../src/db/chapters'
import { blobToDataUrl, dataUrlToBlob, toWire, fromWire } from '../src/sync/serialize'
import { collectPending, applyIncoming, push, pull, setConfig, getConfig } from '../src/sync/engine'

beforeEach(async () => {
  const db = await getDB()
  await Promise.all(['novels', 'chapters', 'characters', 'notes', 'relationships', 'stats', 'world', 'moodboard', 'tombstones', 'meta'].map((s) => db.clear(s)))
  await setConfig({ server: 'http://test.local', token: 'tok-1', state: { lastPull: 0 } })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('serialize', () => {
  it('round-trips a cover Blob through dataURL', async () => {
    const blob = new Blob(['hello cover'], { type: 'image/png' })
    const dataUrl = await blobToDataUrl(blob)
    expect(dataUrl).toMatch(/^data:image\/png;base64,/)

    const wire = await toWire({ id: 'x', cover: blob })
    expect(wire.__hadCover).toBe(true)
    expect(typeof wire.cover).toBe('string')

    const back = fromWire(wire)
    expect(back.cover).toBeInstanceOf(Blob)
    expect(back.__hadCover).toBeUndefined()
    expect(back.pendingSync).toBeUndefined()
  })

  it('leaves plain records untouched', async () => {
    const wire = await toWire({ id: 'y', title: 'hi' })
    expect(wire.title).toBe('hi')
    expect(wire.__hadCover).toBeUndefined()
  })

  it('rejects malformed dataURLs', () => {
    expect(dataUrlToBlob('plain')).toBeNull()
    expect(dataUrlToBlob('data:image/png;base64,@@@')).toBeNull()
  })
})

describe('dirty tracking', () => {
  it('marks new and updated records as pending', async () => {
    const n = await createNovel({ title: 'Sync Me' })
    const pending = await collectPending()
    const novelRec = pending.find((r) => r.store === 'novels' && r.id === n.id)
    expect(novelRec).toBeTruthy()
    expect(novelRec.updatedAt).toBeTypeOf('number')

    await updateNovel(n.id, { title: 'Renamed' })
    const pending2 = await collectPending()
    const updated = pending2.find((r) => r.store === 'novels' && r.id === n.id)
    expect(updated.payload.title).toBe('Renamed')
    expect(updated.payload.rev).toBeGreaterThanOrEqual(2)
  })

  it('records deletes as tombstones', async () => {
    const n = await createNovel({ title: 'Doomed' })
    const ch = await createChapter(n.id, { title: 'One' })
    await deleteChapter(ch.id)

    const pending = await collectPending()
    const tomb = pending.find((r) => r.store === 'chapters' && r.id === ch.id)
    expect(tomb).toBeTruthy()
    expect(tomb.deleted).toBe(true)
  })
})

describe('applyIncoming (LWW)', () => {
  it('writes new records and skips older ones', async () => {
    await applyIncoming([{ store: 'novels', id: 'n-a', novelId: 'n-a', updatedAt: 200, deleted: false, payload: { id: 'n-a', title: 'From remote', updatedAt: 200 } }])
    const db = await getDB()
    expect((await db.get('novels', 'n-a')).title).toBe('From remote')

    // older remote change is ignored
    await applyIncoming([{ store: 'novels', id: 'n-a', novelId: 'n-a', updatedAt: 100, deleted: false, payload: { id: 'n-a', title: 'Stale' } }])
    expect((await db.get('novels', 'n-a')).title).toBe('From remote')
  })

  it('applies remote tombstones', async () => {
    const n = await createNovel({ title: 'Vanishing' })
    await applyIncoming([{ store: 'novels', id: n.id, novelId: n.id, updatedAt: Date.now() + 1000, deleted: true, payload: null }])
    const db = await getDB()
    expect(await db.get('novels', n.id)).toBeUndefined()
  })

  it('keeps a local edit that is newer than a remote delete and re-pushes it', async () => {
    const n = await createNovel({ title: 'Keep Me' })
    await applyIncoming([{ store: 'novels', id: n.id, novelId: n.id, updatedAt: n.updatedAt - 5000, deleted: true, payload: null }])
    const db = await getDB()
    const kept = await db.get('novels', n.id)
    expect(kept.title).toBe('Keep Me')
    expect(kept.pendingSync).toBe(true)
  })
})

describe('push / pull against a mock server', () => {
  it('pushes pending records and clears them', async () => {
    await createNovel({ title: 'To The Cloud' })
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, serverTime: Date.now() })
    })

    const pushed = await push()
    expect(pushed).toBe(1)

    const pending = await collectPending()
    expect(pending.length).toBe(0)

    const [url, init] = global.fetch.mock.calls[0]
    expect(url).toContain('/api/sync/push')
    expect(init.headers.Authorization).toBe('Bearer tok-1')
  })

  it('pulls and merges remote records', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        serverTime: 500,
        records: [
          { store: 'novels', id: 'remote-1', novelId: 'remote-1', updatedAt: 300, deleted: false, payload: { id: 'remote-1', title: 'From the server', updatedAt: 300 } }
        ]
      })
    })

    const pulled = await pull()
    expect(pulled).toBe(1)
    const db = await getDB()
    expect((await db.get('novels', 'remote-1')).title).toBe('From the server')
    const cfg = await getConfig()
    expect(cfg.state.lastPull).toBe(500)
  })
})
