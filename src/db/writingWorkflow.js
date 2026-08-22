import { getDB, putRecord, removeRecord, uid } from './db'

const stores = {
  research: 'research',
  threads: 'storyThreads',
  checklists: 'sceneChecklists',
  packages: 'betaPackages',
}

async function list(store, novelId) {
  const db = await getDB()
  return (await db.getAllFromIndex(store, 'by-novel', novelId)).filter((row) => !row.deleted)
}

export const listResearch = (novelId) => list(stores.research, novelId)
export const listStoryThreads = (novelId) => list(stores.threads, novelId)
export const listSceneChecklists = (novelId) => list(stores.checklists, novelId)
export const listBetaPackages = (novelId) => list(stores.packages, novelId)

export async function saveResearch(novelId, item) {
  return putRecord(stores.research, { id: item.id || uid(), novelId, type: item.type || 'note', title: item.title || 'Untitled research', source: item.source || '', notes: item.notes || '', tags: item.tags || [], chapterId: item.chapterId || null, sceneId: item.sceneId || null, createdAt: item.createdAt || Date.now(), updatedAt: Date.now(), ...item })
}
export async function saveStoryThread(novelId, thread) {
  return putRecord(stores.threads, { id: thread.id || uid(), novelId, title: thread.title || 'Untitled thread', status: thread.status || 'setup', points: thread.points || [], notes: thread.notes || '', createdAt: thread.createdAt || Date.now(), updatedAt: Date.now(), ...thread })
}
export async function saveSceneChecklist(novelId, checklist) {
  return putRecord(stores.checklists, { id: checklist.id || uid(), novelId, chapterId: checklist.chapterId, enabled: checklist.enabled !== false, items: checklist.items || [], completed: checklist.completed || false, updatedAt: Date.now(), ...checklist })
}
export async function saveBetaPackage(novelId, pack) {
  return putRecord(stores.packages, { id: pack.id || uid(), novelId, name: pack.name || 'Beta draft', version: pack.version || 'Draft', chapterIds: pack.chapterIds || [], questions: pack.questions || [], watermark: pack.watermark || null, format: pack.format || 'pdf', createdAt: pack.createdAt || Date.now(), updatedAt: Date.now(), ...pack })
}
export async function deleteWorkflowRecord(store, id, novelId) { return removeRecord(store, id, novelId) }
