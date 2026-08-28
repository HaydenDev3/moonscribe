// Integration tests for the data layer against fake-indexeddb.
import { beforeEach, describe, it, expect, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { getDB } from '../src/db/db'
import { createNovel, updateNovel, getNovel, deleteNovel, listNovels } from '../src/db/novels'
import {
  createChapter,
  listChapters,
  updateChapter,
  moveChapter,
  reorderChapter,
  mergeChapters,
  wordsAndChapters
} from '../src/db/chapters'
import { createCharacter, listCharacters, updateCharacter } from '../src/db/characters'
import { createNote, listNotes } from '../src/db/notes'
import { createRelationship, listRelationships } from '../src/db/relationships'
import { addTodayWords, todayWords } from '../src/db/stats'
import { recordSession, todaySessionStats } from '../src/db/stats'
import { exportBackup, importBackup } from '../src/db/backup'
import { toWire, fromWire } from '../src/sync/serialize'
import { createFolder, listFolders, moveFolder } from '../src/db/folders'

beforeEach(async () => {
  const db = await getDB()
  await Promise.all(['novels', 'chapters', 'folders', 'characters', 'notes', 'relationships', 'stats', 'meta'].map((s) => db.clear(s)))
})

describe('novels', () => {
  it('creates, updates and lists novels', async () => {
    const n = await createNovel({ title: 'The Quiet Tide', blurb: 'Two strangers…' })
    expect(n.title).toBe('The Quiet Tide')
    expect(n.goalWords).toBe(500)
    expect(n.layout.bodyFont).toBe('literata')

    await updateNovel(n.id, { title: 'The Quiet Tide II' })
    const got = await getNovel(n.id)
    expect(got.title).toBe('The Quiet Tide II')

    const all = await listNovels()
    expect(all.length).toBe(1)
  })

  it('stores genres and keeps them queryable', async () => {
    const a = await createNovel({ title: 'Tide', genres: ['Romance', 'Historical'] })
    const b = await createNovel({ title: 'Dust', genres: [] })
    expect(a.genres).toEqual(['Romance', 'Historical'])
    expect(b.genres).toEqual([])
    await updateNovel(a.id, { genres: ['Romance'] })
    expect((await getNovel(a.id)).genres).toEqual(['Romance'])
  })
})

describe('chapters', () => {
  it('creates chapters in order and supports parts', async () => {
    const n = await createNovel({ title: 'T' })
    const c1 = await createChapter(n.id, { title: 'One', part: 'Part I' })
    const c2 = await createChapter(n.id, { title: 'Two', part: 'Part I' })
    const c3 = await createChapter(n.id, { title: 'Three', part: 'Part II' })

    const list = await listChapters(n.id)
    expect(list.map((c) => c.title)).toEqual(['One', 'Two', 'Three'])
    expect(list[0].order).toBeLessThan(list[1].order)

    // reorder: move Three up
    await moveChapter(n.id, c3.id, -1)
    const after = await listChapters(n.id)
    expect(after[1].id).toBe(c3.id)
  })

  it('tracks word counts and deletes cleanly with the novel', async () => {
    const n = await createNovel({ title: 'T' })
    await createChapter(n.id, { title: 'A', content: '<p>one two three</p>' })
    await createChapter(n.id, { title: 'B', content: '<p>four five</p>' })
    const { words, chapters } = await wordsAndChapters(n.id)
    expect(words).toBe(5)
    expect(chapters).toBe(2)

    await deleteNovel(n.id)
    expect(await listChapters(n.id)).toEqual([])
  })

  it('creates child chapters in the correct parent sequence and inherits the parent part', async () => {
    const n = await createNovel({ title: 'T' })
    const book = await createChapter(n.id, { title: 'Book', kind: 'book', part: 'Part I' })
    const chapterA = await createChapter(n.id, { title: 'A', part: 'Part I' })
    const chapterB = await createChapter(n.id, { title: 'B', parentId: book.id })
    const chapterC = await createChapter(n.id, { title: 'C', parentId: book.id })

    const children = (await listChapters(n.id)).filter((c) => c.parentId === book.id)
    expect(children.map((c) => c.title)).toEqual(['B', 'C'])
    expect(children.every((c) => c.part === 'Part I')).toBe(true)
    expect(chapterA.part).toBe('Part I')
    expect(chapterB.order).toBeLessThan(chapterC.order)
  })

  it('creates hierarchy nodes and reorders across parents', async () => {
    const n = await createNovel({ title: 'T' })
    const book = await createChapter(n.id, { title: '', kind: 'book' })
    const part = await createChapter(n.id, { title: '', kind: 'part', parentId: book.id })
    const c1 = await createChapter(n.id, { title: 'One', parentId: part.id })
    const c2 = await createChapter(n.id, { title: 'Two', parentId: part.id })
    const sub = await createChapter(n.id, { title: '', kind: 'subchapter', parentId: c1.id })

    expect(book.kind).toBe('book')
    expect(part.parentId).toBe(book.id)
    expect(sub.kind).toBe('subchapter')

    // move Two above One (same parent)
    await moveChapter(n.id, c2.id, -1)
    let list = await listChapters(n.id)
    expect(list.find((c) => c.id === c2.id).order).toBeLessThan(list.find((c) => c.id === c1.id).order)

    // drag One out of the part up to root
    list = await reorderChapter(n.id, c1.id, { parentId: null })
    expect(list.find((c) => c.id === c1.id).parentId).toBeNull()

    // refuse to nest a parent inside its own subtree
    list = await reorderChapter(n.id, book.id, { parentId: c2.id })
    expect(list.find((c) => c.id === book.id).parentId).toBeNull()
  })

  it('moves chapters into folders without turning outline Acts into folders', async () => {
    const n = await createNovel({ title: 'Drag test' })
    const folder = await createFolder(n.id, { name: 'Drafts' })
    const act = await createChapter(n.id, { title: 'Act I', kind: 'act' })
    const chapter = await createChapter(n.id, { title: 'Scene', folderId: folder.id })

    expect(chapter.kind).toBe('chapter')
    expect(chapter.folderId).toBe(folder.id)
    expect((await listChapters(n.id)).find((item) => item.id === act.id).folderId).toBeNull()

    const nested = await createFolder(n.id, { name: 'Nested', parentId: folder.id })
    await moveFolder(nested.id, null, 0)
    expect((await listFolders(n.id)).find((item) => item.id === nested.id).parentId).toBeNull()
  })

  it('caps stored versions at 20', async () => {
    const n = await createNovel({ title: 'T' })
    const keep = await createChapter(n.id, { title: 'Keep', content: '<p>base</p>' })
    for (let i = 0; i < 25; i++) {
      const absorb = await createChapter(n.id, { title: `A${i}`, content: `<p>a${i}</p>` })
      await mergeChapters(n.id, keep.id, absorb.id)
    }
    const got = await getChapterForTest(n.id, keep.id)
    expect(got.versions.length).toBe(20)
    expect(got.versions[19].words).toBeGreaterThan(got.versions[0].words)
  })
})

async function getChapterForTest(novelId, chId) {
  const db = await getDB()
  return db.get('chapters', chId)
}

describe('characters / notes / relationships', () => {
  it('crud', async () => {
    const n = await createNovel({ title: 'T' })
    const ch = await createChapter(n.id, { title: 'One' })

    const c = await createCharacter(n.id, { name: 'Storm', color: '#D4A5A5', chapterIds: [ch.id] })
    expect(c.name).toBe('Storm')
    await updateCharacter(c.id, { role: 'protagonist' })
    const chars = await listCharacters(n.id)
    expect(chars[0].role).toBe('protagonist')

    await createNote(n.id, { title: 'Idea', content: 'The moon over the bay.', link: { type: 'chapter', id: ch.id } })
    const notes = await listNotes(n.id)
    expect(notes[0].link.type).toBe('chapter')

    await createRelationship(n.id, { a: 'x', b: 'y', description: 'sisters', stages: [{ label: 'Strangers', note: 'met at the fair' }, { label: 'Rivals' }] })
    const rels = await listRelationships(n.id)
    expect(rels[0].description).toBe('sisters')
    expect(rels[0].stages).toHaveLength(2)
    expect(rels[0].stages[1]).toEqual({ label: 'Rivals', note: '' })
  })
})

describe('stats', () => {
  it('accumulates daily words and clamps to the day', async () => {
    const n = await createNovel({ title: 'T' })
    await addTodayWords(n.id, 120)
    await addTodayWords(n.id, 80)
    expect(await todayWords(n.id)).toBe(200)
  })

  it('records sessions without polluting daily totals', async () => {
    const n = await createNovel({ title: 'T' })
    const start = Date.now()
    await addTodayWords(n.id, 100)
    await recordSession(n.id, start, start + 120000, 60)
    const today = await todaySessionStats(n.id)
    expect(today.words).toBe(60)
    expect(today.minutes).toBeCloseTo(2)
    expect(await todayWords(n.id)).toBe(100)
  })
})

describe('backup', () => {
  it('round-trips all data', async () => {
    const n = await createNovel({ title: 'Backup Me' })
    await createChapter(n.id, { title: 'One', content: '<p>words words</p>' })
    const backup = await exportBackup()
    expect(backup.novels.length).toBe(1)
    expect(backup.chapters.length).toBe(1)

    await deleteNovel(n.id)
    expect(await listNovels()).toEqual([])

    await importBackup(backup)
    const restored = await listNovels()
    expect(restored.length).toBe(1)
    expect(restored[0].title).toBe('Backup Me')
    expect((await listChapters(restored[0].id)).length).toBe(1)
  })

  it('serializes cover blobs and restores them as usable blobs', async () => {
    const cover = new Blob(['cover-bytes'], { type: 'image/png' })
    const encoded = await toWire({ id: 'covered', title: 'Covered', cover, createdAt: 1, updatedAt: 1 })
    expect(encoded.cover).toMatch(/^data:image\/png;base64,/)
    const decoded = fromWire(encoded)
    expect(decoded.cover).toBeInstanceOf(Blob)
    expect(decoded.cover.type).toBe('image/png')
    expect(await decoded.cover.text()).toBe('cover-bytes')

    await importBackup({ app: 'moonscribe', version: 3, novels: [encoded] })
    const restored = await getNovel('covered')
    expect(restored.cover).toBeTruthy()
    expect(restored.cover.type).toBe('image/png')
  })

  it('keeps an old malformed-cover backup usable', async () => {
    await importBackup({
      app: 'moonscribe',
      version: 2,
      novels: [{ id: 'legacy', title: 'Recovered words', cover: {}, createdAt: 1, updatedAt: 1 }]
    })
    const restored = await listNovels()
    expect(restored).toHaveLength(1)
    expect(restored[0].title).toBe('Recovered words')
    expect(restored[0].cover).toBeNull()
  })
})
