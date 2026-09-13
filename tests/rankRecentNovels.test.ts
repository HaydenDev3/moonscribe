import { describe, expect, it } from 'vitest'
import { rankRecentNovels } from '../src/dashboard/utils/rankRecentNovels'

describe('rankRecentNovels', () => {
  it('uses the latest chapter edit as the primary activity signal', () => {
    const novels = [{ id: 'a', title: 'A', updatedAt: 500, lastOpened: 400 }, { id: 'b', title: 'B', updatedAt: 900, lastOpened: 900 }]
    const chapters = [{ id: 'chapter-a', novelId: 'a', title: 'New scene', updatedAt: 2_000 }]
    expect(rankRecentNovels(novels, chapters)[0]).toMatchObject({ novel: novels[0], activityAt: 2_000, activityKind: 'chapter' })
  })

  it('falls back from novel activity to last opened time', () => {
    const now = new Date('2026-09-13T10:00:00').getTime()
    const novels = [{ id: 'a', title: 'A', updatedAt: 500, lastOpened: 0 }, { id: 'b', title: 'B', updatedAt: 0, lastOpened: 400 }]
    expect(rankRecentNovels(novels, [], now).map((item) => item.activityKind)).toEqual(['novel', 'opened'])
    expect(rankRecentNovels([{ id: 'a', updatedAt: 0, lastOpened: now }], [], now)[0].timeOfDayMatch).toBe(true)
  })

  it('excludes archived novels and preserves input order for exact ties', () => {
    const novels = [{ id: 'a', title: 'A', updatedAt: 100 }, { id: 'archived', archived: true, updatedAt: 9_999 }, { id: 'b', title: 'B', updatedAt: 100 }]
    expect(rankRecentNovels(novels, [], 1_000).map((item) => item.novel.id)).toEqual(['a', 'b'])
  })
})
