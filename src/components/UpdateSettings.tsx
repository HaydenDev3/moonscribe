import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import { checkForDesktopUpdate, currentVersion, restartAfterUpdate, type DesktopUpdate, type UpdateState } from '../platform/updater'

export default function UpdateSettings() {
  const [version, setVersion] = useState('…')
  const [state, setState] = useState<UpdateState>('idle')
  const [progress, setProgress] = useState<number | null>(null)
  const [lastChecked, setLastChecked] = useState<string>(() => localStorage.getItem('moonscribe:update:lastChecked') || 'Never')
  const [automatic, setAutomatic] = useState(() => localStorage.getItem('moonscribe:update:autoCheck') !== 'false')
  const updateRef = useRef<DesktopUpdate | null>(null)

  useEffect(() => { currentVersion().then(setVersion).catch(() => setVersion('0.1.0')) }, [])

  const checkNow = async () => {
    setState(navigator.onLine ? 'checking' : 'offline')
    if (!navigator.onLine) return
    try {
      updateRef.current = await checkForDesktopUpdate()
      const checked = new Date().toLocaleString()
      localStorage.setItem('moonscribe:update:lastChecked', checked); setLastChecked(checked)
      setState(updateRef.current ? 'available' : 'up-to-date')
    } catch (error) {
      const message = String((error as Error)?.message || error)
      setState(/endpoint|configuration|pubkey/i.test(message) ? 'unconfigured' : 'error')
    }
  }

  const download = async () => {
    if (!updateRef.current) return
    setState('downloading'); setProgress(null)
    try { await updateRef.current.downloadAndInstall(setProgress); setState('ready') } catch { setState('error') }
  }

  const labels: Record<UpdateState, string> = { idle: 'Ready to check', checking: 'Checking for updates…', 'up-to-date': 'MoonScribe is up to date.', available: `MoonScribe ${updateRef.current?.version || ''} is available.`, downloading: `Downloading update${progress == null ? '…' : ` — ${progress}%`}`, ready: 'Update ready. Restart when you are ready.', installing: 'Restarting to finish the update…', offline: 'Unable to check while offline.', error: 'MoonScribe could not check for or install the update. Your stories are safe.', unconfigured: 'Release updater signing is not configured for this build.' }

  return <section className="settings-panel"><div className="settings-panel-kicker">MoonScribe Desktop</div><h2>Updates</h2><p className="muted">Updates are checked quietly and never block your local writing room.</p>
    <div className="settings-section-card"><div className="settings-section-head"><span className="settings-section-icon"><Icon icon="fa-solid fa-arrows-rotate" /></span><div><strong>MoonScribe Desktop</strong><small>Version {version} · Stable channel</small></div><span className={`settings-status-pill ${state === 'error' ? '' : 'safe'}`}>{state === 'downloading' ? `${progress ?? '…'}%` : state}</span></div>
      <div className="settings-row"><div><div className="settings-row-title">Automatic update checks</div><div className="settings-row-sub">Checks after startup without delaying the dashboard.</div></div><button className={`toggle ${automatic ? 'on' : ''}`} aria-pressed={automatic} onClick={() => { const next = !automatic; setAutomatic(next); localStorage.setItem('moonscribe:update:autoCheck', String(next)) }}><span /></button></div>
      <div className="settings-detail-grid"><span><small>Last checked</small><b>{lastChecked}</b></span><span><small>Status</small><b>{labels[state]}</b></span></div>
      {state === 'downloading' && <progress max="100" value={progress ?? undefined} style={{ width: '100%', marginTop: 14 }} />}
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}><button className="button button-secondary" disabled={state === 'checking' || state === 'downloading'} onClick={checkNow}>Check for updates</button>{state === 'available' && <button className="button button-primary" onClick={download}>Update now</button>}{state === 'ready' && <button className="button button-primary" onClick={async () => { setState('installing'); await restartAfterUpdate() }}>Restart &amp; update</button>}</div>
    </div>
  </section>
}
