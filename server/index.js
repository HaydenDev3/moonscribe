// MoonScribe sync server.
//
// A tiny, dependency-free backend that keeps two writers in step.
//   - node:sqlite database (no external DB server needed)
//   - user accounts: register / login with username + password
//   - every account has its own private library, stored server-side
//   - LWW merge by client timestamp, tombstones for deletes
//   - serves the production build from dist/ when present
//
// Run:  node server/index.js
// Env:  PORT (default 3001), DATA_DIR
// The first account to register claims any records left by an older server.
//
// Testable: createMoonScribeServer({ db, rateLimit }) builds the whole app
// around an injected database (use new DatabaseSync(':memory:') in tests) and
// returns { server, db } — call server.listen(0) and use the real HTTP API.

import { createServer } from 'node:http'
import { readFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { join, dirname, extname, normalize } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { WebSocketServer } from 'ws'
import { isEmailConfigured, sendAccountUpdateEmail, sendMagicLink, sendReminderEmail, sendTwoFactorCode, sendVerificationCode } from './email.js'
import { migrateSqliteToSupabase, restoreSupabaseToSqlite, supabasePersistenceEnabled, mirrorRecords, mirrorUserProfile, mirrorUserAndSession, mirrorOauthExchange, consumeSupabaseOauthExchange, mergeSupabaseUser } from './supabasePersistence.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'dist')
const PORT = Number(process.env.PORT || 3001)
const notificationSockets = new Map()

function describeSupabaseError(error) {
  if (!error) return 'Unknown Supabase error'
  if (typeof error === 'string') return error
  return JSON.stringify({
    name: error.name,
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
    status: error.status,
  })
}
const IS_PRODUCTION = process.env.NODE_ENV === 'production' || Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID)
const CANONICAL_WEB_ORIGIN = 'https://moonscribe.cc'

const STORES = new Set([
  'novels',
  'chapters',
  'characters',
  'notes',
  'relationships',
  'world',
  'moodboard',
  'glossary',
  'annotations',
  'branches',
  'suggestions'
])

// ---- OAuth ----
// Providers always return through the public application origin. In local
// development Vite proxies /auth to this process, so backend ports never leak
// into provider-facing redirect URIs.
const APP_ORIGIN = (process.env.APP_ORIGIN || (IS_PRODUCTION ? 'https://moonscribe.cc' : 'http://localhost:5173')).replace(/\/+$/, '')
// Magic Links must always land on the real MoonScribe web app. This is
// intentionally independent from APP_ORIGIN so local/test servers cannot
// send unusable localhost links through Resend.
const MAGIC_LINK_ORIGIN = 'https://moonscribe.cc'
const BOOTSTRAP_ADMIN_DISCORD_ID = process.env.MOONSCRIBE_ADMIN_DISCORD_ID || '622903645268344835'
const BOOTSTRAP_ADMIN_EMAIL = String(process.env.MOONSCRIBE_ADMIN_EMAIL || '').trim().toLowerCase()
// OAuth providers must always return to the hosted API. The final browser
// destination may instead be the web app or the desktop custom URI scheme.
const API_ORIGIN = (process.env.API_ORIGIN || APP_ORIGIN).replace(/\/+$/, '')
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || '1537750421458780170'
// Never provide a fallback here. A Discord client secret must only live in the
// deployment environment, and the previous exposed secret must be rotated.
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET
const DISCORD_SCOPES = 'identify'
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const ALLOW_DEV_TUNNELS = process.env.ALLOW_DEV_TUNNELS === 'true' || !IS_PRODUCTION
const DEV_TUNNEL_HOST = /(?:^|\.)(?:ngrok-free\.app|ngrok-free\.dev|ngrok\.io|loca\.lt)$/i

const OAUTH_STATE_SECRET = process.env.OAUTH_STATE_SECRET || DISCORD_CLIENT_SECRET || GOOGLE_CLIENT_SECRET
function oauthState(payload) {
  if (!OAUTH_STATE_SECRET) throw new Error('OAuth state signing is not configured.')
  const encoded = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 10 * 60 * 1000, nonce: randomBytes(12).toString('hex') })).toString('base64url')
  const signature = createHmac('sha256', OAUTH_STATE_SECRET).update(encoded).digest('base64url')
  return `${encoded}.${signature}`
}

function readOauthState(value, provider) {
  try {
    const [encoded, signature] = String(value || '').split('.')
    if (!encoded || !signature || !OAUTH_STATE_SECRET) return null
    const expected = createHmac('sha256', OAUTH_STATE_SECRET).update(encoded).digest()
    const received = Buffer.from(signature, 'base64url')
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))
    if (payload.exp < Date.now() || payload.provider !== provider || !payload.redirectTo) return null
    return payload
  } catch { return null }
}

// Auth tokens live for 30 days; expired tokens are rejected and swept.
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000

// A single record (a chapter, or a cover as a data-URL) must fit in this many
// bytes. Guards against a client pushing absurdly large payloads.
const MAX_RECORD_BYTES = 10 * 1024 * 1024

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json'
}

function publicAvatar(user) {
  if (!user) return null
  if (user.discord_id && user.discord_avatar) {
    if (/^https?:\/\//i.test(user.discord_avatar)) return user.discord_avatar
    const extension = user.discord_avatar.startsWith('a_') ? 'gif' : 'png'
    return `https://cdn.discordapp.com/avatars/${encodeURIComponent(user.discord_id)}/${encodeURIComponent(user.discord_avatar)}.${extension}?size=128`
  }
  return user.google_avatar && /^https?:\/\//i.test(user.google_avatar) ? user.google_avatar : null
}

// ---- passwords & tokens ----
const sha = (s) => createHash('sha256').update(String(s)).digest('hex')

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(String(password), salt, 32).toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':')
  if (!salt || !hash) return false
  const candidate = scryptSync(String(password), salt, 32)
  const expected = Buffer.from(hash, 'hex')
  return candidate.length === expected.length && timingSafeEqual(candidate, expected)
}

function issueToken(db, userId, { deviceId = null, deviceName = 'Unknown device' } = {}) {
  const token = randomBytes(24).toString('base64url')
  const sessionId = randomBytes(16).toString('hex')
  const expiresAt = Date.now() + TOKEN_TTL_MS
  // One current token per device. Signing in again rotates that device's
  // token, without unexpectedly signing the writer out elsewhere.
  if (deviceId) db.prepare('DELETE FROM tokens WHERE user_id = ? AND device_id = ?').run(userId, deviceId)
  db.prepare('INSERT INTO tokens (token_hash, user_id, created_at, expires_at, device_id, device_name, last_seen_at, session_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
    sha(token), userId, Date.now(), expiresAt, deviceId, deviceName.slice(0, 120), Date.now(), sessionId
  )
  if (supabasePersistenceEnabled) mirrorUserAndSession(db, userId, { token: sha(token), expiresAt, sessionId, deviceId, deviceName: deviceName.slice(0, 120) }).catch((error) => console.error('[supabase] session mirror failed', describeSupabaseError(error)))
  return { token, expiresAt, sessionId }
}

function userFromToken(db, token) {
  if (!token) return null
  const row = db.prepare('SELECT user_id, expires_at FROM tokens WHERE token_hash = ?').get(sha(token))
  if (!row) return null
  if (row.expires_at && row.expires_at < Date.now()) {
    // Expired — consume the row and treat the token as invalid.
    db.prepare('DELETE FROM tokens WHERE token_hash = ?').run(sha(token))
    return null
  }
  const active = db.prepare('SELECT 1 FROM users WHERE id = ? AND disabled_at IS NULL').get(row.user_id)
  if (!active) {
    db.prepare('DELETE FROM tokens WHERE token_hash = ?').run(sha(token))
    return null
  }
  db.prepare('UPDATE tokens SET last_seen_at = ? WHERE token_hash = ?').run(Date.now(), sha(token))
  return row.user_id
}

const APP_ROLES = ['user', 'developer', 'beta_tester', 'admin']

function normalizeRoles(rawValue) {
  const values = Array.isArray(rawValue) ? rawValue : String(rawValue || '').split(',')
  const chosen = new Set()
  for (const item of values) {
    const role = String(item || '').trim().toLowerCase()
    if (APP_ROLES.includes(role)) chosen.add(role)
  }
  if (!chosen.size) chosen.add('user')
  return APP_ROLES.filter((role) => chosen.has(role))
}

function userRoleInfo(user) {
  if (!user) return { roles: ['user'], role: 'user', isAdmin: false, isDeveloper: false }
  const roles = normalizeRoles(user.roles || user.role || 'user')
  const primaryRole = roles.includes('admin') ? 'admin' : roles.includes('developer') ? 'developer' : 'user'
  return {
    roles,
    role: primaryRole,
    isAdmin: roles.includes('admin'),
    isDeveloper: roles.includes('developer'),
  }
}

function issueEmailCode(db, userId, purpose, ttlMs = 10 * 60 * 1000) {
  const code = String((randomBytes(4).readUInt32BE(0) % 900000) + 100000)
  const id = randomBytes(12).toString('hex')
  const expiresAt = Date.now() + ttlMs
  db.prepare('DELETE FROM email_tokens WHERE user_id = ? AND purpose = ?').run(userId, purpose)
  db.prepare('INSERT INTO email_tokens (id, user_id, purpose, code, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, userId, purpose, sha(code), expiresAt, Date.now())
  return { code, expiresAt }
}

function verifyEmailCode(db, userId, purpose, code) {
  const row = db.prepare('SELECT * FROM email_tokens WHERE user_id = ? AND purpose = ? ORDER BY created_at DESC LIMIT 1').get(userId, purpose)
  if (!row) return false
  if (row.used_at || row.expires_at < Date.now()) return false
  const expected = Buffer.from(String(row.code))
  const received = Buffer.from(sha(String(code || '')))
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return false
  db.prepare('UPDATE email_tokens SET used_at = ? WHERE id = ?').run(Date.now(), row.id)
  return true
}

// Pre-account records have no owner. Claiming them automatically would let the
// first person to sign up see data that may belong to somebody else. A server
// owner can explicitly opt in during a controlled migration.
function claimLegacyRecords(db, userId) {
  if (process.env.CLAIM_LEGACY_RECORDS_ON_FIRST_ACCOUNT !== 'true') return
  db.prepare("UPDATE records SET user_id = ? WHERE user_id IS NULL OR user_id = ''").run(userId)
}

// Merge an already-existing provider account into the account that initiated
// linking. Records are reassigned in one SQLite transaction; provider data on
// the destination account is preserved unless it is currently empty.
function mergeAccountRecords(db, sourceId, destinationId) {
  if (!sourceId || !destinationId || sourceId === destinationId) return
  const sourceUser = db.prepare('SELECT role, roles FROM users WHERE id = ?').get(sourceId)
  const destinationUser = db.prepare('SELECT role, roles FROM users WHERE id = ?').get(destinationId)
  const sourceRoles = normalizeRoles(sourceUser?.roles || sourceUser?.role)
  const destinationRoles = normalizeRoles(destinationUser?.roles || destinationUser?.role)
  const mergedRoles = normalizeRoles([...new Set([...sourceRoles, ...destinationRoles])])
  if (mergedRoles.includes('admin')) mergedRoles.splice(mergedRoles.indexOf('admin'), 1, 'admin')
  db.exec('BEGIN')
  try {
    db.prepare('UPDATE records SET user_id = ? WHERE user_id = ?').run(destinationId, sourceId)
    db.prepare('UPDATE tokens SET user_id = ? WHERE user_id = ?').run(destinationId, sourceId)
    db.prepare('UPDATE notifications SET user_id = ? WHERE user_id = ?').run(destinationId, sourceId)
    db.prepare('UPDATE email_tokens SET user_id = ? WHERE user_id = ?').run(destinationId, sourceId)
    db.prepare('UPDATE novel_members SET member_user_id = ? WHERE member_user_id = ?').run(destinationId, sourceId)
    db.prepare('UPDATE share_presence SET user_id = ? WHERE user_id = ?').run(destinationId, sourceId)
    db.prepare('UPDATE share_invites SET owner_user_id = ? WHERE owner_user_id = ?').run(destinationId, sourceId)
    db.prepare('UPDATE share_rooms SET owner_user_id = ? WHERE owner_user_id = ?').run(destinationId, sourceId)
    db.prepare('UPDATE users SET role = ?, roles = ? WHERE id = ?').run(mergedRoles.includes('admin') ? 'admin' : mergedRoles.includes('developer') ? 'developer' : 'user', mergedRoles.join(','), destinationId)
    db.prepare('DELETE FROM oauth_exchanges WHERE user_id = ?').run(sourceId)
    db.prepare('DELETE FROM users WHERE id = ?').run(sourceId)
    db.exec('COMMIT')
  } catch (error) {
    try { db.exec('ROLLBACK') } catch { /* preserve the original merge error */ }
    throw error
  }
}

// ---- schema (with migrations for pre-account databases) ----
function setupSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS records (
      store      TEXT NOT NULL,
      id         TEXT NOT NULL,
      novel_id   TEXT,
      payload    TEXT,
      updated_at INTEGER NOT NULL,
      deleted    INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (store, id)
    );
    CREATE INDEX IF NOT EXISTS idx_records_since ON records(updated_at);
    CREATE TABLE IF NOT EXISTS tokens (
      token_hash TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      username      TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at    INTEGER NOT NULL,
      role          TEXT NOT NULL DEFAULT 'user',
      roles         TEXT NOT NULL DEFAULT 'user'
    );
    CREATE TABLE IF NOT EXISTS admin_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_user_id TEXT NOT NULL,
      actor_username TEXT NOT NULL,
      action TEXT NOT NULL,
      target_user_id TEXT,
      target_username TEXT,
      detail TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'system',
      priority TEXT NOT NULL DEFAULT 'normal',
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      action_url TEXT,
      read_at INTEGER,
      created_at INTEGER NOT NULL,
      expires_at INTEGER,
      metadata TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read_at);
    CREATE TABLE IF NOT EXISTS feature_flags (
      key TEXT PRIMARY KEY, label TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 0,
      rollout INTEGER NOT NULL DEFAULT 0, updated_by TEXT, updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS announcements (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'info', published INTEGER NOT NULL DEFAULT 1,
      created_by TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS oauth_exchanges (
      code         TEXT PRIMARY KEY,
      user_id      TEXT NOT NULL,
      username     TEXT NOT NULL,
      avatar       TEXT,
      provider     TEXT NOT NULL,
      server_origin TEXT NOT NULL,
      expires_at   INTEGER NOT NULL,
      created_at   INTEGER NOT NULL,
      mode         TEXT NOT NULL DEFAULT 'login'
    );
    CREATE TABLE IF NOT EXISTS magic_links (
      id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, user_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL, used_at INTEGER, created_at INTEGER NOT NULL
    );
  `)

  const ensureColumn = (table, column, ddl) => {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all()
    if (!cols.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`)
  }
  ensureColumn('records', 'user_id', 'user_id TEXT')
  ensureColumn('tokens', 'user_id', 'user_id TEXT')
  ensureColumn('tokens', 'expires_at', 'expires_at INTEGER')
  ensureColumn('tokens', 'device_id', 'device_id TEXT')
  ensureColumn('tokens', 'device_name', 'device_name TEXT')
  ensureColumn('tokens', 'last_seen_at', 'last_seen_at INTEGER')
  ensureColumn('tokens', 'session_id', 'session_id TEXT')
  ensureColumn('users', 'discord_id', 'discord_id TEXT')
  ensureColumn('users', 'discord_avatar', 'discord_avatar TEXT')
  ensureColumn('users', 'discord_username', 'discord_username TEXT')
  ensureColumn('users', 'google_id', 'google_id TEXT')
  ensureColumn('users', 'google_avatar', 'google_avatar TEXT')
  ensureColumn('users', 'email', 'email TEXT')
  ensureColumn('users', 'notification_email', 'notification_email TEXT')
  ensureColumn('users', 'email_verified', 'email_verified INTEGER NOT NULL DEFAULT 0')
  ensureColumn('users', 'email_verification_code', 'email_verification_code TEXT')
  ensureColumn('users', 'email_verification_expires_at', 'email_verification_expires_at INTEGER')
  ensureColumn('users', 'two_factor_enabled', 'two_factor_enabled INTEGER NOT NULL DEFAULT 0')
  ensureColumn('users', 'two_factor_secret', 'two_factor_secret TEXT')
  ensureColumn('users', 'two_factor_code', 'two_factor_code TEXT')
  ensureColumn('users', 'two_factor_expires_at', 'two_factor_expires_at INTEGER')
  ensureColumn('users', 'disabled_at', 'disabled_at INTEGER')
  ensureColumn('oauth_exchanges', 'mode', "mode TEXT NOT NULL DEFAULT 'login'")
  ensureColumn('users', 'role', "role TEXT NOT NULL DEFAULT 'user'")
  ensureColumn('users', 'roles', "roles TEXT NOT NULL DEFAULT 'user'")
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      purpose TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      used_at INTEGER,
      created_at INTEGER NOT NULL
    );
  `)
  db.exec('CREATE INDEX IF NOT EXISTS idx_records_user_since ON records(user_id, updated_at)')
  db.exec('CREATE INDEX IF NOT EXISTS idx_magic_links_hash ON magic_links(token_hash)')
  db.exec(`
    CREATE TABLE IF NOT EXISTS novel_members (
      novel_id TEXT NOT NULL, owner_user_id TEXT NOT NULL, member_user_id TEXT NOT NULL,
      role TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER,
      PRIMARY KEY (novel_id, member_user_id)
    );
    CREATE TABLE IF NOT EXISTS share_invites (
      code TEXT PRIMARY KEY, novel_id TEXT NOT NULL, owner_user_id TEXT NOT NULL,
      role TEXT NOT NULL, expires_at INTEGER NOT NULL, access_expires_at INTEGER, created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS share_presence (
      novel_id TEXT NOT NULL, user_id TEXT NOT NULL, chapter_id TEXT,
      last_seen_at INTEGER NOT NULL, PRIMARY KEY (novel_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS share_rooms (
      novel_id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL,
      max_users INTEGER NOT NULL DEFAULT 4, default_role TEXT NOT NULL DEFAULT 'editor',
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_members_user ON novel_members(member_user_id, novel_id);
    CREATE INDEX IF NOT EXISTS idx_invites_expiry ON share_invites(expires_at);
    CREATE INDEX IF NOT EXISTS idx_presence_novel ON share_presence(novel_id, last_seen_at);
  `)
  ensureColumn('share_presence', 'status', "status TEXT NOT NULL DEFAULT 'online'")
  ensureColumn('share_presence', 'activity', "activity TEXT NOT NULL DEFAULT 'viewing'")
  ensureColumn('share_presence', 'workspace', "workspace TEXT NOT NULL DEFAULT 'manuscript'")
  ensureColumn('share_presence', 'tab_name', "tab_name TEXT NOT NULL DEFAULT ''")
  ensureColumn('share_presence', 'line_number', 'line_number INTEGER')
  ensureColumn('share_presence', 'cursor_offset', 'cursor_offset INTEGER')
  ensureColumn('novel_members', 'expires_at', 'expires_at INTEGER')
  ensureColumn('share_invites', 'access_expires_at', 'access_expires_at INTEGER')
  db.exec('CREATE INDEX IF NOT EXISTS idx_users_discord ON users(discord_id)')
  db.exec('CREATE INDEX IF NOT EXISTS idx_users_google ON users(google_id)')
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL')
  db.exec('CREATE INDEX IF NOT EXISTS idx_oauth_exchanges_expiry ON oauth_exchanges(expires_at)')

  // Older databases keyed records globally by (store,id). That allowed a
  // colliding client-generated id from another account to take ownership of a
  // row. Rebuild once with the account as part of the primary key.
  const recordPk = db.prepare('PRAGMA table_info(records)').all().filter((column) => column.pk).sort((a, b) => a.pk - b.pk).map((column) => column.name)
  if (recordPk.join(',') !== 'user_id,store,id') {
    db.exec(`
      BEGIN;
      CREATE TABLE records_scoped (
        user_id TEXT NOT NULL DEFAULT '', store TEXT NOT NULL, id TEXT NOT NULL,
        novel_id TEXT, payload TEXT, updated_at INTEGER NOT NULL,
        deleted INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, store, id)
      );
      INSERT OR REPLACE INTO records_scoped (user_id, store, id, novel_id, payload, updated_at, deleted)
        SELECT COALESCE(user_id, ''), store, id, novel_id, payload, updated_at, deleted FROM records;
      DROP TABLE records;
      ALTER TABLE records_scoped RENAME TO records;
      COMMIT;
    `)
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_records_since ON records(updated_at)')
  db.exec('CREATE INDEX IF NOT EXISTS idx_records_user_since ON records(user_id, updated_at)')

  // Sweep expired tokens on startup.
  db.prepare('DELETE FROM tokens WHERE expires_at IS NOT NULL AND expires_at < ?').run(Date.now())
  db.prepare('DELETE FROM share_invites WHERE expires_at < ?').run(Date.now())
  db.prepare('DELETE FROM novel_members WHERE expires_at IS NOT NULL AND expires_at < ?').run(Date.now())
  db.prepare('DELETE FROM share_presence WHERE last_seen_at < ?').run(Date.now() - 24 * 60 * 60 * 1000)
}

function createNotification(db, { userId, type = 'system', category = 'system', priority = 'normal', title, body, actionUrl = null, metadata = null, expiresAt = null }) {
  const id = randomBytes(16).toString('hex')
  const now = Date.now()
  db.prepare('INSERT INTO notifications (id, user_id, type, category, priority, title, body, action_url, created_at, expires_at, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, userId, type, category, priority, title, body, actionUrl, now, expiresAt, metadata ? JSON.stringify(metadata) : null)
  const room = notificationSockets.get(String(userId))
  if (room?.size) {
    const row = db.prepare('SELECT id, type, category, priority, title, body, action_url, read_at, created_at, metadata FROM notifications WHERE id = ? AND user_id = ?').get(id, userId)
    const payload = JSON.stringify({ type: 'notification:new', notification: { id: row.id, type: row.type, category: row.category, priority: row.priority, title: row.title, body: row.body, actionUrl: row.action_url || null, readAt: row.read_at || null, createdAt: row.created_at, metadata: row.metadata ? JSON.parse(row.metadata) : null } })
    for (const socket of room) if (socket.readyState === 1) socket.send(payload)
  }
  return id
}

// ---- rate limiting (per-IP sliding window) ----
function createRateLimiter({ max = 10, windowMs = 15 * 60 * 1000 } = {}) {
  const hits = new Map()
  const limited = (key, now) => {
    const arr = (hits.get(key) || []).filter((t) => now - t < windowMs)
    if (arr.length >= max) {
      hits.set(key, arr)
      return Math.max(0, windowMs - (now - arr[0]))
    }
    arr.push(now)
    hits.set(key, arr)
    return 0
  }
  const timer = setInterval(() => {
    const now = Date.now()
    for (const [key, arr] of hits) {
      const live = arr.filter((t) => now - t < windowMs)
      if (!live.length) hits.delete(key)
      else hits.set(key, live)
    }
  }, windowMs)
  timer.unref?.()
  return {
    limited,
    reset: () => hits.clear(),
    dispose: () => clearInterval(timer)
  }
}

// ---- http plumbing ----
async function readBody(req, maxBytes = 12 * 1024 * 1024) {
  let data = ''
  for await (const chunk of req) {
    data += chunk
    if (data.length > maxBytes) throw new Error('payload too large')
  }
  return data ? JSON.parse(data) : {}
}

function json(res, status, body) {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer'
  })
  res.end(text)
}

function securityHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https://cdn.discordapp.com https://lh3.googleusercontent.com; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://discord.com https://discordapp.com https://accounts.google.com https://oauth2.googleapis.com https://openidconnect.googleapis.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  }
}

function serveStatic(req, res, url, dist) {
  const pathname = decodeURIComponent(url.pathname || '/')
  const safe = normalize(pathname).replace(/^(\.\.[/\\])+/, '')
  let file = join(dist, safe)
  if (!file.startsWith(dist)) file = join(dist, 'index.html')

  try {
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html')
  } catch {
    return false
  }

  if (!existsSync(file)) {
    // SPA fallback for non-file routes.
    file = join(dist, 'index.html')
  }

  try {
    const body = readFileSync(file)
    const ext = extname(file).toLowerCase()
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream', ...securityHeaders() }
    if (file.endsWith('index.html')) headers['Cache-Control'] = 'no-cache'
    if (file.includes(`${join(dist, 'assets')}`)) headers['Cache-Control'] = 'public, max-age=31536000, immutable'
    if (file.endsWith('sw.js')) headers['Cache-Control'] = 'no-cache'
    res.writeHead(200, headers)
    res.end(body)
    return true
  } catch {
    return false
  }
}

// ---- the app ----
export function createMoonScribeServer({ db, dataDir, rateLimit, distDir, corsOrigins } = {}) {
  const dist = distDir || DIST
  const dir = dataDir || process.env.DATA_DIR || join(ROOT, 'data')
  const database = db || (() => {
    if (dir === ':memory:') return new DatabaseSync(':memory:')
    mkdirSync(dir, { recursive: true })
    return new DatabaseSync(join(dir, 'moonscribe.db'))
  })()
  setupSchema(database)
  const defaultFlags = [
    ['realtime_collaboration', 'Realtime Collaboration', 1, 100],
    ['desktop_beta', 'Experimental Desktop', 0, 0],
    ['ai_continuity', 'AI Continuity Assistant', 0, 0],
    ['new_editor_engine', 'New Editor Engine', 0, 0],
  ]
  for (const [key, label, enabled, rollout] of defaultFlags) database.prepare('INSERT OR IGNORE INTO feature_flags (key, label, enabled, rollout, updated_at) VALUES (?, ?, ?, ?, ?)').run(key, label, enabled, rollout, Date.now())
  // This is a server-side bootstrap identity, never a browser-controlled role.
  // It makes the owner's existing Discord account an admin on every restart.
  if (/^\d{17,20}$/.test(BOOTSTRAP_ADMIN_DISCORD_ID)) {
    database.prepare("UPDATE users SET role = 'admin', roles = 'user,admin' WHERE discord_id = ?").run(BOOTSTRAP_ADMIN_DISCORD_ID)
  }
  if (BOOTSTRAP_ADMIN_EMAIL) {
    database.prepare("UPDATE users SET role = 'admin', roles = 'user,admin' WHERE lower(email) = ?").run(BOOTSTRAP_ADMIN_EMAIL)
  }

  const opts = rateLimit === false ? { max: Number.MAX_SAFE_INTEGER, windowMs: 1 } : { ...(rateLimit || {}) }
  const limiter = createRateLimiter(opts)
  const allowedOrigins = new Set((corsOrigins || [
    APP_ORIGIN,
    `http://localhost:${PORT}`,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
    'http://tauri.localhost',
    'https://tauri.localhost',
    ...(process.env.CORS_ORIGINS || '').split(',')
  ]).map((origin) => String(origin).trim().replace(/\/+$/, '')).filter(Boolean))

  const isAllowedOrigin = (origin) => {
    try {
      const parsed = new URL(origin)
      return allowedOrigins.has(parsed.origin) || parsed.origin === CANONICAL_WEB_ORIGIN || (ALLOW_DEV_TUNNELS && parsed.protocol === 'https:' && DEV_TUNNEL_HOST.test(parsed.hostname))
    } catch { return false }
  }

  // Resolve the browser-visible application origin. OAuth callbacks and the
  // sync client must use this public URL, never the backend's localhost bind
  // address. Explicit configured origins remain authoritative in production;
  // recognized HTTPS tunnel hosts are accepted only in development.
  const publicOrigin = (req, requested = null) => {
    if (requested && isAllowedOrigin(requested)) return new URL(requested).origin
    const requestHost = String(req.headers.host || '').split(':')[0].toLowerCase()
    if (requestHost === 'moonscribe.cc' || requestHost === 'www.moonscribe.cc') return CANONICAL_WEB_ORIGIN
    const requestOrigin = req.headers.origin
    if (requestOrigin && isAllowedOrigin(requestOrigin)) return new URL(requestOrigin).origin
    if (process.env.TRUST_PROXY === 'true') {
      const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim()
      const forwardedProto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim()
      if (forwardedHost) {
        const forwarded = `${forwardedProto}://${forwardedHost}`
        if (isAllowedOrigin(forwarded)) return new URL(forwarded).origin
      }
    }
    return APP_ORIGIN
  }

  // In production the API may be deployed separately from the web app. If
  // API_ORIGIN was omitted, derive the callback host from the request instead
  // of sending Discord/Google back to a static web host that cannot exchange
  // the provider code.
  const oauthCallbackOrigin = (req) => {
    if (process.env.API_ORIGIN) return API_ORIGIN
    if (!IS_PRODUCTION) return API_ORIGIN
    const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim()
    const host = forwardedHost || String(req.headers.host || '').trim()
    if (!host) return API_ORIGIN
    const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim()
    const protocol = forwardedProto === 'http' ? 'http' : 'https'
    return `${protocol}://${host}`.replace(/\/+$/, '')
  }

  const authReturnTarget = (req, requested = null) => {
    if (requested === 'moonscribe://auth/callback') return requested
    return publicOrigin(req, requested)
  }
  const oauthResultLocation = (target, params) => target.startsWith('moonscribe:')
    ? `${target}?${params}`
    // Always land on the public root callback. The root mounts AppContext
    // without the signed-out studio guard, so the exchange request cannot be
    // redirected away before the token is stored.
    : `${target}/?${params}`

  const clientAddress = (req) => {
    if (process.env.TRUST_PROXY === 'true') return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown'
    return String(req.socket.remoteAddress || 'unknown')
  }
  const device = (req) => ({
    deviceId: String(req.headers['x-device-id'] || '').trim().slice(0, 120) || null,
    deviceName: String(req.headers['x-device-name'] || req.headers['user-agent'] || 'Unknown device').trim()
  })
  const presenceRowsFor = (novelId) => database.prepare(`SELECT u.id, u.username, u.discord_id, u.discord_avatar, u.google_avatar, p.chapter_id, p.last_seen_at, p.status, p.activity, p.workspace, p.tab_name, p.line_number, p.cursor_offset
    FROM share_presence p JOIN users u ON u.id = p.user_id WHERE p.novel_id = ? AND p.last_seen_at > ? ORDER BY p.last_seen_at DESC`)
    .all(String(novelId), Date.now() - 45_000)
  const serializePresenceRows = (rows) => rows.map((p) => ({ id: p.id, username: p.username, avatar: publicAvatar(p), chapterId: p.chapter_id, lastSeenAt: p.last_seen_at, status: p.status, activity: p.activity, workspace: p.workspace, tabName: p.tab_name, lineNumber: p.line_number, cursorOffset: p.cursor_offset }))

  function handleApi(req, res, url, path) {
    // Only configured browser origins may call the API cross-origin.
    const origin = req.headers.origin
    if (origin && isAllowedOrigin(origin)) res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
    if (req.method === 'OPTIONS') {
      res.writeHead(origin && !isAllowedOrigin(origin) ? 403 : 204)
      res.end()
      return
    }

    if (path === '/api/health' && req.method === 'GET') {
      try {
        database.prepare('SELECT 1 AS healthy').get()
        json(res, 200, {
          status: 'ok',
          database: 'ok',
          version: process.env.npm_package_version || 'unknown',
          timestamp: new Date().toISOString()
        })
      } catch {
        json(res, 503, { status: 'error', database: 'unavailable' })
      }
      return
    }

    // ---- Discord OAuth ----
    if (path === '/auth/discord' && req.method === 'GET') {
      if (!DISCORD_CLIENT_SECRET) {
        json(res, 503, { error: 'Discord sign-in is not configured on this server.' })
        return
      }
      const requestedRedirect = url.searchParams.get('redirect_to')
      const redirectTo = authReturnTarget(req, requestedRedirect)
      const state = oauthState({ redirectTo, provider: 'discord' })
      const callbackUrl = `${oauthCallbackOrigin(req)}/auth/discord/callback`
      const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(callbackUrl)}&response_type=code&scope=${DISCORD_SCOPES}&state=${state}`
      res.writeHead(302, { Location: authUrl, 'Cache-Control': 'no-store' })
      res.end()
      return
    }

    if (path === '/auth/discord/callback' && req.method === 'GET') {
      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')
      const stateData = readOauthState(state, 'discord')
      if (!code || !stateData) {
        res.writeHead(302, { Location: `${publicOrigin(req)}/?signin=1&discord_error=oauth_state_expired`, 'Cache-Control': 'no-store' })
        res.end()
        return
      }
      const callbackUrl = `${oauthCallbackOrigin(req)}/auth/discord/callback`
      ;(async () => {
        // Exchange code for Discord access token
        const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: DISCORD_CLIENT_ID,
            client_secret: DISCORD_CLIENT_SECRET,
            grant_type: 'authorization_code',
            code,
            redirect_uri: callbackUrl,
          }).toString()
        })
        const tokenData = await tokenRes.json()
        if (!tokenData.access_token) throw new Error(tokenData.error_description || 'Discord token exchange failed')

        // Fetch Discord user info
        const meRes = await fetch('https://discord.com/api/users/@me', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` }
        })
        const discordUser = await meRes.json()
        if (!meRes.ok || !discordUser.id) {
          const detail = discordUser?.message || discordUser?.error || `Discord profile request returned ${meRes.status}`
          throw new Error(`Discord profile request failed: ${detail}`)
        }

        // Linking never creates or switches the MoonScribe account.
        let user = stateData.mode === 'link'
          ? database.prepare('SELECT * FROM users WHERE id = ?').get(stateData.linkUserId)
          : database.prepare('SELECT * FROM users WHERE discord_id = ?').get(discordUser.id)
        const owner = database.prepare('SELECT id FROM users WHERE discord_id = ?').get(discordUser.id)
        if (stateData.mode === 'link' && owner && owner.id !== stateData.linkUserId) throw new Error('This Discord account already belongs to another MoonScribe account')
        if (stateData.mode === 'link' && !user) throw new Error('The current MoonScribe session is no longer valid.')
        if (!user) {
          const userId = randomBytes(12).toString('hex')
          let base = (discordUser.username || 'user').toLowerCase().replace(/[^a-z0-9._-]/g, '_').slice(0, 28)
          let uname = base
          let n = 0
          while (database.prepare('SELECT 1 FROM users WHERE username = ?').get(uname)) {
            uname = `${base}_${++n}`
          }
          const userCount = database.prepare('SELECT COUNT(*) AS n FROM users').get().n
          database.prepare(
            'INSERT INTO users (id, username, password_hash, discord_id, discord_avatar, discord_username, created_at, role, roles) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).run(userId, uname, '', discordUser.id, discordUser.avatar || '', discordUser.username || '', Date.now(), userCount === 0 ? 'admin' : 'user', userCount === 0 ? 'admin' : 'user')
          if (userCount === 0) claimLegacyRecords(database, userId)
          user = database.prepare('SELECT * FROM users WHERE id = ?').get(userId)
        } else {
          if (user.disabled_at) throw new Error('This MoonScribe account is disabled. Contact support to restore access.')
          // Refresh avatar/username
          if (stateData.mode === 'link') {
            database.prepare('UPDATE users SET discord_id = ?, discord_avatar = ?, discord_username = ? WHERE id = ?')
              .run(discordUser.id, discordUser.avatar || '', discordUser.username || '', user.id)
          } else {
            database.prepare('UPDATE users SET discord_avatar = ?, discord_username = ? WHERE discord_id = ?')
              .run(discordUser.avatar || '', discordUser.username || '', discordUser.id)
          }
        }

        const avatarUrl = discordUser.avatar
          ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
          : `https://cdn.discordapp.com/embed/avatars/${(BigInt(discordUser.id) >> 22n) % 6n}.png`

        // A short-lived, one-use code keeps the long-lived sync token out of
        // redirect URLs, browser history, and referrer headers.
        const exchange = randomBytes(24).toString('base64url')
        database.prepare('INSERT OR REPLACE INTO oauth_exchanges (code, user_id, username, avatar, provider, server_origin, expires_at, created_at, mode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(exchange, user.id, user.username, avatarUrl, 'discord', oauthCallbackOrigin(req), Date.now() + 2 * 60 * 1000, Date.now(), stateData.mode || 'login')
        if (supabasePersistenceEnabled) {
          const expiresAt = Date.now() + 2 * 60 * 1000
          await mirrorUserProfile(database, user.id)
          await mirrorOauthExchange({ code: exchange, userId: user.id, username: user.username, avatar: avatarUrl, provider: 'discord', serverOrigin: oauthCallbackOrigin(req), expiresAt, mode: stateData.mode || 'login' })
        }
        const params = new URLSearchParams({ discord_exchange: exchange, oauth_server: oauthCallbackOrigin(req), ...(stateData.mode === 'link' ? { linked: '1' } : {}) })
        res.writeHead(302, { Location: oauthResultLocation(stateData.redirectTo, params), 'Cache-Control': 'no-store' })
        res.end()
      })().catch((err) => {
        console.error('[Discord OAuth]', err.message)
        const message = String(err?.message || '')
        const failure = /fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT/i.test(message)
          ? 'discord_provider_unreachable'
          : /token exchange|invalid_client|invalid.*secret|unauthorized/i.test(message)
          ? 'discord_credentials_invalid'
          : /user|profile|retrieve Discord|Discord profile request/i.test(message)
            ? 'discord_profile_failed'
            : 'sign_in_failed'
        const errUrl = oauthResultLocation(stateData.redirectTo, new URLSearchParams({ discord_error: failure }))
        res.writeHead(302, { Location: errUrl, 'Cache-Control': 'no-store' })
        res.end()
      })
      return
    }

    if (path === '/auth/google' && req.method === 'GET') {
      if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return json(res, 503, { error: 'Google sign-in is not configured on this server.' })
      const requestedRedirect = url.searchParams.get('redirect_to')
      const redirectTo = authReturnTarget(req, requestedRedirect)
      const state = oauthState({ redirectTo, provider: 'google' })
      const callbackUrl = `${oauthCallbackOrigin(req)}/auth/google/callback`
      const params = new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, redirect_uri: callbackUrl, response_type: 'code', scope: 'openid email profile', state, access_type: 'online', prompt: 'select_account' })
      res.writeHead(302, { Location: `https://accounts.google.com/o/oauth2/v2/auth?${params}`, 'Cache-Control': 'no-store' })
      res.end()
      return
    }

    if (path === '/auth/google/callback' && req.method === 'GET') {
      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')
      const stateData = readOauthState(state, 'google')
      if (!code || !stateData) {
        res.writeHead(302, { Location: `${publicOrigin(req)}/?signin=1&oauth_error=oauth_state_expired`, 'Cache-Control': 'no-store' })
        res.end()
        return
      }
      const callbackUrl = `${oauthCallbackOrigin(req)}/auth/google/callback`
      ;(async () => {
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, code, grant_type: 'authorization_code', redirect_uri: callbackUrl }).toString() })
        const tokenData = await tokenRes.json()
        if (!tokenData.access_token) throw new Error(tokenData.error_description || 'Google token exchange failed')
        const profileRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${tokenData.access_token}` } })
        const profile = await profileRes.json()
        if (!profile.sub || !profile.email || profile.email_verified === false) throw new Error('Google did not return a verified email address.')
        const email = String(profile.email).toLowerCase()
        let user = stateData.mode === 'link'
          ? database.prepare('SELECT * FROM users WHERE id = ?').get(stateData.linkUserId)
          : database.prepare('SELECT * FROM users WHERE google_id = ? OR email = ?').get(profile.sub, email)
        const owner = database.prepare('SELECT id FROM users WHERE google_id = ? OR (email = ? AND email_verified = 1)').get(profile.sub, email)
        if (stateData.mode === 'link' && owner && owner.id !== stateData.linkUserId) {
          // Linking from Account Centre is an explicit merge request. Move
          // the existing Google account's library into the current account
          // before attaching the Google identity.
          const sourceUserId = owner.id
          mergeAccountRecords(database, sourceUserId, stateData.linkUserId)
          if (supabasePersistenceEnabled) await mergeSupabaseUser(sourceUserId, stateData.linkUserId)
          user = database.prepare('SELECT * FROM users WHERE id = ?').get(stateData.linkUserId)
        }
        if (stateData.mode === 'link' && !user) throw new Error('The current MoonScribe session is no longer valid.')
        if (!user) {
          const userId = randomBytes(12).toString('hex')
        const userCount = database.prepare('SELECT COUNT(*) AS n FROM users').get().n
        let base = email.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '_').slice(0, 28) || 'writer'
        let uname = base
        let n = 0
        while (database.prepare('SELECT 1 FROM users WHERE username = ?').get(uname)) uname = `${base}_${++n}`
        database.prepare('INSERT INTO users (id, username, password_hash, google_id, google_avatar, email, created_at, role, roles) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(userId, uname, '', profile.sub, profile.picture || '', email, Date.now(), userCount === 0 ? 'admin' : 'user', userCount === 0 ? 'admin' : 'user')
        user = database.prepare('SELECT * FROM users WHERE id = ?').get(userId)
        } else {
          if (user.disabled_at) throw new Error('This MoonScribe account is disabled. Contact support to restore access.')
          database.prepare('UPDATE users SET google_id = ?, google_avatar = ?, email = ? WHERE id = ?').run(profile.sub, profile.picture || '', email, user.id)
        }
        const exchange = randomBytes(24).toString('base64url')
        database.prepare('INSERT OR REPLACE INTO oauth_exchanges (code, user_id, username, avatar, provider, server_origin, expires_at, created_at, mode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(exchange, user.id, user.username, profile.picture || '', 'google', oauthCallbackOrigin(req), Date.now() + 2 * 60 * 1000, Date.now(), stateData.mode || 'login')
        if (supabasePersistenceEnabled) {
          const expiresAt = Date.now() + 2 * 60 * 1000
          await mirrorUserProfile(database, user.id)
          await mirrorOauthExchange({ code: exchange, userId: user.id, username: user.username, avatar: profile.picture || '', provider: 'google', serverOrigin: oauthCallbackOrigin(req), expiresAt, mode: stateData.mode || 'login' })
        }
        res.writeHead(302, { Location: oauthResultLocation(stateData.redirectTo, new URLSearchParams({ oauth_exchange: exchange, oauth_server: oauthCallbackOrigin(req), provider: 'google', ...(stateData.mode === 'link' ? { linked: '1' } : {}) })), 'Cache-Control': 'no-store' })
        res.end()
      })().catch((error) => {
        console.error('[Google OAuth]', error.message)
        const message = String(error?.message || '')
        const failure = /token exchange|invalid_client|unauthorized/i.test(message)
          ? 'google_credentials_invalid'
          : /email|verified|profile/i.test(message)
            ? 'google_profile_failed'
            : 'google_sign_in_failed'
        res.writeHead(302, { Location: oauthResultLocation(stateData.redirectTo, new URLSearchParams({ oauth_error: failure })), 'Cache-Control': 'no-store' })
        res.end()
      })
      return
    }

    if (path === '/api/auth/oauth/exchange' && req.method === 'POST') {
      readBody(req, 8 * 1024).then(async ({ code }) => {
        const exchange = database.prepare('SELECT * FROM oauth_exchanges WHERE code = ?').get(String(code || '')) || await consumeSupabaseOauthExchange(code)
        if (!exchange || Number(exchange.expires_at) < Date.now()) throw new Error('This sign-in link has expired. Please try again.')
        if (!database.prepare('SELECT 1 FROM users WHERE id = ? AND disabled_at IS NULL').get(exchange.user_id)) throw new Error('This MoonScribe account is disabled. Contact support to restore access.')
        database.prepare('DELETE FROM oauth_exchanges WHERE code = ?').run(String(code))
        const { token } = issueToken(database, exchange.user_id, device(req))
        json(res, 200, { token, accountId: exchange.user_id, username: exchange.username, avatar: exchange.avatar, provider: exchange.provider, server: exchange.server_origin || publicOrigin(req), linked: exchange.mode === 'link' })
      }).catch((error) => json(res, 400, { error: error.message }))
      return
    }

    if (path === '/api/auth/discord/exchange' && req.method === 'POST') {
        readBody(req, 8 * 1024)
        .then(async ({ code }) => {
          const exchange = database.prepare('SELECT * FROM oauth_exchanges WHERE code = ?').get(String(code || '')) || await consumeSupabaseOauthExchange(code)
          if (!exchange || Number(exchange.expires_at) < Date.now()) throw new Error('This sign-in link has expired. Please try again.')
          if (!database.prepare('SELECT 1 FROM users WHERE id = ? AND disabled_at IS NULL').get(exchange.user_id)) throw new Error('This MoonScribe account is disabled. Contact support to restore access.')
          database.prepare('DELETE FROM oauth_exchanges WHERE code = ?').run(String(code))
          const { token } = issueToken(database, exchange.user_id, device(req))
          json(res, 200, { token, accountId: exchange.user_id, username: exchange.username, avatar: exchange.avatar, provider: exchange.provider || 'discord', server: exchange.server_origin || publicOrigin(req), linked: exchange.mode === 'link' })
        })
        .catch((err) => json(res, 400, { error: err.message }))
      return
    }

    if (path === '/api/auth/status' && req.method === 'GET') {
      const userCount = database.prepare('SELECT COUNT(*) AS count FROM users').get().count
      const activeSessions = database.prepare('SELECT COUNT(*) AS count FROM tokens WHERE expires_at IS NULL OR expires_at > ?').get(Date.now()).count
      json(res, 200, { online: true, emailAuth: true, discordAuth: !!DISCORD_CLIENT_SECRET, googleAuth: !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET), emailDelivery: isEmailConfigured(), users: userCount, activeSessions, database: 'SQLite', appOrigin: publicOrigin(req) })
      return
    }

    if (path === '/api/auth/magic-link' && req.method === 'POST') {
      const retryAfter = limiter.limited(clientAddress(req), Date.now())
      if (retryAfter) { json(res, 429, { error: 'Too many attempts — wait a bit, then try again.' }); return }
      readBody(req, 8 * 1024).then(async ({ email, redirect_to: redirectTo }) => {
        const address = String(email || '').trim().toLowerCase()
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) throw new Error('Enter a valid email address.')
        // Ignore browser redirect_to values here: Resend links always use the
        // canonical public MoonScribe origin, including during local testing.
        const target = MAGIC_LINK_ORIGIN
        const user = database.prepare('SELECT id, username, email, disabled_at FROM users WHERE email = ?').get(address)
        // Always return the same response for unknown addresses.
        if (user && !user.disabled_at && isEmailConfigured()) {
          const rawToken = randomBytes(32).toString('base64url')
          database.prepare('DELETE FROM magic_links WHERE user_id = ? AND used_at IS NULL').run(user.id)
          database.prepare('INSERT INTO magic_links (id, token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?)').run(randomBytes(12).toString('hex'), sha(rawToken), user.id, Date.now() + 15 * 60 * 1000, Date.now())
          const separator = target.includes('?') ? '&' : '?'
          const link = `${target}${separator}magic_token=${encodeURIComponent(rawToken)}`
          const delivery = await sendMagicLink({ to: address, username: user.username, link })
          if (!delivery.ok) console.error('[Magic Link]', delivery.reason || delivery.error)
        }
        json(res, 200, { ok: true, message: 'If that email is connected to MoonScribe, a sign-in link is on its way.' })
      }).catch((err) => json(res, 400, { error: err.message }))
      return
    }

    if (path === '/api/auth/magic-link/consume' && req.method === 'POST') {
      readBody(req, 8 * 1024).then(({ token }) => {
        const row = database.prepare('SELECT * FROM magic_links WHERE token_hash = ? AND used_at IS NULL').get(sha(String(token || '')))
        if (!row || row.expires_at < Date.now()) throw new Error('This sign-in link has expired. Please request another.')
        database.prepare('UPDATE magic_links SET used_at = ? WHERE id = ?').run(Date.now(), row.id)
        const user = database.prepare('SELECT id, username, email FROM users WHERE id = ? AND disabled_at IS NULL').get(row.user_id)
        if (!user) throw new Error('This sign-in link is no longer valid.')
        const { token: sessionToken } = issueToken(database, user.id, device(req))
        json(res, 200, { ok: true, token: sessionToken, accountId: user.id, username: user.username, server: API_ORIGIN, provider: 'magic' })
      }).catch((err) => json(res, 400, { error: err.message }))
      return
    }

    if (path === '/api/auth/request-verification' && req.method === 'POST') {
      readBody(req, 8 * 1024)
        .then(({ email }) => {
          const address = String(email || '').trim().toLowerCase()
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) throw new Error('Enter a valid email address.')
          const user = database.prepare('SELECT * FROM users WHERE email = ?').get(address)
          if (!user) return json(res, 404, { error: 'No account is linked to that email yet.' })
          const { code, expiresAt } = issueEmailCode(database, user.id, 'email_verification')
          database.prepare('UPDATE users SET email_verification_code = ?, email_verification_expires_at = ? WHERE id = ?').run(code, expiresAt, user.id)
          if (isEmailConfigured()) sendVerificationCode({ to: address, username: user.username, code, appOrigin: publicOrigin(req) })
          json(res, 200, { ok: true, email: address, codeSent: true, expiresAt })
        })
        .catch((err) => json(res, 400, { error: err.message }))
      return
    }

    if (path === '/api/auth/request-password-reset' && req.method === 'POST') {
      readBody(req, 8 * 1024).then(({ email }) => {
        const address = String(email || '').trim().toLowerCase()
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) throw new Error('Enter a valid email address.')
        const user = database.prepare('SELECT * FROM users WHERE email = ?').get(address)
        if (!user) return json(res, 404, { error: 'No MoonScribe account uses that email address.' })
        const { code, expiresAt } = issueEmailCode(database, user.id, 'password_reset')
        if (isEmailConfigured()) sendVerificationCode({ to: address, username: user.username, code, appOrigin: publicOrigin(req), expiresAt })
        json(res, 200, { ok: true, email: address, expiresAt })
      }).catch((err) => json(res, 400, { error: err.message }))
      return
    }

    if (path === '/api/auth/reset-password' && req.method === 'POST') {
      readBody(req, 8 * 1024).then(({ email, code, password }) => {
        const address = String(email || '').trim().toLowerCase()
        if (String(password || '').length < 10) throw new Error('Your password needs at least 10 characters.')
        const user = database.prepare('SELECT id FROM users WHERE email = ?').get(address)
        if (!user || !verifyEmailCode(database, user.id, 'password_reset', code)) throw new Error('That reset code is invalid or expired.')
        database.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), user.id)
        database.prepare('DELETE FROM tokens WHERE user_id = ?').run(user.id)
        json(res, 200, { ok: true })
      }).catch((err) => json(res, 400, { error: err.message }))
      return
    }

    // ---- accounts (rate-limited) ----
    if (path === '/api/auth/register' && req.method === 'POST') {
      const retryAfter = limiter.limited(clientAddress(req), Date.now())
      if (retryAfter) {
        json(res, 429, { error: 'Too many attempts — wait a bit, then try again.' })
        return
      }
      readBody(req)
        .then(async ({ username, password, email }) => {
          const identity = String(username || '').trim().toLowerCase()
          const normalizedEmail = String(email || '').trim().toLowerCase()
          const resolvedEmail = normalizedEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ? normalizedEmail : (identity.includes('@') ? identity : null)
          let name = resolvedEmail ? resolvedEmail.split('@')[0].replace(/[^a-z0-9._-]/g, '_').slice(0, 28) : identity
          if (resolvedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resolvedEmail)) throw new Error('Enter a valid email address.')
          if (resolvedEmail) { let candidate = name || 'writer'; let n = 0; while (database.prepare('SELECT 1 FROM users WHERE username = ?').get(candidate)) candidate = `${name || 'writer'}_${++n}`; name = candidate }
          if (name.length < 2 || name.length > 40) throw new Error('A username needs between 2 and 40 characters.')
          if (!/^[a-z0-9._-]+$/.test(name)) throw new Error('Usernames can only use letters, numbers, dots, dashes and underscores.')
          const pass = String(password || '')
          if (pass.length < 10) throw new Error('Your password needs at least 10 characters.')
          if (pass.length > 200) throw new Error('That password is too long.')
          const existing = database.prepare('SELECT 1 FROM users WHERE username = ?').get(name)
          if (existing || (resolvedEmail && database.prepare('SELECT 1 FROM users WHERE email = ?').get(resolvedEmail))) throw new Error('That account already exists — try signing in instead.')
          const userId = randomBytes(12).toString('hex')
          const userCount = database.prepare('SELECT COUNT(*) AS n FROM users').get().n
          database.prepare('INSERT INTO users (id, username, password_hash, email, created_at, role, roles, email_verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
            userId, name, hashPassword(password), resolvedEmail, Date.now(), userCount === 0 ? 'admin' : 'user', userCount === 0 ? 'admin' : 'user', resolvedEmail ? 0 : 1
          )
          if (userCount === 0) claimLegacyRecords(database, userId)
          if (resolvedEmail) {
            const { code, expiresAt } = issueEmailCode(database, userId, 'email_verification')
            database.prepare('UPDATE users SET email_verification_code = ?, email_verification_expires_at = ? WHERE id = ?').run(code, expiresAt, userId)
            if (isEmailConfigured()) await sendVerificationCode({ to: resolvedEmail, username: name, code, appOrigin: publicOrigin(req) }).catch(() => null)
          }
          const { token } = issueToken(database, userId, device(req))
          json(res, 200, { token, accountId: userId, username: name, emailVerified: resolvedEmail ? false : true })
        })
        .catch((err) => json(res, 400, { error: err.message }))
      return
    }

    if (path === '/api/auth/login' && req.method === 'POST') {
      const retryAfter = limiter.limited(clientAddress(req), Date.now())
      if (retryAfter) {
        json(res, 429, { error: 'Too many attempts — wait a bit, then try again.' })
        return
      }
      readBody(req)
        .then(async ({ username, password }) => {
          const name = String(username || '').trim().toLowerCase()
          const user = database.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(name, name)
          if (!user || !verifyPassword(password, user.password_hash)) {
            return json(res, 401, { error: 'That username or password didn’t match.' })
          }
          if (user.disabled_at) return json(res, 403, { error: 'This MoonScribe account is disabled. Contact support to restore access.' })
          if (Number(user.two_factor_enabled) === 1) {
            const { code, expiresAt } = issueEmailCode(database, user.id, 'two_factor')
            database.prepare('UPDATE users SET two_factor_code = ?, two_factor_expires_at = ? WHERE id = ?').run(code, expiresAt, user.id)
            if (isEmailConfigured() && user.email) await sendTwoFactorCode({ to: user.email, username: user.username, code }).catch(() => null)
            return json(res, 200, { requires2fa: true, userId: user.id, username: user.username, email: user.email || null })
          }
          const { token } = issueToken(database, user.id, device(req))
          json(res, 200, { token, accountId: user.id, username: user.username, emailVerified: Number(user.email_verified) === 1 })
        })
        .catch(() => json(res, 400, { error: 'Bad request.' }))
      return
    }

    // A second-factor confirmation cannot require a session token: the preceding
    // password step deliberately does not issue one. It is still rate-limited,
    // short-lived, one-use, and scoped to the account id returned by that step.
    if (path === '/api/auth/verify-2fa' && req.method === 'POST') {
      const retryAfter = limiter.limited(clientAddress(req), Date.now())
      if (retryAfter) {
        json(res, 429, { error: 'Too many attempts — wait a bit, then try again.' })
        return
      }
      readBody(req, 8 * 1024).then(({ userId: targetId, code }) => {
        const target = database.prepare('SELECT * FROM users WHERE id = ? AND two_factor_enabled = 1 AND disabled_at IS NULL').get(String(targetId || ''))
        if (!target) return json(res, 400, { error: 'The sign-in request is no longer valid. Start again.' })
        const valid = verifyEmailCode(database, target.id, 'two_factor', code)
        if (!valid) return json(res, 400, { error: 'That security code is invalid or expired.' })
        const { token } = issueToken(database, target.id, device(req))
        json(res, 200, { token, accountId: target.id, username: target.username })
      }).catch((err) => json(res, 400, { error: err.message }))
      return
    }

    if (path === '/api/auth/logout' && req.method === 'POST') {
      const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
      database.prepare('DELETE FROM tokens WHERE token_hash = ?').run(sha(token))
      json(res, 200, { ok: true })
      return
    }

    // ---- protected sync endpoints ----
    const userId = userFromToken(database, (req.headers.authorization || '').replace(/^Bearer\s+/i, ''))
    const betaFeatureAllowed = () => {
      const current = userId ? database.prepare('SELECT role, roles FROM users WHERE id = ?').get(userId) : null
      const roles = userRoleInfo(current).roles
      return roles.includes('admin') || roles.includes('developer') || roles.includes('beta_tester')
    }
    if (!userId) {
      json(res, 401, { error: 'Not signed in. Create an account or sign in.' })
      return
    }

    // Linking is deliberately separate from login. The browser must prove an
    // existing MoonScribe session before an OAuth provider can be attached.
    if (path === '/api/auth/link/start' && req.method === 'POST') {
      readBody(req, 8 * 1024).then(({ provider, redirect_to }) => {
        const providerName = provider === 'google' || provider === 'discord' ? provider : null
        if (!providerName) return json(res, 400, { error: 'Unsupported sign-in method.' })
        if (providerName === 'discord' && !DISCORD_CLIENT_SECRET) return json(res, 503, { error: 'Discord sign-in is not configured.' })
        if (providerName === 'google' && (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET)) return json(res, 503, { error: 'Google sign-in is not configured.' })
        const redirectTo = authReturnTarget(req, redirect_to)
        const state = oauthState({ redirectTo, provider: providerName, mode: 'link', linkUserId: userId })
        const callbackUrl = `${oauthCallbackOrigin(req)}/auth/${providerName}/callback`
        const params = providerName === 'google'
          ? new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, redirect_uri: callbackUrl, response_type: 'code', scope: 'openid email profile', state, access_type: 'online', prompt: 'select_account' })
          : new URLSearchParams({ client_id: DISCORD_CLIENT_ID, redirect_uri: callbackUrl, response_type: 'code', scope: DISCORD_SCOPES, state })
        const url = providerName === 'google' ? `https://accounts.google.com/o/oauth2/v2/auth?${params}` : `https://discord.com/api/oauth2/authorize?${params}`
        json(res, 200, { ok: true, provider: providerName, url })
      }).catch((error) => json(res, 400, { error: error.message }))
      return
    }

    if (path === '/api/auth/verify-email' && req.method === 'POST') {
      readBody(req, 8 * 1024).then(({ code }) => {
        const user = database.prepare('SELECT * FROM users WHERE id = ?').get(userId)
        if (!user || !user.email) return json(res, 400, { error: 'Add an email address before verifying it.' })
        const valid = verifyEmailCode(database, user.id, 'email_verification', code)
        if (!valid) return json(res, 400, { error: 'That verification code is invalid or expired.' })
        database.prepare('UPDATE users SET email_verified = 1, email_verification_code = NULL, email_verification_expires_at = NULL WHERE id = ?').run(user.id)
        json(res, 200, { ok: true, verified: true })
      }).catch((err) => json(res, 400, { error: err.message }))
      return
    }

    if (path === '/api/auth/update-account' && req.method === 'POST') {
      readBody(req, 12 * 1024).then(async ({ username, email, password, content, notify }) => {
        const user = database.prepare('SELECT * FROM users WHERE id = ?').get(userId)
        if (!user) return json(res, 401, { error: 'Account no longer exists.' })
        const nextUsername = typeof username === 'string' && username.trim() ? username.trim() : user.username
        if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{1,39}$/.test(nextUsername)) throw new Error('Username must be 2–40 characters and use letters, numbers, dots, dashes or underscores.')
        const usernameOwner = database.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE AND id <> ?').get(nextUsername, userId)
        if (usernameOwner) throw new Error('That username is already in use.')
        const nextEmail = typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : user.email
        if (nextEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) throw new Error('Enter a valid email address.')
        if (typeof password === 'string' && password.trim()) {
          if (password.length < 10) throw new Error('Your password needs at least 10 characters.')
          database.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), userId)
        }
        if (nextUsername !== user.username) database.prepare('UPDATE users SET username = ? WHERE id = ?').run(nextUsername, userId)
        if (nextEmail && nextEmail !== user.email) {
          database.prepare('UPDATE users SET email = ?, email_verified = 0 WHERE id = ?').run(nextEmail, userId)
          if (isEmailConfigured()) {
            const { code, expiresAt } = issueEmailCode(database, user.id, 'email_verification')
            database.prepare('UPDATE users SET email_verification_code = ?, email_verification_expires_at = ? WHERE id = ?').run(code, expiresAt, userId)
            await sendAccountUpdateEmail({ to: nextEmail, username: user.username, summary: 'Your email address was updated. Verify it to keep your account protected.' }).catch(() => null)
            await sendVerificationCode({ to: nextEmail, username: user.username, code, appOrigin: publicOrigin(req) }).catch(() => null)
          }
        }
        if (content && typeof content === 'object') {
          if (content.remindersEnabled !== undefined) {
            database.prepare('UPDATE users SET notification_email = ? WHERE id = ?').run(content.remindersEnabled ? (nextEmail || user.email) : null, userId)
          }
        }
        if (notify && typeof notify === 'string' && user.email) {
          await sendAccountUpdateEmail({ to: user.email, username: user.username, summary: notify }).catch(() => null)
        }
        json(res, 200, { ok: true, username: nextUsername, email: nextEmail || null })
      }).catch((err) => json(res, 400, { error: err.message }))
      return
    }

    if (path === '/api/auth/disable-account' && req.method === 'POST') {
      readBody(req, 8 * 1024).then(({ confirmation }) => {
        const user = database.prepare('SELECT username FROM users WHERE id = ?').get(userId)
        if (!user) return json(res, 404, { error: 'Account not found.' })
        if (String(confirmation || '').trim().toLowerCase() !== String(user.username).toLowerCase()) return json(res, 400, { error: `Type ${user.username} to confirm account deactivation.` })
        const now = Date.now()
        database.prepare('UPDATE users SET disabled_at = ? WHERE id = ?').run(now, userId)
        database.prepare('DELETE FROM tokens WHERE user_id = ?').run(userId)
        database.prepare('DELETE FROM share_presence WHERE user_id = ?').run(userId)
        json(res, 200, { ok: true, disabledAt: now })
      }).catch((err) => json(res, 400, { error: err.message }))
      return
    }

    if (path === '/api/auth/delete-account' && req.method === 'POST') {
      readBody(req, 8 * 1024).then(({ confirmation }) => {
        const user = database.prepare('SELECT username FROM users WHERE id = ?').get(userId)
        if (!user) return json(res, 404, { error: 'Account not found.' })
        if (String(confirmation || '').trim() !== String(user.username)) return json(res, 400, { error: `Type ${user.username} exactly to permanently delete this account.` })
        database.exec('BEGIN')
        try {
          database.prepare('DELETE FROM records WHERE user_id = ?').run(userId)
          database.prepare('DELETE FROM tokens WHERE user_id = ?').run(userId)
          database.prepare('DELETE FROM notifications WHERE user_id = ?').run(userId)
          database.prepare('DELETE FROM email_tokens WHERE user_id = ?').run(userId)
          database.prepare('DELETE FROM magic_links WHERE user_id = ?').run(userId)
          database.prepare('DELETE FROM novel_members WHERE member_user_id = ? OR owner_user_id = ?').run(userId, userId)
          database.prepare('DELETE FROM share_presence WHERE user_id = ?').run(userId)
          database.prepare('DELETE FROM users WHERE id = ?').run(userId)
          database.exec('COMMIT')
          json(res, 200, { ok: true, deleted: true })
        } catch (error) {
          database.exec('ROLLBACK')
          throw error
        }
      }).catch((err) => json(res, 400, { error: err.message }))
      return
    }

    if (path === '/api/auth/enable-2fa' && req.method === 'POST') {
      readBody(req, 8 * 1024).then(async ({ enable }) => {
        const user = database.prepare('SELECT * FROM users WHERE id = ?').get(userId)
        const shouldEnable = enable !== false
        if (!user) return json(res, 401, { error: 'Account no longer exists.' })
        if (!shouldEnable) {
          database.prepare('UPDATE users SET two_factor_enabled = 0, two_factor_code = NULL, two_factor_expires_at = NULL WHERE id = ?').run(userId)
          database.prepare("DELETE FROM email_tokens WHERE user_id = ? AND purpose = 'two_factor'").run(userId)
          json(res, 200, { ok: true, enabled: false })
          return
        }
        if (!user.email || Number(user.email_verified) !== 1) return json(res, 400, { error: 'Verify an email address before enabling 2FA.' })
        if (!isEmailConfigured()) return json(res, 503, { error: 'Email delivery is not configured, so 2FA cannot be enabled yet.' })
        const { code, expiresAt } = issueEmailCode(database, user.id, 'two_factor')
        database.prepare('UPDATE users SET two_factor_enabled = 1, two_factor_code = NULL, two_factor_expires_at = ? WHERE id = ?').run(expiresAt, userId)
        const delivery = await sendTwoFactorCode({ to: user.email, username: user.username, code })
        if (!delivery.ok) {
          database.prepare('UPDATE users SET two_factor_enabled = 0, two_factor_expires_at = NULL WHERE id = ?').run(userId)
          database.prepare("DELETE FROM email_tokens WHERE user_id = ? AND purpose = 'two_factor'").run(userId)
          throw new Error('MoonScribe could not send the security code. 2FA was not enabled.')
        }
        json(res, 200, { ok: true, enabled: true, requiresVerification: true })
      }).catch((err) => json(res, 400, { error: err.message }))
      return
    }

    if (path === '/api/auth/reminder' && req.method === 'POST') {
      readBody(req, 8 * 1024).then(async ({ title, message }) => {
        const user = database.prepare('SELECT * FROM users WHERE id = ?').get(userId)
        if (!user || !user.email) return json(res, 400, { error: 'No email is attached to this account.' })
        const summary = String(title || 'MoonScribe reminder')
        const details = String(message || 'A quick reminder from your writing studio.')
        if (isEmailConfigured()) await sendReminderEmail({ to: user.email, username: user.username, title: summary, message: details })
        json(res, 200, { ok: true, sent: isEmailConfigured() })
      }).catch((err) => json(res, 400, { error: err.message }))
      return
    }

    if (path === '/api/auth/me' && req.method === 'GET') {
      const user = database.prepare('SELECT id, username, email, discord_id, discord_username, discord_avatar, google_id, google_avatar, email_verified, two_factor_enabled, created_at, disabled_at, role, roles FROM users WHERE id = ?').get(userId)
      if (!user) return json(res, 401, { error: 'Account no longer exists.' })
      const roleInfo = userRoleInfo(user)
      json(res, 200, { account: { id: user.id, username: user.username, email: user.email || null, provider: user.discord_id ? 'discord' : user.google_id ? 'google' : 'email', discordUsername: user.discord_username || null, discordAvatar: user.discord_avatar || user.google_avatar || null, emailVerified: Number(user.email_verified) === 1, twoFactorEnabled: Number(user.two_factor_enabled) === 1, disabledAt: user.disabled_at || null, createdAt: user.created_at, role: roleInfo.role, roles: roleInfo.roles, isAdmin: roleInfo.isAdmin, isDeveloper: roleInfo.isDeveloper, linkedProviders: { discord: Boolean(user.discord_id), google: Boolean(user.google_id), password: Boolean(user.password_hash) } } })
      return
    }

    if (path === '/api/auth/session/refresh' && req.method === 'POST') {
      const current = database.prepare('SELECT device_id, device_name FROM tokens WHERE token_hash = ?').get(sha((req.headers.authorization || '').replace(/^Bearer\s+/i, '')))
      if (!current || !userId) return json(res, 401, { error: 'Session expired. Please sign in again.' })
      const session = issueToken(database, userId, { deviceId: current.device_id, deviceName: current.device_name || 'Unknown device' })
      json(res, 200, { ok: true, token: session.token, expiresAt: session.expiresAt, sessionId: session.sessionId })
      return
    }

    if (path === '/api/notifications' && req.method === 'GET') {
      const now = Date.now()
      const rows = database.prepare('SELECT id, type, category, priority, title, body, action_url, read_at, created_at, metadata FROM notifications WHERE user_id = ? AND (expires_at IS NULL OR expires_at > ?) ORDER BY created_at DESC LIMIT 50').all(userId, now)
      const unread = database.prepare('SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND read_at IS NULL AND (expires_at IS NULL OR expires_at > ?)').get(userId, now)
      json(res, 200, { unreadCount: Number(unread?.count || 0), notifications: rows.map((row) => ({ id: row.id, type: row.type, category: row.category, priority: row.priority, title: row.title, body: row.body, actionUrl: row.action_url || null, readAt: row.read_at || null, createdAt: row.created_at, metadata: row.metadata ? JSON.parse(row.metadata) : null })) })
      return
    }

    if (path === '/api/announcements' && req.method === 'GET') {
      const announcements = database.prepare('SELECT id, title, body, severity, created_at, updated_at FROM announcements WHERE published = 1 ORDER BY created_at DESC LIMIT 20').all()
      json(res, 200, { announcements: announcements.map((item) => ({ id: item.id, title: item.title, body: item.body, severity: item.severity, createdAt: item.created_at, updatedAt: item.updated_at })) })
      return
    }

    if (path === '/api/notifications/read-all' && req.method === 'POST') {
      database.prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL').run(Date.now(), userId)
      json(res, 200, { ok: true })
      return
    }

    if (path.startsWith('/api/notifications/') && path.endsWith('/read') && req.method === 'POST') {
      const notificationId = path.slice('/api/notifications/'.length, -'/read'.length)
      const result = database.prepare('UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ?').run(Date.now(), notificationId, userId)
      if (!result.changes) return json(res, 404, { error: 'Notification not found.' })
      json(res, 200, { ok: true })
      return
    }

    if (path === '/api/admin/users' && req.method === 'GET') {
      const user = database.prepare('SELECT id, role, roles FROM users WHERE id = ?').get(userId)
      const currentRoleInfo = userRoleInfo(user)
      if (!currentRoleInfo.isAdmin) return json(res, 403, { error: 'Admin access required.' })
      const users = database.prepare('SELECT id, username, email, role, roles, disabled_at, created_at FROM users ORDER BY created_at DESC').all().map((row) => {
        const roleInfo = userRoleInfo(row)
        return { id: row.id, username: row.username, email: row.email || null, role: roleInfo.role, roles: roleInfo.roles, disabledAt: row.disabled_at || null, createdAt: row.created_at }
      })
      json(res, 200, { users })
      return
    }

    if (path === '/api/admin/audit' && req.method === 'GET') {
      const user = database.prepare('SELECT id, role, roles FROM users WHERE id = ?').get(userId)
      if (!userRoleInfo(user).isAdmin) return json(res, 403, { error: 'Admin access required.' })
      const events = database.prepare('SELECT id, actor_username, action, target_username, detail, created_at FROM admin_audit ORDER BY created_at DESC LIMIT 100').all()
      json(res, 200, { events: events.map((event) => ({ id: event.id, actor: event.actor_username, action: event.action, target: event.target_username, detail: event.detail, createdAt: event.created_at })) })
      return
    }

    if (path === '/api/admin/feature-flags' && req.method === 'GET') {
      const user = database.prepare('SELECT id, role, roles FROM users WHERE id = ?').get(userId)
      if (!userRoleInfo(user).isAdmin) return json(res, 403, { error: 'Admin access required.' })
      const flags = database.prepare('SELECT key, label, enabled, rollout, updated_at FROM feature_flags ORDER BY label').all().map((flag) => ({ key: flag.key, label: flag.label, enabled: Boolean(flag.enabled), rollout: flag.rollout, updatedAt: flag.updated_at }))
      json(res, 200, { flags })
      return
    }

    if (path === '/api/admin/announcements' && req.method === 'GET') {
      const user = database.prepare('SELECT role, roles FROM users WHERE id = ?').get(userId)
      if (!userRoleInfo(user).isAdmin) return json(res, 403, { error: 'Admin access required.' })
      const announcements = database.prepare('SELECT id, title, body, severity, published, created_by, created_at, updated_at FROM announcements ORDER BY created_at DESC LIMIT 100').all()
      json(res, 200, { announcements })
      return
    }

    if (path === '/api/admin/announcements' && req.method === 'POST') {
      const user = database.prepare('SELECT username, role, roles FROM users WHERE id = ?').get(userId)
      if (!userRoleInfo(user).isAdmin) return json(res, 403, { error: 'Admin access required.' })
      readBody(req, 16 * 1024).then(({ title, body, severity = 'info' }) => {
        const cleanTitle = String(title || '').trim()
        const cleanBody = String(body || '').trim().replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\son\w+\s*=\s*(["']).*?\1/gi, '')
        if (!cleanTitle || !cleanBody) throw new Error('Title and body are required.')
        if (cleanTitle.length > 160 || cleanBody.length > 4000) throw new Error('Announcement is too long.')
        const allowedSeverity = ['info', 'success', 'warning', 'critical'].includes(severity) ? severity : 'info'
        const id = randomBytes(12).toString('hex')
        const now = Date.now()
        database.prepare('INSERT INTO announcements (id, title, body, severity, published, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?, ?)').run(id, cleanTitle, cleanBody, allowedSeverity, user.username, now, now)
        database.prepare('INSERT INTO admin_audit (actor_user_id, actor_username, action, target_user_id, target_username, detail, created_at) VALUES (?, ?, ?, NULL, NULL, ?, ?)').run(userId, user.username, 'announcement.created', cleanTitle, now)
        json(res, 201, { ok: true, announcement: { id, title: cleanTitle, body: cleanBody, severity: allowedSeverity, createdAt: now, updatedAt: now } })
      }).catch((err) => json(res, 400, { error: err.message }))
      return
    }

    if (path.startsWith('/api/admin/announcements/') && req.method === 'DELETE') {
      const user = database.prepare('SELECT username, role, roles FROM users WHERE id = ?').get(userId)
      if (!userRoleInfo(user).isAdmin) return json(res, 403, { error: 'Admin access required.' })
      const announcementId = path.replace('/api/admin/announcements/', '').split('/')[0]
      const existing = database.prepare('SELECT title FROM announcements WHERE id = ?').get(announcementId)
      if (!existing) return json(res, 404, { error: 'Announcement not found.' })
      database.prepare('DELETE FROM announcements WHERE id = ?').run(announcementId)
      database.prepare('INSERT INTO admin_audit (actor_user_id, actor_username, action, target_user_id, target_username, detail, created_at) VALUES (?, ?, ?, NULL, NULL, ?, ?)').run(userId, user.username, 'announcement.deleted', existing.title, Date.now())
      json(res, 200, { ok: true })
      return
    }

    if (path.startsWith('/api/admin/feature-flags/') && req.method === 'POST') {
      const user = database.prepare('SELECT id, username, role, roles FROM users WHERE id = ?').get(userId)
      if (!userRoleInfo(user).isAdmin) return json(res, 403, { error: 'Admin access required.' })
      const key = path.replace('/api/admin/feature-flags/', '').split('/')[0]
      readBody(req, 8 * 1024).then(({ enabled, rollout }) => {
        const flag = database.prepare('SELECT label FROM feature_flags WHERE key = ?').get(key)
        if (!flag) throw new Error('Feature flag not found.')
        const nextEnabled = enabled ? 1 : 0
        const nextRollout = Math.max(0, Math.min(100, Number(rollout ?? 0)))
        database.prepare('UPDATE feature_flags SET enabled = ?, rollout = ?, updated_by = ?, updated_at = ? WHERE key = ?').run(nextEnabled, nextRollout, user.username, Date.now(), key)
        database.prepare('INSERT INTO admin_audit (actor_user_id, actor_username, action, target_user_id, target_username, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(userId, user.username, 'feature.updated', null, null, `${flag.label} ${nextEnabled ? 'enabled' : 'disabled'} at ${nextRollout}%`, Date.now())
        json(res, 200, { ok: true, key, enabled: Boolean(nextEnabled), rollout: nextRollout })
      }).catch((err) => json(res, 400, { error: err.message }))
      return
    }

    if (path.startsWith('/api/admin/users/') && path.endsWith('/enable') && req.method === 'POST') {
      const user = database.prepare('SELECT id, username, role, roles FROM users WHERE id = ?').get(userId)
      if (!userRoleInfo(user).isAdmin) return json(res, 403, { error: 'Admin access required.' })
      const targetId = path.replace(/^\/api\/admin\/users\//, '').replace(/\/enable$/, '')
      const target = database.prepare('SELECT username, disabled_at FROM users WHERE id = ?').get(targetId)
      if (!target) return json(res, 404, { error: 'Account not found.' })
      database.prepare('UPDATE users SET disabled_at = NULL WHERE id = ?').run(targetId)
      database.prepare('INSERT INTO admin_audit (actor_user_id, actor_username, action, target_user_id, target_username, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(userId, user.username, 'account.enabled', targetId, target.username, target.disabled_at ? 'Disabled account restored' : 'Account was already enabled', Date.now())
      json(res, 200, { ok: true, enabled: true })
      return
    }

    if ((path.startsWith('/api/admin/users/') && req.method === 'DELETE') || (path.startsWith('/api/admin/users/') && path.endsWith('/delete') && req.method === 'POST')) {
      const actor = database.prepare('SELECT id, username, role, roles FROM users WHERE id = ?').get(userId)
      if (!userRoleInfo(actor).isAdmin) return json(res, 403, { error: 'Admin access required.' })
      const targetId = path.replace(/^\/api\/admin\/users\//, '').split('/')[0]
      const target = database.prepare('SELECT id, username, role, roles FROM users WHERE id = ?').get(targetId)
      if (!target) return json(res, 404, { error: 'Account not found.' })
      if (userRoleInfo(target).isAdmin) return json(res, 403, { error: 'Administrator accounts cannot be deleted.' })
      readBody(req, 8 * 1024).then(({ confirmation }) => {
        if (String(confirmation || '').trim().toLowerCase() !== String(target.username).toLowerCase()) throw new Error(`Type ${target.username} to confirm deletion.`)
        database.exec('BEGIN IMMEDIATE')
        try {
          database.prepare('DELETE FROM tokens WHERE user_id = ?').run(targetId)
          database.prepare('DELETE FROM notifications WHERE user_id = ?').run(targetId)
          database.prepare('DELETE FROM oauth_exchanges WHERE user_id = ?').run(targetId)
          database.prepare('DELETE FROM magic_links WHERE user_id = ?').run(targetId)
          database.prepare('DELETE FROM email_tokens WHERE user_id = ?').run(targetId)
          database.prepare('DELETE FROM share_presence WHERE user_id = ?').run(targetId)
          database.prepare('DELETE FROM novel_members WHERE owner_user_id = ? OR member_user_id = ?').run(targetId, targetId)
          database.prepare('DELETE FROM share_invites WHERE owner_user_id = ?').run(targetId)
          database.prepare('DELETE FROM share_rooms WHERE owner_user_id = ?').run(targetId)
          database.prepare('DELETE FROM records WHERE user_id = ?').run(targetId)
          database.prepare('DELETE FROM users WHERE id = ?').run(targetId)
          database.prepare('INSERT INTO admin_audit (actor_user_id, actor_username, action, target_user_id, target_username, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(userId, actor.username, 'account.deleted', targetId, target.username, 'Non-admin account and owned data permanently deleted', Date.now())
          database.exec('COMMIT')
        } catch (error) {
          database.exec('ROLLBACK')
          throw error
        }
        const room = notificationSockets.get(String(targetId))
        if (room) for (const socket of room) socket.close(1008, 'Account deleted')
        json(res, 200, { ok: true, deleted: true })
      }).catch((err) => json(res, 400, { error: err.message }))
      return
    }

    if (path.startsWith('/api/admin/users/') && path.endsWith('/disable') && req.method === 'POST') {
      const actor = database.prepare('SELECT id, username, role, roles FROM users WHERE id = ?').get(userId)
      if (!userRoleInfo(actor).isAdmin) return json(res, 403, { error: 'Admin access required.' })
      const targetId = path.replace(/^\/api\/admin\/users\//, '').replace(/\/disable$/, '')
      const target = database.prepare('SELECT id, username, role, roles FROM users WHERE id = ?').get(targetId)
      if (!target) return json(res, 404, { error: 'Account not found.' })
      if (userRoleInfo(target).isAdmin) return json(res, 403, { error: 'Administrator accounts cannot be disabled.' })
      database.prepare('UPDATE users SET disabled_at = ? WHERE id = ?').run(Date.now(), targetId)
      database.prepare('DELETE FROM tokens WHERE user_id = ?').run(targetId)
      database.prepare('DELETE FROM share_presence WHERE user_id = ?').run(targetId)
      database.prepare('INSERT INTO admin_audit (actor_user_id, actor_username, action, target_user_id, target_username, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(userId, actor.username, 'account.disabled', targetId, target.username, 'Account disabled by administrator', Date.now())
      json(res, 200, { ok: true, disabled: true })
      return
    }

    if (path.startsWith('/api/admin/users/') && req.method === 'POST') {
      const user = database.prepare('SELECT id, role, roles FROM users WHERE id = ?').get(userId)
      const currentRoleInfo = userRoleInfo(user)
      if (!currentRoleInfo.isAdmin) return json(res, 403, { error: 'Admin access required.' })
      const targetId = path.replace(/^\/api\/admin\/users\//, '').split('/')[0]
      if (!targetId) return json(res, 400, { error: 'No user was selected.' })
      readBody(req, 8 * 1024).then(({ roles }) => {
        const nextRoles = normalizeRoles(Array.isArray(roles) ? roles : [roles])
        const nextRole = nextRoles.includes('admin') ? 'admin' : nextRoles.includes('developer') ? 'developer' : nextRoles.includes('beta_tester') ? 'beta_tester' : 'user'
        const target = database.prepare('SELECT username FROM users WHERE id = ?').get(targetId)
        database.prepare('UPDATE users SET role = ?, roles = ? WHERE id = ?').run(nextRole, nextRoles.join(','), targetId)
        const actor = database.prepare('SELECT username FROM users WHERE id = ?').get(userId)
        database.prepare('INSERT INTO admin_audit (actor_user_id, actor_username, action, target_user_id, target_username, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(userId, actor?.username || 'Admin', 'role.updated', targetId, target?.username || 'Unknown user', `Role changed to ${nextRole}`, Date.now())
        createNotification(database, { userId: targetId, type: 'account', category: 'account', priority: 'high', title: 'Your MoonScribe access changed', body: `An administrator changed your role to ${nextRole.replace('_', ' ')}.`, actionUrl: '/admin' })
        json(res, 200, { ok: true, roles: nextRoles, role: nextRole })
      }).catch((err) => json(res, 400, { error: err.message }))
      return
    }

    if (path === '/api/auth/sessions' && req.method === 'GET') {
      const currentHash = sha((req.headers.authorization || '').replace(/^Bearer\s+/i, ''))
      const sessions = database.prepare(
        'SELECT token_hash, session_id, device_id, created_at, expires_at, device_name, last_seen_at FROM tokens WHERE user_id = ? ORDER BY last_seen_at DESC'
      ).all(userId).map((row) => ({
        current: row.token_hash === currentHash,
        id: row.session_id,
        deviceId: row.device_id || null,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        deviceName: row.device_name || 'Unknown device',
        lastSeenAt: row.last_seen_at || row.created_at
      }))
      json(res, 200, { sessions })
      return
    }

    if (path === '/api/auth/sessions/revoke' && req.method === 'POST') {
      readBody(req, 8 * 1024).then(({ sessionId }) => {
        const currentHash = sha((req.headers.authorization || '').replace(/^Bearer\s+/i, ''))
        const row = database.prepare('SELECT token_hash FROM tokens WHERE user_id = ? AND session_id = ?').get(userId, String(sessionId || ''))
        if (!row) return json(res, 404, { error: 'Session not found.' })
        if (row.token_hash === currentHash) return json(res, 400, { error: 'Use sign out to end this device session.' })
        database.prepare('DELETE FROM tokens WHERE user_id = ? AND session_id = ?').run(userId, String(sessionId))
        json(res, 200, { ok: true })
      }).catch((err) => json(res, 400, { error: err.message }))
      return
    }

    if (path === '/api/auth/logout-others' && req.method === 'POST') {
      const currentHash = sha((req.headers.authorization || '').replace(/^Bearer\s+/i, ''))
      const removed = database.prepare('DELETE FROM tokens WHERE user_id = ? AND token_hash != ?').run(userId, currentHash).changes
      json(res, 200, { ok: true, removed })
      return
    }

    const accessFor = (novelId) => {
      const id = String(novelId || '')
      if (!id) return null
      const owned = database.prepare("SELECT 1 FROM records WHERE user_id = ? AND store = 'novels' AND id = ? AND deleted = 0").get(userId, id)
      if (owned) return { ownerUserId: userId, role: 'owner' }
      const member = database.prepare('SELECT owner_user_id, role, expires_at FROM novel_members WHERE novel_id = ? AND member_user_id = ? AND (expires_at IS NULL OR expires_at > ?)').get(id, userId, Date.now())
      return member ? { ownerUserId: member.owner_user_id, role: member.role } : null
    }

    const HOST_LIVE_WINDOW_MS = 45_000
    const hostIsLive = (novelId, ownerUserId) => Boolean(database.prepare(
      'SELECT 1 FROM share_presence WHERE novel_id = ? AND user_id = ? AND last_seen_at > ?'
    ).get(String(novelId || ''), String(ownerUserId || ''), Date.now() - HOST_LIVE_WINDOW_MS))
    const liveAccessFor = (novelId) => {
      const access = accessFor(novelId)
      if (!access) return null
      if (access.role === 'owner') return { ...access, hostLive: true }
      return hostIsLive(novelId, access.ownerUserId) ? { ...access, hostLive: true } : { ...access, hostLive: false }
    }
    const requireLiveAccess = (res, novelId) => {
      const access = liveAccessFor(novelId)
      if (!access) {
        json(res, 403, { error: 'You do not have access to this novel.' })
        return null
      }
      if (!access.hostLive) {
        json(res, 423, { error: 'The host is offline. This private writing room opens when the owner is live.' })
        return null
      }
      return access
    }
    const roomFor = (novelId, ownerUserId) => {
      const id = String(novelId || '')
      let room = database.prepare('SELECT max_users, default_role FROM share_rooms WHERE novel_id = ?').get(id)
      if (!room) {
        database.prepare('INSERT OR IGNORE INTO share_rooms (novel_id, owner_user_id, max_users, default_role, updated_at) VALUES (?, ?, 4, ?, ?)')
          .run(id, String(ownerUserId), 'editor', Date.now())
        room = { max_users: 4, default_role: 'editor' }
      }
      return { maxUsers: room.max_users, defaultRole: room.default_role }
    }
    const sharedManuscriptRecords = (novelId, ownerUserId, role, expiresAt = null) => {
      const rows = database.prepare(
        `SELECT user_id, store, id, novel_id, payload, updated_at, deleted FROM records
         WHERE user_id = ? AND (novel_id = ? OR (store = 'novels' AND id = ?))
         ORDER BY updated_at ASC`
      ).all(ownerUserId, novelId, novelId)
      return rows.map((r) => {
        const payload = r.deleted ? null : safeJson(r.payload)
        if (payload && r.store === 'novels' && role !== 'owner') {
          payload.sharedRole = role || 'viewer'
          payload.sharedExpiresAt = expiresAt || null
          payload.sharedOwnerId = ownerUserId
        }
        return {
          store: r.store,
          id: r.id,
          novelId: r.novel_id || novelId,
          updatedAt: r.updated_at,
          deleted: !!r.deleted,
          payload
        }
      })
    }

    if (path === '/api/shares/invite' && req.method === 'POST') {
      if (!betaFeatureAllowed()) return json(res, 403, { error: 'Sharing is currently available to Beta Testers, Developers, and Admins.' })
      readBody(req, 16 * 1024).then(({ novelId, role, accessDurationMs }) => {
        const access = accessFor(novelId)
        if (!access || access.role !== 'owner') return json(res, 403, { error: 'Only the novel owner can invite collaborators.' })
        const room = roomFor(novelId, userId)
        const occupied = database.prepare('SELECT COUNT(*) AS count FROM novel_members WHERE novel_id = ? AND (expires_at IS NULL OR expires_at > ?)').get(String(novelId), Date.now()).count + 1
        if (occupied >= room.maxUsers) return json(res, 409, { error: `This room is full (${room.maxUsers} users maximum).` })
        const selectedRole = ['viewer', 'commenter', 'editor'].includes(role) ? role : room.defaultRole
        const duration = Number(accessDurationMs)
        const accessExpiresAt = Number.isFinite(duration) && duration > 0
          ? Date.now() + Math.max(15 * 60 * 1000, Math.min(duration, 365 * 24 * 60 * 60 * 1000))
          : null
        const code = randomBytes(18).toString('base64url')
        const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000
        database.prepare('INSERT INTO share_invites (code, novel_id, owner_user_id, role, expires_at, access_expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(code, String(novelId), userId, selectedRole, expiresAt, accessExpiresAt, Date.now())
        json(res, 200, { code, role: selectedRole, expiresAt, accessExpiresAt })
      }).catch((err) => json(res, 400, { error: err.message }))
      return
    }

    if (path === '/api/shares/accept' && req.method === 'POST') {
      if (!betaFeatureAllowed()) return json(res, 403, { error: 'Sharing is currently available to Beta Testers, Developers, and Admins.' })
      readBody(req, 16 * 1024).then(({ code }) => {
        const invite = database.prepare('SELECT * FROM share_invites WHERE code = ?').get(String(code || '').trim())
        if (!invite || invite.expires_at < Date.now()) return json(res, 404, { error: 'That invitation is invalid or has expired.' })
        if (invite.owner_user_id === userId) return json(res, 400, { error: 'You already own this novel.' })
        if (!hostIsLive(invite.novel_id, invite.owner_user_id)) return json(res, 423, { error: 'The host is offline. Ask them to open this novel, then try the invitation again.' })
        const room = roomFor(invite.novel_id, invite.owner_user_id)
        const alreadyMember = database.prepare('SELECT 1 FROM novel_members WHERE novel_id = ? AND member_user_id = ?').get(invite.novel_id, userId)
        const occupied = database.prepare('SELECT COUNT(*) AS count FROM novel_members WHERE novel_id = ? AND (expires_at IS NULL OR expires_at > ?)').get(invite.novel_id, Date.now()).count + 1
        if (!alreadyMember && occupied >= room.maxUsers) return json(res, 409, { error: `This collaborative room has reached its ${room.maxUsers}-user limit.` })
        const records = sharedManuscriptRecords(invite.novel_id, invite.owner_user_id, invite.role, invite.access_expires_at)
        if (!records.some((record) => record.store === 'novels' && record.id === invite.novel_id && !record.deleted)) {
          return json(res, 409, { error: 'The host has not synced this novel yet. Ask them to keep the novel open, save once, and retry.' })
        }
        database.prepare(`INSERT INTO novel_members (novel_id, owner_user_id, member_user_id, role, created_at, expires_at)
          VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(novel_id, member_user_id) DO UPDATE SET role = excluded.role, owner_user_id = excluded.owner_user_id, expires_at = excluded.expires_at`)
          .run(invite.novel_id, invite.owner_user_id, userId, invite.role, Date.now(), invite.access_expires_at)
        json(res, 200, { novelId: invite.novel_id, role: invite.role, serverTime: Date.now(), records })
      }).catch((err) => json(res, 400, { error: err.message }))
      return
    }

    if (path === '/api/shares/bootstrap' && req.method === 'GET') {
      if (!betaFeatureAllowed()) return json(res, 403, { error: 'Sharing is currently available to Beta Testers, Developers, and Admins.' })
      const novelId = String(url.searchParams.get('novelId') || '')
      const access = requireLiveAccess(res, novelId)
      if (!access) return

      // Invite acceptance must not depend on the incremental sync cursor. Send
      // the complete, exact manuscript owned by the inviter in one response.
      const membership = access.role === 'owner'
        ? null
        : database.prepare('SELECT role, expires_at FROM novel_members WHERE novel_id = ? AND owner_user_id = ? AND member_user_id = ? AND (expires_at IS NULL OR expires_at > ?)')
          .get(novelId, access.ownerUserId, userId, Date.now())
      const records = sharedManuscriptRecords(novelId, access.ownerUserId, membership?.role || access.role, membership?.expires_at)
      if (!records.some((record) => record.store === 'novels' && record.id === novelId && !record.deleted)) {
        json(res, 409, { error: 'The host has not synced this novel yet. Ask them to keep the novel open, save once, and retry.' })
        return
      }
      json(res, 200, { serverTime: Date.now(), novelId, records })
      return
    }

    if (path === '/api/shares' && req.method === 'GET') {
      if (!betaFeatureAllowed()) return json(res, 403, { error: 'Sharing is currently available to Beta Testers, Developers, and Admins.' })
      const novelId = url.searchParams.get('novelId')
      const access = requireLiveAccess(res, novelId)
      if (!access) return
      const owner = database.prepare(`SELECT u.id, u.username, u.discord_id, u.discord_avatar, u.google_avatar,
        CASE WHEN p.last_seen_at > ? THEN p.status ELSE 'offline' END AS presence_status
        FROM users u LEFT JOIN share_presence p ON p.user_id = u.id AND p.novel_id = ? WHERE u.id = ?`)
        .get(Date.now() - HOST_LIVE_WINDOW_MS, String(novelId), access.ownerUserId)
      const members = database.prepare(`SELECT u.id, u.username, u.discord_id, u.discord_avatar, u.google_avatar, m.role, m.created_at, m.expires_at,
        CASE WHEN p.last_seen_at > ? THEN p.status ELSE 'offline' END AS presence_status
        FROM novel_members m JOIN users u ON u.id = m.member_user_id
        LEFT JOIN share_presence p ON p.user_id = u.id AND p.novel_id = m.novel_id
        WHERE m.novel_id = ? AND (m.expires_at IS NULL OR m.expires_at > ?) ORDER BY m.created_at`).all(Date.now() - HOST_LIVE_WINDOW_MS, String(novelId), Date.now())
      json(res, 200, {
        role: access.role,
        room: roomFor(novelId, access.ownerUserId),
        owner: owner ? { id: owner.id, username: owner.username, avatar: publicAvatar(owner), role: 'owner', status: owner.presence_status } : null,
        members: members.map((m) => ({ id: m.id, username: m.username, avatar: publicAvatar(m), role: m.role, status: m.presence_status, createdAt: m.created_at, expiresAt: m.expires_at }))
      })
      return
    }

    if (path === '/api/shares/room' && req.method === 'POST') {
      if (!betaFeatureAllowed()) return json(res, 403, { error: 'Sharing is currently available to Beta Testers, Developers, and Admins.' })
      readBody(req, 16 * 1024).then(({ novelId, maxUsers, defaultRole }) => {
        const access = accessFor(novelId)
        if (!access || access.role !== 'owner') return json(res, 403, { error: 'Only the owner can change room settings.' })
        const capacity = Math.max(2, Math.min(12, Number(maxUsers) || 4))
        const selectedRole = ['viewer', 'commenter', 'editor'].includes(defaultRole) ? defaultRole : 'editor'
        const occupied = database.prepare('SELECT COUNT(*) AS count FROM novel_members WHERE novel_id = ? AND (expires_at IS NULL OR expires_at > ?)').get(String(novelId), Date.now()).count + 1
        if (capacity < occupied) return json(res, 400, { error: `Remove collaborators before lowering the limit below ${occupied}.` })
        database.prepare(`INSERT INTO share_rooms (novel_id, owner_user_id, max_users, default_role, updated_at) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(novel_id) DO UPDATE SET max_users = excluded.max_users, default_role = excluded.default_role, updated_at = excluded.updated_at`)
          .run(String(novelId), userId, capacity, selectedRole, Date.now())
        json(res, 200, { maxUsers: capacity, defaultRole: selectedRole })
      }).catch((error) => json(res, 400, { error: error.message }))
      return
    }

    if (path === '/api/shares/revoke' && req.method === 'POST') {
      if (!betaFeatureAllowed()) return json(res, 403, { error: 'Sharing is currently available to Beta Testers, Developers, and Admins.' })
      readBody(req, 16 * 1024).then(({ novelId, memberId }) => {
        const access = accessFor(novelId)
        if (!access || access.role !== 'owner') return json(res, 403, { error: 'Only the novel owner can remove collaborators.' })
        database.prepare('DELETE FROM novel_members WHERE novel_id = ? AND member_user_id = ? AND owner_user_id = ?').run(String(novelId), String(memberId), userId)
        database.prepare('DELETE FROM share_presence WHERE novel_id = ? AND user_id = ?').run(String(novelId), String(memberId))
        broadcastPresence?.(String(novelId))
        json(res, 200, { ok: true })
      }).catch((err) => json(res, 400, { error: err.message }))
      return
    }

    if (path === '/api/shares/presence' && req.method === 'POST') {
      if (!betaFeatureAllowed()) return json(res, 403, { error: 'Sharing is currently available to Beta Testers, Developers, and Admins.' })
      readBody(req, 16 * 1024).then(({ novelId, chapterId, status, activity, workspace, tabName, lineNumber, cursorOffset }) => {
        const access = accessFor(novelId)
        if (!access) return json(res, 403, { error: 'You do not have access to this novel.' })
        const safeStatus = ['online', 'idle', 'dnd', 'offline'].includes(status) ? status : 'online'
        if (safeStatus !== 'offline' && access.role !== 'owner' && !hostIsLive(novelId, access.ownerUserId)) return json(res, 423, { error: 'The host is offline. This private writing room is closed.' })
        const safeActivity = ['viewing', 'writing'].includes(activity) ? activity : 'viewing'
        if (safeStatus === 'offline') {
          database.prepare('DELETE FROM share_presence WHERE novel_id = ? AND user_id = ?').run(String(novelId), userId)
          broadcastPresence?.(String(novelId))
          json(res, 200, { ok: true, offline: true })
          return
        }
        database.prepare(`INSERT INTO share_presence (novel_id, user_id, chapter_id, last_seen_at, status, activity, workspace, tab_name, line_number, cursor_offset) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(novel_id, user_id) DO UPDATE SET chapter_id = excluded.chapter_id, last_seen_at = excluded.last_seen_at, status = excluded.status, activity = excluded.activity, workspace = excluded.workspace, tab_name = excluded.tab_name, line_number = excluded.line_number, cursor_offset = excluded.cursor_offset`)
          .run(String(novelId), userId, chapterId ? String(chapterId) : null, Date.now(), safeStatus, safeActivity, String(workspace || 'manuscript').slice(0, 60), String(tabName || '').slice(0, 120), Number.isFinite(Number(lineNumber)) ? Number(lineNumber) : null, Number.isFinite(Number(cursorOffset)) ? Number(cursorOffset) : null)
        broadcastPresence?.(String(novelId))
        json(res, 200, { ok: true })
      }).catch((err) => json(res, 400, { error: err.message }))
      return
    }

    if (path === '/api/shares/presence' && req.method === 'GET') {
      if (!betaFeatureAllowed()) return json(res, 403, { error: 'Sharing is currently available to Beta Testers, Developers, and Admins.' })
      const novelId = url.searchParams.get('novelId')
      if (!requireLiveAccess(res, novelId)) return
      json(res, 200, { people: serializePresenceRows(presenceRowsFor(novelId)) })
      return
    }

    if (path === '/api/sync/push' && req.method === 'POST') {
      readBody(req)
        .then(async ({ records }) => {
          if (!Array.isArray(records)) throw new Error('records array expected')
          const upsert = database.prepare(
            `INSERT INTO records (store, id, novel_id, user_id, payload, updated_at, deleted)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(user_id, store, id) DO UPDATE SET
               payload = CASE WHEN excluded.updated_at >= records.updated_at THEN excluded.payload ELSE records.payload END,
               updated_at = CASE WHEN excluded.updated_at >= records.updated_at THEN excluded.updated_at ELSE records.updated_at END,
               deleted = CASE WHEN excluded.updated_at >= records.updated_at THEN excluded.deleted ELSE records.deleted END,
               novel_id = excluded.novel_id`
          )
          database.exec('BEGIN')
          try {
            if (records.length > 2000) throw new Error('Too many records in one sync batch.')
            const serverNow = Date.now()
            const accepted = []
            const cloudRecords = []
            const rejected = []
            for (const r of records) {
              const key = r?.store && r?.id ? `${r.store}:${r.id}` : null
              if (!r || !STORES.has(r.store) || !r.id || typeof r.updatedAt !== 'number') {
                if (key) rejected.push({ key, reason: 'Unsupported or malformed sync record.' })
                continue
              }
              const payload = r.deleted ? null : JSON.stringify(r.payload ?? null)
              if (payload !== null && payload.length > MAX_RECORD_BYTES) {
                rejected.push({ key, reason: 'Record is too large to sync.' })
                continue
              }
              const access = r.novelId ? accessFor(r.novelId) : null
              const targetUserId = access && access.role !== 'owner' ? access.ownerUserId : userId
              if (access && access.role !== 'owner' && !hostIsLive(r.novelId, access.ownerUserId)) {
                rejected.push({ key, reason: 'The host is offline. Shared edits remain safely on this device.' })
                continue
              }
              if ((access?.role === 'viewer' || access?.role === 'commenter') && r.store !== 'annotations') {
                rejected.push({ key, reason: 'This shared novel is in proofread mode.' })
                continue
              }
              upsert.run(
                r.store,
                String(r.id),
                r.novelId ? String(r.novelId) : null,
                targetUserId,
                payload,
                Math.max(0, Math.min(r.updatedAt, serverNow + 5 * 60 * 1000)),
                r.deleted ? 1 : 0
              )
              accepted.push(key)
              cloudRecords.push({ userId: targetUserId, store: r.store, id: String(r.id), novelId: r.novelId ? String(r.novelId) : null, payload: r.deleted ? null : (r.payload ?? null), updatedAt: Math.max(0, Math.min(r.updatedAt, serverNow + 5 * 60 * 1000)), deleted: Boolean(r.deleted) })
            }
            database.exec('COMMIT')
            if (supabasePersistenceEnabled && cloudRecords.length) {
              // Cloud mirroring is deliberately after the local commit: a
              // transient Supabase outage must never discard an offline-safe
              // local write. The next startup migration repairs any gap.
              mirrorRecords(cloudRecords).catch((error) => console.error('[supabase] record mirror failed', describeSupabaseError(error), {
                count: cloudRecords.length,
                stores: [...new Set(cloudRecords.map((record) => record.store).filter(Boolean))],
              }))
            }
            json(res, 200, { ok: true, serverTime: Date.now(), accepted, rejected })
          } catch (err) {
            database.exec('ROLLBACK')
            throw err
          }
        })
        .catch((err) => json(res, 400, { error: err.message, at: '/api/sync/push' }))
      return
    }

    if (path === '/api/sync/pull' && req.method === 'GET') {
      const since = Number(url.searchParams.get('since')) || 0
      const rows = database.prepare(
        `SELECT user_id, store, id, novel_id, payload, updated_at, deleted FROM records r
         WHERE updated_at > ? AND (user_id = ? OR (novel_id IS NOT NULL AND EXISTS (
           SELECT 1 FROM novel_members m
           WHERE m.novel_id = r.novel_id AND m.member_user_id = ? AND m.owner_user_id = r.user_id
             AND (m.expires_at IS NULL OR m.expires_at > ?)
             AND EXISTS (
               SELECT 1 FROM share_presence p
               WHERE p.novel_id = r.novel_id AND p.user_id = m.owner_user_id AND p.last_seen_at > ?
             )
         ))) ORDER BY updated_at ASC`
      ).all(since, userId, userId, Date.now(), Date.now() - HOST_LIVE_WINDOW_MS)
      const membershipFor = database.prepare('SELECT role, expires_at FROM novel_members WHERE novel_id = ? AND owner_user_id = ? AND member_user_id = ? AND (expires_at IS NULL OR expires_at > ?)')
      const records = rows.map((r) => {
        const payload = r.deleted ? null : safeJson(r.payload)
        if (payload && r.store === 'novels' && r.user_id !== userId) {
          const membership = membershipFor.get(r.novel_id, r.user_id, userId, Date.now())
          payload.sharedRole = membership?.role || 'viewer'
          payload.sharedExpiresAt = membership?.expires_at || null
          payload.sharedOwnerId = r.user_id
        }
        return {
          store: r.store,
          id: r.id,
          novelId: r.novel_id,
          updatedAt: r.updated_at,
          deleted: !!r.deleted,
          payload
        }
      })
      json(res, 200, { serverTime: Date.now(), records })
      return
    }

    json(res, 404, { error: 'Not found.' })
  }

  const server = createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
    if (url.pathname.startsWith('/api') || url.pathname.startsWith('/auth/')) {
      handleApi(req, res, url, url.pathname)
      return
    }
    if (existsSync(dist)) {
      if (serveStatic(req, res, url, dist)) return
    }
    json(res, 404, { error: 'No build found. Run `npm run build` first, or serve during development with `npm run dev`.' })
  })

  const livePresenceRooms = new Map()
  const trackPresenceSocket = (novelId, socket) => {
    const key = String(novelId)
    const room = livePresenceRooms.get(key) || new Set()
    room.add(socket)
    livePresenceRooms.set(key, room)
    return () => {
      room.delete(socket)
      if (!room.size) livePresenceRooms.delete(key)
    }
  }
  var broadcastPresence = (novelId) => {
    const room = livePresenceRooms.get(String(novelId))
    if (!room?.size) return
    const payload = JSON.stringify({ type: 'presence', novelId: String(novelId), people: serializePresenceRows(presenceRowsFor(novelId)) })
    for (const socket of room) {
      // `OPEN` is a static WebSocket constant in ws; the numeric state keeps
      // this compatible with every ws release we support.
      if (socket.readyState === 1) socket.send(payload)
    }
  }
  const broadcastRecord = (novelId, record, sender) => {
    const room = livePresenceRooms.get(String(novelId))
    if (!room?.size) return
    for (const socket of room) {
      if (socket === sender || socket.readyState !== 1) continue
      let outgoing = record
      if (record.store === 'novels' && socket.role !== 'owner' && record.payload) {
        outgoing = { ...record, payload: { ...record.payload, sharedRole: socket.role, sharedOwnerId: socket.ownerUserId } }
      }
      socket.send(JSON.stringify({ type: 'record:update', novelId: String(novelId), record: outgoing }))
    }
  }

  const wss = new WebSocketServer({ noServer: true })
  const notificationWss = new WebSocketServer({ noServer: true })
  const websocketHostIsLive = (novelId, ownerUserId) => Boolean(database.prepare(
    'SELECT 1 FROM share_presence WHERE novel_id = ? AND user_id = ? AND last_seen_at > ?'
  ).get(String(novelId || ''), String(ownerUserId || ''), Date.now() - 45_000))
  server.on('upgrade', (req, socket, head) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
      if (url.pathname === '/ws/notifications') {
        const userId = userFromToken(database, url.searchParams.get('token'))
        if (!userId) return socket.destroy()
        notificationWss.handleUpgrade(req, socket, head, (ws) => { ws.userId = String(userId); notificationWss.emit('connection', ws) })
        return
      }
      if (url.pathname !== '/ws/presence') return socket.destroy()
      const token = url.searchParams.get('token')
      const novelId = url.searchParams.get('novelId')
      const wsUserId = userFromToken(database, token)
      if (!wsUserId || !novelId) return socket.destroy()
      const owned = database.prepare("SELECT 1 FROM records WHERE user_id = ? AND store = 'novels' AND id = ? AND deleted = 0").get(wsUserId, String(novelId))
      const member = database.prepare('SELECT owner_user_id, role, expires_at FROM novel_members WHERE novel_id = ? AND member_user_id = ? AND (expires_at IS NULL OR expires_at > ?)').get(String(novelId), wsUserId, Date.now())
      const access = owned ? { ownerUserId: wsUserId, role: 'owner' } : (member ? { ownerUserId: member.owner_user_id, role: member.role } : null)
      if (!access) return socket.destroy()
      if (access.role !== 'owner' && !database.prepare('SELECT 1 FROM share_presence WHERE novel_id = ? AND user_id = ? AND last_seen_at > ?').get(String(novelId), String(access.ownerUserId || ''), Date.now() - 45_000)) {
        return socket.destroy()
      }
      wss.handleUpgrade(req, socket, head, (ws) => {
        ws.novelId = String(novelId)
        ws.userId = wsUserId
        ws.ownerUserId = String(access.ownerUserId)
        ws.role = access.role
        wss.emit('connection', ws, req)
      })
    } catch {
      socket.destroy()
    }
  })

  notificationWss.on('connection', (ws) => {
    const room = notificationSockets.get(ws.userId) || new Set()
    room.add(ws)
    notificationSockets.set(ws.userId, room)
    ws.send(JSON.stringify({ type: 'notification:ready' }))
    ws.on('close', () => { room.delete(ws); if (!room.size) notificationSockets.delete(ws.userId) })
  })

  wss.on('connection', (ws) => {
    const untrack = trackPresenceSocket(ws.novelId, ws)
    ws.send(JSON.stringify({ type: 'presence', novelId: ws.novelId, people: serializePresenceRows(presenceRowsFor(ws.novelId)) }))
    ws.on('message', (raw) => {
      try {
        const message = safeJson(String(raw))
        const record = message?.type === 'record:update' ? message.record : null
        if (!record || String(record.novelId || '') !== ws.novelId || !STORES.has(record.store) || !record.id || typeof record.updatedAt !== 'number') return
        if (ws.role !== 'owner' && !websocketHostIsLive(ws.novelId, ws.ownerUserId)) {
          ws.send(JSON.stringify({ type: 'record:error', error: 'The owner is offline. Live editing is paused.' }))
          return
        }
        if ((ws.role === 'viewer' || ws.role === 'commenter') && record.store !== 'annotations') {
          ws.send(JSON.stringify({ type: 'record:error', error: 'This permission only allows proofread comments.' }))
          return
        }
        const payloadJson = record.deleted ? null : JSON.stringify(record.payload ?? null)
        if (payloadJson !== null && payloadJson.length > MAX_RECORD_BYTES) return
        const targetUserId = ws.role === 'owner' ? ws.userId : ws.ownerUserId
        const updatedAt = Math.max(0, Math.min(record.updatedAt, Date.now() + 5 * 60 * 1000))
        database.prepare(
          `INSERT INTO records (store, id, novel_id, user_id, payload, updated_at, deleted)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(user_id, store, id) DO UPDATE SET
             payload = CASE WHEN excluded.updated_at >= records.updated_at THEN excluded.payload ELSE records.payload END,
             updated_at = CASE WHEN excluded.updated_at >= records.updated_at THEN excluded.updated_at ELSE records.updated_at END,
             deleted = CASE WHEN excluded.updated_at >= records.updated_at THEN excluded.deleted ELSE records.deleted END,
             novel_id = excluded.novel_id`
        ).run(record.store, String(record.id), ws.novelId, targetUserId, payloadJson, updatedAt, record.deleted ? 1 : 0)
        broadcastRecord(ws.novelId, { ...record, updatedAt }, ws)
        if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'record:accepted', novelId: ws.novelId, recordId: String(record.id), updatedAt }))
      } catch (error) {
        console.error('[collaboration] record update failed', { novelId: ws.novelId, userId: ws.userId, error: String(error) })
        if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'record:error', error: 'The live update could not be saved.' }))
      }
    })
    ws.on('close', () => untrack())
  })

  return { server, db: database, limiter }
}

function safeJson(raw) {
  if (raw === null || raw === undefined) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// ---- entrypoint: `node server/index.js` ----
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  const { server, db, limiter } = createMoonScribeServer()
  const startServer = () => server.listen(PORT, () => {
    console.log(`🌙 MoonScribe server listening on http://localhost:${PORT}`)
    console.log('   Accounts: sign in or create one in the app (Settings → Sign in).')
    if (!existsSync(DIST)) {
      console.log('   (no dist/ yet — run `npm run build` to serve the app here)')
    }
    if (process.env.SUPABASE_MIGRATE_ON_STARTUP === 'true') {
      migrateSqliteToSupabase(db).then((summary) => console.log('[supabase] migration complete:', summary)).catch((error) => console.error('[supabase] migration failed:', String(error)))
    }
  })
  if (supabasePersistenceEnabled) {
    restoreSupabaseToSqlite(db).then((summary) => { console.log('[supabase] state restored:', summary); startServer() }).catch((error) => { console.error('[supabase] restore failed; refusing to start with cloud state unavailable:', String(error)); process.exitCode = 1 })
  } else startServer()
  const shutdown = () => {
    limiter.dispose()
    server.close(() => process.exit(0))
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}
