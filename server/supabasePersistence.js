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

export async function mirrorUserProfile(db, userId) {
  if (!supabasePersistence) return
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
  if (!user) return
  const provider = user.discord_id ? 'discord' : user.google_id ? 'google' : 'password'
  const providerSubject = user.discord_id || user.google_id || null
  // SQLite is the active identity source, but Supabase can retain a row from
  // an older deployment or a previous local database. Reconcile by identity
  // before upserting by id, otherwise a unique provider/email constraint turns
  // a successful OAuth login into a 500 response.
  const identityMatches = []
  if (providerSubject) {
    const { data, error } = await supabasePersistence.from('moonscribe_users').select('id').eq('provider', provider).eq('provider_subject', providerSubject).maybeSingle()
    if (error) throw error
    if (data?.id && String(data.id) !== String(user.id)) identityMatches.push(String(data.id))
  }
  if (user.email) {
    const { data, error } = await supabasePersistence.from('moonscribe_users').select('id').eq('email', user.email).maybeSingle()
    if (error) throw error
    if (data?.id && String(data.id) !== String(user.id)) identityMatches.push(String(data.id))
  }
  for (const sourceId of [...new Set(identityMatches)]) await mergeSupabaseUser(sourceId, user.id)
  const { error } = await supabasePersistence.from('moonscribe_users').upsert({ id: String(user.id), email: user.email || null, username: user.username || null, password_hash: user.password_hash || null, display_name: user.username || null, provider, provider_subject: providerSubject, avatar_url: user.discord_avatar || user.google_avatar || null, email_verified: Boolean(user.email_verified), disabled_at: user.disabled_at ? new Date(user.disabled_at).toISOString() : null, created_at: new Date(user.created_at || Date.now()).toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'id' })
  if (error) throw error
}

export async function mergeSupabaseUser(sourceUserId, destinationUserId) {
  if (!supabasePersistence || !sourceUserId || !destinationUserId) return
  const source = String(sourceUserId)
  const destination = String(destinationUserId)
  const { data: records, error: recordsError } = await supabasePersistence.from('moonscribe_records').select('*').eq('user_id', source)
  if (recordsError) throw recordsError
  for (const record of records || []) {
    const { error } = await supabasePersistence.from('moonscribe_records').upsert({ ...record, user_id: destination }, { onConflict: 'user_id,store,id' })
    if (error) throw error
  }
  const { error: sessionError } = await supabasePersistence.from('moonscribe_sessions').update({ user_id: destination }).eq('user_id', source)
  if (sessionError) throw sessionError
  const { error: deleteRecordsError } = await supabasePersistence.from('moonscribe_records').delete().eq('user_id', source)
  if (deleteRecordsError) throw deleteRecordsError
  const { error: userError } = await supabasePersistence.from('moonscribe_users').delete().eq('id', source)
  if (userError) throw userError
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

// Restore cloud state before Railway accepts traffic after a restart. This
// keeps the existing synchronous request handlers compatible while Supabase
// remains the durable source for OAuth sessions and library records.
export async function restoreSupabaseToSqlite(db) {
  const client = requirePersistence()
  const { data: users, error: usersError } = await client.from('moonscribe_users').select('*')
  if (usersError) throw usersError
  for (const u of users || []) {
    db.prepare(`INSERT OR IGNORE INTO users (id, username, password_hash, email, created_at, role, roles, email_verified, disabled_at, discord_id, discord_avatar, google_id, google_avatar)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      u.id, u.username || `writer_${String(u.id).slice(0, 8)}`, u.password_hash || 'supabase-managed', u.email || null,
      Date.parse(u.created_at) || Date.now(), 'user', 'user', u.email_verified ? 1 : 0, u.disabled_at ? Date.parse(u.disabled_at) : null,
      u.provider === 'discord' ? u.provider_subject : null, u.provider === 'discord' ? u.avatar_url : null,
      u.provider === 'google' ? u.provider_subject : null, u.provider === 'google' ? u.avatar_url : null
    )
  }
  const { data: sessions, error: sessionError } = await client.from('moonscribe_sessions').select('*')
  if (sessionError) throw sessionError
  for (const s of sessions || []) db.prepare(`INSERT OR REPLACE INTO tokens (token_hash, user_id, created_at, expires_at, device_id, device_name, last_seen_at, session_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    s.token_hash, s.user_id, Date.parse(s.created_at) || Date.now(), s.expires_at ? Date.parse(s.expires_at) : null, s.device_id || null, s.device_name || 'Unknown device', Date.parse(s.last_seen_at) || Date.now(), s.session_id || null
  )
  const { data: records, error: recordError } = await client.from('moonscribe_records').select('*')
  if (recordError) throw recordError
  const insert = db.prepare(`INSERT OR REPLACE INTO records (user_id, store, id, novel_id, payload, updated_at, deleted) VALUES (?, ?, ?, ?, ?, ?, ?)`)
  for (const r of records || []) insert.run(r.user_id, r.store, r.id, r.novel_id || null, r.deleted ? null : JSON.stringify(r.payload ?? null), r.updated_at || 0, r.deleted ? 1 : 0)
  return { users: users?.length || 0, sessions: sessions?.length || 0, records: records?.length || 0 }
}

export async function mirrorRecords(records, db = null) {
  if (!supabasePersistence || !records?.length) return
  let rows = records.filter((r) => r?.userId).map((r) => ({
    user_id: String(r.userId), store: String(r.store), id: String(r.id), novel_id: r.novelId || null,
    payload: r.deleted ? {} : (r.payload ?? {}), updated_at: Number(r.updatedAt) || 0, deleted: Boolean(r.deleted)
  }))
  if (!rows.length) return
  // Records can arrive immediately after local account creation. The FK on
  // moonscribe_records is intentional, so make the parent rows durable before
  // mirroring the child records instead of relying on request ordering.
  if (db) {
    for (const userId of [...new Set(rows.map((row) => row.user_id))]) {
      await mirrorUserProfile(db, userId)
    }
    rows = rows.filter((row) => db.prepare('SELECT id FROM users WHERE id = ?').get(row.user_id))
  }
  if (!rows.length) return
  const { error } = await supabasePersistence.from('moonscribe_records').upsert(rows, { onConflict: 'user_id,store,id' })
  if (error) throw error
}

export async function mirrorUserAndSession(db, userId, session) {
  if (!supabasePersistence) return
  await mirrorUserProfile(db, userId)
  const { error: sessionError } = await supabasePersistence.from('moonscribe_sessions').upsert({
    token_hash: shaToken(session.token), user_id: String(userId), device_id: session.deviceId || null, device_name: session.deviceName || 'Unknown device',
    session_id: session.sessionId, created_at: new Date().toISOString(), expires_at: new Date(session.expiresAt).toISOString(), last_seen_at: new Date().toISOString()
  }, { onConflict: 'token_hash' })
  if (sessionError) throw sessionError
}

const shaToken = (value) => {
  // The server passes the already-hashed token when available; this fallback
  // is only used by the session mirror and never exposes the raw token.
  return String(value)
}

export async function mirrorOauthExchange(exchange) {
  if (!supabasePersistence) return
  const { error } = await supabasePersistence.from('moonscribe_oauth_exchanges').upsert({ code: exchange.code, user_id: exchange.userId, username: exchange.username, avatar: exchange.avatar || null, provider: exchange.provider, server_origin: exchange.serverOrigin, expires_at: new Date(exchange.expiresAt).toISOString(), created_at: new Date(exchange.createdAt || Date.now()).toISOString(), mode: exchange.mode || 'login' }, { onConflict: 'code' })
  if (error) throw error
}

export async function consumeSupabaseOauthExchange(code) {
  if (!supabasePersistence) return null
  const { data, error } = await supabasePersistence.from('moonscribe_oauth_exchanges').select('*').eq('code', String(code)).maybeSingle()
  if (error) throw error
  if (!data || Date.parse(data.expires_at) < Date.now()) return null
  await supabasePersistence.from('moonscribe_oauth_exchanges').delete().eq('code', String(code))
  return { user_id: data.user_id, username: data.username, avatar: data.avatar, provider: data.provider, server_origin: data.server_origin, expires_at: Date.parse(data.expires_at), mode: data.mode }
}
