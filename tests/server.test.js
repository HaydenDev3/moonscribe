// Integration tests for the sync server. Runs the real HTTP server in-process
// with an in-memory SQLite database — no build, no external processes.
// Node environment: real fetch, no happy-dom CORS layer.
// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { request as httpRequest } from 'node:http'
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import WebSocket from 'ws'
import { createMoonScribeServer } from '../server/index.js'

let db = null
let server = null
let limiter = null
let base = ''

async function startServer(opts = {}) {
  db = new DatabaseSync(':memory:')
  const app = createMoonScribeServer({ db, distDir: opts.distDir, rateLimit: opts.rateLimit })
  server = app.server
  limiter = app.limiter
  await new Promise((resolve) => server.listen(0, resolve))
  base = `http://127.0.0.1:${server.address().port}`
}

async function stopServer() {
  if (server) {
    await new Promise((resolve) => {
      server.close(resolve)
      server.closeAllConnections?.()
    })
    server = null
  }
  limiter?.dispose()
  limiter = null
  if (db) {
    db.close()
    db = null
  }
}

afterEach(stopServer)

function post(path, body, token) {
  return fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  })
}

function get(path, token) {
  return fetch(`${base}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  })
}

function rawGet(path) {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: '127.0.0.1', port: server.address().port, path, method: 'GET' }, (res) => {
      let data = ''
      res.on('data', (c) => (data += c))
      res.on('end', () => resolve({ status: res.statusCode, body: data, headers: res.headers }))
    })
    req.on('error', reject)
    req.end()
  })
}

async function register(username, password = 'secret1234') {
  const res = await post('/api/auth/register', { username, password })
  return { status: res.status, body: await res.json() }
}

function openSocket(path) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`${base.replace('http', 'ws')}${path}`)
    socket.once('message', () => resolve(socket))
    socket.once('error', reject)
  })
}

function nextSocketMessage(socket, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for WebSocket message')), 2_000)
    const receive = (raw) => {
      const message = JSON.parse(String(raw))
      if (!predicate(message)) return
      clearTimeout(timeout)
      socket.off('message', receive)
      resolve(message)
    }
    socket.on('message', receive)
  })
}

describe('accounts', () => {
  beforeEach(async () => startServer())

  it('registers and logs in', async () => {
    const reg = await register('alice')
    expect(reg.status).toBe(200)
    expect(reg.body.token).toBeTruthy()
    expect(reg.body.username).toBe('alice')

    const login = await post('/api/auth/login', { username: 'alice', password: 'secret1234' })
    expect(login.status).toBe(200)
    expect((await login.json()).token).toBeTruthy()
  })

  it('persists OAuth handoffs and consumes each exchange exactly once', async () => {
    const account = await register('oauth-writer')
    const code = 'durable-oauth-code'
    db.prepare('INSERT INTO oauth_exchanges (code, user_id, username, avatar, provider, server_origin, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(code, account.body.accountId, account.body.username, '', 'discord', base, Date.now() + 60_000, Date.now())

    const exchanged = await post('/api/auth/discord/exchange', { code })
    expect(exchanged.status).toBe(200)
    expect((await exchanged.json()).token).toBeTruthy()

    const replay = await post('/api/auth/discord/exchange', { code })
    expect(replay.status).toBe(400)
  })

  it('keeps OAuth sessions for 30 days and rotates them without signing out', async () => {
    const account = await register('oauth-session-writer')
    const firstExpiry = db.prepare('SELECT expires_at FROM tokens WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(account.body.accountId).expires_at
    expect(firstExpiry - Date.now()).toBeGreaterThan(29 * 24 * 60 * 60 * 1000)

    const refreshed = await post('/api/auth/session/refresh', {}, account.body.token)
    expect(refreshed.status).toBe(200)
    const refreshedBody = await refreshed.json()
    expect(refreshedBody.token).toBeTruthy()
    expect(refreshedBody.expiresAt - Date.now()).toBeGreaterThan(29 * 24 * 60 * 60 * 1000)
    expect((await get('/api/auth/me', refreshedBody.token)).status).toBe(200)
    expect((await get('/api/auth/me', account.body.token)).status).toBe(200)
  })

  it('reports which authentication providers are configured', async () => {
    const response = await get('/api/auth/status')
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ online: true, emailAuth: true, passkeyAuth: true, appOrigin: 'http://localhost:5173' })
  })

  it('issues expiring passkey authentication challenges', async () => {
    const response = await post('/api/auth/passkey/options', {})
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.challengeId).toBeTruthy()
    expect(body.options.challenge).toBeTruthy()
    expect(body.options.rpId).toBe('localhost')
    const stored = db.prepare('SELECT purpose, challenge, expires_at, used_at FROM webauthn_challenges WHERE id = ?').get(body.challengeId)
    expect(stored).toMatchObject({ purpose: 'authentication', challenge: body.options.challenge, used_at: null })
    expect(stored.expires_at).toBeGreaterThan(Date.now())
  })

  it('requires an authenticated account before issuing passkey registration options', async () => {
    expect((await post('/api/auth/passkeys/register/options', {})).status).toBe(401)
    const account = await register('passkey-writer')
    const response = await post('/api/auth/passkeys/register/options', {}, account.body.token)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.options.user.name).toBe('passkey-writer')
    expect(body.options.authenticatorSelection).toMatchObject({ residentKey: 'required', userVerification: 'required' })
    expect(db.prepare('SELECT user_id, purpose FROM webauthn_challenges WHERE id = ?').get(body.challengeId)).toMatchObject({ user_id: account.body.accountId, purpose: 'registration' })
  })

  it('uses a trusted development tunnel as the browser-visible app origin', async () => {
    const origin = 'https://moon-test.ngrok-free.dev'
    const response = await fetch(`${base}/api/auth/status`, { headers: { Origin: origin } })
    expect(response.status).toBe(200)
    expect(response.headers.get('access-control-allow-origin')).toBe(origin)
    expect(await response.json()).toMatchObject({ appOrigin: origin })
  })

  it('rejects a bad login', async () => {
    await register('bob')
    const bad = await post('/api/auth/login', { username: 'bob', password: 'nope-nope' })
    expect(bad.status).toBe(401)
  })

  it('registers and signs in with an email address', async () => {
    const created = await register('writer@example.com')
    expect(created.status).toBe(200)
    const login = await post('/api/auth/login', { username: 'writer@example.com', password: 'secret1234' })
    expect(login.status).toBe(200)
  })

  it('validates usernames and passwords', async () => {
    const cases = [
      ['a', 'secret1234'], // username too short
      ['ok name', 'secret1234'], // spaces not allowed
      ['has!bang', 'secret1234'], // symbols not allowed
      ['alice', 'short'], // password too short
      ['alice', 'x'.repeat(201)] // password too long
    ]
    for (const [u, p] of cases) {
      const res = await register(u, p)
      expect(res.status, `username=${u}`).toBe(400)
    }
  })

  it('rejects duplicate usernames', async () => {
    await register('carol')
    const dup = await register('carol')
    expect(dup.status).toBe(400)
  })

  it('logs out by revoking the token', async () => {
    const reg = await register('dave')
    const out = await post('/api/auth/logout', {}, reg.body.token)
    expect(out.status).toBe(200)
    const pull = await get('/api/sync/pull?since=0', reg.body.token)
    expect(pull.status).toBe(401)
  })

  it('can revoke every other signed-in device', async () => {
    const first = await register('devices')
    const second = await post('/api/auth/login', { username: 'devices', password: 'secret1234' })
    const secondToken = (await second.json()).token
    const revoke = await post('/api/auth/logout-others', {}, first.body.token)
    expect(revoke.status).toBe(200)
    expect((await revoke.json()).removed).toBe(1)
    expect((await get('/api/sync/pull?since=0', secondToken)).status).toBe(401)
    expect((await get('/api/sync/pull?since=0', first.body.token)).status).toBe(200)
  })

  it('returns the authenticated account and supports per-session revocation', async () => {
    const first = await register('profile-owner')
    const second = await post('/api/auth/login', { username: 'profile-owner', password: 'secret1234' })
    const secondToken = (await second.json()).token
    const me = await (await get('/api/auth/me', first.body.token)).json()
    expect(me.account.id).toBe(first.body.accountId)
    expect(me.account.username).toBe('profile-owner')

    const sessions = await (await get('/api/auth/sessions', first.body.token)).json()
    const other = sessions.sessions.find((session) => !session.current)
    expect(other.id).toBeTruthy()
    expect((await post('/api/auth/sessions/revoke', { sessionId: other.id }, first.body.token)).status).toBe(200)
    expect((await get('/api/sync/pull?since=0', secondToken)).status).toBe(401)
  })

  it('disables an account, revokes every session, blocks login, and allows an admin restore', async () => {
    const admin = await register('disable-admin')
    db.prepare("UPDATE users SET role = 'admin', roles = 'user,admin' WHERE id = ?").run(admin.body.accountId)
    const account = await register('disable-writer')
    const second = await post('/api/auth/login', { username: 'disable-writer', password: 'secret1234' })
    const secondToken = (await second.json()).token

    const wrong = await post('/api/auth/disable-account', { confirmation: 'wrong-name' }, account.body.token)
    expect(wrong.status).toBe(400)
    const disabled = await post('/api/auth/disable-account', { confirmation: 'disable-writer' }, account.body.token)
    expect(disabled.status).toBe(200)
    expect((await get('/api/auth/me', account.body.token)).status).toBe(401)
    expect((await get('/api/auth/me', secondToken)).status).toBe(401)
    expect((await post('/api/auth/login', { username: 'disable-writer', password: 'secret1234' })).status).toBe(403)

    const restored = await post(`/api/admin/users/${account.body.accountId}/enable`, {}, admin.body.token)
    expect(restored.status).toBe(200)
    expect((await post('/api/auth/login', { username: 'disable-writer', password: 'secret1234' })).status).toBe(200)
  })

  it('allows admins to permanently delete non-admin users and owned data only', async () => {
    const admin = await register('delete-admin')
    db.prepare("UPDATE users SET role = 'admin', roles = 'user,admin' WHERE id = ?").run(admin.body.accountId)
    const target = await register('delete-target')
    await post('/api/sync/push', { records: [{ store: 'novels', id: 'doomed-novel', novelId: 'doomed-novel', updatedAt: Date.now(), deleted: false, payload: { title: 'Delete me' } }] }, target.body.token)
    db.prepare('INSERT INTO notifications (id, user_id, type, category, priority, title, body, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('doomed-notice', target.body.accountId, 'system', 'account', 'normal', 'Notice', 'Delete me', Date.now())

    expect((await fetch(`${base}/api/admin/users/${target.body.accountId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.body.token}` }, body: JSON.stringify({ confirmation: 'wrong' }) })).status).toBe(400)
    const deleted = await fetch(`${base}/api/admin/users/${target.body.accountId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.body.token}` }, body: JSON.stringify({ confirmation: 'delete-target' }) })
    expect(deleted.status).toBe(200)
    expect(db.prepare('SELECT 1 FROM users WHERE id = ?').get(target.body.accountId)).toBeUndefined()
    expect(db.prepare('SELECT 1 FROM records WHERE user_id = ?').get(target.body.accountId)).toBeUndefined()
    expect(db.prepare('SELECT 1 FROM notifications WHERE user_id = ?').get(target.body.accountId)).toBeUndefined()
    expect((await get('/api/auth/me', target.body.token)).status).toBe(401)
    expect((await (await get('/api/admin/audit', admin.body.token)).json()).events[0].action).toBe('account.deleted')

    const protectedAdmin = await fetch(`${base}/api/admin/users/${admin.body.accountId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.body.token}` }, body: JSON.stringify({ confirmation: 'delete-admin' }) })
    expect(protectedAdmin.status).toBe(403)
  })

  it('serves only owned notifications and supports read state', async () => {
    const owner = await register('notification-owner')
    const other = await register('notification-other')
    db.prepare('INSERT INTO notifications (id, user_id, type, category, priority, title, body, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run('owned-notice', owner.body.accountId, 'system', 'account', 'normal', 'Welcome', 'Your library is ready.', Date.now())
    db.prepare('INSERT INTO notifications (id, user_id, type, category, priority, title, body, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run('other-notice', other.body.accountId, 'system', 'account', 'normal', 'Private', 'This must not leak.', Date.now())

    const list = await (await get('/api/notifications', owner.body.token)).json()
    expect(list.unreadCount).toBe(1)
    expect(list.notifications.map((item) => item.id)).toEqual(['owned-notice'])
    expect((await post('/api/notifications/owned-notice/read', {}, owner.body.token)).status).toBe(200)
    expect((await (await get('/api/notifications', owner.body.token)).json()).unreadCount).toBe(0)
    expect((await post('/api/notifications/other-notice/read', {}, owner.body.token)).status).toBe(404)
  })

  it('persists admin announcements and exposes published announcements', async () => {
    const admin = await register('announcement-admin')
    db.prepare("UPDATE users SET role = 'admin', roles = 'user,admin' WHERE id = ?").run(admin.body.accountId)
    const created = await post('/api/admin/announcements', { title: 'Maintenance window', body: 'The studio will be refreshed tonight.', severity: 'warning' }, admin.body.token)
    expect(created.status).toBe(201)
    expect((await (await get('/api/announcements', admin.body.token)).json()).announcements[0]).toMatchObject({ title: 'Maintenance window', severity: 'warning' })
    expect((await (await get('/api/admin/audit', admin.body.token)).json()).events[0].action).toBe('announcement.created')
  })

  it('completes a two-factor login without an existing session token', async () => {
    const account = await register('two-factor-writer')
    db.prepare('UPDATE users SET two_factor_enabled = 1, email = ?, email_verified = 1 WHERE id = ?')
      .run('writer@example.com', account.body.accountId)

    const login = await post('/api/auth/login', { username: 'two-factor-writer', password: 'secret1234' })
    expect(login.status).toBe(200)
    expect(await login.json()).toMatchObject({ requires2fa: true, userId: account.body.accountId })

    const code = '123456'
    db.prepare("UPDATE email_tokens SET code = ?, expires_at = ?, used_at = NULL WHERE user_id = ? AND purpose = 'two_factor'")
      .run(createHash('sha256').update(code).digest('hex'), Date.now() + 60_000, account.body.accountId)

    const verified = await post('/api/auth/verify-2fa', { userId: account.body.accountId, code })
    expect(verified.status).toBe(200)
    expect((await verified.json()).token).toBeTruthy()

    const replay = await post('/api/auth/verify-2fa', { userId: account.body.accountId, code })
    expect(replay.status).toBe(400)
  })
})

describe('production health and realtime', () => {
  beforeEach(async () => startServer())

  it('reports API and database health without authentication', async () => {
    const response = await get('/api/health')
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ status: 'ok', database: 'ok' })
  })

  it('syncs a live record between two independent sessions', async () => {
    const first = await register('two-session-writer')
    const login = await post('/api/auth/login', { username: 'two-session-writer', password: 'secret1234' })
    const secondToken = (await login.json()).token
    await post('/api/sync/push', { records: [
      { store: 'novels', id: 'live-novel', novelId: 'live-novel', updatedAt: 1, deleted: false, payload: { title: 'Live novel' } }
    ] }, first.body.token)

    const firstSocket = await openSocket(`/ws/presence?novelId=live-novel&token=${encodeURIComponent(first.body.token)}`)
    const secondSocket = await openSocket(`/ws/presence?novelId=live-novel&token=${encodeURIComponent(secondToken)}`)
    const update = nextSocketMessage(secondSocket, (message) => message.type === 'record:update')
    const accepted = nextSocketMessage(firstSocket, (message) => message.type === 'record:accepted' || message.type === 'record:error')
    firstSocket.send(JSON.stringify({
      type: 'record:update',
      record: { store: 'chapters', id: 'live-chapter', novelId: 'live-novel', updatedAt: Date.now(), deleted: false, payload: { title: 'Arrived live' } }
    }))

    expect(await accepted).toMatchObject({ type: 'record:accepted', recordId: 'live-chapter' })
    expect((await update).record.payload.title).toBe('Arrived live')
    const pull = await (await get('/api/sync/pull?since=0', secondToken)).json()
    expect(pull.records.find((record) => record.id === 'live-chapter').payload.title).toBe('Arrived live')
    firstSocket.close()
    secondSocket.close()
  })

  it('delivers account notifications to the signed-in user in realtime', async () => {
    const admin = await register('realtime-admin')
    const target = await register('realtime-target')
    db.prepare("UPDATE users SET role = 'admin', roles = 'user,admin' WHERE id = ?").run(admin.body.accountId)
    const socket = await openSocket(`/ws/notifications?token=${encodeURIComponent(target.body.token)}`)
    const notification = nextSocketMessage(socket, (message) => message.type === 'notification:new')

    const response = await post(`/api/admin/users/${target.body.accountId}`, { roles: ['user', 'beta_tester'] }, admin.body.token)
    expect(response.status).toBe(200)
    expect((await notification).notification).toMatchObject({ title: 'Your MoonScribe access changed', priority: 'high' })
    socket.close()
  })
})

describe('rate limiting', () => {
  it('limits auth attempts per IP', async () => {
    await startServer({ rateLimit: { max: 3, windowMs: 60000 } })
    const statuses = []
    for (let i = 0; i < 6; i++) {
      statuses.push((await post('/api/auth/login', { username: 'nobody', password: 'whatever' })).status)
    }
    expect(statuses.slice(0, 3).every((s) => s === 401)).toBe(true)
    expect(statuses.slice(3).every((s) => s === 429)).toBe(true)
  })
})

describe('token expiry', () => {
  it('rejects and consumes an expired token', async () => {
    await startServer()
    const reg = await register('erin')
    db.prepare('UPDATE tokens SET expires_at = ?').run(Date.now() - 1)
    const pull = await get('/api/sync/pull?since=0', reg.body.token)
    expect(pull.status).toBe(401)
    const remaining = db.prepare('SELECT COUNT(*) AS n FROM tokens').get().n
    expect(remaining).toBe(0)
  })
})

describe('sync', () => {
  it('shares only an invited novel and enforces collaborator roles', async () => {
    await startServer()
    const owner = (await register('share-owner')).body
    const editor = (await register('share-editor')).body
    const viewer = (await register('share-viewer')).body
    db.prepare("UPDATE users SET role = 'beta_tester', roles = 'user,beta_tester' WHERE username IN ('share-editor', 'share-viewer')").run()
    await post('/api/sync/push', { records: [
      { store: 'novels', id: 'shared-novel', novelId: 'shared-novel', updatedAt: 1, deleted: false, payload: { title: 'Invited manuscript' } },
      { store: 'chapters', id: 'shared-chapter', novelId: 'shared-novel', updatedAt: 2, deleted: false, payload: { title: 'One' } },
      { store: 'novels', id: 'private-novel', novelId: 'private-novel', updatedAt: 3, deleted: false, payload: { title: 'Private manuscript' } }
    ] }, owner.token)
    expect((await post('/api/shares/presence', { novelId: 'shared-novel', chapterId: 'shared-chapter' }, owner.token)).status).toBe(200)

    const editorInvite = await (await post('/api/shares/invite', { novelId: 'shared-novel', role: 'editor' }, owner.token)).json()
    const acceptedResponse = await post('/api/shares/accept', { code: editorInvite.code }, editor.token)
    expect(acceptedResponse.status).toBe(200)
    const accepted = await acceptedResponse.json()
    expect(accepted.records.map((record) => record.id)).toEqual(expect.arrayContaining(['shared-novel', 'shared-chapter']))
    expect(accepted.records.some((record) => record.id === 'private-novel')).toBe(false)
    expect(accepted.records.find((record) => record.id === 'shared-novel').payload.sharedRole).toBe('editor')
    const bootstrap = await (await get('/api/shares/bootstrap?novelId=shared-novel', editor.token)).json()
    expect(bootstrap.records.map((record) => record.id)).toEqual(expect.arrayContaining(['shared-novel', 'shared-chapter']))
    expect(bootstrap.records.some((record) => record.id === 'private-novel')).toBe(false)
    expect(bootstrap.records.find((record) => record.id === 'shared-novel').payload.sharedRole).toBe('editor')
    const editorPull = await (await get('/api/sync/pull?since=0', editor.token)).json()
    expect(editorPull.records.map((record) => record.id)).toEqual(expect.arrayContaining(['shared-novel', 'shared-chapter']))
    expect(editorPull.records.some((record) => record.id === 'private-novel')).toBe(false)

    const edit = await post('/api/sync/push', { records: [
      { store: 'chapters', id: 'shared-chapter', novelId: 'shared-novel', updatedAt: 20, deleted: false, payload: { title: 'Edited together' } }
    ] }, editor.token)
    expect(edit.status).toBe(200)
    const ownerPull = await (await get('/api/sync/pull?since=0', owner.token)).json()
    expect(ownerPull.records.find((record) => record.id === 'shared-chapter').payload.title).toBe('Edited together')

    const viewerInvite = await (await post('/api/shares/invite', { novelId: 'shared-novel', role: 'viewer' }, owner.token)).json()
    await post('/api/shares/accept', { code: viewerInvite.code }, viewer.token)
    const forbidden = await post('/api/sync/push', { records: [
      { store: 'chapters', id: 'shared-chapter', novelId: 'shared-novel', updatedAt: 30, deleted: false, payload: { title: 'Should not save' } }
    ] }, viewer.token)
    expect(forbidden.status).toBe(200)
    const forbiddenBody = await forbidden.json()
    expect(forbiddenBody.accepted).toEqual([])
    expect(forbiddenBody.rejected).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'chapters:shared-chapter', reason: expect.stringContaining('proofread') })
    ]))

    db.prepare('UPDATE share_presence SET last_seen_at = ? WHERE novel_id = ? AND user_id = ?')
      .run(Date.now() - 60_000, 'shared-novel', owner.accountId)
    const closedRoom = await post('/api/shares/presence', { novelId: 'shared-novel', chapterId: 'shared-chapter' }, editor.token)
    expect(closedRoom.status).toBe(423)
    expect((await get('/api/shares/bootstrap?novelId=shared-novel', editor.token)).status).toBe(423)
    const offlinePull = await (await get('/api/sync/pull?since=0', editor.token)).json()
    expect(offlinePull.records.some((record) => record.id === 'shared-novel')).toBe(false)
  })

  it('pushes and pulls records with last-writer-wins', async () => {
    await startServer()
    const reg = await register('finn')
    const token = reg.body.token

    const push = await post('/api/sync/push', { records: [
      { store: 'chapters', id: 'ch1', novelId: 'n1', updatedAt: 100, deleted: false, payload: { title: 'One' } },
      { store: 'chapters', id: 'ch2', novelId: 'n1', updatedAt: 200, deleted: false, payload: { title: 'Two' } }
    ] }, token)
    expect(push.status).toBe(200)

    const body = await (await get('/api/sync/pull?since=0', token)).json()
    expect(body.records).toHaveLength(2)

    // Newer write wins.
    await post('/api/sync/push', { records: [
      { store: 'chapters', id: 'ch1', novelId: 'n1', updatedAt: 300, deleted: false, payload: { title: 'One (revised)' } }
    ] }, token)
    // Stale write loses.
    await post('/api/sync/push', { records: [
      { store: 'chapters', id: 'ch1', novelId: 'n1', updatedAt: 150, deleted: false, payload: { title: 'stale' } }
    ] }, token)
    const body2 = await (await get('/api/sync/pull?since=0', token)).json()
    expect(body2.records.find((r) => r.id === 'ch1').payload.title).toBe('One (revised)')

    // Deletes travel as tombstones.
    await post('/api/sync/push', { records: [
      { store: 'chapters', id: 'ch2', novelId: 'n1', updatedAt: 400, deleted: true, payload: null }
    ] }, token)
    const body3 = await (await get('/api/sync/pull?since=0', token)).json()
    expect(body3.records.find((r) => r.id === 'ch2').deleted).toBe(true)
  })

  it('pulls only records newer than `since`', async () => {
    await startServer()
    const reg = await register('george')
    const token = reg.body.token
    await post('/api/sync/push', { records: [
      { store: 'notes', id: 'nt1', novelId: 'n1', updatedAt: 100, deleted: false, payload: { title: 'a' } }
    ] }, token)

    const first = await (await get('/api/sync/pull?since=0', token)).json()
    const later = await (await get(`/api/sync/pull?since=${first.serverTime}`, token)).json()
    expect(later.records).toHaveLength(0)
  })

  it('syncs glossary and annotation records', async () => {
    await startServer()
    const reg = await register('writer')
    const push = await post('/api/sync/push', { records: [
      { store: 'glossary', id: 'gl1', novelId: 'n1', updatedAt: 100, deleted: false, payload: { term: 'Moonstone' } },
      { store: 'annotations', id: 'an1', novelId: 'n1', updatedAt: 101, deleted: false, payload: { note: 'Check continuity' } }
    ] }, reg.body.token)
    expect(push.status).toBe(200)
    const body = await (await get('/api/sync/pull?since=0', reg.body.token)).json()
    expect(body.records.map((record) => record.store)).toEqual(expect.arrayContaining(['glossary', 'annotations']))
  })

  it('requires auth', async () => {
    await startServer()
    expect((await get('/api/sync/pull?since=0')).status).toBe(401)
    expect((await post('/api/sync/push', { records: [] })).status).toBe(401)
  })

  it('isolates each user library', async () => {
    await startServer()
    const a = (await register('userA')).body
    const b = (await register('userB')).body
    await post('/api/sync/push', { records: [
      { store: 'novels', id: 'nov1', novelId: 'nov1', updatedAt: 1, deleted: false, payload: { title: 'A-only' } }
    ] }, a.token)

    const pullB = await (await get('/api/sync/pull?since=0', b.token)).json()
    expect(pullB.records).toHaveLength(0)
    const pullA = await (await get('/api/sync/pull?since=0', a.token)).json()
    expect(pullA.records).toHaveLength(1)
  })

  it('keeps colliding record ids isolated by account', async () => {
    await startServer()
    const a = (await register('collision-a')).body
    const b = (await register('collision-b')).body
    await post('/api/sync/push', { records: [{ store: 'novels', id: 'same-id', novelId: 'same-id', updatedAt: 1, deleted: false, payload: { title: 'A library' } }] }, a.token)
    await post('/api/sync/push', { records: [{ store: 'novels', id: 'same-id', novelId: 'same-id', updatedAt: 2, deleted: false, payload: { title: 'B library' } }] }, b.token)
    const pullA = await (await get('/api/sync/pull?since=0', a.token)).json()
    const pullB = await (await get('/api/sync/pull?since=0', b.token)).json()
    expect(pullA.records[0].payload.title).toBe('A library')
    expect(pullB.records[0].payload.title).toBe('B library')
  })

  it('drops oversized records', async () => {
    await startServer()
    const reg = await register('grace')
    const huge = 'x'.repeat(11 * 1024 * 1024)
    const res = await post('/api/sync/push', { records: [
      { store: 'notes', id: 'nt1', novelId: 'n1', updatedAt: 1, deleted: false, payload: { title: huge } }
    ] }, reg.body.token)
    expect(res.status).toBe(200)
    const body = await (await get('/api/sync/pull?since=0', reg.body.token)).json()
    expect(body.records).toHaveLength(0)
  })
})

describe('legacy records', () => {
  it('does not expose orphaned records to the first account by default', async () => {
    await startServer()
    db.prepare('INSERT INTO records (store, id, novel_id, payload, updated_at, deleted) VALUES (?, ?, ?, ?, ?, ?)').run(
      'novels', 'old1', 'old1', JSON.stringify({ title: 'legacy' }), 1, 0
    )
    const a = (await register('legacyUser')).body
    const pullA = await (await get('/api/sync/pull?since=0', a.token)).json()
    expect(pullA.records).toHaveLength(0)

    const b = (await register('secondUser')).body
    const pullB = await (await get('/api/sync/pull?since=0', b.token)).json()
    expect(pullB.records).toHaveLength(0)
  })
})

describe('static serving', () => {
  let tmpDir = null

  beforeEach(() => {
    tmpDir = join(tmpdir(), `moonscribe-test-${process.pid}-${Math.random().toString(36).slice(2, 8)}`)
    mkdirSync(join(tmpDir, 'assets'), { recursive: true })
    writeFileSync(join(tmpDir, 'index.html'), '<html><body>moonscribe-app</body></html>')
    writeFileSync(join(tmpDir, 'assets', 'app.js'), 'console.log(1)')
  })

  afterEach(() => {
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true })
    tmpDir = null
  })

  it('serves index.html and assets with cache headers, and SPA-falls back', async () => {
    await startServer({ distDir: tmpDir })
    const idx = await fetch(`${base}/`)
    expect(idx.status).toBe(200)
    expect(await idx.text()).toContain('moonscribe-app')

    const asset = await fetch(`${base}/assets/app.js`)
    expect(asset.status).toBe(200)
    expect(asset.headers.get('cache-control')).toContain('immutable')

    const spa = await fetch(`${base}/novel/xyz`)
    expect(spa.status).toBe(200)
    expect(await spa.text()).toContain('moonscribe-app')
  })

  it('never escapes the dist directory', async () => {
    writeFileSync(join(tmpDir, '..', 'moonscribe-secret.txt'), 'do-not-serve')
    await startServer({ distDir: tmpDir })
    for (const path of ['/..%2F..%2Fmoonscribe-secret.txt', '/..%2Fmoonscribe-secret.txt', '/.//../moonscribe-secret.txt']) {
      const probe = await rawGet(path)
      expect(probe.body, `path=${path}`).not.toContain('do-not-serve')
    }
  })
})
