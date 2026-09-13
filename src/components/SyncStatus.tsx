import { useEffect, useRef, useState } from 'react'
import { onStatus, pendingSyncCount } from '../sync/engine'
import { pendingNativeMirrorFailures } from '../platform/nativeStorage'

const LABELS = {
  offline: 'Offline — changes queued safely',
  local: 'Saved locally',
  connecting: 'Connecting…',
  syncing: 'Syncing…',
  synced: 'Synced across your devices',
  attention: 'Synced — local changes waiting',
  error: 'Sync needs attention'
}

const DOTS = {
  offline: '',
  local: 'ok',
  connecting: '',
  syncing: 'pulse',
  synced: 'ok',
  attention: 'pulse',
  error: 'err'
}

const STATE_META = {
  offline: { code: 'OFFLINE', icon: '○' },
  local: { code: 'LOCAL_ONLY', icon: '●' },
  connecting: { code: 'CONNECTING', icon: '↗' },
  syncing: { code: 'SYNCING', icon: '↻' },
  synced: { code: 'SYNCED', icon: '✓' },
  attention: { code: 'QUEUED', icon: '◐' },
  error: { code: 'ERROR', icon: '!' },
}

export default function SyncStatus({ onClick }) {
  const [status, setStatus] = useState({ status: 'offline', detail: '' })
  const [pending, setPending] = useState(0)
  const [nativePending, setNativePending] = useState(0)
  const pendingIndicator = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    const refreshPending = () => { void pendingSyncCount().then(setPending).catch(() => {}); setNativePending(pendingNativeMirrorFailures()) }
    refreshPending()
    window.addEventListener('moonscribe:record-written', refreshPending)
    window.addEventListener('moonscribe:native-mirror-failed', refreshPending)
    const unsubscribe = onStatus((next) => {
      refreshPending()
      if (pendingIndicator.current) clearTimeout(pendingIndicator.current)
      pendingIndicator.current = undefined
      // Fast background syncs should be invisible. Only show the busy state if
      // the network operation lasts long enough for the message to be useful.
      if (next.status === 'syncing' || next.status === 'connecting') {
        pendingIndicator.current = setTimeout(() => setStatus(next), 400)
        return
      }
      setStatus(next)
    })
    return () => {
      if (pendingIndicator.current) clearTimeout(pendingIndicator.current)
      window.removeEventListener('moonscribe:record-written', refreshPending)
      window.removeEventListener('moonscribe:native-mirror-failed', refreshPending)
      unsubscribe()
    }
  }, [])

  const label = LABELS[status.status] || LABELS.offline
  const totalPending = pending + nativePending
  const displayLabel = totalPending > 0 && (status.status === 'offline' || status.status === 'attention' || status.status === 'local')
    ? `${label} · ${totalPending} queued`
    : label
  const dot = DOTS[status.status] || ''
  const meta = STATE_META[status.status] || STATE_META.offline
  const diagnostic = `${meta.code}${totalPending ? ` · ${totalPending} pending` : ''}${status.detail ? ` · ${status.detail}` : ''}`

  return (
    <button
      className={`sync-status ${status.status}`}
      onClick={onClick}
      title={diagnostic}
      aria-label={displayLabel}
    >
      <span className={`dot ${dot}`} aria-hidden="true" />
      <span className="sync-state-code" aria-hidden="true">{meta.icon}</span>
      <span className="sync-label" aria-live="polite">{displayLabel}</span>
    </button>
  )
}
