import { getDB, putRecord, uid } from './db'
import { defaultWorkspacePreferences } from '../workspaces/registry'

export async function getWorkspacePreferences(novelId) {
  const db = await getDB()
  const record = await db.get('workspacePreferences', novelId)
  return { id: novelId, novelId, ...defaultWorkspacePreferences(), ...(record || {}), names: { ...(record?.names || {}) }, panels: { ...(record?.panels || {}) } }
}

export async function updateWorkspacePreferences(novelId, patch) {
  const current = await getWorkspacePreferences(novelId)
  return putRecord('workspacePreferences', { ...current, ...patch, id: novelId, novelId, updatedAt: Date.now() })
}

export async function resetWorkspacePreferences(novelId) {
  return putRecord('workspacePreferences', { ...defaultWorkspacePreferences(), id: novelId, novelId, updatedAt: Date.now() })
}
