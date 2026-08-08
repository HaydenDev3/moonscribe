import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { getDB } from '../src/db/db'
import { mergeChapters, createChapter, listChapters, getChapter } from '../src/db/chapters'

beforeEach(async () => {
  const db = await getDB()
  await db.clear('chapters')
  await db.clear('novels')
  await db.clear('tombstones')
})

describe('mergeChapters', () => {
  it('joins content at a scene break and deletes the absorbed chapter', async () => {
    const a = await createChapter('n1', { title: 'One', content: '<p>Alpha.</p>' })
    const b = await createChapter('n1', { title: 'Two', content: '<p>Beta.</p>' })

    const res = await mergeChapters('n1', a.id, b.id, { separator: 'scene-break' })
    expect(res).toBeTruthy()
    expect(res.keep.content).toContain('Alpha.')
    expect(res.keep.content).toContain('Beta.')
    expect(res.keep.content).toContain('scene-break')
    expect(await getChapter(b.id)).toBeUndefined()
    expect(res.after).toHaveLength(1)
  })

  it('recounts the word total after merging', async () => {
    const a = await createChapter('n1', { title: 'One', content: '<p>One two three.</p>' })
    const b = await createChapter('n1', { title: 'Two', content: '<p>Four five.</p>' })
    const res = await mergeChapters('n1', a.id, b.id, { separator: 'space' })
    expect(res.keep.wordCount).toBe(5)
  })

  it('refuses to merge a chapter into itself', async () => {
    const a = await createChapter('n1', { title: 'One' })
    const res = await mergeChapters('n1', a.id, a.id)
    expect(res).toBeNull()
  })

  it('leaves a stable, gap-free ordering after the merge', async () => {
    const a = await createChapter('n1', { title: 'One' })
    const b = await createChapter('n1', { title: 'Two' })
    const c = await createChapter('n1', { title: 'Three' })
    await mergeChapters('n1', a.id, b.id)
    const after = await listChapters('n1')
    expect(after.map((x) => x.id).sort()).toEqual([a.id, c.id].sort())
    const orders = after.map((x) => x.order)
    expect(new Set(orders).size).toBe(orders.length)
    expect(orders).toEqual([...orders].sort((x, y) => x - y))
  })
})
