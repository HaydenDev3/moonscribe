import { getDB, putRecord, removeRecord, uid } from './db'
import { listChapters, updateChapter } from './chapters'

export async function listBranches(novelId) {
  const db = await getDB()
  const rows = await db.getAllFromIndex('branches', 'by-novel', novelId)
  return rows.sort((a, b) => b.createdAt - a.createdAt)
}

export async function createBranch(novelId, name, { description = '', sourceBranchId = null } = {}) {
  const chapters = await listChapters(novelId)
  const now = Date.now()
  return putRecord('branches', {
    id: uid(), novelId, name: String(name || 'Untitled branch').trim(), description,
    sourceBranchId, createdAt: now, updatedAt: now,
    chapters: chapters.map(({ id, title, content, kind, parentId, part, order, status, meta, wordCount }) => ({ id, title, content, kind, parentId, part, order, status, meta, wordCount }))
  })
}

export async function restoreBranch(branchId) {
  const db = await getDB()
  const branch = await db.get('branches', branchId)
  if (!branch) throw new Error('That manuscript branch no longer exists.')
  const current = await listChapters(branch.novelId)
  const snapshotById = new Map((branch.chapters || []).map((chapter) => [chapter.id, chapter]))
  await Promise.all(current.filter((chapter) => snapshotById.has(chapter.id)).map((chapter) => {
    const saved = snapshotById.get(chapter.id)
    return updateChapter(chapter.id, { ...saved, id: chapter.id, novelId: branch.novelId, updatedAt: Date.now() })
  }))
  return branch
}

export async function deleteBranch(branchId) {
  const db = await getDB()
  const branch = await db.get('branches', branchId)
  return removeRecord('branches', branchId, branch?.novelId)
}
