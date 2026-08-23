// Sync engine. Local-first: every write stays in IndexedDB and is flagged
// pendingSync; the engine pushes pending records and pulls remote changes
// with last-writer-wins merge. Deletes travel as tombstones.
import { getDB, listStores, uid } from '../db/db'
import { migrateGuestToAccount } from '../db/guestMerge'
import { getMeta, setMeta } from '../db/meta'
import { toWire, fromWire } from './serialize'
import { todayKey, addTodayWords } from '../db/stats'
import { hasDesktopCredentialVault, readDesktopCredential, writeDesktopCredential } from '../security/credentials'
import { apiBaseUrl, websocketOrigin } from '../api/config'

let statusListeners = []
// Sync requests can arrive together (initial app sync, focus, invite accept).
// Keep them ordered instead of dropping the later request: an invite resets
// lastPull and must receive its own reconciliation pass.
let syncQueue = Promise.resolve()

export function onStatus(cb) {
  statusListeners.push(cb)
  return () => {
    statusListeners = statusListeners.filter((f) => f !== cb)
  }
}

function setStatus(status, detail = '') {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('moonscribe:sync', { detail: { status, detail } }))
  }
  for (const cb of statusListeners) cb({ status, detail })
}

export async function getConfig() {
  let server = await getMeta('syncServer', null) || apiBaseUrl()
  // Older OAuth responses persisted APP_ORIGIN (often localhost) even when
  // the app was opened through a public tunnel/domain. Heal that configuration
  // to same-origin so API, collaboration, and cover sync remain reachable.
  if (server && typeof window !== 'undefined' && !import.meta.env.VITE_API_URL && !import.meta.env.VITE_SYNC_SERVER) {
    try {
      const storedHost = new URL(server).hostname
      const currentHost = window.location.hostname
      const storedIsLocal = storedHost === 'localhost' || storedHost === '127.0.0.1'
      const currentIsLocal = currentHost === 'localhost' || currentHost === '127.0.0.1'
      if (storedIsLocal && !currentIsLocal) {
        server = apiBaseUrl()
        await setMeta('syncServer', server)
      }
    } catch {
      // Invalid legacy values are handled by the normal connection flow.
    }
  }
  let token = hasDesktopCredentialVault()
    ? await readDesktopCredential('sync-token')
    : await getMeta('syncToken', null)
  // Keep a small web-session recovery copy so a browser profile/database
  // migration during a redeploy does not strand an otherwise valid OAuth
  // session. This contains only the opaque bearer token; passwords are never
  // stored here. IndexedDB remains the primary web store.
  if (!hasDesktopCredentialVault() && !token && typeof localStorage !== 'undefined') {
    token = localStorage.getItem('moonscribe:session:token') || null
  }
  // Migrate older desktop builds away from plaintext browser storage once.
  if (hasDesktopCredentialVault() && !token) {
    const legacyToken = await getMeta('syncToken', null)
    if (legacyToken) {
      await writeDesktopCredential('sync-token', legacyToken)
      await setMeta('syncToken', null)
      token = legacyToken
    }
  }
  const username = await getMeta('syncUsername', null)
  const state = (await getMeta('syncState', {})) || {}
  const deviceId = await getMeta('syncDeviceId', null)
  const accountId = await getMeta('syncAccountId', null)
  return { server, token, username, state, deviceId, accountId }
}

export async function setConfig(patch) {
  const cfg = await getConfig()
  const next = { ...cfg, ...patch }
  if (patch.server !== undefined) await setMeta('syncServer', next.server)
  if (patch.token !== undefined) {
    if (hasDesktopCredentialVault()) {
      await writeDesktopCredential('sync-token', next.token || null)
      await setMeta('syncToken', null)
    } else {
      await setMeta('syncToken', next.token)
      if (typeof localStorage !== 'undefined') {
        if (next.token) localStorage.setItem('moonscribe:session:token', next.token)
        else localStorage.removeItem('moonscribe:session:token')
      }
    }
  }
  if (patch.username !== undefined) await setMeta('syncUsername', next.username)
  if (patch.state !== undefined) await setMeta('syncState', next.state)
  if (patch.accountId !== undefined) await setMeta('syncAccountId', next.accountId)
  return next
}

function apiBase(cfg) {
  if (cfg.server) return cfg.server.replace(/\/+$/, '')
  return ''
}

async function deviceHeaders() {
  let deviceId = await getMeta('syncDeviceId', null)
  if (!deviceId) {
    deviceId = uid()
    await setMeta('syncDeviceId', deviceId)
  }
  const name = navigator.userAgent.includes('Windows') ? 'Windows device'
    : navigator.userAgent.includes('Mac') ? 'Mac device'
      : navigator.userAgent.includes('Android') ? 'Android device'
        : navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad') ? 'Apple device'
          : 'This device'
  return { 'X-Device-Id': deviceId, 'X-Device-Name': name }
}

async function clearAuth() {
  await setConfig({ token: null, username: null, accountId: null, state: {} })
}

// IndexedDB is scoped to an origin. A library written before account sync was
// enabled (or before the writer signed in) may therefore contain perfectly
// valid records that are not pending and have never reached the server. Queue
// one complete, non-destructive snapshot the first time this origin is bound
// to an account. Server LWW rules still protect a newer remote copy.
async function queueInitialLibrarySnapshot(accountId) {
  const bootstrapKey = `syncBootstrap:${accountId}:v1`
  if (await getMeta(bootstrapKey, false)) return 0

  const db = await getDB()
  const stores = listStores()
  const tx = db.transaction(stores, 'readwrite')
  let queued = 0
  for (const store of stores) {
    const objectStore = tx.objectStore(store)
    let cursor = await objectStore.openCursor()
    while (cursor) {
      const record = cursor.value
      if (record && record.id) {
        await cursor.update({
          ...record,
          // Do not make an old local copy artificially newer than the server.
          updatedAt: record.updatedAt || record.createdAt || 1,
          pendingSync: true
        })
        queued += 1
      }
      cursor = await cursor.continue()
    }
  }
  await tx.done
  await setMeta(bootstrapKey, { queued, at: Date.now() })
  return queued
}

async function bindLocalLibrary(accountId, { replaceOwner = false } = {}) {
  if (!accountId) throw new Error('The server did not return an account identity.')
  const owner = await getMeta('syncLibraryOwner', null)
  if (owner && owner !== accountId) {
    if (!replaceOwner) {
      const error = new Error('This browser has a library from another account. Back it up, then switch to this account’s cloud library.')
      error.code = 'LIBRARY_OWNER_CONFLICT'
      throw error
    }
    await replaceLocalLibraryOwner(accountId)
  }
  if (!owner) await setMeta('syncLibraryOwner', accountId)
  await queueInitialLibrarySnapshot(accountId)
}

async function replaceLocalLibraryOwner(accountId) {
  const db = await getDB()
  const stores = [...listStores(), 'tombstones', 'stats'].filter((name) => db.objectStoreNames.contains(name))
  const tx = db.transaction(stores, 'readwrite')
  for (const store of stores) await tx.objectStore(store).clear()
  await tx.done
  await setMeta('syncLibraryOwner', accountId)
  await setMeta('syncState', {})
  await setMeta(`syncBootstrap:${accountId}:v1`, { queued: 0, at: Date.now(), cloudOnly: true })
}

export async function accountProfile(server, token) {
  const base = String(server || '').replace(/\/+$/, '')
  const res = await fetch(`${base}/api/auth/me`, { headers: { Authorization: `Bearer ${token}`, ...(await deviceHeaders()) } })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.account?.id) throw new Error(data.error || 'Could not verify this account.')
  return data.account
}

export async function validateSession() {
  const cfg = await getConfig()
  if (!cfg.server || !cfg.token) return null
  try {
    const profile = await accountProfile(cfg.server, cfg.token)
    await bindLocalLibrary(profile.id)
    await setConfig({ accountId: profile.id, username: profile.username || cfg.username })
    return profile
  } catch (error) {
    await clearAuth()
    throw error
  }
}

function notifySynced() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('moonscribe:synced'))
  }
}

// ---- conflicts ----
// A conflict is a record edited on this device (pendingSync) that also changed
// remotely. Rather than silently pick a winner, we hold both versions until the
// author resolves it — losing a novel's words to a silent overwrite is the one
// thing sync must never do.
const VOLATILE = new Set(['pendingSync', 'rev', 'updatedAt', 'lastOpened', '__hadCover', 'cover'])

function stableString(rec) {
  if (!rec) return ''
  const out = {}
  for (const k of Object.keys(rec).sort()) {
    if (!VOLATILE.has(k)) out[k] = rec[k]
  }
  return JSON.stringify(out)
}

export function recordsDiffer(a, b) {
  return stableString(a) !== stableString(b)
}

function emitConflicts(list) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('moonscribe:conflicts', { detail: { count: list.length } }))
  }
}

export async function listConflicts() {
  return (await getMeta('conflicts', [])) || []
}

async function recordConflict(store, id, mine, theirs) {
  const list = await listConflicts()
  const next = list.filter((c) => !(c.store === store && c.id === id))
  next.push({
    cid: `${store}:${id}:${theirs?.updatedAt || Date.now()}`,
    store,
    id,
    novelId: mine?.novelId || theirs?.novelId || null,
    mine,
    theirs,
    at: theirs?.updatedAt || Date.now()
  })
  await setMeta('conflicts', next)
  emitConflicts(next)
}

// choice: 'mine' | 'theirs' | 'both'
export async function resolveConflict(cid, choice) {
  const db = await getDB()
  const list = await listConflicts()
  const c = list.find((x) => x.cid === cid)
  if (!c) return
  if (choice === 'theirs') {
    // Adopt the remote version; the server already has it, so no re-push needed.
    await db.put(c.store, { ...c.theirs, id: c.id, pendingSync: false })
  } else if (choice === 'both') {
    // Keep mine (already local, pending). Fork theirs into a new record so both survive.
    const now = Date.now()
    const forkTitle = (t) => `${t || 'Untitled'} (their version)`
    const fork = { ...c.theirs, id: uid(), updatedAt: now, pendingSync: true }
    if ('title' in fork) fork.title = forkTitle(fork.title)
    else if ('name' in fork) fork.name = forkTitle(fork.name)
    if (c.store === 'chapters') fork.order = (c.mine?.order || 0) + 0.5
    await db.put(c.store, fork)
  } else {
    // Keep mine — bump it so the next push wins on the server.
    const local = await db.get(c.store, c.id)
    if (local) await db.put(c.store, { ...local, updatedAt: Date.now(), pendingSync: true })
  }
  const remaining = list.filter((x) => x.cid !== cid)
  await setMeta('conflicts', remaining)
  emitConflicts(remaining)
}

// ---- collect pending local changes ----
export async function collectPending() {
  const db = await getDB()
  const out = []
  for (const store of listStores()) {
    const all = await db.getAll(store)
    for (const rec of all) {
      if (rec && rec.pendingSync) {
        const wire = await toWire(rec)
        if (wire) {
          out.push({ store, id: rec.id, novelId: rec.novelId, updatedAt: rec.updatedAt || Date.now(), deleted: false, payload: wire })
        }
      }
    }
  }
  const tombs = await db.getAll('tombstones')
  for (const t of tombs) {
    if (t && t.pendingSync) {
      out.push({ store: t.store, id: t.id.replace(/^[^:]*:/, ''), novelId: t.novelId, updatedAt: t.deletedAt, deleted: true, payload: null })
    }
  }
  return out
}

// ---- apply remote changes (LWW) ----
export async function applyIncoming(records) {
  if (!records || !records.length) return { applied: 0 }
  const db = await getDB()
  let applied = 0
  for (const r of records) {
    if (!r || !r.store || !r.id) continue
    const key = r.id
    const local = await db.get(r.store, key)

    if (r.deleted) {
      if (local && local.updatedAt > r.updatedAt) {
        // Local edit is newer than the remote delete — keep it, re-push it.
        if (!local.pendingSync) await db.put(r.store, { ...local, pendingSync: true })
      } else {
        await db.delete(r.store, key)
        await db.delete('tombstones', `${r.store}:${key}`)
        applied += 1
      }
      continue
    }

    const incoming = fromWire(r.payload)

    // Both sides changed since the last sync: this device has unpushed edits
    // (pendingSync) and the remote differs. Capture both rather than pick a
    // silent winner.
    if (local && local.pendingSync && incoming && recordsDiffer(local, incoming)) {
      await recordConflict(r.store, key, local, incoming)
      continue
    }

    if (local && (local.updatedAt || 0) >= r.updatedAt) {
      // Local copy is at least as new. Make sure the server gets it back.
      if (!local.pendingSync) await db.put(r.store, { ...local, pendingSync: true })
      continue
    }

    const next = incoming
    if (!next) continue
    // Restore the id in case the wire payload was keyed differently.
    next.id = key
    delete next.pendingSync
    await db.put(r.store, next)
    applied += 1

    // Keep the daily "words today" tally roughly in step across devices.
    if (r.store === 'chapters' && next.novelId) {
      const prev = local?.wordCount || 0
      const nowWords = next.wordCount || 0
      const today = todayKey(next.novelId)
      const recDate = todayKey(next.novelId, new Date(r.updatedAt))
      if (recDate === today && nowWords > prev) {
        await addTodayWords(next.novelId, nowWords - prev)
      }
    }
  }
  return { applied }
}

async function clearPending(ids) {
  if (!ids.length) return
  const db = await getDB()
  const tx = db.transaction([...listStores(), 'tombstones'], 'readwrite')
  for (const { store, id, deleted } of ids) {
    if (deleted) {
      const t = await tx.objectStore('tombstones').get(`${store}:${id}`)
      if (t) await tx.objectStore('tombstones').put({ ...t, pendingSync: false })
    } else {
      const rec = await tx.objectStore(store).get(id)
      if (rec) await tx.objectStore(store).put({ ...rec, pendingSync: false })
    }
  }
  await tx.done
}

// ---- push ----
export async function push() {
  const cfg = await getConfig()
  if (!cfg.token) return 0
  const pending = await collectPending()
  if (!pending.length) return 0
  setStatus('syncing')
  const res = await fetch(`${apiBase(cfg)}/api/sync/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.token}` },
    body: JSON.stringify({ records: pending })
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    if (res.status === 401) {
      await clearAuth()
      setStatus('offline')
      throw new Error('connection lost — reconnect')
    }
    throw new Error(data.error || `push failed (${res.status})`)
  }
  const data = await res.json()
  const acceptedKeys = Array.isArray(data.accepted) ? new Set(data.accepted) : null
  const acknowledged = acceptedKeys
    ? pending.filter((p) => acceptedKeys.has(`${p.store}:${p.id}`))
    : pending
  await clearPending(acknowledged.map((p) => ({ store: p.store, id: p.id, deleted: p.deleted })))
  await setConfig({ state: { ...cfg.state, lastPull: cfg.state?.lastPull || 0, lastPush: data.serverTime || Date.now() } })
  return acknowledged.length
}

// ---- pull ----
export async function pull() {
  const cfg = await getConfig()
  if (!cfg.token) return 0
  setStatus('syncing')
  const since = cfg.state?.lastPull || 0
  const res = await fetch(`${apiBase(cfg)}/api/sync/pull?since=${since}`, {
    headers: { Authorization: `Bearer ${cfg.token}` }
  })
  if (!res.ok) {
    if (res.status === 401) {
      await clearAuth()
      setStatus('offline')
      throw new Error('connection lost — reconnect')
    }
    throw new Error(`pull failed (${res.status})`)
  }
  const data = await res.json()
  await applyIncoming(data.records || [])
  await setConfig({ state: { ...cfg.state, lastPull: data.serverTime || since } })
  return (data.records || []).length
}

// ---- full sync (push then pull) ----
async function performSync() {
  try {
    const cfg = await getConfig()
    if (!cfg.token) {
      setStatus('offline')
      return { pushed: 0, pulled: 0 }
    }
    setStatus('syncing')
    let pushed = 0
    let pushError = null
    try {
      pushed = await push()
    } catch (err) {
      // A rejected local edit must never prevent remote/shared manuscripts
      // from being downloaded. Authentication failures still abort because
      // pull cannot succeed without a valid session.
      if (!((await getConfig()).token)) throw err
      pushError = err
    }
    const pulled = await pull()
    const completedAt = Date.now()
    const completedConfig = await getConfig()
    await setConfig({
      state: {
        ...(completedConfig.state || {}),
        lastSuccessfulSync: completedAt
      }
    })
    setStatus(pushError ? 'attention' : 'synced', pushError?.message || '')
    if (pulled > 0 || pushed > 0) notifySynced()
    return { pushed, pulled, pushError: pushError?.message || null }
  } catch (err) {
    setStatus('error', err.message)
    throw err
  }
}

export function sync() {
  const task = syncQueue.then(performSync, performSync)
  // Keep the queue usable after a failed request while returning the original
  // rejection to the caller that needs to display it.
  syncQueue = task.catch(() => undefined)
  return task
}

// ---- connect / disconnect ----
export async function connect({ url, mode = 'login', username, password, replaceLocal = false }) {
  setStatus('connecting')
  try {
    const base = url.replace(/\/+$/, '')
    const res = await fetch(`${base}/api/auth/${mode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await deviceHeaders()) },
      body: JSON.stringify({ username, password })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Could not connect — is the server running?')
    if (await getMeta('guestMode', false)) await migrateGuestToAccount(data.accountId)
    await bindLocalLibrary(data.accountId, { replaceOwner: replaceLocal })
    await setConfig({ server: base, token: data.token, accountId: data.accountId, username: data.username })
    await sync()
    return { ok: true, username: data.username }
  } catch (err) {
    setStatus('error', err.message)
    return { ok: false, error: err.message, code: err.code }
  }
}

// Connect using a pre-issued token (e.g. from Discord OAuth callback)
export async function connectWithToken({ server, token, username }) {
  setStatus('connecting')
  try {
    const base = server.replace(/\/+$/, '')
    const profile = await accountProfile(base, token)
    if (await getMeta('guestMode', false)) await migrateGuestToAccount(profile.id)
    await bindLocalLibrary(profile.id)
    await setConfig({ server: base, token, accountId: profile.id, username: profile.username || username })
    // OAuth is successful once the bearer token has been verified and stored.
    // A first library sync may fail because the device is offline or the API
    // origin is briefly unavailable; that must not sign the user back out.
    try { await sync() } catch (syncError) {
      setStatus('attention', syncError?.message || 'Cloud sync will retry shortly.')
    }
    return { ok: true, username: profile.username || username }
  } catch (err) {
    setStatus('error', err.message)
    return { ok: false, error: err.message }
  }
}

export async function signOutOtherDevices() {
  const cfg = await getConfig()
  if (!cfg.server || !cfg.token) throw new Error('Sign in first.')
  const res = await fetch(`${apiBase(cfg)}/api/auth/logout-others`, {
    method: 'POST', headers: { Authorization: `Bearer ${cfg.token}` }
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Could not sign out other devices.')
  return data.removed || 0
}

export async function listSessions() {
  const cfg = await getConfig()
  if (!cfg.server || !cfg.token) return []
  const res = await fetch(`${apiBase(cfg)}/api/auth/sessions`, { headers: { Authorization: `Bearer ${cfg.token}` } })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Could not load signed-in devices.')
  return data.sessions || []
}

export async function revokeSession(sessionId) {
  const cfg = await getConfig()
  if (!cfg.server || !cfg.token) throw new Error('Sign in first.')
  const res = await fetch(`${apiBase(cfg)}/api/auth/sessions/revoke`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.token}` }, body: JSON.stringify({ sessionId })
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Could not revoke that device.')
  return true
}

async function shareRequest(path, { method = 'GET', body, keepalive = false } = {}) {
  const cfg = await getConfig()
  if (!cfg.server || !cfg.token) throw new Error('Sign in to share a writing session.')
  const res = await fetch(`${apiBase(cfg)}${path}`, {
    method,
    headers: { Authorization: `Bearer ${cfg.token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    ...(keepalive ? { keepalive: true } : {})
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const error = new Error(data.error || 'The collaboration request failed.')
    error.status = res.status
    throw error
  }
  return data
}

export const createShareInvite = (novelId, role, accessDurationMs = null) => shareRequest('/api/shares/invite', { method: 'POST', body: { novelId, role, accessDurationMs } })
export function inviteCode(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  try {
    const url = new URL(raw, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
    return url.searchParams.get('share') || raw
  } catch {
    return raw
  }
}

export async function acceptShareInvite(code) {
  const result = await shareRequest('/api/shares/accept', { method: 'POST', body: { code: inviteCode(code) } })
  let bootstrap = { records: result.records || [], serverTime: result.serverTime || 0 }
  let fallbackReceived = 0
  if (!bootstrap.records.length) {
    try {
      bootstrap = await shareRequest(`/api/shares/bootstrap?novelId=${encodeURIComponent(result.novelId)}`)
    } catch (error) {
      if (error.status !== 404) throw error
      // Compatibility with a server process that predates the bootstrap route.
      // Reset the cursor so the established pull endpoint returns the full share.
      const cfg = await getConfig()
      await setConfig({ state: { ...(cfg.state || {}), lastPull: 0 } })
      fallbackReceived = await pull()
    }
  }
  await applyIncoming(bootstrap.records || [])
  const db = await getDB()
  const novel = await db.get('novels', result.novelId)
  if (!novel) {
    throw new Error('The invitation was accepted, but the shared manuscript could not be saved on this device.')
  }

  // Keep subsequent incremental syncs aligned with the completed bootstrap.
  if (bootstrap.serverTime) {
    const cfg = await getConfig()
    await setConfig({ state: { ...(cfg.state || {}), lastPull: bootstrap.serverTime } })
  }
  notifySynced()
  return { ...result, received: (bootstrap.records || []).length || fallbackReceived }
}
export const listNovelMembers = (novelId) => shareRequest(`/api/shares?novelId=${encodeURIComponent(novelId)}`)
export const revokeNovelMember = (novelId, memberId) => shareRequest('/api/shares/revoke', { method: 'POST', body: { novelId, memberId } })
export const updateShareRoom = (novelId, settings) => shareRequest('/api/shares/room', { method: 'POST', body: { novelId, ...settings } })
export const updatePresence = (novelId, chapterId, context = {}) => shareRequest('/api/shares/presence', { method: 'POST', body: { novelId, chapterId, ...context }, keepalive: context.status === 'offline' })
export const clearPresence = (novelId, chapterId = null, context = {}) => shareRequest('/api/shares/presence', { method: 'POST', body: { novelId, chapterId, status: 'offline', activity: 'viewing', workspace: context.workspace, tabName: context.tabName, lineNumber: null, cursorOffset: null }, keepalive: true })
export const listPresence = (novelId) => shareRequest(`/api/shares/presence?novelId=${encodeURIComponent(novelId)}`)

export function publishLiveRecord(record) {
  if (typeof window === 'undefined' || !record?.novelId) return
  window.dispatchEvent(new CustomEvent('moonscribe:record-written', { detail: record }))
}

export async function subscribePresence(novelId, { onMessage, onRecord, onError } = {}) {
  const cfg = await getConfig()
  if (!cfg.server || !cfg.token || !novelId || typeof WebSocket === 'undefined') return () => {}
  const base = apiBase(cfg)
  const wsUrl = websocketOrigin(base) + `/ws/presence?novelId=${encodeURIComponent(novelId)}&token=${encodeURIComponent(cfg.token)}`
  let closed = false
  let retryTimer = null
  let retryAttempt = 0
  let online = typeof navigator === 'undefined' || navigator.onLine !== false
  let socket = null
  const pendingRecords = new Map()
  const sendRecord = (record) => {
    if (socket?.readyState !== WebSocket.OPEN) return false
    socket.send(JSON.stringify({ type: 'record:update', record }))
    return true
  }
  const publishRecord = (event) => {
    const record = event?.detail
    if (String(record?.novelId || '') !== String(novelId)) return
    if (!sendRecord(record)) pendingRecords.set(`${record.store}:${record.id}`, record)
  }
  window.addEventListener('moonscribe:record-written', publishRecord)

  const connectSocket = () => {
    if (closed || !online) return
    window.dispatchEvent(new CustomEvent('moonscribe:collaboration', { detail: { status: retryAttempt ? 'reconnecting' : 'connecting', novelId } }))
    socket = new WebSocket(wsUrl)
    socket.addEventListener('open', () => {
      retryAttempt = 0
      for (const [key, record] of pendingRecords) {
        if (sendRecord(record)) pendingRecords.delete(key)
      }
      window.dispatchEvent(new CustomEvent('moonscribe:collaboration', { detail: { status: 'connected', novelId } }))
    })
    socket.addEventListener('message', async (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data?.type === 'presence') onMessage?.(data.people || [])
        if (data?.type === 'record:update' && data.record) {
          onRecord?.(data.record)
          window.dispatchEvent(new CustomEvent('moonscribe:remote-record', { detail: data.record }))
          await applyIncoming([data.record])
          notifySynced()
        }
        if (data?.type === 'record:error') {
          const error = new Error(data.error || 'The live update was rejected.')
          onError?.(error)
          window.dispatchEvent(new CustomEvent('moonscribe:collaboration', { detail: { status: 'error', novelId, error: error.message } }))
        }
      } catch {
        // Ignore malformed events and keep the connection alive.
      }
    })
    socket.addEventListener('close', () => {
      if (closed) return
      window.dispatchEvent(new CustomEvent('moonscribe:collaboration', { detail: { status: 'reconnecting', novelId } }))
      const delay = Math.min(30000, 800 * (2 ** Math.min(retryAttempt++, 6))) + Math.round(Math.random() * 250)
      retryTimer = setTimeout(connectSocket, delay)
    })
    socket.addEventListener('error', (error) => {
      onError?.(error)
      try { socket?.close() } catch { /* noop */ }
    })
  }

  const onOnline = () => { online = true; retryAttempt = 0; connectSocket() }
  const onOffline = () => { online = false; clearTimeout(retryTimer); try { socket?.close() } catch {} ; window.dispatchEvent(new CustomEvent('moonscribe:collaboration', { detail: { status: 'offline', novelId } })) }
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)

  connectSocket()
  return () => {
    closed = true
    window.removeEventListener('moonscribe:record-written', publishRecord)
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
    clearTimeout(retryTimer)
    if (!socket) return
    if (socket.readyState === WebSocket.OPEN) {
      try { socket.close() } catch { /* noop */ }
    } else if (socket.readyState === WebSocket.CONNECTING) {
      // Closing a CONNECTING socket produces a noisy browser warning. Let the
      // handshake settle, then close without scheduling a reconnect.
      socket.addEventListener('open', () => {
        try { socket.close() } catch { /* noop */ }
      }, { once: true })
    }
  }
}

export async function disconnect() {
  const cfg = await getConfig()
  if (cfg.token && cfg.server) {
    try {
      await fetch(`${apiBase(cfg)}/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${cfg.token}` }
      })
    } catch {
      // offline — just clear locally
    }
  }
  await setConfig({ server: null, token: null, username: null, accountId: null, state: {} })
  setStatus('offline')
}
