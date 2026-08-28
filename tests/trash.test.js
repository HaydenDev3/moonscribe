// Integration tests for the recoverable trash (soft delete / restore / purge).
import { beforeEach, describe, it, expect, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { getDB } from '../src/db/db'
import { createNovel } from '../src/db/novels'
import { createChapter, listChapters, mergeChapters, wordsAndChapters, trashChapter } from '../src/db/chapters'
import { createCharacter, listCharacters, trashCharacter } from '../src/db/characters'
import { createNote, listNotes, trashNote } from '../src/db/notes'
import { createWorldItem, listWorld, trashWorldItem } from '../src/db/world'
import {
  listTrash,
  restoreTrashed,
  purgeTrashed,
  emptyTrash,
  purgeExpired,
  TRASH_TTL_MS
} from '../src/db/trash'

beforeEach(async () => {
  const db = await getDB()
  await Promise.all(['novels', 'chapters', 'characters', 'notes', 'relationships', 'stats', 'meta', 'world'].map((s) => db.clear(s)))
})

describe('trash', () => {
  it('soft-deletes a chapter and hides it from the chapter list', async () => {
    const n = await createNovel({ title: 'T' })
    const c = await createChapter(n.id, { title: 'The Lighthouse', content: '<p>Storm rising.</p>' })

    await expect(listChapters(n.id).then((l) => l.map((x) => x.id))).resolves.toEqual([c.id])

    // chapters use trashChapter from db/chapters
    const { trashChapter } = await import('../src/db/chapters')
    await trashChapter(c.id)
    expect(await listChapters(n.id)).toEqual([])

    const trash = await listTrash(n.id)
    expect(trash).toHaveLength(1)
    expect(trash[0].store).toBe('chapters')
    expect(trash[0].rec.id).toBe(c.id)
    expect(trash[0].rec.trashedAt).toBeGreaterThan(0)
  })

  it('does not repair or re-dirty a deleted nested chapter during refresh', async () => {
    const n = await createNovel({ title: 'Nested delete' })
    const parent = await createChapter(n.id, { title: 'Parent' })
    const middle = await createChapter(n.id, { title: 'Middle' })
    const child = await createChapter(n.id, { title: 'Deep chapter', kind: 'subchapter', parentId: parent.id })
    await createChapter(n.id, { title: 'Later chapter' })
    await trashChapter(child.id)

    const visible = await listChapters(n.id)
    expect(visible.map((chapter) => chapter.id)).toEqual([parent.id, middle.id, visible.find((chapter) => chapter.title === 'Later chapter').id])
    const db = await getDB()
    const deleted = await db.get('chapters', child.id)
    expect(deleted.trashedAt).toBeTypeOf('number')
    expect(deleted.parentId).toBe(parent.id)
  })

  it('keeps later chapters visible when deleting a parent, with or without a folder', async () => {
    const n = await createNovel({ title: 'Reparent on delete' })
    const parent = await createChapter(n.id, { title: 'Chapter 3' })
    const child4 = await createChapter(n.id, { title: 'Chapter 4', kind: 'subchapter', parentId: parent.id })
    const child5 = await createChapter(n.id, { title: 'Chapter 5', kind: 'subchapter', parentId: parent.id })
    await trashChapter(parent.id)
    const visible = await listChapters(n.id)
    expect(visible.map((chapter) => chapter.id)).toEqual([child4.id, child5.id])
    expect(visible.every((chapter) => chapter.parentId === null)).toBe(true)
  })

  it('restores a trashed record', async () => {
    const n = await createNovel({ title: 'T' })
    const c = await createChapter(n.id, { title: 'Back', content: '' })
    const { trashChapter } = await import('../src/db/chapters')
    await trashChapter(c.id)
    await restoreTrashed('chapters', c.id)

    expect(await listTrash(n.id)).toEqual([])
    expect(await listChapters(n.id)).toHaveLength(1)
    expect((await import('../src/db/chapters')).getChapter).toBeDefined()
  })

  it('purges a record permanently and emits a sync tombstone', async () => {
    const n = await createNovel({ title: 'T' })
    const c = await createChapter(n.id, { title: 'Gone', content: '' })
    await purgeTrashed('chapters', c.id)

    expect(await listTrash(n.id)).toEqual([])
    const db = await getDB()
    expect(await db.get('chapters', c.id)).toBeUndefined()
    const tomb = await db.get('tombstones', `chapters:${c.id}`)
    expect(tomb).toBeTruthy()
    expect(tomb.pendingSync).toBe(true)
  })

  it('empties the trash for a novel only', async () => {
    const n1 = await createNovel({ title: 'A' })
    const n2 = await createNovel({ title: 'B' })
    const { trashChapter } = await import('../src/db/chapters')
    const c1 = await createChapter(n1.id, { title: 'One', content: '' })
    const c2 = await createChapter(n2.id, { title: 'Two', content: '' })
    await trashChapter(c1.id)
    await trashChapter(c2.id)

    expect(await emptyTrash(n1.id)).toBe(1)
    expect(await listTrash(n1.id)).toEqual([])
    expect(await listTrash(n2.id)).toHaveLength(1)
  })

  it('sweeps expired trash and leaves fresh items alone', async () => {
    const n = await createNovel({ title: 'T' })
    const c = await createChapter(n.id, { title: 'Old', content: '' })
    const { trashChapter } = await import('../src/db/chapters')

    await trashChapter(c.id)
    const db = await getDB()
    const old = await db.get('chapters', c.id)
    await db.put('chapters', { ...old, id: c.id, trashedAt: Date.now() - TRASH_TTL_MS - 1000 })

    const f = await createChapter(n.id, { title: 'Fresh', content: '' })
    await trashChapter(f.id)

    const removed = await purgeExpired()
    expect(removed).toBe(1)
    const trash = await listTrash(n.id)
    expect(trash).toHaveLength(1)
    expect(trash[0].rec.id).toBe(f.id)
  })

  it('keeps every binder store trashable and restorable', async () => {
    const n = await createNovel({ title: 'T' })
    const ch = await createChapter(n.id, { title: 'Ch', content: '' })
    const char = await createCharacter(n.id, { name: 'Ada' })
    const note = await createNote(n.id, { title: 'N' })
    const item = await createWorldItem(n.id, { name: 'The Shard' })

    const { trashChapter } = await import('../src/db/chapters')
    await Promise.all([trashChapter(ch.id), trashCharacter(char.id), trashNote(note.id), trashWorldItem(item.id)])

    const trash = await listTrash(n.id)
    expect(trash.map((t) => t.store).sort()).toEqual(['chapters', 'characters', 'notes', 'world'])
    expect(await listCharacters(n.id)).toEqual([])
    expect(await listNotes(n.id)).toEqual([])
    expect(await listWorld(n.id)).toEqual([])

    await restoreTrashed('characters', char.id)
    await restoreTrashed('notes', note.id)
    await restoreTrashed('world', item.id)
    expect(await listCharacters(n.id)).toHaveLength(1)
    expect(await listNotes(n.id)).toHaveLength(1)
    expect(await listWorld(n.id)).toHaveLength(1)
  })

  it('mergeChapters still hard-deletes the absorbed chapter (not to trash)', async () => {
    const n = await createNovel({ title: 'T' })
    const keep = await createChapter(n.id, { title: 'Keep', content: '<p>Alpha.</p>' })
    const absorb = await createChapter(n.id, { title: 'Absorb', content: '<p>Beta.</p>' })
    const { trashChapter } = await import('../src/db/chapters')

    await mergeChapters(n.id, keep.id, absorb.id, { separator: 'space' })
    expect(await listTrash(n.id)).toEqual([])
    expect((await wordsAndChapters(n.id)).chapters).toBe(1)

    // A trashed chapter is invisible to listChapters, so merge cannot see it.
    const ghost = await createChapter(n.id, { title: 'Ghost', content: '' })
    await trashChapter(ghost.id)
    expect(await listChapters(n.id)).toHaveLength(1)
  })
})
