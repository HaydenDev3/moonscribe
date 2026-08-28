import { getDB, uid } from './db'

const SESSION_TTL = 24 * 60 * 60 * 1000 // keep 24 hours of snapshots

export async function saveRecoveryDraft(chapterId, novelId, content, wordCount) {
  const db = await getDB()
  const id = `recovery:${chapterId}`
  await db.put('snapshots', { id, chapterId, novelId, content, wordCount, ts: Date.now(), recovery: true })
  return id
}

export async function getRecoveryDraft(chapterId) {
  const db = await getDB()
  const draft = await db.get('snapshots', `recovery:${chapterId}`)
  return draft?.recovery ? draft : null
}

export async function clearRecoveryDraft(chapterId) {
  const db = await getDB()
  await db.delete('snapshots', `recovery:${chapterId}`)
}

export async function saveSnapshot(chapterId, novelId, content, wordCount) {
  const db = await getDB()
  await db.add('snapshots', { id: uid(), chapterId, novelId, content, wordCount, ts: Date.now() })
}

export async function getSnapshots(chapterId, since = 0) {
  const db = await getDB()
  const all = await db.getAllFromIndex('snapshots', 'by-chapter', chapterId)
  return all.filter((s) => s.ts >= since).sort((a, b) => a.ts - b.ts)
}

// Lightweight replay timeline. Large chapters can have thousands of full HTML
// snapshots; keeping every body in React multiplies memory usage needlessly.
export async function getSnapshotTimeline(chapterId, since = 0) {
  const db = await getDB()
  const rows = []
  let cursor = await db.transaction('snapshots').objectStore('snapshots').index('by-chapter').openCursor(chapterId)
  while (cursor) {
    const value = cursor.value
    if (value.ts >= since) rows.push({ id: value.id, chapterId: value.chapterId, novelId: value.novelId, wordCount: value.wordCount, ts: value.ts })
    cursor = await cursor.continue()
  }
  return rows.sort((a, b) => a.ts - b.ts)
}

export async function getSnapshot(id) {
  const db = await getDB()
  return db.get('snapshots', id)
}

export async function clearOldSnapshots(beforeTs = Date.now() - SESSION_TTL) {
  const db = await getDB()
  const tx = db.transaction('snapshots', 'readwrite')
  const store = tx.objectStore('snapshots')
  let cursor = await store.openCursor()
  while (cursor) {
    if (cursor.value.ts < beforeTs) await cursor.delete()
    cursor = await cursor.continue()
  }
  await tx.done
}
