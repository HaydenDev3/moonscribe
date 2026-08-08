import { useRef } from 'react'
import Modal from './Modal'
import { useApp } from '../context/AppContext'
import { exportBackup, importBackup } from '../db/backup'
import { downloadBlob } from '../utils/download'
import SyncStatus from './SyncStatus'

export default function SettingsModal({ open, onClose, onConnect }) {
  const { settings, updateSettings, refreshNovels, toast } = useApp()
  const fileRef = useRef(null)

  const backup = async () => {
    const data = await exportBackup()
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `moonscribe-backup-${new Date().toISOString().slice(0, 10)}.json`)
    toast('Backup downloaded.')
  }

  const restore = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const data = JSON.parse(await file.text())
      await importBackup(data)
      await refreshNovels()
      toast('Everything restored. Welcome back.')
    } catch (err) {
      toast('That file didn’t look right — nothing changed.')
    }
    e.target.value = ''
  }

  return (
    <Modal open={open} onClose={onClose} title="Settings">
      <div className="settings-section">
        <h3>Appearance</h3>
        <div className="switch-row">
          <span>Soft paper texture</span>
          <label className="switch">
            <input type="checkbox" checked={!!settings.paperTexture} onChange={(e) => updateSettings({ paperTexture: e.target.checked })} />
            <span className="track" />
          </label>
        </div>
        <div className="switch-row">
          <span>
            Theme <span className="muted small">(daylight, moonlight, amoled, or follow this device)</span>
          </span>
          <select className="theme-select" value={settings.theme || 'auto'} onChange={(e) => updateSettings({ theme: e.target.value })}>
            <option value="light">Daylight</option>
            <option value="dark">Moonlight</option>
            <option value="amoled">Amoled</option>
            <option value="auto">Follow device</option>
          </select>
        </div>
      </div>

      <div className="settings-section">
        <h3>Your library</h3>
        <p className="small muted" style={{ marginTop: 0 }}>
          Sign in with your own account to store your novels on the server and
          reach them from any device. Each writer’s library is private to them.
        </p>
        <div className="actions-row">
          <SyncStatus onClick={onConnect} />
          <button className="button button-ghost" onClick={onConnect}>Sign in / manage</button>
        </div>
      </div>

      <div className="settings-section">
        <h3>Your words are yours</h3>
        <p className="small muted" style={{ marginTop: 0 }}>
          Everything lives in this browser too. Download a backup any time — or move it to another device by restoring the file there.
        </p>
        <div className="actions-row">
          <button className="button button-ghost" onClick={backup}>Download backup</button>
          <button className="button button-ghost" onClick={() => fileRef.current?.click()}>Restore backup</button>
          <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={restore} />
        </div>
      </div>

      <div className="settings-section">
        <h3>Made for two</h3>
        <p className="small muted" style={{ margin: '4px 0 0' }}>
          Moonscribe was built quietly, with love, for Storm — a private place where every word is welcome and nothing is ever counted against you.
        </p>
      </div>
    </Modal>
  )
}
