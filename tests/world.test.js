// Tests for worldbuilding and moodboard stores.
import { beforeEach, describe, it, expect } from 'vitest'
import 'fake-indexeddb/auto'
import { getDB } from '../src/db/db'
import { createNovel, deleteNovel } from '../src/db/novels'
import { createWorldItem, listWorld, updateWorldItem, deleteWorldItem, WORLD_KINDS } from '../src/db/world'
import { createTile, listMoodboard, updateTile, deleteTile } from '../src/db/moodboard'

beforeEach(async () => {
  const db = await getDB()
  await Promise.all(['world', 'moodboard', 'tombstones'].map((s) => db.clear(s)))
})

describe('world', () => {
  it('crud with kinds', async () => {
    const n = await createNovel({ title: 'T' })
    const place = await createWorldItem(n.id, { kind: 'place', name: 'Alder Canal', summary: 'Glows at dusk.' })
    expect(place.kind).toBe('place')
    expect(WORLD_KINDS.map((k) => k.key)).toContain('place')

    await updateWorldItem(place.id, { tags: ['canal', 'borderland'] })
    const all = await listWorld(n.id)
    expect(all.length).toBe(1)
    expect(all[0].tags).toEqual(['canal', 'borderland'])

    await deleteWorldItem(place.id)
    expect(await listWorld(n.id)).toEqual([])
  })
})

describe('moodboard', () => {
  it('adds, moves and removes tiles', async () => {
    const n = await createNovel({ title: 'T' })
    const note = await createTile(n.id, { kind: 'note', x: 10, y: 20, text: 'sea-glass green' })
    const img = await createTile(n.id, { kind: 'image', x: 40, y: 50, image: 'data:image/jpeg;base64,xxxx' })
    const all = await listMoodboard(n.id)
    expect(all.length).toBe(2)

    await updateTile(note.id, { x: 100, y: 120 })
    const moved = await listMoodboard(n.id)
    expect(moved.find((t) => t.id === note.id).x).toBe(100)

    await deleteTile(img.id)
    expect(await listMoodboard(n.id)).toHaveLength(1)
  })

  it('supports link and palette tiles', async () => {
    const n = await createNovel({ title: 'T' })
    const link = await createTile(n.id, { kind: 'link', x: 0, y: 0, url: 'pinterest.com/board/x', text: 'Cape references' })
    const palette = await createTile(n.id, { kind: 'palette', x: 5, y: 5, palette: ['#7BA3C9', '#D4A5A5'], text: 'Sea-glass dusk' })
    expect(link.url).toBe('pinterest.com/board/x')
    expect(palette.palette).toEqual(['#7BA3C9', '#D4A5A5'])
    expect(link.h).toBe(96)
    expect(palette.h).toBe(150)
    await updateTile(palette.id, { palette: ['#000000'] })
    const got = await listMoodboard(n.id)
    expect(got.find((t) => t.id === palette.id).palette).toEqual(['#000000'])
  })

  it('cleans up with its novel', async () => {
    const n = await createNovel({ title: 'T' })
    await createTile(n.id, { kind: 'note', text: 'keep' })
    await createWorldItem(n.id, { kind: 'lore', name: 'The old song' })
    await deleteNovel(n.id)
    expect(await listMoodboard(n.id)).toEqual([])
    expect(await listWorld(n.id)).toEqual([])
  })
})
