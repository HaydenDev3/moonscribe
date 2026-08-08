import { getDB, uid, putRecord, removeRecord } from './db'

// Worldbuilding: places, factions, artefacts, lore, timeline entries.
export const WORLD_KINDS = [
  { key: 'place', label: 'Places', icon: 'fa-solid fa-mountain-sun' },
  { key: 'faction', label: 'Factions', icon: 'fa-solid fa-flag' },
  { key: 'item', label: 'Artefacts', icon: 'fa-solid fa-gem' },
  { key: 'lore', label: 'Lore', icon: 'fa-solid fa-scroll' },
  { key: 'timeline', label: 'Timeline', icon: 'fa-regular fa-clock' }
]

export async function listWorld(novelId) {
  const db = await getDB()
  const all = await db.getAllFromIndex('world', 'by-novel', novelId)
  return all.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
}

export async function createWorldItem(novelId, data) {
  const now = Date.now()
  const item = {
    id: uid(),
    novelId,
    kind: data.kind || 'place',
    name: data.name || 'Untitled',
    summary: data.summary || '',
    details: data.details || '',
    tags: data.tags || [],
    color: data.color || '#7BA3C9',
    createdAt: now,
    updatedAt: now
  }
  return putRecord('world', item)
}

export async function updateWorldItem(id, patch) {
  const db = await getDB()
  const item = await db.get('world', id)
  if (!item) return null
  const next = { ...item, ...patch, id: item.id, updatedAt: Date.now() }
  return putRecord('world', next)
}

export async function deleteWorldItem(id) {
  const db = await getDB()
  const item = await db.get('world', id)
  await db.delete('world', id)
  await removeRecord('world', id, item?.novelId)
}
