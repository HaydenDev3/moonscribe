import { createClient } from '@supabase/supabase-js'

export type MoonScribeBackupPayload = {
  app?: string
  version?: number
  exportedAt?: string
  [key: string]: unknown
}

function readEnv(...keys: string[]) {
  const env = typeof import.meta !== 'undefined' ? import.meta.env : undefined
  for (const key of keys) {
    const value = env?.[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

const url = readEnv('VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL')
const key = readEnv('VITE_SUPABASE_ANON_KEY', 'VITE_SUPABASE_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY')

export const supabaseConfig = {
  url,
  key,
  enabled: Boolean(url && key),
}

export const supabase = supabaseConfig.enabled
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

export function isSupabaseConfigured() {
  return Boolean(supabaseConfig.enabled)
}

export function getSupabaseMigrationDefaults() {
  return {
    profileTable: 'moonscribe_profiles',
    libraryTable: 'moonscribe_library',
    storageBucket: 'moonscribe-backups',
  }
}

export async function upsertSupabaseProfile({
  userId,
  email,
  username,
  accountRole,
  roles,
}: {
  userId: string
  email?: string | null
  username?: string | null
  accountRole?: string
  roles?: string[]
}) {
  if (!supabase) return { ok: false, reason: 'SUPABASE_NOT_CONFIGURED' }

  const payload = {
    id: userId,
    email: email || null,
    username: username || null,
    account_role: accountRole || 'user',
    roles: Array.isArray(roles) ? roles : ['user'],
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase.from(getSupabaseMigrationDefaults().profileTable).upsert(payload, { onConflict: 'id' })
  return { ok: !error, error, payload }
}

export async function exportLocalBackupToSupabase({
  userId,
  email,
  username,
  backup,
  accountRole,
  roles,
}: {
  userId: string
  email?: string | null
  username?: string | null
  backup: MoonScribeBackupPayload
  accountRole?: string
  roles?: string[]
}) {
  if (!supabase) return { ok: false, reason: 'SUPABASE_NOT_CONFIGURED' }

  const { profileTable, libraryTable } = getSupabaseMigrationDefaults()
  const normalizedBackup = {
    app: 'moonscribe',
    version: typeof backup.version === 'number' ? backup.version : 3,
    exportedAt: backup.exportedAt || new Date().toISOString(),
    ...backup,
  }

  const profileResult = await upsertSupabaseProfile({ userId, email, username, accountRole, roles })
  if (!profileResult.ok) return profileResult

  const row = {
    id: `${userId}-${Date.now()}`,
    user_id: userId,
    email: email || null,
    username: username || null,
    payload: normalizedBackup,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase.from(libraryTable).insert([row])
  return {
    ok: !error,
    error,
    row,
    profile: profileResult.payload,
  }
}

export async function importSupabaseBackupForUser({
  userId,
  libraryTable = getSupabaseMigrationDefaults().libraryTable,
}: {
  userId: string
  libraryTable?: string
}) {
  if (!supabase) return { ok: false, reason: 'SUPABASE_NOT_CONFIGURED' }

  const { data, error } = await supabase
    .from(libraryTable)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) return { ok: false, error }
  const latest = Array.isArray(data) && data.length ? data[0] : null
  return { ok: true, backup: latest?.payload || null }
}
