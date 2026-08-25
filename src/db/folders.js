import { getDB, uid, putRecord, removeRecord } from './db'

const MIGRATION_KEY = 'folders:migration:v1'
const migrationLocks = new Map()

function siblingOrder(rows, parentId) {
  const siblings = rows.filter((row) => (row.parentId || null) === (parentId || null))
  return siblings.length ? Math.max(...siblings.map((row) => Number(row.order) || 0)) + 1 : 1
}

export async function migrateFolders(novelId = null) {
  if (!novelId) return
  if (migrationLocks.has(novelId)) return migrationLocks.get(novelId)
  const task = migrateFoldersOnce(novelId).finally(() => migrationLocks.delete(novelId))
  migrationLocks.set(novelId, task)
  return task
}

async function migrateFoldersOnce(novelId) {
  const db = await getDB()
  const existing = await db.getAllFromIndex('folders', 'by-novel', novelId) || []
  const byLegacyId = new Map()
  for (const folder of existing) {
    if (!folder.legacyChapterId) continue
    // These records were an intermediate migration experiment. The legacy
    // outline remains authoritative until the complete folder tree UI is in
    // place, so remove the non-interactive placeholders instead of exposing
    // ghost folders in the sidebar.
    await db.delete('folders', folder.id)
  }
  // Do not manufacture folder records from chapter outline records. A Part,
  // Book, or Act remains an outline node, never a ghost organizational folder.
  await db.put('meta', { key: `${MIGRATION_KEY}:${novelId}`, value: 1, updatedAt: Date.now() })
}

export async function listFolders(novelId) {
  await migrateFolders(novelId)
  const db = await getDB()
  return (await db.getAllFromIndex('folders', 'by-novel', novelId)).sort((a, b) => (a.order || 0) - (b.order || 0))
}

export async function createFolder(novelId, { name = 'New folder', parentId = null, color = null, icon = null, order = null } = {}) {
  const rows = await listFolders(novelId)
  const now = Date.now()
  return putRecord('folders', { id: uid(), novelId, parentId: parentId || null, name: name.trim() || 'New folder', order: order ?? siblingOrder(rows, parentId), color, icon, isExpanded: true, createdAt: now, updatedAt: now })
}

export async function updateFolder(id, patch) {
  const db = await getDB()
  const current = await db.get('folders', id)
  if (!current) return null
  return putRecord('folders', { ...current, ...patch, id, updatedAt: Date.now() })
}

export async function moveFolder(id, parentId = null, index = null) {
  const db = await getDB()
  const all = await db.getAll('folders')
  const target = all.find((folder) => folder.id === id)
  if (!target || parentId === id) return all
  const descendants = new Set()
  let changed = true
  while (changed) {
    changed = false
    for (const folder of all) if (folder.parentId && (folder.parentId === id || descendants.has(folder.parentId)) && !descendants.has(folder.id)) { descendants.add(folder.id); changed = true }
  }
  if (parentId && descendants.has(parentId)) return all
  const siblings = all.filter((folder) => folder.novelId === target.novelId && (folder.parentId || null) === (parentId || null) && folder.id !== id).sort((a, b) => (a.order || 0) - (b.order || 0))
  const position = index == null ? siblings.length : Math.max(0, Math.min(index, siblings.length))
  siblings.splice(position, 0, { ...target, parentId: parentId || null })
  await Promise.all(siblings.map((folder, order) => putRecord('folders', { ...folder, order, updatedAt: Date.now() })))
  return listFolders(target.novelId)
}

export async function deleteFolder(id) {
  const db = await getDB()
  const folder = await db.get('folders', id)
  if (!folder) return null
  const children = (await db.getAllFromIndex('folders', 'by-novel', folder.novelId)).filter((child) => child.parentId === id)
  await Promise.all(children.map((child) => updateFolder(child.id, { parentId: folder.parentId || null })))
  return removeRecord('folders', id, folder.novelId)
}
