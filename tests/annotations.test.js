import { beforeEach, describe, it, expect } from 'vitest'
import 'fake-indexeddb/auto'
import { getDB } from '../src/db/db'
import {
  createAnnotation,
  listAnnotations,
  updateAnnotation,
  deleteAnnotation,
  annotationCounts
} from '../src/db/annotations'

beforeEach(async () => {
  const db = await getDB()
  await db.clear('annotations')
})

describe('annotations', () => {
  it('creates comments scoped to a chapter and lists them in order', async () => {
    await createAnnotation('n1', { chapterId: 'c1', comment: 'first', type: 'plot' })
    await createAnnotation('n1', { chapterId: 'c1', comment: 'second', type: 'style' })
    await createAnnotation('n1', { chapterId: 'c2', comment: 'elsewhere' })

    const forC1 = await listAnnotations('n1', 'c1')
    expect(forC1.map((a) => a.comment)).toEqual(['first', 'second'])

    const all = await listAnnotations('n1')
    expect(all).toHaveLength(3)
  })

  it('coerces an unknown type to note and clamps the quote', async () => {
    const a = await createAnnotation('n1', { chapterId: 'c1', quote: 'x'.repeat(500), comment: 'c', type: 'bogus' })
    expect(a.type).toBe('note')
    expect(a.quote).toHaveLength(400)
  })

  it('resolves, deletes and counts only open comments per chapter', async () => {
    const a1 = await createAnnotation('n1', { chapterId: 'c1', comment: 'one' })
    await createAnnotation('n1', { chapterId: 'c1', comment: 'two' })
    await createAnnotation('n1', { chapterId: 'c2', comment: 'three' })

    await updateAnnotation(a1.id, { resolved: true })
    let counts = await annotationCounts('n1')
    expect(counts.c1).toBe(1)
    expect(counts.c2).toBe(1)

    await deleteAnnotation(a1.id)
    expect(await listAnnotations('n1', 'c1')).toHaveLength(1)
  })
})
