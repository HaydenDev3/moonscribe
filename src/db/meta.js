import { getDB } from './db'

export async function getMeta(key, fallback = null) {
  const db = await getDB()
  const row = await db.get('meta', key)
  return row ? row.value : fallback
}

export async function setMeta(key, value) {
  const db = await getDB()
  await db.put('meta', { key, value })
}
