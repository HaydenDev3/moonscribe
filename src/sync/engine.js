// Sync engine. Local-first: every write stays in IndexedDB and is flagged
// pendingSync; the engine pushes pending records and pulls remote changes
// with last-writer-wins merge. Deletes travel as tombstones.
import { getDB, listStores } from '../db/db'
import { getMeta, setMeta } from '../db/meta'
import { toWire, fromWire } from './serialize'
import { todayKey, addTodayWords } from '../db/stats'

let statusListeners = []
let busy = false

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
  const server = await getMeta('syncServer', null)
  const token = await getMeta('syncToken', null)
  const username = await getMeta('syncUsername', null)
  const state = (await getMeta('syncState', {})) || {}
  return { server, token, username, state }
}

export async function setConfig(patch) {
  const cfg = await getConfig()
  const next = { ...cfg, ...patch }
  if (patch.server !== undefined) await setMeta('syncServer', next.server)
  if (patch.token !== undefined) await setMeta('syncToken', next.token)
  if (patch.username !== undefined) await setMeta('syncUsername', next.username)
  if (patch.state !== undefined) await setMeta('syncState', next.state)
  return next
}

function apiBase(cfg) {
  if (cfg.server) return cfg.server.replace(/\/+$/, '')
  return ''
}

function notifySynced() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('moonscribe:synced'))
  }
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

    if (local && (local.updatedAt || 0) >= r.updatedAt) {
      // Local copy is at least as new. Make sure the server gets it back.
      if (!local.pendingSync) await db.put(r.store, { ...local, pendingSync: true })
      continue
    }

    const next = fromWire(r.payload)
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
  if (!res.ok) throw new Error(res.status === 401 ? 'connection lost — reconnect' : `push failed (${res.status})`)
  const data = await res.json()
  await clearPending(pending.map((p) => ({ store: p.store, id: p.id, deleted: p.deleted })))
  await setConfig({ state: { ...cfg.state, lastPull: cfg.state?.lastPull || 0, lastPush: data.serverTime || Date.now() } })
  return pending.length
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
  if (!res.ok) throw new Error(res.status === 401 ? 'connection lost — reconnect' : `pull failed (${res.status})`)
  const data = await res.json()
  await applyIncoming(data.records || [])
  await setConfig({ state: { ...cfg.state, lastPull: data.serverTime || since } })
  return (data.records || []).length
}

// ---- full sync (push then pull) ----
export async function sync() {
  if (busy) return { pushed: 0, pulled: 0 }
  busy = true
  try {
    const cfg = await getConfig()
    if (!cfg.token) {
      setStatus('offline')
      return { pushed: 0, pulled: 0 }
    }
    setStatus('syncing')
    const pushed = await push()
    const pulled = await pull()
    setStatus('synced')
    if (pulled > 0 || pushed > 0) notifySynced()
    return { pushed, pulled }
  } catch (err) {
    setStatus('error', err.message)
    throw err
  } finally {
    busy = false
  }
}

// ---- connect / disconnect ----
export async function connect({ url, mode = 'login', username, password }) {
  setStatus('connecting')
  try {
    const base = url.replace(/\/+$/, '')
    const res = await fetch(`${base}/api/auth/${mode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Could not connect — is the server running?')
    await setConfig({ server: base, token: data.token, username: data.username })
    await sync()
    return { ok: true, username: data.username }
  } catch (err) {
    setStatus('error', err.message)
    return { ok: false, error: err.message }
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
  await setConfig({ server: null, token: null, username: null, state: {} })
  setStatus('offline')
}
