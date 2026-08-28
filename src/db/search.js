import { getDB } from './db'
import { listMoodboard } from './moodboard'

// Offline, structure-aware search across every novel. Grouped results feed
// the command palette (Ctrl+K). A simple lowercase substring match over the
// meaningful fields of each record — plenty fast at this scale; the
// long-manuscript phase adds a proper inverted index.
export async function searchAll(query) {
  const q = (query || '').trim().toLowerCase()
  const empty = { novels: [], chapters: [], characters: [], notes: [], world: [], relationships: [], glossary: [], media: [] }
  if (!q) return empty

  const db = await getDB()
  const novels = await db.getAll('novels')
  const novelTitle = new Map(novels.map((n) => [n.id, n.title || 'Untitled']))

  const matches = (text) => (text || '').toLowerCase().includes(q)
  const rank = (title) => {
    const t = (title || '').toLowerCase()
    if (t === q) return 100
    if (t.startsWith(q)) return 60
    if (t.includes(q)) return 30
    return 0
  }
  const sortTop = (arr) => arr.sort((a, b) => b.score - a.score).slice(0, 8)

  const novelResults = novels
    .filter((n) => matches(`${n.title} ${n.blurb || ''}`))
    .map((n) => ({ id: n.id, title: n.title, subtitle: n.blurb || '', score: rank(n.title) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  const chapters = []
  for (const c of await db.getAllFromIndex('chapters', 'by-novel')) {
    if (c.trashedAt) continue
    const title = c.title || 'Untitled chapter'
    const body = (c.content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    if (matches(title) || matches(body)) {
      const source = matches(title) ? title : body
      const at = source.toLowerCase().indexOf(q)
      const start = Math.max(0, at - 70)
      const snippet = source.slice(start, start + 180)
      chapters.push({ id: c.id, novelId: c.novelId, title, subtitle: novelTitle.get(c.novelId) || '', preview: `${start ? '…' : ''}${snippet}${start + 180 < source.length ? '…' : ''}`, match: q, score: rank(title) + (matches(title) ? 10 : 0) })
    }
  }

  const characters = []
  for (const c of await db.getAllFromIndex('characters', 'by-novel')) {
    if (c.trashedAt) continue
    const name = c.name || 'A character'
    if (matches(name) || matches(c.role) || matches(c.appearance) || matches(c.personality) || matches(c.notes)) {
      characters.push({ id: c.id, novelId: c.novelId, title: name, subtitle: c.role || novelTitle.get(c.novelId) || '', score: rank(name) })
    }
  }

  const notes = []
  for (const n of await db.getAllFromIndex('notes', 'by-novel')) {
    if (n.trashedAt) continue
    const title = n.title || 'Untitled note'
    if (matches(title) || matches(n.content)) {
      notes.push({ id: n.id, novelId: n.novelId, title, subtitle: novelTitle.get(n.novelId) || '', score: rank(title) })
    }
  }

  const world = []
  for (const w of await db.getAllFromIndex('world', 'by-novel')) {
    if (w.trashedAt) continue
    const name = w.name || 'Untitled'
    if (matches(name) || matches(w.summary) || matches(w.details) || matches((w.tags || []).join(' '))) {
      world.push({ id: w.id, novelId: w.novelId, title: name, subtitle: w.kind || novelTitle.get(w.novelId) || '', score: rank(name) })
    }
  }

  const relationships = []
  for (const r of await db.getAllFromIndex('relationships', 'by-novel')) {
    const names = [r.a, r.b].filter(Boolean).join(' & ')
    if (matches(names) || matches(r.description)) {
      relationships.push({ id: r.id, novelId: r.novelId, title: names || 'A relationship', subtitle: r.description || novelTitle.get(r.novelId) || '', score: rank(names) })
    }
  }

  const glossary = []
  for (const t of await db.getAllFromIndex('glossary', 'by-novel')) {
    if (t.trashedAt) continue
    const term = t.term || 'Untitled term'
    if (matches(term) || matches(t.definition) || matches((t.aliases || []).join(' '))) {
      glossary.push({ id: t.id, novelId: t.novelId, title: term, subtitle: t.definition || novelTitle.get(t.novelId) || '', score: rank(term) })
    }
  }

  const media = []
  for (const novel of novels) {
    for (const item of (await listMoodboard(novel.id)).filter((tile) => tile.kind === 'image' && tile.image)) {
      const title = item.text || 'Untitled image'
      if (matches(`${title} ${novel.title}`)) media.push({ id: item.id, novelId: novel.id, title, subtitle: novel.title, score: rank(title) })
    }
  }

  return {
    novels: novelResults,
    chapters: sortTop(chapters),
    characters: sortTop(characters),
    notes: sortTop(notes),
    world: sortTop(world),
    relationships: sortTop(relationships),
    glossary: sortTop(glossary),
    media: sortTop(media)
  }
}
