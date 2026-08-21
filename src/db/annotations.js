import { getDB, uid, putRecord, removeRecord } from './db'

// Private revision comments anchored to a chapter. Each annotation keeps the
// quoted passage it refers to plus the author's note. They live in their own
// store, so they never travel into an export. Types let the author filter by
// concern (plot / style / continuity / a plain note).

export const ANNOTATION_TYPES = [
  ['note', 'Note'],
  ['plot', 'Plot'],
  ['style', 'Style'],
  ['continuity', 'Continuity']
]

export async function listAnnotations(novelId, chapterId = null) {
  const db = await getDB()
  const all = await db.getAllFromIndex('annotations', 'by-novel', novelId)
  return all
    .filter((a) => (chapterId ? a.chapterId === chapterId : true))
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
}

export async function createAnnotation(novelId, { chapterId, quote = '', comment = '', type = 'note' } = {}) {
  const now = Date.now()
  const annotation = {
    id: uid(),
    novelId,
    chapterId: chapterId || null,
    quote: (quote || '').slice(0, 400),
    comment: comment || '',
    type: ANNOTATION_TYPES.some(([k]) => k === type) ? type : 'note',
    resolved: false,
    createdAt: now,
    updatedAt: now
  }
  return putRecord('annotations', annotation)
}

export async function updateAnnotation(id, patch) {
  const db = await getDB()
  const a = await db.get('annotations', id)
  if (!a) return null
  const next = { ...a, ...patch, id: a.id, updatedAt: Date.now() }
  return putRecord('annotations', next)
}

export async function deleteAnnotation(id) {
  const db = await getDB()
  const a = await db.get('annotations', id)
  await db.delete('annotations', id)
  await removeRecord('annotations', id, a?.novelId)
}

// Count of open (unresolved) annotations per chapter, for margin/footer badges.
export async function annotationCounts(novelId) {
  const db = await getDB()
  const all = await db.getAllFromIndex('annotations', 'by-novel', novelId)
  const map = {}
  for (const a of all) {
    if (a.resolved) continue
    map[a.chapterId] = (map[a.chapterId] || 0) + 1
  }
  return map
}
