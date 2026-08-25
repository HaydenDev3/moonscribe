import { getDB, uid, putRecord, removeRecord } from './db'
import { trashRecord } from './trash'

export async function listProjectFiles(novelId) {
  const db = await getDB()
  return (await db.getAllFromIndex('projectFiles', 'by-novel', novelId)).filter((file) => !file.trashedAt).sort((a, b) => String(a.name).localeCompare(String(b.name)))
}

export async function createProjectFile(novelId, data = {}) {
  const now = Date.now()
  return putRecord('projectFiles', { id: uid(), novelId, name: data.name || 'Untitled file', folderId: data.folderId || null, mimeType: data.mimeType || 'application/octet-stream', size: data.size || 0, sourceKind: data.sourceKind === 'reference' ? 'reference' : 'imported', content: data.content || null, sourcePath: data.sourcePath || '', sourceUrl: data.sourceUrl || '', createdAt: now, updatedAt: now })
}
export async function updateProjectFile(id, patch) { const db = await getDB(); const current = await db.get('projectFiles', id); return current ? putRecord('projectFiles', { ...current, ...patch, id, updatedAt: Date.now() }) : null }
export async function trashProjectFile(id) { return trashRecord('projectFiles', id) }
export async function deleteProjectFile(id) { const db = await getDB(); const file = await db.get('projectFiles', id); if (file) await removeRecord('projectFiles', id, file.novelId) }
