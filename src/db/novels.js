import { getDB, uid, putRecord, removeRecord } from './db'

export async function listNovels() {
  const db = await getDB()
  const novels = await db.getAll('novels')
  return novels.sort((a, b) => (b.lastOpened || b.createdAt || 0) - (a.lastOpened || a.createdAt || 0))
}

export async function getNovel(id) {
  const db = await getDB()
  return db.get('novels', id)
}

export async function createNovel({ title, blurb = '', cover = null, coverStyle = 'moonstone', genres = [] }) {
  const now = Date.now()
  const novel = {
    id: uid(),
    title: title || 'A novel without a name yet',
    blurb,
    cover,
    coverStyle,
    genres: Array.isArray(genres) ? genres : [],
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
