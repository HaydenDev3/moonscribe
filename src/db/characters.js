import { getDB, uid, putRecord, removeRecord } from './db'
import { trashRecord } from './trash'

export async function listCharacters(novelId) {
  const db = await getDB()
  const all = await db.getAllFromIndex('characters', 'by-novel', novelId)
  return all.filter((c) => !c.trashedAt).sort((a, b) => a.name.localeCompare(b.name))
}

export async function createCharacter(novelId, data) {
  const now = Date.now()
  const character = {
    id: uid(),
    novelId,
    name: data.name || 'A character',
    aliases: data.aliases || [],
    role: data.role || '',
    age: data.age || '',
    gender: data.gender || '',
    species: data.species || '',
    occupation: data.occupation || '',
    appearance: data.appearance || '',
    personality: data.personality || '',
    bio: data.bio || '',
    motivation: data.motivation || '',
    arc: data.arc || '',
    notes: data.notes || '',
    customFields: data.customFields || [],
    chapterIds: data.chapterIds || [],
    color: data.color || defaultColor(),
    portrait: data.portrait || null,
    createdAt: now,
    updatedAt: now
  }
  return putRecord('characters', character)
}

export async function updateCharacter(id, patch) {
  const db = await getDB()
  const character = await db.get('characters', id)
  if (!character) return null
  const next = { ...character, ...patch, id: character.id, updatedAt: Date.now() }
  return putRecord('characters', next)
}

export async function deleteCharacter(id) {
  const db = await getDB()
  const c = await db.get('characters', id)
  await db.delete('characters', id)
  await removeRecord('characters', id, c?.novelId)
}

export async function trashCharacter(id) {
  return trashRecord('characters', id)
}

const COLORS = ['#D4A5A5', '#7BA3C9', '#A8C5A8', '#D8B48F', '#B49BCB', '#E3C18A', '#9FBFA8', '#C9A9C4']
export function defaultColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)]
}
export function characterColors() {
  return COLORS
}
