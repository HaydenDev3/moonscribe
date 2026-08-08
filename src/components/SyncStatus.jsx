import { useEffect, useState } from 'react'
import { onStatus } from '../sync/engine'

const LABELS = {
  offline: 'Offline — stored safely on this device',
  connecting: 'Connecting…',
  syncing: 'Syncing…',
  synced: 'Synced across your devices',
  error: 'Sync needs attention'
}

const DOTS = {
  offline: '',
  connecting: '',
  syncing: 'pulse',
  synced: 'ok',
  error: 'err'
}

export default function SyncStatus({ onClick }) {
  const [status, setStatus] = useState({ status: 'offline', detail: '' })

  useEffect(() => {
    return onStatus((s) => setStatus(s))
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
