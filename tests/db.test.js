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
  wordsAndChapters
} from '../src/db/chapters'
import { createCharacter, listCharacters, updateCharacter } from '../src/db/characters'
import { createNote, listNotes } from '../src/db/notes'
import { createRelationship, listRelationships } from '../src/db/relationships'
import { addTodayWords, todayWords } from '../src/db/stats'
import { recordSession, todaySessionStats } from '../src/db/stats'
import { exportBackup, importBackup } from '../src/db/backup'

beforeEach(async () => {
  const db = await getDB()
  await Promise.all(['novels', 'chapters', 'characters', 'notes', 'relationships', 'stats', 'meta'].map((s) => db.clear(s)))
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

  it('saves versions with a cap', async () => {
    const n = await createNovel({ title: 'T' })
    const c = await createChapter(n.id, { title: 'A', content: '' })
    for (let i = 1; i <= 25; i++) {
      const now = Date.now() + i * 120000
      vi.spyOn(Date, 'now').mockReturnValue(now)
      await updateChapter(c.id, { content: `<p>v${i}</p>` })
    }
    vi.restoreAllMocks()
    const got = await getChapterForTest(n.id, c.id)
    expect(got.versions.length).toBeLessThanOrEqual(20)
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
})
