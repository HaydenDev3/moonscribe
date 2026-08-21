import { getDB, uid, putRecord, removeRecord } from './db'
import { trashRecord } from './trash'

// Unified store for Factions, Artefacts, and Places — each has a `kind` field.

export async function listEntities(novelId, kind) {
  const db = await getDB()
  const all = await db.getAllFromIndex('characters', 'by-novel', novelId)
  // We reuse the 'characters' store for entities since it already syncs and
  // has the right shape — kind distinguishes them.
  return all
    .filter((e) => !e.trashedAt && e.kind === kind)
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
}

export async function createEntity(novelId, kind, data) {
  const now = Date.now()
  const entity = {
    id: uid(),
    novelId,
    kind,
    name: data.name || DEFAULTS[kind].name,
    color: data.color || randomColor(),
    portrait: data.portrait || null,
    notes: data.notes || '',
    ...kindFields(kind, data),
    createdAt: now,
    updatedAt: now
  }
  return putRecord('characters', entity)
}

export async function updateEntity(id, patch) {
  const db = await getDB()
  const entity = await db.get('characters', id)
  if (!entity) return null
  const next = { ...entity, ...patch, id: entity.id, updatedAt: Date.now() }
  return putRecord('characters', next)
}

export async function trashEntity(id) {
  return trashRecord('characters', id)
}

export async function deleteEntity(id) {
  const db = await getDB()
  const e = await db.get('characters', id)
  await db.delete('characters', id)
  await removeRecord('characters', id, e?.novelId)
}

// --- per-kind field templates ---

function kindFields(kind, data = {}) {
  if (kind === 'faction')  return { type: data.type || '', allegiance: data.allegiance || '', description: data.description || '', members: data.members || '', goals: data.goals || '' }
  if (kind === 'artefact') return { type: data.type || '', origin: data.origin || '', description: data.description || '', powers: data.powers || '', location: data.location || '' }
  if (kind === 'place')    return { type: data.type || '', region: data.region || '', description: data.description || '', atmosphere: data.atmosphere || '', significance: data.significance || '' }
  return {}
}

export const DEFAULTS = {
  faction:  { name: 'A faction',  icon: 'fa-solid fa-shield-halved',    color: '#7B9EBF' },
  artefact: { name: 'An artefact', icon: 'fa-solid fa-gem',              color: '#B49BCB' },
  place:    { name: 'A place',    icon: 'fa-solid fa-location-dot',      color: '#A8C5A8' },
}

export const KIND_FIELDS = {
  faction:  [
    { key: 'type',       label: 'Type',       placeholder: 'Guild, cult, army…' },
    { key: 'allegiance', label: 'Allegiance',  placeholder: 'Aligned with…' },
    { key: 'goals',      label: 'Goals',       placeholder: 'What do they want?' },
    { key: 'members',    label: 'Key members', placeholder: 'Notable members…' },
    { key: 'description',label: 'Description', placeholder: 'Overview…', multiline: true },
  ],
  artefact: [
    { key: 'type',       label: 'Type',        placeholder: 'Weapon, relic, tome…' },
    { key: 'origin',     label: 'Origin',       placeholder: 'Where it came from…' },
    { key: 'powers',     label: 'Powers',       placeholder: 'What it can do…' },
    { key: 'location',   label: 'Current location', placeholder: 'Where it is now…' },
    { key: 'description',label: 'Description',  placeholder: 'Appearance and lore…', multiline: true },
  ],
  place: [
    { key: 'type',         label: 'Type',          placeholder: 'City, forest, realm…' },
    { key: 'region',       label: 'Region',         placeholder: 'Part of what larger area…' },
    { key: 'atmosphere',   label: 'Atmosphere',     placeholder: 'Mood and feeling…' },
    { key: 'significance', label: 'Significance',   placeholder: 'Why it matters…' },
    { key: 'description',  label: 'Description',    placeholder: 'Sights, sounds, smells…', multiline: true },
  ],
}

const COLORS = ['#D4A5A5', '#7BA3C9', '#A8C5A8', '#D8B48F', '#B49BCB', '#E3C18A', '#9FBFA8', '#C9A9C4']
function randomColor() { return COLORS[Math.floor(Math.random() * COLORS.length)] }
export function entityColors() { return COLORS }
