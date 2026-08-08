import { useEffect, useState } from 'react'
import Modal from './Modal'
import { useApp } from '../context/AppContext'

// "Sign in" UI — create an account (or sign in) on the shared Moonscribe
// server. Each account owns its own library, stored server-side; this device
// keeps a local copy in IndexedDB and syncs both ways.
export default function AuthModal({ open, onClose }) {
  const { syncServer, syncUsername, syncStatus, connectSync, disconnectSync, toast } = useApp()
  const [url, setUrl] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setUrl(syncServer || '')
      setUsername(syncUsername || '')
    }
  }, [open, syncServer, syncUsername])

  const submit = async () => {
    if (busy) return
    setBusy(true)
    const res = await connectSync({ url: url.trim(), mode, username: username.trim(), password })
    setBusy(false)
    if (res.ok) {
      toast(mode === 'register' ? 'Your library has a home now. ✧' : 'Welcome back — your words are here. ✧')
      onClose()
    } else {
      toast(res.error || 'Could not connect.')
    }
  }

  const disconnect = async () => {
    await disconnectSync()
    toast('Signed out. Everything is still safe on this device.')
    onClose()
  }

  const canSubmit = !busy && url.trim() && username.trim().length >= 2 && password.length >= 6

  return (
    <Modal open={open} onClose={onClose} title={syncServer ? 'Your account' : mode === 'login' ? 'Sign in' : 'Create an account'} width={460}>
      <p className="small muted" style={{ marginTop: 0 }}>
        Moonscribe mirrors each writer’s library to your own server, so your novels
        are stored there too — and waiting for you on any device you sign in on.
      </p>

      {syncServer ? (
        <div className="field">
          <label>Signed in</label>
          <div className="sync-current">
            <span className="dot ok" />
            <span style={{ flex: 1, fontWeight: 600 }}>{syncUsername || 'you'}</span>
            <span className="tag">{syncStatus}</span>
          </div>
          <span className="hint">{syncServer}</span>
        </div>
      ) : (
        <>
          <div className="field">
            <label>Server address</label>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://words.example.com" autoFocus spellCheck={false} />
            <span className="hint">The address of the Moonscribe server you and your co-writer share.</span>
          </div>
          <div className="field">
            <label>Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" spellCheck={false} />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              onKeyDown={(e) => e.key === 'Enter' && canSubmit && submit()}
            />
          </div>
          <button
            className="button button-quiet"
            style={{ alignSelf: 'flex-start', color: 'var(--moon-deep)' }}
            onClick={() => setMode((m) => (m === 'login' ? 'register' : 'login'))}
          >
            {mode === 'login' ? 'No account yet? Create one' : 'Already have an account? Sign in'}
          </button>
        </>
      )}

      <div className="modal-foot">
        {syncServer ? (
          <button className="button button-rose" onClick={disconnect}>Sign out</button>
        ) : (
          <button className="button button-primary" onClick={submit} disabled={!canSubmit}>
            {busy ? 'Connecting…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        )}
      </div>
    </Modal>
  )
}
