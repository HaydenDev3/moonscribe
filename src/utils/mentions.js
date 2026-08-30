// Auto chapter tracking: which chapters mention which character. Uses the same
// word-boundary regex as the name highlighter, so the count always matches what
// the reader would see underlined.
import { buildNameRegex } from './highlight'

export function mentionsInHtml(html, names) {
  if (!html) return []
  const doc = new DOMParser().parseFromString(String(html), 'text/html')
  const text = doc.body.textContent || ''
  const found = []
  for (const name of names) {
    if (name && text.match(buildNameRegex(name))) found.push(name)
  }
  return found
}

// Build a { characterId: chapterId[] } map of auto-detected appearances,
// merged with any chapters the author pinned by hand.
export function autoChapterMentions(chapters, characters) {
  const map = {}
  const idByName = {}
  const firstNames = new Map()
  for (const c of characters || []) {
    if (!c.id) continue
    map[c.id] = new Set(c.chapterIds || [])
    if (c.name && c.name.trim()) {
      const full = c.name.trim()
      idByName[full] = c.id
      for (const alias of (c.aliases || [])) {
        const value = String(alias || '').trim()
        if (value) idByName[value] = c.id
      }
      const first = full.split(/\s+/)[0]
      if (first.length > 1 && first !== full) firstNames.set(first, (firstNames.get(first) || []).concat(c.id))
    }
  }
  for (const [first, ids] of firstNames) {
    // Ambiguous first names are deliberately left unassigned.
    if (ids.length === 1) idByName[first] = ids[0]
  }
  const names = Object.keys(idByName).sort((a, b) => b.length - a.length)
  for (const ch of chapters || []) {
    for (const name of mentionsInHtml(ch.content || '', names)) {
      const id = idByName[name]
      if (id && !map[id].has(ch.id)) map[id].add(ch.id)
    }
  }
  const out = {}
  for (const [id, set] of Object.entries(map)) out[id] = [...set]
  return out
}
