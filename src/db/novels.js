import { getDB, uid, putRecord, removeRecord } from './db'

export async function listNovels() {
  const db = await getDB()
  const novels = await db.getAll('novels')
  // Backup v2 encoded Blob covers as `{}`. Repair those legacy records while
  // keeping the manuscript itself intact and eligible for sync.
  for (let i = 0; i < novels.length; i++) {
    const novel = novels[i]
    const validBlob = typeof Blob !== 'undefined' && novel.cover instanceof Blob
    const validString = typeof novel.cover === 'string' && /^(data:|blob:|https?:\/\/)/i.test(novel.cover)
    if (novel.cover != null && !validBlob && !validString) {
      novels[i] = { ...novel, cover: null, pendingSync: true }
      await db.put('novels', novels[i])
    }
  }
  return novels.sort((a, b) => (b.lastOpened || b.createdAt || 0) - (a.lastOpened || a.createdAt || 0))
}

export async function getNovel(id) {
  const db = await getDB()
  return db.get('novels', id)
}

export async function createNovel({ title, blurb = '', cover = null, coverStyle = 'moonstone', genres = [], series = null }) {
  const now = Date.now()
  const novel = {
    id: uid(),
    title: title || 'A novel without a name yet',
    blurb,
    cover,
    coverStyle,
    genres: Array.isArray(genres) ? genres : [],
    series: series || null,
    milestones: [],
    createdAt: now,
    updatedAt: now,
    lastOpened: now,
    goalWords: 500,
    layout: defaultLayout()
  }
  return putRecord('novels', novel)
}

export async function updateNovel(id, patch, { sync = true } = {}) {
  const db = await getDB()
  const novel = await db.get('novels', id)
  if (!novel) return null
  const next = { ...novel, ...patch, id: novel.id }
  return putRecord('novels', next, { sync })
}

export async function touchNovel(id) {
  return updateNovel(id, { lastOpened: Date.now() }, { sync: false })
}

export async function archiveNovel(id) {
  return updateNovel(id, { archived: true })
}

export async function unarchiveNovel(id) {
  const db = await getDB()
  const novel = await db.get('novels', id)
  if (!novel) return null
  const next = { ...novel, id: novel.id }
  delete next.archived
  return putRecord('novels', next)
}

export async function deleteNovel(id) {
  const db = await getDB()
  const novel = await db.get('novels', id)
  const tx = db.transaction(['novels', 'chapters', 'characters', 'notes', 'relationships', 'stats', 'world', 'moodboard'], 'readwrite')
  const childIds = []
  await tx.objectStore('novels').delete(id)
  for (const store of ['chapters', 'characters', 'notes', 'relationships', 'stats', 'world', 'moodboard']) {
    let cursor = await tx.objectStore(store).index('by-novel').openCursor(id)
    while (cursor) {
      childIds.push({ store, id: cursor.primaryKey })
      await cursor.delete()
      cursor = await cursor.continue()
    }
  }
  await tx.done
  const now = Date.now()
  const tombstones = db.transaction('tombstones', 'readwrite')
  for (const { store, id: cid } of childIds) {
    await tombstones.objectStore('tombstones').put({
      id: `${store}:${cid}`,
      store,
      novelId: id,
      deletedAt: now,
      rev: 1,
      pendingSync: true
    })
  }
  await tombstones.done
  await removeRecord('novels', id, id)
}

export async function duplicateNovelStructure(sourceId) {
  const db = await getDB()
  const source = await db.get('novels', sourceId)
  if (!source) return null
  const { listChapters } = await import('./chapters')
  const now = Date.now()
  const newNovel = {
    ...source,
    id: uid(),
    title: `Copy of ${source.title || 'Untitled'}`,
    createdAt: now,
    updatedAt: now,
    lastOpened: now,
    collection: null,
    pinned: false,
    archived: false,
    lock: null,
    cover: null
  }
  await putRecord('novels', newNovel)
  const chapters = await listChapters(sourceId)
  for (const ch of chapters) {
    await putRecord('chapters', {
      ...ch,
      id: uid(),
      novelId: newNovel.id,
      content: '',
      wordCount: 0,
      versions: [],
      createdAt: now,
      updatedAt: now
    })
  }
  return newNovel
}

export function defaultLayout() {
  return {
    bodyFont: 'literata',
    bodySize: 11.5,
    dropCap: false,
    sceneBreak: '❦',
    titleStyle: 'centered', // centered | ornament
    chapterStyle: 'centered', // centered | left
    pageSize: 'trade-paperback', // PAGE_PRESETS key or { w, h } in mm
    pageMargin: 20, // mm
    bleed: 3 // mm
  }
}
