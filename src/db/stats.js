import { getDB } from './db'

// Daily word totals, keyed by `${novelId}:${YYYY-MM-DD}`.
export function todayKey(novelId, date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${novelId}:${y}-${m}-${d}`
}

export async function todayWords(novelId) {
  const db = await getDB()
  const row = await db.get('stats', todayKey(novelId))
  return row ? row.words : 0
}

export async function addTodayWords(novelId, delta) {
  if (!delta || delta <= 0) return
  const db = await getDB()
  const key = todayKey(novelId)
  const row = await db.get('stats', key)
  await db.put('stats', { id: key, novelId, date: key.split(':')[1], words: (row ? row.words : 0) + delta })
}

export async function dailyHistory(novelId, days = 30) {
  const db = await getDB()
  const all = await db.getAllFromIndex('stats', 'by-novel', novelId)
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const map = {}
  for (const r of all) {
    if (r.kind === 'session') continue
    if (r.date >= toISODate(cutoff)) map[r.date] = r.words
  }
  // fill every day so charts can be continuous
  const out = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const iso = toISODate(d)
    out.push({ date: iso, words: map[iso] || 0 })
  }
  return out
}

export async function monthlyHistory(novelId, months = 12) {
  const db = await getDB()
  const all = await db.getAllFromIndex('stats', 'by-novel', novelId)
  const wordsByDate = {}
  for (const r of all) {
    if (r.kind === 'session') continue
    wordsByDate[r.date] = (wordsByDate[r.date] || 0) + (r.words || 0)
  }
  const now = new Date()
  const out = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    let total = 0
    const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    for (let day = 1; day <= daysInMonth; day++) {
      total += wordsByDate[`${ym}-${String(day).padStart(2, '0')}`] || 0
    }
    out.push({
      label: d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
      words: total
    })
  }
  return out
}

// ---- writing sessions (per-device, deliberately not synced) ----
// Stored in the stats store with kind: 'session' so daily/monthly rollups
// ignore them. Used only to estimate pace (words per minute).
export async function recordSession(novelId, startedAt, endAt, words) {
  if (!words || words <= 0) return null
  const db = await getDB()
  const minutes = (endAt - startedAt) / 60000
  const row = {
    id: `session:${novelId}:${startedAt}`,
    novelId,
    kind: 'session',
    date: toISODate(new Date(startedAt)),
    startedAt,
    endAt,
    minutes,
    words
  }
  await db.put('stats', row)
  return row
}

export async function todaySessionStats(novelId, now = new Date()) {
  const db = await getDB()
  const all = await db.getAllFromIndex('stats', 'by-novel', novelId)
  const today = toISODate(now)
  let words = 0
  let minutes = 0
  for (const r of all) {
    if (r.kind !== 'session' || r.date !== today) continue
    words += r.words || 0
    minutes += r.minutes || 0
  }
  return { words, minutes }
}

function toISODate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
