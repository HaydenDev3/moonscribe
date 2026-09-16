import { getDB, putRecord, uid } from './db'
import { defaultWorkspacePreferences } from '../workspaces/registry'

export const DEFAULT_CONTINUITY_SETTINGS = {
  factTypes: ['age', 'eyeColor', 'relationshipStatus', 'aliases'],
  severity: 'warn'
}

export async function getWorkspacePreferences(novelId) {
  const db = await getDB()
  const record = await db.get('workspacePreferences', novelId)
  const defaults = defaultWorkspacePreferences()
  // Add newly introduced default-visible workspaces to existing novels while
  // preserving any deliberate visibility choices for older workspaces.
  const enabled = record?.enabled ? [...new Set([...record.enabled, 'interior-layout'])] : defaults.enabled
  return { id: novelId, novelId, ...defaults, ...(record || {}), enabled, names: { ...(record?.names || {}) }, panels: { ...(record?.panels || {}) }, continuity: { ...DEFAULT_CONTINUITY_SETTINGS, ...(record?.continuity || {}) }, designPresets: { ...(record?.designPresets || {}) }, exportPresets: { ...(record?.exportPresets || {}) } }
}

export async function updateWorkspacePreferences(novelId, patch) {
  const current = await getWorkspacePreferences(novelId)
  return putRecord('workspacePreferences', { ...current, ...patch, id: novelId, novelId, updatedAt: Date.now() })
}

export async function resetWorkspacePreferences(novelId) {
  return putRecord('workspacePreferences', { ...defaultWorkspacePreferences(), id: novelId, novelId, updatedAt: Date.now() })
}
