import { getDB, uid, putRecord, removeRecord } from './db'
import { trashRecord } from './trash'

export async function listNotes(novelId) {
  const db = await getDB()
  const all = await db.getAllFromIndex('notes', 'by-novel', novelId)
  return all.filter((n) => !n.trashedAt).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
}

export async function createNote(novelId, data) {
  const now = Date.now()
  const note = {
    id: uid(),
    novelId,
    title: data.title || 'Untitled note',
    content: data.content || '',
    link: data.link || null, // { type: 'chapter' | 'character', id }
    createdAt: now,
    updatedAt: now
  }
  return putRecord('notes', note)
}

export async function updateNote(id, patch) {
  const db = await getDB()
  const note = await db.get('notes', id)
  if (!note) return null
  const next = { ...note, ...patch, id: note.id, updatedAt: Date.now() }
  return putRecord('notes', next)
}

export async function deleteNote(id) {
  const db = await getDB()
  const n = await db.get('notes', id)
  await db.delete('notes', id)
  await removeRecord('notes', id, n?.novelId)
}

export async function trashNote(id) {
  return trashRecord('notes', id)
}
