import { getDB, putRecord, uid } from './db'

// Collaboration records are deliberately separate from manuscript content so
// a shared reader can sync progress and feedback without receiving the story
// bible or gaining a write path to chapters.
export async function listFactProvenance(novelId, factKey = null) {
  const db = await getDB()
  const rows = await db.getAllFromIndex('factProvenance', 'by-novel', novelId)
  return factKey ? rows.filter((row) => row.factKey === factKey) : rows
}

export async function saveFactProvenance(novelId, fact) {
  const value = {
    novelId,
    factKey: String(fact.factKey || fact.key || '').trim(),
    factType: String(fact.factType || '').trim(),
    normalizedValue: String(fact.normalizedValue ?? fact.value ?? '').trim().toLowerCase(),
    sourceChapterId: fact.sourceChapterId || fact.chapterId || null,
    sourceSceneId: fact.sourceSceneId || fact.sceneId || null,
    introducingUserId: fact.introducingUserId || fact.userId || null,
    introducedAt: fact.introducedAt || Date.now(),
    sourceRevision: fact.sourceRevision ?? null,
  }
  if (!value.factKey || !value.factType || !value.normalizedValue) throw new Error('A fact key, type, and value are required.')
  value.id = fact.id || `${novelId}:${value.factKey}:${value.factType}:${value.normalizedValue}:${value.sourceChapterId || 'unknown'}`
  return putRecord('factProvenance', { ...value, updatedAt: fact.updatedAt || Date.now() })
}

export async function listContinuityConflicts(novelId, { status } = {}) {
  const db = await getDB()
  const rows = await db.getAllFromIndex('continuityConflicts', 'by-novel', novelId)
  return status ? rows.filter((row) => row.status === status) : rows
}

export async function saveContinuityConflict(novelId, conflict) {
  const now = Date.now()
  const established = conflict.establishedValue || ''
  const introduced = conflict.introducedValue || ''
  const identity = conflict.identity || [novelId, conflict.factKey, established, introduced, conflict.establishedChapterId, conflict.introducedChapterId].join(':')
  const existing = (await listContinuityConflicts(novelId)).find((row) => row.identity === identity)
  return putRecord('continuityConflicts', {
    ...conflict,
    id: existing?.id || conflict.id || uid(),
    identity,
    novelId,
    establishedValue: established,
    introducedValue: introduced,
    status: conflict.status || existing?.status || 'open',
    ownerRecipientId: conflict.ownerRecipientId || null,
    factOwnerId: conflict.factOwnerId || null,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  })
}

export async function resolveContinuityConflict(id, resolution, novelId) {
  const db = await getDB()
  const current = await db.get('continuityConflicts', id)
  if (!current || (novelId && current.novelId !== novelId)) return null
  return putRecord('continuityConflicts', { ...current, status: resolution || 'resolved', resolvedAt: Date.now(), updatedAt: Date.now() })
}

export async function getReadMarker(novelId, readerId, chapterId) {
  const db = await getDB()
  const rows = await db.getAllFromIndex('readMarkers', 'by-novel', novelId)
  return rows.find((row) => row.readerId === readerId && row.chapterId === chapterId) || null
}

export async function saveReadMarker(novelId, readerId, marker) {
  if (!readerId) throw new Error('A reader identity is required.')
  const current = await getReadMarker(novelId, readerId, marker.chapterId)
  const next = {
    ...(current || {}),
    ...marker,
    id: current?.id || `${novelId}:${readerId}:${marker.chapterId}`,
    novelId,
    readerId,
    updatedAt: Date.now(),
    clientTimestamp: marker.clientTimestamp || Date.now(),
  }
  return putRecord('readMarkers', next)
}

export function betaFeedbackPayload({ chapterId, anchor = null, quote, kind = 'comment', comment = '', creatorId, role = 'beta-reader' }) {
  return {
    chapterId,
    anchor: anchor || null,
    quote: String(quote || '').slice(0, 400),
    comment: String(comment || '').slice(0, 2000),
    kind,
    creatorId: creatorId || null,
    role,
    visibility: 'team',
  }
}
