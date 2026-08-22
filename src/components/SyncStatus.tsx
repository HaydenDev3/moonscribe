import { useEffect, useRef, useState } from 'react'
import { onStatus } from '../sync/engine'

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

export default function SyncStatus({ onClick }) {
  const [status, setStatus] = useState({ status: 'offline', detail: '' })
  const pendingIndicator = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    const unsubscribe = onStatus((next) => {
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
      unsubscribe()
    }
  }, [])

  const label = LABELS[status.status] || LABELS.offline
  const dot = DOTS[status.status] || ''

  return (
    <button
      className={`sync-status ${status.status}`}
      onClick={onClick}
      title={status.detail ? `${label} — ${status.detail}` : label}
      aria-label={label}
    >
      <span className={`dot ${dot}`} />
      <span className="sync-label">{label}</span>
    </button>
  )
}
