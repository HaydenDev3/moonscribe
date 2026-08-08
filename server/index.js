// Moonscribe sync server.
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

import { createServer } from 'node:http'
import { readFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { join, dirname, extname, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'dist')
const DATA_DIR = process.env.DATA_DIR || join(ROOT, 'data')
const PORT = Number(process.env.PORT || 3001)

mkdirSync(DATA_DIR, { recursive: true })
const DB = new DatabaseSync(join(DATA_DIR, 'moonscribe.db'))

// ---- schema (with migrations for pre-account databases) ----
DB.exec(`
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
    created_at    INTEGER NOT NULL
  );
`)

function ensureColumn(table, column, ddl) {
  const cols = DB.prepare(`PRAGMA table_info(${table})`).all()
  if (!cols.some((c) => c.name === column)) DB.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`)
}
ensureColumn('records', 'user_id', 'user_id TEXT')
ensureColumn('tokens', 'user_id', 'user_id TEXT')
DB.exec('CREATE INDEX IF NOT EXISTS idx_records_user_since ON records(user_id, updated_at)')

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

function issueToken(userId) {
  const token = randomBytes(24).toString('base64url')
  DB.prepare('INSERT INTO tokens (token_hash, user_id, created_at) VALUES (?, ?, ?)').run(sha(token), userId, Date.now())
  return token
}

function userFromToken(token) {
  if (!token) return null
  const row = DB.prepare('SELECT user_id FROM tokens WHERE token_hash = ?').get(sha(token))
  return row ? row.user_id : null
}

// The very first account to register adopts any records from a pre-account
// database, so nothing written before accounts existed is lost.
function claimLegacyRecords(userId) {
  DB.prepare("UPDATE records SET user_id = ? WHERE user_id IS NULL OR user_id = ''").run(userId)
}

const STORES = new Set(['novels', 'chapters', 'characters', 'notes', 'relationships', 'world', 'moodboard'])

// ---- http plumbing ----
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

async function readBody(req) {
  let data = ''
  for await (const chunk of req) {
    data += chunk
    if (data.length > 50 * 1024 * 1024) throw new Error('payload too large')
  }
  return data ? JSON.parse(data) : {}
}

function json(res, status, body) {
  const text = JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(text)
}

function serveStatic(req, res, url) {
  const pathname = decodeURIComponent(url.pathname || '/')
  const safe = normalize(pathname).replace(/^(\.\.[/\\])+/, '')
  let file = join(DIST, safe)
  if (!file.startsWith(DIST)) file = join(DIST, 'index.html')

  try {
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html')
  } catch {
    return false
  }

  if (!existsSync(file)) {
    // SPA fallback for non-file routes.
    file = join(DIST, 'index.html')
  }

  try {
    const body = readFileSync(file)
    const ext = extname(file).toLowerCase()
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' }
    if (file.endsWith('index.html')) headers['Cache-Control'] = 'no-cache'
    if (file.includes('/assets/')) headers['Cache-Control'] = 'public, max-age=31536000, immutable'
    if (file.endsWith('sw.js')) headers['Cache-Control'] = 'no-cache'
    res.writeHead(200, headers)
    res.end(body)
    return true
  } catch {
    return false
  }
}

// ---- API ----
function handleApi(req, res, url, path) {
  // CORS for the dev server (vite runs on :5173, api on :3001).
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  // ---- accounts ----
  if (path === '/api/auth/register' && req.method === 'POST') {
    readBody(req)
      .then(({ username, password }) => {
        const name = String(username || '').trim().toLowerCase()
        if (name.length < 2) throw new Error('A username needs at least 2 characters.')
        if (name.length > 40) throw new Error('That username is too long.')
        if (String(password || '').length < 6) throw new Error('Your password needs at least 6 characters.')
        const existing = DB.prepare('SELECT 1 FROM users WHERE username = ?').get(name)
        if (existing) throw new Error('That username is taken — try signing in instead.')
        const userId = randomBytes(12).toString('hex')
        const userCount = DB.prepare('SELECT COUNT(*) AS n FROM users').get().n
        DB.prepare('INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)').run(
          userId, name, hashPassword(password), Date.now()
        )
        if (userCount === 0) claimLegacyRecords(userId)
        json(res, 200, { token: issueToken(userId), username: name })
      })
      .catch((err) => json(res, 400, { error: err.message }))
    return
  }

  if (path === '/api/auth/login' && req.method === 'POST') {
    readBody(req)
      .then(({ username, password }) => {
        const name = String(username || '').trim().toLowerCase()
        const user = DB.prepare('SELECT * FROM users WHERE username = ?').get(name)
        if (!user || !verifyPassword(password, user.password_hash)) {
          return json(res, 401, { error: 'That username or password didn’t match.' })
        }
        json(res, 200, { token: issueToken(user.id), username: user.username })
      })
      .catch(() => json(res, 400, { error: 'Bad request.' }))
    return
  }

  if (path === '/api/auth/logout' && req.method === 'POST') {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    DB.prepare('DELETE FROM tokens WHERE token_hash = ?').run(sha(token))
    json(res, 200, { ok: true })
    return
  }

  // ---- protected sync endpoints ----
  const userId = userFromToken((req.headers.authorization || '').replace(/^Bearer\s+/i, ''))
  if (!userId) {
    json(res, 401, { error: 'Not signed in. Create an account or sign in.' })
    return
  }

  if (path === '/api/sync/push' && req.method === 'POST') {
    readBody(req)
      .then(async ({ records }) => {
        if (!Array.isArray(records)) throw new Error('records array expected')
        const upsert = DB.prepare(
          `INSERT INTO records (store, id, novel_id, user_id, payload, updated_at, deleted)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(store, id) DO UPDATE SET
             payload = CASE WHEN excluded.updated_at >= records.updated_at THEN excluded.payload ELSE records.payload END,
             updated_at = CASE WHEN excluded.updated_at >= records.updated_at THEN excluded.updated_at ELSE records.updated_at END,
             deleted = CASE WHEN excluded.updated_at >= records.updated_at THEN excluded.deleted ELSE records.deleted END,
             novel_id = excluded.novel_id,
             user_id = excluded.user_id`
        )
        DB.exec('BEGIN')
        try {
          for (const r of records) {
            if (!r || !STORES.has(r.store) || !r.id || typeof r.updatedAt !== 'number') continue
            upsert.run(
              r.store,
              String(r.id),
              r.novelId ? String(r.novelId) : null,
              userId,
              r.deleted ? null : JSON.stringify(r.payload ?? null),
              r.updatedAt,
              r.deleted ? 1 : 0
            )
          }
          DB.exec('COMMIT')
        } catch (err) {
          DB.exec('ROLLBACK')
          throw err
        }
        json(res, 200, { ok: true, serverTime: Date.now() })
      })
      .catch((err) => json(res, 400, { error: err.message }))
    return
  }

  if (path === '/api/sync/pull' && req.method === 'GET') {
    const since = Number(url.searchParams.get('since')) || 0
    const rows = DB.prepare(
      'SELECT store, id, novel_id, payload, updated_at, deleted FROM records WHERE user_id = ? AND updated_at > ? ORDER BY updated_at ASC'
    ).all(userId, since)
    const records = rows.map((r) => ({
      store: r.store,
      id: r.id,
      novelId: r.novel_id,
      updatedAt: r.updated_at,
      deleted: !!r.deleted,
      payload: r.deleted ? null : safeJson(r.payload)
    }))
    json(res, 200, { serverTime: Date.now(), records })
    return
  }

  json(res, 404, { error: 'Not found.' })
}

function safeJson(raw) {
  if (raw === null || raw === undefined) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
  if (url.pathname.startsWith('/api')) {
    handleApi(req, res, url, url.pathname)
    return
  }
  if (existsSync(DIST)) {
    if (serveStatic(req, res, url)) return
  }
  json(res, 404, { error: 'No build found. Run `npm run build` first, or serve during development with `npm run dev`.' })
})

server.listen(PORT, () => {
  console.log(`🌙 Moonscribe server listening on http://localhost:${PORT}`)
  console.log('   Accounts: sign in or create one in the app (Settings → Sign in).')
  if (!existsSync(DIST)) {
    console.log('   (no dist/ yet — run `npm run build` to serve the app here)')
  }
})
