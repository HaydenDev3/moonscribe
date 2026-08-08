// Pure, testable analytics helpers: GitHub-style heatmap layout, monthly
// rollups and words-per-minute. No DOM, no IndexedDB.

export function wordsPerMinute(words, ms) {
  const min = ms / 60000
  if (!Number.isFinite(min) || min <= 0) return 0
  return Math.round(words / min)
}

export function activityLevel(words) {
  if (!words || words <= 0) return 0
  if (words < 100) return 1
  if (words < 300) return 2
  if (words < 700) return 3
  return 4
}

// Turn a chronological list of { date: 'YYYY-MM-DD', words } into weeks
// (Sunday-first columns) so the final column ends on `end`.
export function heatmapCells(history, end = new Date()) {
  const cells = history.map((h) => ({ date: h.date, words: h.words, level: activityLevel(h.words) }))
  if (!cells.length) return []
  const first = new Date(`${cells[0].date}T12:00:00`)
  const pad = first.getDay()
  const padded = [...Array(pad).fill(null), ...cells]
  const weeks = []
  for (let i = 0; i < padded.length; i += 7) {
    const week = padded.slice(i, i + 7)
    while (week.length < 7) week.push(null)
    weeks.push(week)
  }
  return weeks
}

// Group { date, words } rows into labelled month buckets (newest last).
export function monthlyBuckets(rows) {
  const buckets = new Map()
  for (const r of rows) {
    const key = r.date.slice(0, 7)
    if (!buckets.has(key)) {
      const d = new Date(`${key}-01T12:00:00`)
      buckets.set(key, {
        key,
        label: d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
        words: 0
      })
    }
    buckets.get(key).words += r.words || 0
  }
  return [...buckets.values()]
}
