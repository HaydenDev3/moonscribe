import Modal from './Modal'
import { useApp } from '../context/AppContext'
import { useState } from 'react'
import Icon from './Icon'
import { exportBackup } from '../db/backup'
import { downloadBlob } from '../utils/download'

const APP_LOGO = '/moonscribelogo.png'

const DISCORD_LOGO = (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" role="img">
    <path fill="currentColor" d="M20.3 4.37a19.8 19.8 0 0 0-4.12-1.28.8.8 0 0 0-.86.4c-.23.4-.48.96-.66 1.4a18.3 18.3 0 0 0-9.3 0c-.19-.44-.44-1-.68-1.4a.8.8 0 0 0-.86-.4A19.7 19.7 0 0 0 3.68 4.37a.63.63 0 0 0-.3.26A20.2 20.2 0 0 0 0 14.48a.76.76 0 0 0 .25.52c1.4 1.04 2.76 1.68 4.08 2.1a.79.79 0 0 0 .85-.33 15.5 15.5 0 0 1 1.32-1.72.42.42 0 0 1-.42-.2c-.3-.66-.63-1.5-.87-2.22a.46.46 0 0 0-.17-.23.44.44 0 0 0-.26-.08h-.06a.48.48 0 0 1-.42-.17c.12-.06.27-.12.42-.17a14.7 14.7 0 0 1 6.07 0c.16.06.31.11.43.17v.07h-.06a.44.44 0 0 0-.27.08.46.46 0 0 0-.17.23c-.24.72-.57 1.56-.87 2.22.05.07-.24.19-.42.2a15.47 15.47 0 0 1 1.32 1.72.79.79 0 0 0 .85.33c1.32-.42 2.68-1.06 4.08-2.1a.76.76 0 0 0 .25-.52A20.2 20.2 0 0 0 20.02 4.63a.63.63 0 0 0-.3-.26ZM8.08 12.78c-.87 0-1.58-.79-1.58-1.76s.69-1.76 1.58-1.76c.9 0 1.62.79 1.6 1.76 0 .97-.7 1.76-1.6 1.76Zm7.84 0c-.87 0-1.58-.79-1.58-1.76s.69-1.76 1.58-1.76c.9 0 1.62.79 1.6 1.76 0 .97-.7 1.76-1.6 1.76Z" />
  </svg>
)

const GOOGLE_LOGO = <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1a5.8 5.8 0 0 1-5.5-4H3.2v2.6A10 10 0 0 0 12 22"/><path fill="#FBBC05" d="M6.5 14.1A6 6 0 0 1 6.2 12c0-.7.1-1.4.3-2.1V7.3H3.2A10 10 0 0 0 2 12c0 1.7.4 3.3 1.2 4.7z"/><path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.8A9.7 9.7 0 0 0 12 2a10 10 0 0 0-8.8 5.3l3.3 2.6A5.8 5.8 0 0 1 12 5.9"/></svg>

function BrandButton({ type, title, subtitle, onClick, icon, accent = 'discord' }) {
  return (
    <button type="button" className={`brand-auth-button ${accent === 'google' ? 'google' : 'discord'}`} onClick={onClick}>
      <span className="brand-auth-button__pad">{icon}</span>
      <span className="brand-auth-button__content">
        <span className="brand-auth-button__wordmark">MOONSCRIBE</span>
        <span className="brand-auth-button__title">{title}</span>
      </span>
      <span className="brand-auth-button__arrow"><i className="fa-solid fa-arrow-right" /></span>
    </button>
  )
}

export default function AuthModal({ open, onClose }) {
  const { syncServer, syncUsername, syncStatus, syncDiscordAvatar, syncProvider, connectDiscord, connectGoogle, connectSync, disconnectSync, signOutOtherDevices, toast } = useApp()
  const [method, setMethod] = useState('discord')
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [libraryConflict, setLibraryConflict] = useState(false)

  const handleDiscord = () => connectDiscord()

  const disconnect = async () => {
    await disconnectSync()
    toast('Signed out. Everything is still safe on this device.')
    onClose()
  }

  const isDiscordAccount = syncProvider === 'discord'
  const nativeAuth = async (event) => {
    event.preventDefault()
    setBusy(true)
    const result = await connectSync({ url: window.location.origin, mode, username, password })
    setBusy(false)
    if (result.ok) { setLibraryConflict(false); toast(mode === 'register' ? 'MoonScribe account created.' : 'Welcome back.'); onClose() }
    else if (result.code === 'LIBRARY_OWNER_CONFLICT') setLibraryConflict(true)
    else toast(result.error)
  }

  const switchLibrary = async () => {
    setBusy(true)
    try {
      const backup = await exportBackup()
      downloadBlob(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }), `moonscribe-browser-library-${new Date().toISOString().slice(0, 10)}.json`)
      const result = await connectSync({ url: window.location.origin, mode, username, password, replaceLocal: true })
      if (!result.ok) throw new Error(result.error)
      setLibraryConflict(false)
      toast('Signed in. The previous browser library was backed up, and your cloud library is loading.')
      onClose()
    } catch (error) {
      toast(error.message || 'Could not switch libraries safely.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={syncUsername ? 'Your account' : ''} width={540} className="auth-glass-modal">
      {syncUsername ? (
        /* ── Connected ── */
        <div className="auth-connected">
          <div className="auth-connected-avatar">
            {syncDiscordAvatar
              ? <img src={syncDiscordAvatar} alt={syncUsername} className="auth-discord-avatar" />
              : <div className="auth-initials-avatar">{(syncUsername || '?')[0].toUpperCase()}</div>
            }
            {(isDiscordAccount || syncProvider === 'google') && (
              <span className="auth-discord-badge" title={`Signed in with ${syncProvider}`}>{isDiscordAccount ? DISCORD_LOGO : GOOGLE_LOGO}</span>
            )}
          </div>
          <div className="auth-connected-info">
            <div className="auth-connected-name">{syncUsername}</div>
            <div className="auth-connected-server">{syncServer?.replace(/https?:\/\//, '')}</div>
            <div className="auth-connected-status">
              <span className={`dot ${syncStatus === 'synced' ? 'ok' : syncStatus === 'error' ? 'err' : ''}`} />
              {syncStatus === 'synced' ? 'Synced' : syncStatus === 'error' ? 'Sync error' : 'Offline'}
            </div>
          </div>
        </div>
      ) : (
        /* ── Sign-in ── */
        <div className="auth-platform">
          <div className="auth-brand-mark">
            <img src={APP_LOGO} alt="MoonScribe logo" className="auth-brand-logo" />
            <div>
              <small>MoonScribe</small>
              <h2>Return to your stories</h2>
              <p>Your library, collaborators and creative world—waiting wherever you write.</p>
            </div>
          </div>
          <div className="auth-method-tabs"><button className={method === 'discord' ? 'active' : ''} onClick={() => setMethod('discord')}>Discord</button><button className={method === 'google' ? 'active' : ''} onClick={() => setMethod('google')}>Google</button><button className={method === 'native' ? 'active' : ''} onClick={() => setMethod('native')}>Email</button></div>
          <div className="auth-provider-stage">{method === 'discord' ? <BrandButton type="discord" title="Continue with Discord" icon={<span className="brand-auth-icon discord">{DISCORD_LOGO}</span>} accent="discord" onClick={handleDiscord} /> : method === 'google' ? <BrandButton type="google" title="Continue with Google" icon={<span className="brand-auth-icon google">{GOOGLE_LOGO}</span>} accent="google" onClick={connectGoogle} /> : <form className="auth-native-form" onSubmit={nativeAuth}><div className="auth-form-heading"><strong>{mode === 'register' ? 'Create your writing account' : 'Sign in with email'}</strong><small>{mode === 'register' ? 'A private MoonScribe identity for syncing and collaboration.' : 'Welcome back. Your drafts are ready.'}</small></div><label>Email or username<div className="auth-input-wrap"><i className="fa-regular fa-envelope"/><input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" minLength={2} required /></div></label><label>Password<div className="auth-input-wrap"><i className="fa-solid fa-lock"/><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} minLength={10} required /></div></label><button className="button button-primary auth-submit" disabled={busy}>{busy ? 'Opening your library…' : mode === 'register' ? 'Create account' : 'Enter MoonScribe'} <i className="fa-solid fa-arrow-right"/></button><button type="button" className="button button-quiet" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'New here? Create an account' : 'Already have an account? Sign in'}</button></form>}</div>
          {libraryConflict && <div className="auth-library-conflict" role="alert"><span className="auth-conflict-icon"><i className="fa-solid fa-box-archive"/></span><div><strong>A different library is stored in this browser</strong><p>MoonScribe can download a safety backup, then replace this browser copy with the cloud library belonging to <b>{username}</b>. Nothing from the previous library will be uploaded to your account.</p><div className="auth-conflict-actions"><button className="button button-quiet" onClick={() => setLibraryConflict(false)}>Cancel</button><button className="button button-primary" disabled={busy} onClick={switchLibrary}>{busy ? 'Switching safely…' : 'Back up & use cloud library'}</button></div></div></div>}
          <div className="auth-trust-row"><span><i className="fa-solid fa-shield-halved"/> Encrypted sessions</span><span><i className="fa-solid fa-cloud-arrow-up"/> Local-first sync</span><span><i className="fa-solid fa-user-lock"/> Private by default</span></div>
        </div>
      )}

      {syncUsername && (
        <><div className="auth-connections"><div className="auth-connection"><span>{isDiscordAccount ? DISCORD_LOGO : syncProvider === 'google' ? GOOGLE_LOGO : <i className="fa-solid fa-envelope"/>}</span><div><strong>{isDiscordAccount ? 'Discord' : syncProvider === 'google' ? 'Google' : 'Email account'}</strong><small>Connected as {syncUsername}</small></div><b>Connected</b></div><div className="auth-connection muted"><span><i className="fa-solid fa-user-group"/></span><div><strong>Writing profile</strong><small>Used for invitations, presence and comments</small></div><b>Active</b></div></div><div className="modal-foot">
          <button className="button button-ghost" onClick={() => signOutOtherDevices().catch((err) => toast(err.message))}>Sign out other devices</button>
          <button className="button button-rose" onClick={disconnect}>Sign out</button>
        </div></>
      )}
    </Modal>
  )
}
