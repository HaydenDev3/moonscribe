import { getDB, uid, putRecord, removeRecord } from './db'

export async function listRelationships(novelId) {
  const db = await getDB()
  const all = await db.getAllFromIndex('relationships', 'by-novel', novelId)
  return all.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
}

export async function createRelationship(novelId, data) {
  const now = Date.now()
  const rel = {
    id: uid(),
    novelId,
    a: data.a || '',
    b: data.b || '',
    description: data.description || '',
    stages: Array.isArray(data.stages) ? data.stages.map((s) => ({ label: s.label || '', note: s.note || '' })) : [],
    createdAt: now,
    updatedAt: now
  }
  return putRecord('relationships', rel)
}

export async function updateRelationship(id, patch) {
  const db = await getDB()
  const rel = await db.get('relationships', id)
  if (!rel) return null
  const next = { ...rel, ...patch, id: rel.id, updatedAt: Date.now() }
  return putRecord('relationships', next)
}

export async function deleteRelationship(id) {
  const db = await getDB()
  const r = await db.get('relationships', id)
  await db.delete('relationships', id)
  await removeRecord('relationships', id, r?.novelId)
}
