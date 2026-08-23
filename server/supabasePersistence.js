import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY

export const supabasePersistenceEnabled = Boolean(url && serviceKey)
export const supabasePersistence = supabasePersistenceEnabled
  ? createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null

function requirePersistence() {
  if (!supabasePersistence) throw new Error('Supabase server persistence is not configured.')
  return supabasePersistence
}

// One-way, idempotent migration. Nothing is deleted from Supabase and every
// record uses the newest timestamp, so a restart cannot erase production work.
export async function migrateSqliteToSupabase(db) {
  const client = requirePersistence()
  const users = db.prepare('SELECT * FROM users').all()
  const sessions = db.prepare('SELECT * FROM tokens').all()
  const records = db.prepare('SELECT user_id, store, id, novel_id, payload, updated_at, deleted FROM records').all()

  const userRows = users.map((u) => ({
    id: String(u.id), email: u.email || null, username: u.username || null,
    password_hash: u.password_hash || null, display_name: u.username || null,
    provider: u.discord_id ? 'discord' : u.google_id ? 'google' : 'password',
    provider_subject: u.discord_id || u.google_id || null,
    avatar_url: u.discord_avatar || u.google_avatar || null,
    email_verified: Boolean(u.email_verified), disabled_at: u.disabled_at ? new Date(u.disabled_at).toISOString() : null,
    created_at: new Date(u.created_at || Date.now()).toISOString(), updated_at: new Date().toISOString()
  }))
  for (let i = 0; i < userRows.length; i += 500) {
    const { error } = await client.from('moonscribe_users').upsert(userRows.slice(i, i + 500), { onConflict: 'id' })
    if (error) throw error
  }

  const sessionRows = sessions.filter((s) => s.user_id).map((s) => ({
    token_hash: s.token_hash, user_id: String(s.user_id), device_id: s.device_id || null,
    device_name: s.device_name || null, session_id: s.session_id || null,
    created_at: new Date(s.created_at || Date.now()).toISOString(),
    expires_at: s.expires_at ? new Date(s.expires_at).toISOString() : null,
    last_seen_at: new Date(s.last_seen_at || Date.now()).toISOString()
  }))
  for (let i = 0; i < sessionRows.length; i += 500) {
    const { error } = await client.from('moonscribe_sessions').upsert(sessionRows.slice(i, i + 500), { onConflict: 'token_hash' })
    if (error) throw error
  }

  const recordRows = records.filter((r) => r.user_id).map((r) => ({
    user_id: String(r.user_id), store: r.store, id: r.id, novel_id: r.novel_id || null,
    payload: r.payload ? JSON.parse(r.payload) : {}, updated_at: Number(r.updated_at) || 0, deleted: Boolean(r.deleted)
  }))
  for (let i = 0; i < recordRows.length; i += 500) {
    const { error } = await client.from('moonscribe_records').upsert(recordRows.slice(i, i + 500), { onConflict: 'user_id,store,id' })
    if (error) throw error
  }
  return { users: userRows.length, sessions: sessionRows.length, records: recordRows.length }
}

export async function mirrorRecords(records) {
  if (!supabasePersistence || !records?.length) return
  const rows = records.filter((r) => r?.userId).map((r) => ({
    user_id: String(r.userId), store: String(r.store), id: String(r.id), novel_id: r.novelId || null,
    payload: r.deleted ? {} : (r.payload ?? {}), updated_at: Number(r.updatedAt) || 0, deleted: Boolean(r.deleted)
  }))
  if (!rows.length) return
  const { error } = await supabasePersistence.from('moonscribe_records').upsert(rows, { onConflict: 'user_id,store,id' })
  if (error) throw error
}
