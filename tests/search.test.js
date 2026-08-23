// Integration tests for the grouped command-palette search.
import { beforeEach, describe, it, expect } from 'vitest'
import 'fake-indexeddb/auto'
import { getDB } from '../src/db/db'
import { createNovel } from '../src/db/novels'
import { createChapter, trashChapter } from '../src/db/chapters'
import { createCharacter, trashCharacter } from '../src/db/characters'
import { createNote } from '../src/db/notes'
import { createWorldItem } from '../src/db/world'
import { createRelationship } from '../src/db/relationships'
import { searchAll } from '../src/db/search'

beforeEach(async () => {
  const db = await getDB()
  await Promise.all(['novels', 'chapters', 'characters', 'notes', 'relationships', 'stats', 'meta', 'world'].map((s) => db.clear(s)))
})

describe('searchAll', () => {
  it('returns an empty grouped shape for an empty query', async () => {
    const res = await searchAll('   ')
    expect(res).toEqual({ novels: [], chapters: [], characters: [], notes: [], world: [], relationships: [], glossary: [], media: [] })
  })

  it('groups results across every store', async () => {
    const n = await createNovel({ title: 'The Salt Garden', blurb: 'A story about tides.' })
    await createChapter(n.id, { title: 'The Salt Harvest', content: '<p>They gathered salt at dawn.</p>' })
    await createCharacter(n.id, { name: 'Mara Salt', role: 'protagonist' })
    await createNote(n.id, { title: 'Salt lore', content: 'Salt marks a threshold.' })
    await createWorldItem(n.id, { name: 'Salt Road', summary: 'Trades along the coast.' })
    await createRelationship(n.id, { a: 'Mara', b: 'the tide', description: 'bound by salt' })

    const res = await searchAll('salt')

    expect(res.novels.map((x) => x.title)).toEqual(['The Salt Garden'])
    expect(res.chapters.map((x) => x.title)).toEqual(['The Salt Harvest'])
    expect(res.characters.map((x) => x.title)).toEqual(['Mara Salt'])
    expect(res.notes.map((x) => x.title)).toEqual(['Salt lore'])
    expect(res.world.map((x) => x.title)).toEqual(['Salt Road'])
    expect(res.relationships.length).toBe(1)
    expect(res.relationships[0].title).toContain('Mara')
  })

  it('ranks exact and prefix title matches above body matches', async () => {
    const n = await createNovel({ title: 'Nest' })
    await createChapter(n.id, { title: 'Nest', content: '<p>exact</p>' })
    await createChapter(n.id, { title: 'Nestling', content: '<p>prefix</p>' })
    await createChapter(n.id, { title: 'A Far Place', content: '<p>the nest is empty</p>' })

    const res = await searchAll('nest')
    expect(res.chapters.map((x) => x.title)).toEqual(['Nest', 'Nestling', 'A Far Place'])
  })

  it('skips trashed records', async () => {
    const n = await createNovel({ title: 'T' })
    const c = await createChapter(n.id, { title: 'Hidden', content: '<p>secret</p>' })
    const ch = await createCharacter(n.id, { name: 'Hidden Hero' })

    expect((await searchAll('hidden')).chapters).toHaveLength(1)
    expect((await searchAll('hidden')).characters).toHaveLength(1)

    await trashChapter(c.id)
    await trashCharacter(ch.id)
    const res = await searchAll('hidden')
    expect(res.chapters).toEqual([])
    expect(res.characters).toEqual([])
  })

  it('searches chapter body content after stripping tags', async () => {
    const n = await createNovel({ title: 'T' })
    await createChapter(n.id, { title: 'Untitled', content: '<p>The <b>velvet</b> hour.</p>' })
    const res = await searchAll('velvet')
    expect(res.chapters).toHaveLength(1)
    expect(res.chapters[0].title).toBe('Untitled')
  })
})
