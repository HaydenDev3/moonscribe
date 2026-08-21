import { getDB, uid, putRecord, removeRecord } from './db'
import { trashRecord } from './trash'

// A living dictionary of invented words, place names, and special terms.
// Terms are matched (whole-word) in the read view and surface a definition
// card on hover. Each term can carry alternate spellings (aliases).

export async function listGlossary(novelId) {
  const db = await getDB()
  const all = await db.getAllFromIndex('glossary', 'by-novel', novelId)
  return all
    .filter((t) => !t.trashedAt)
    .sort((a, b) => (a.term || '').localeCompare(b.term || '', undefined, { sensitivity: 'base' }))
}

export async function createTerm(novelId, data = {}) {
  const now = Date.now()
  const term = {
    id: uid(),
    novelId,
    term: (data.term || '').trim(),
    definition: data.definition || '',
    category: data.category || 'term', // term | place | name | faction | item | other
    aliases: Array.isArray(data.aliases) ? data.aliases : [],
    pronunciation: data.pronunciation || '',
    createdAt: now,
    updatedAt: now
  }
  return putRecord('glossary', term)
}

export async function updateTerm(id, patch) {
  const db = await getDB()
  const term = await db.get('glossary', id)
  if (!term) return null
  const next = { ...term, ...patch, id: term.id, updatedAt: Date.now() }
  return putRecord('glossary', next)
}

export async function deleteTerm(id) {
  const db = await getDB()
  const t = await db.get('glossary', id)
  await db.delete('glossary', id)
  await removeRecord('glossary', id, t?.novelId)
}

export async function trashTerm(id) {
  return trashRecord('glossary', id)
}

// Every spelling that should resolve to a given term: the term itself plus
// any aliases, de-duplicated and trimmed.
export function spellingsOf(term) {
  const all = [term.term, ...(term.aliases || [])]
  return all.map((s) => (s || '').trim()).filter(Boolean)
}
