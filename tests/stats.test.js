import { describe, it, expect } from 'vitest'
import { wordsPerMinute, activityLevel, heatmapCells, monthlyBuckets } from '../src/utils/stats'

describe('wordsPerMinute', () => {
  it('computes rounded wpm', () => {
    expect(wordsPerMinute(150, 60000)).toBe(150)
    expect(wordsPerMinute(120, 120000)).toBe(60)
  })
  it('guards against zero elapsed time', () => {
    expect(wordsPerMinute(50, 0)).toBe(0)
  })
})

describe('activityLevel', () => {
  it('buckets activity into 5 levels', () => {
    expect(activityLevel(0)).toBe(0)
    expect(activityLevel(50)).toBe(1)
    expect(activityLevel(250)).toBe(2)
    expect(activityLevel(600)).toBe(3)
    expect(activityLevel(1000)).toBe(4)
  })
})

describe('heatmapCells', () => {
  const days = (n) =>
    Array.from({ length: n }, (_, i) => {
      const d = new Date(2026, 5, 1 + i)
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      return { date: `2026-${m}-${dd}`, words: i % 2 ? 0 : 200 }
    })

  it('aligns the final column to a Sunday-…-Saturday week', () => {
    const cells = days(30)
    const weeks = heatmapCells(cells, new Date(2026, 5, 30))
    const lastCol = weeks[weeks.length - 1]
    expect(lastCol.filter(Boolean).length).toBe(3) // Jun 28–30 2026 (Sun–Tue)
    expect(weeks.every((w) => w.length === 7)).toBe(true)
    expect(weeks[0].slice(0, weeks[0].filter(Boolean).length - 1).includes(null)).toBe(true)
  })
})

describe('monthlyBuckets', () => {
  it('groups and sums rows by month', () => {
    const rows = [
      { date: '2026-01-05', words: 10 },
      { date: '2026-01-20', words: 20 },
      { date: '2026-02-01', words: 5 }
    ]
    const buckets = monthlyBuckets(rows)
    expect(buckets).toHaveLength(2)
    expect(buckets[0].words).toBe(30)
    expect(buckets[1].words).toBe(5)
  })
})
