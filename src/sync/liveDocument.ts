import * as Y from 'yjs'
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness'
import { getConfig } from './engine'

type LiveDocumentOptions = {
  novelId: string
  chapterId: string
  readOnly?: boolean
  onUpdate?: (update: Uint8Array, origin: unknown) => void
  onStatus?: (status: 'connecting' | 'connected' | 'reconnecting' | 'offline' | 'error') => void
}

const databaseName = 'moonscribe-live-documents'
const storeName = 'updates'

function keyFor(novelId: string, chapterId: string) {
  return `${novelId}:${chapterId}`
}

function openPersistence() {
  return new Promise<any>((resolve, reject) => {
    const request = globalThis.indexedDB.open(databaseName, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(storeName)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function loadPersisted(key: string, doc: Y.Doc) {
  if (typeof globalThis.indexedDB === 'undefined') return
  const db = await openPersistence()
  const update = await new Promise<ArrayBuffer | undefined>((resolve, reject) => {
    const request = db.transaction(storeName).objectStore(storeName).get(key)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  db.close()
  if (update) Y.applyUpdate(doc, new Uint8Array(update))
}

async function persist(key: string, doc: Y.Doc) {
  if (typeof globalThis.indexedDB === 'undefined') return
  const db = await openPersistence()
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(storeName, 'readwrite').objectStore(storeName).put(Y.encodeStateAsUpdate(doc), key)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
  db.close()
}

function websocketUrl(server: string, novelId: string, token: string, sessionId: string) {
  const url = new URL(server.replace(/^http/, 'ws') + `/ws/presence?novelId=${encodeURIComponent(novelId)}&token=${encodeURIComponent(token)}&sessionId=${encodeURIComponent(sessionId)}`)
  return url.toString()
}

function encode(update: Uint8Array) {
  let binary = ''
  update.forEach((value) => { binary += String.fromCharCode(value) })
  return btoa(binary)
}

function decode(value: string) {
  const binary = atob(value)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

export async function openLiveDocument({ novelId, chapterId, readOnly = false, onUpdate, onStatus }: LiveDocumentOptions) {
  const doc = new Y.Doc()
  const key = keyFor(novelId, chapterId)
  await loadPersisted(key, doc)
  const cfg = await getConfig()
  if (!cfg.server || !cfg.token || typeof WebSocket === 'undefined') {
    onStatus?.('offline')
    return { doc, close: async () => {} }
  }
  onStatus?.('connecting')
  const socket = new WebSocket(websocketUrl(cfg.server, novelId, cfg.token, `${Date.now()}-${Math.random().toString(36).slice(2)}`))
  const awareness = new Awareness(doc)
  let closed = false
  let ready = false
  let persistTimer: ReturnType<typeof setTimeout> | null = null
  const pending: Uint8Array[] = []
  const schedulePersist = () => {
    if (persistTimer) clearTimeout(persistTimer)
    persistTimer = setTimeout(() => {
      persistTimer = null
      void persist(key, doc)
    }, 2000)
  }
  const send = (update: Uint8Array) => {
    if (readOnly) return
    if (!ready) { pending.push(update); return }
    socket.send(JSON.stringify({ type: 'crdt:update', novelId, chapterId, update: encode(update) }))
  }
  const sendAwareness = ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
    if (socket.readyState !== WebSocket.OPEN) return
    const clients = [...added, ...updated, ...removed]
    socket.send(JSON.stringify({ type: 'crdt:awareness', novelId, chapterId, update: encode(encodeAwarenessUpdate(awareness, clients)) }))
  }
  const observer = (update: Uint8Array, origin: unknown) => {
    schedulePersist()
    if (origin !== 'remote') {
      onUpdate?.(update, origin)
      send(update)
    }
  }
  doc.on('update', observer)
  awareness.on('update', sendAwareness)
  socket.addEventListener('open', () => {
    onStatus?.('connected')
    socket.send(JSON.stringify({ type: 'crdt.sync', novelId, chapterId }))
  })
  socket.addEventListener('message', (event) => {
    try {
      const message = JSON.parse(String(event.data))
      if ((message.type === 'crdt.sync' || message.type === 'crdt:update') && message.update) {
        ready = true
        doc.transact(() => Y.applyUpdate(doc, decode(message.update)), 'remote')
        for (const update of pending.splice(0)) send(update)
      }
      if (message.type === 'crdt:awareness' && message.update) applyAwarenessUpdate(awareness, decode(message.update), 'remote')
    } catch { onStatus?.('error') }
  })
  socket.addEventListener('close', () => { if (!closed) onStatus?.('reconnecting') })
  socket.addEventListener('error', () => onStatus?.('error'))
  return {
    doc,
    provider: { awareness },
    close: async () => {
      closed = true
      if (persistTimer) clearTimeout(persistTimer)
      persistTimer = null
      doc.off('update', observer)
      awareness.off('update', sendAwareness)
      await persist(key, doc)
      if (socket.readyState === WebSocket.OPEN) socket.close()
      else if (socket.readyState === WebSocket.CONNECTING) socket.addEventListener('open', () => socket.close(), { once: true })
    },
  }
}
