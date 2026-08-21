import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../context/AppContext'
import { exportBackup, importBackup, wipeEverything } from '../db/backup'
import { encryptJSON, decryptJSON, isEncryptedBackup } from '../utils/crypto'
import { getMeta, setMeta } from '../db/meta'
import { getDB } from '../db/db'
import { clearOldSnapshots } from '../db/snapshots'
import { downloadBlob } from '../utils/download'
import SyncStatus from './SyncStatus'
import AuthModal from './AuthModal'
import Select from './Select'
import Icon from './Icon'
import * as syncEngine from '../sync/engine'
import { NOVEL_NAV } from '../nav'

const IDLE_OPTIONS = [
  { value: '0', label: 'Never' },
  { value: '1', label: '1 minute' },
  { value: '5', label: '5 minutes' },
  { value: '15', label: '15 minutes' },
  { value: '30', label: '30 minutes' },
  { value: '60', label: '1 hour' }
]

const CATEGORIES = [
  { key: 'appearance', label: 'Appearance', icon: 'fa-solid fa-palette', group: 'Experience', terms: 'theme colour paper custom motion' },
  { key: 'editor', label: 'Editor', icon: 'fa-solid fa-pen-nib', group: 'Experience', terms: 'writing font spelling autocorrect page' },
  { key: 'performance', label: 'Performance', icon: 'fa-solid fa-gauge-high', group: 'Experience', terms: 'speed autosave responsiveness animation' },
  { key: 'accessibility', label: 'Accessibility', icon: 'fa-solid fa-universal-access', group: 'Experience', terms: 'contrast readable motion keyboard focus' },
  { key: 'keybinds', label: 'Keybinds', icon: 'fa-regular fa-keyboard', group: 'Experience', terms: 'shortcuts keyboard commands' },
  { key: 'lock', label: 'Lock & security', icon: 'fa-solid fa-lock', group: 'Privacy & safety', terms: 'password pin idle authorization security' },
  { key: 'privacy', label: 'Privacy & data', icon: 'fa-solid fa-shield-halved', group: 'Privacy & safety', terms: 'backup export delete encryption storage' },
  { key: 'sync', label: 'Account & sync', icon: 'fa-solid fa-user-shield', group: 'Account', terms: 'profile discord cloud devices login sessions identity' },
  { key: 'about', label: 'About', icon: 'fa-solid fa-moon', group: 'MoonScribe', terms: 'version app' }
]

export default function Settings() {
  const app = useApp()
  const { settings, updateSettings, refreshNovels, toast, settingsOpen, openSettings, closeSettings,
    appLock, enableAppLock, updateAppLock, disableAppLock, lockNow,
    customFonts, systemFonts, installCustomFont, deleteCustomFont, refreshSystemFonts } = app

  const [cat, setCat] = useState('appearance')
  const [query, setQuery] = useState('')
  const [connectOpen, setConnectOpen] = useState(false)
  const [fontName, setFontName] = useState('')
  const fileRef = useRef(null)
  const fontFileRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => {
      const mod = e.ctrlKey || e.metaKey
      if (mod && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault()
        settingsOpen ? closeSettings() : openSettings()
      } else if (e.key === 'Escape' && settingsOpen && !connectOpen) {
        closeSettings()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [settingsOpen, connectOpen, openSettings, closeSettings])

  useEffect(() => {
    const search = (event) => setQuery(event.detail || '')
    window.addEventListener('moonscribe:settings-search', search)
    return () => window.removeEventListener('moonscribe:settings-search', search)
  }, [])

  if (!settingsOpen) return null

  return createPortal(
    <div className="settings-overlay" onMouseDown={(e) => e.target === e.currentTarget && closeSettings()}>
      <div className="settings-shell" role="dialog" aria-modal="true" aria-label="Settings">
        <nav className="settings-rail">
          <div className="settings-profile"><span className="settings-profile-mark"><Icon icon="fa-solid fa-moon" /></span><span><strong>MoonScribe</strong><small>Make the studio yours</small></span></div>
          <label className="settings-search"><Icon icon="fa-solid fa-magnifying-glass" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search settings" aria-label="Search settings" /></label>
          {[...new Set(CATEGORIES.map((item) => item.group))].map((group) => {
            const items = CATEGORIES.filter((item) => item.group === group && `${item.label} ${item.terms}`.toLowerCase().includes(query.trim().toLowerCase()))
            if (!items.length) return null
            return <div className="settings-rail-group" key={group}><div className="settings-rail-group-label">{group}</div>{items.map((c) => (
              <button key={c.key} className={`settings-rail-item ${cat === c.key ? 'active' : ''}`} onClick={() => setCat(c.key)}><span className="settings-rail-icon"><Icon icon={c.icon} /></span>{c.label}<Icon icon="fa-solid fa-chevron-right" className="settings-rail-chevron" /></button>
            ))}</div>
          })}
          <div className="settings-rail-foot">
            <span className="palette-kbd">Ctrl P</span>
          </div>
        </nav>

        <div className="settings-content">
          <button className="settings-close" onClick={closeSettings} aria-label="Close settings">
            <Icon icon="fa-solid fa-xmark" />
          </button>

          {query && <SettingsSearchResults query={query} settings={settings} updateSettings={updateSettings} onOpenCategory={(key) => { setCat(key); setQuery('') }} />}
          {!query && cat === 'appearance' && (
            <Appearance
              settings={settings}
              updateSettings={updateSettings}
              customFonts={customFonts}
              systemFonts={systemFonts}
              installCustomFont={installCustomFont}
              deleteCustomFont={deleteCustomFont}
              refreshSystemFonts={refreshSystemFonts}
              fontName={fontName}
              setFontName={setFontName}
              fontFileRef={fontFileRef}
              toast={toast}
            />
          )}
          {!query && cat === 'editor' && <EditorSettings settings={settings} updateSettings={updateSettings} />}
          {!query && cat === 'performance' && <Performance settings={settings} updateSettings={updateSettings} />}
          {!query && cat === 'accessibility' && <Accessibility settings={settings} updateSettings={updateSettings} />}
          {!query && cat === 'keybinds' && <Keybinds />}
          {!query && cat === 'lock' && (
            <LockSecurity appLock={appLock} enableAppLock={enableAppLock} updateAppLock={updateAppLock} disableAppLock={disableAppLock} lockNow={lockNow} toast={toast} settings={settings} updateSettings={updateSettings} />
          )}
          {!query && cat === 'privacy' && (
            <PrivacyData toast={toast} refreshNovels={refreshNovels} fileRef={fileRef} />
          )}
          {!query && cat === 'sync' && (
            <section className="settings-panel">
              <div className="settings-panel-kicker">Identity &amp; devices</div>
              <h2>Account &amp; sync</h2>
              <p className="muted">Manage who you are in MoonScribe, where your library lives, and which devices can reach it.</p>
              <SyncPanel onOpen={() => setConnectOpen(true)} />
              <AccountSessions />
              <div className="settings-section-card">
                <div className="settings-section-head"><span className="settings-section-icon"><Icon icon="fa-solid fa-laptop-file" /></span><div><strong>Local writing identity</strong><small>Your offline library is available without an account.</small></div><span className="settings-status-pill safe">Active</span></div>
                <div className="settings-detail-grid"><span><small>Storage</small><b>This browser</b></span><span><small>Ownership</small><b>Private to you</b></span><span><small>Offline access</small><b>Available</b></span></div>
              </div>
            </section>
          )}
          {!query && cat === 'about' && (
            <section className="settings-panel">
              <h2>MoonScribe</h2>
              <p className="muted">A quiet, private place to write — made with love, for Storm. Every word stays on your device by default; nothing is ever counted against you.</p>
              <p className="muted small">Online across your devices · offline-safe · yours.</p>
              <div className="settings-row" style={{ marginTop: 'var(--space-5)' }}>
                <div><div className="settings-row-title">Version</div><div className="settings-row-sub">0.1.0 — Parchment</div></div>
              </div>
            </section>
          )}
        </div>
      </div>

      <AuthModal open={connectOpen} onClose={() => setConnectOpen(false)} />
    </div>,
    document.body
  )
}

function SettingsSearchResults({ query, settings, updateSettings, onOpenCategory }) {
  const actions = [
    ...[['light','Parchment'],['sandstone','Sandstone'],['dark','Moonlight'],['ember','Ember'],['moss','Moss'],['midnight','Midnight'],['amoled','AMOLED']].map(([value,label]) => ({ label:`${label} theme`, terms:`theme appearance ${label}`, category:'appearance', control:<button className="button button-secondary" onClick={() => updateSettings({ theme:value })}>{settings.theme === value ? 'Selected' : 'Use theme'}</button> })),
    { label:'Soft paper texture', terms:'paper grain texture appearance', category:'appearance', control:<Toggle checked={!!settings.paperTexture} onChange={(value) => updateSettings({ paperTexture:value })}/> },
    { label:'Reduce motion', terms:'animation motion accessibility', category:'accessibility', control:<Toggle checked={!!settings.reduceMotion} onChange={(value) => updateSettings({ reduceMotion:value })}/> },
    { label:'High contrast', terms:'contrast visibility accessibility', category:'accessibility', control:<Toggle checked={!!settings.highContrast} onChange={(value) => updateSettings({ highContrast:value })}/> },
    { label:'Spell check', terms:'dictionary spelling editor', category:'editor', control:<Toggle checked={settings.spellCheck !== false} onChange={(value) => updateSettings({ spellCheck:value })}/> },
    { label:'Custom fonts', terms:'font upload install installer family', category:'appearance', control:<button className="button button-secondary" onClick={() => onOpenCategory('appearance')}>Open fonts</button> },
    { label:'System fonts', terms:'detected fonts local typeface', category:'appearance', control:<button className="button button-secondary" onClick={() => onOpenCategory('appearance')}>Refresh on Appearance</button> },
    { label:'App layout', terms:'layout compact visual library studio appearance', category:'appearance', control:<Select ariaLabel="App layout" width={155} value={settings.appLayout || 'studio'} onChange={(value) => updateSettings({ appLayout:value })} options={[{value:'studio',label:'Writer studio'},{value:'library',label:'Visual library'},{value:'compact',label:'Compact'}]}/> },
    { label:'Editor font size', terms:'font text size editor', category:'editor', control:<Select ariaLabel="Editor font size" width={140} value={settings.editorFontSize || 'md'} onChange={(value) => updateSettings({ editorFontSize:value })} options={[{value:'sm',label:'Small'},{value:'md',label:'Medium'},{value:'lg',label:'Large'},{value:'xl',label:'X-large'}]}/> },
  ]
  const needle = query.trim().toLowerCase()
  const matches = actions.filter((item) => `${item.label} ${item.terms}`.toLowerCase().includes(needle))
  const categories = CATEGORIES.filter((item) => `${item.label} ${item.terms}`.toLowerCase().includes(needle))
  return <section className="settings-panel"><div className="settings-panel-kicker">Smart settings search</div><h2>Results for “{query}”</h2><p className="muted">Change common settings directly, or open the full category for more detail.</p><div className="settings-search-results">{matches.map((item) => <div className="settings-row" key={item.label}><button className="settings-search-result-label" onClick={() => onOpenCategory(item.category)}><strong>{item.label}</strong><small>Open {CATEGORIES.find((category) => category.key === item.category)?.label}</small></button>{item.control}</div>)}{categories.map((item) => <button className="settings-search-category" key={item.key} onClick={() => onOpenCategory(item.key)}><Icon icon={item.icon}/><span><strong>{item.label}</strong><small>View every {item.label.toLowerCase()} option</small></span><Icon icon="fa-solid fa-arrow-right"/></button>)}{!matches.length && !categories.length && <div className="palette-hint">No setting matches “{query}”. Try theme, font, layout, security or motion.</div>}</div></section>
}

function AccountSessions() {
  const { syncUsername, syncServer, toast } = useApp()
  const [profile, setProfile] = useState(null)
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!syncUsername || !syncServer) return
    setLoading(true)
    try {
      const cfg = await syncEngine.getConfig()
      const [account, devices] = await Promise.all([
        syncEngine.accountProfile(cfg.server, cfg.token),
        syncEngine.listSessions()
      ])
      setProfile(account)
      setSessions(devices)
    } catch (error) {
      toast(error.message)
    } finally {
      setLoading(false)
    }
  }, [syncUsername, syncServer, toast])

  useEffect(() => { refresh() }, [refresh])
  if (!syncUsername || !syncServer) return null

  const revoke = async (id) => {
    try {
      await syncEngine.revokeSession(id)
      toast('Device access revoked.')
      await refresh()
    } catch (error) { toast(error.message) }
  }

  return (
    <div className="settings-section-card">
      <div className="settings-section-head"><span className="settings-section-icon"><Icon icon="fa-solid fa-shield-halved" /></span><div><strong>Security &amp; signed-in devices</strong><small>Discord verifies your identity; MoonScribe keeps a separate revocable session for each device.</small></div><span className="settings-status-pill safe">Protected</span></div>
      {profile && <div className="settings-detail-grid"><span><small>Account</small><b>{profile.username}</b></span><span><small>Provider</small><b>{profile.provider === 'discord' ? 'Discord OAuth' : 'MoonScribe'}</b></span><span><small>Member since</small><b>{new Date(profile.createdAt).toLocaleDateString()}</b></span></div>}
      <div className="settings-subheading">Active sessions</div>
      {loading && !sessions.length ? <p className="muted small">Checking devices…</p> : sessions.map((session) => (
        <div className="settings-row" key={session.id}>
          <div><div className="settings-row-title">{session.deviceName || 'Unknown device'} {session.current ? <span className="settings-status-pill safe">This device</span> : null}</div><div className="settings-row-sub">Last active {new Date(session.lastSeenAt).toLocaleString()}</div></div>
          {!session.current && <button className="button button-secondary" onClick={() => revoke(session.id)}>Revoke</button>}
        </div>
      ))}
    </div>
  )
}

// ---- Accent colour swatches ----
function SyncPanel({ onOpen }) {
  const { syncUsername, syncDiscordAvatar, syncServer, syncStatus, disconnectSync, toast } = useApp()
  const isConnected = !!(syncUsername || syncServer)

  const handleSignOut = async () => {
    await disconnectSync()
    toast('Signed out.')
  }

  if (isConnected) {
    const statusColor = syncStatus === 'synced' ? '#22c55e' : syncStatus === 'error' ? '#ef4444' : '#94a3b8'
    const statusLabel = syncStatus === 'synced' ? 'Online' : syncStatus === 'error' ? 'Error' : 'Offline'
    const initials = (syncUsername || '?')[0].toUpperCase()
    // Derive a stable accent colour from the username (same trick as char cards)
    const hue = [...(syncUsername || 'u')].reduce((n, c) => n + c.charCodeAt(0), 0) % 360
    const bannerColor = `hsl(${hue}, 38%, 38%)`
    const avatarColor = `hsl(${hue}, 42%, 44%)`

    return (
      <div className="sync-char-card">
        {/* Banner */}
        <div className="sync-char-banner" style={{ background: `linear-gradient(135deg, ${bannerColor} 0%, hsl(${(hue + 40) % 360}, 32%, 28%) 100%)` }}>
          {syncDiscordAvatar && (
            <img src={syncDiscordAvatar} alt="" className="sync-char-banner-img" />
          )}
          {/* Discord badge top-right */}
          <span className="sync-char-badge" title="Discord">
            <svg width="14" height="11" viewBox="0 0 71 55" fill="currentColor">
              <path d="M60.1 4.9A58.5 58.5 0 0 0 45.5.4a.2.2 0 0 0-.2.1 40.8 40.8 0 0 0-1.8 3.7 54 54 0 0 0-16.2 0A37.5 37.5 0 0 0 25.5.5a.2.2 0 0 0-.2-.1A58.4 58.4 0 0 0 10.8 4.9a.2.2 0 0 0-.1.1C1.6 18.1-.9 30.9.3 43.6v.1a58.9 58.9 0 0 0 17.9 9 .2.2 0 0 0 .2-.1 42 42 0 0 0 3.6-5.9.2.2 0 0 0-.1-.3 38.8 38.8 0 0 1-5.5-2.6.2.2 0 0 1 0-.4l1.1-.9a.2.2 0 0 1 .2 0c11.5 5.3 24 5.3 35.4 0a.2.2 0 0 1 .2 0l1.1.9a.2.2 0 0 1 0 .4 36 36 0 0 1-5.5 2.6.2.2 0 0 0-.1.3 47.1 47.1 0 0 0 3.6 5.9c.1.1.2.1.3.1a58.7 58.7 0 0 0 17.9-9v-.1c1.5-15.3-2.5-28-10.6-39.6a.2.2 0 0 0-.1-.1z" />
            </svg>
          </span>
        </div>

        {/* Avatar overlapping banner */}
        <div className="sync-char-avatar-wrap">
          {syncDiscordAvatar
            ? <img src={syncDiscordAvatar} alt={syncUsername} className="sync-char-avatar-img" />
            : <div className="sync-char-avatar" style={{ background: avatarColor }}>{initials}</div>
          }
          {/* Status dot */}
          <span className="sync-char-dot" style={{ background: statusColor }} title={statusLabel} />
        </div>

        {/* Body */}
        <div className="sync-char-body">
          <div className="sync-char-name">{syncUsername || 'Connected'}</div>
          <div className="sync-char-role" style={{ color: statusColor }}>
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: statusColor, marginRight: 5, verticalAlign: 'middle' }} />
            {statusLabel}
          </div>
          {syncServer && (
            <div className="sync-char-stat">
              <i className="fa-solid fa-server" style={{ fontSize: '0.7rem', opacity: 0.6 }} />
              {syncServer.replace(/https?:\/\//, '')}
            </div>
          )}
          <div className="sync-char-tags">
            <span className="char-tag">Writer</span>
            <span className="char-tag">Discord</span>
          </div>
        </div>

        {/* Footer actions */}
        <div className="sync-char-foot">
          <button className="char-card-btn" onClick={onOpen}>
            <i className="fa-solid fa-gear" /> Manage
          </button>
          <button className="char-card-btn char-card-btn-del" onClick={handleSignOut}>
            <i className="fa-solid fa-right-from-bracket" /> Sign out
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <p className="muted small">Sign in to mirror novels to the server and reach them from any device. Each writer's library stays private to them.</p>
      <div className="sync-current"><SyncStatus onClick={onOpen} /></div>
      <div className="actions-row"><button className="button button-primary" onClick={onOpen}>Sign in / manage</button></div>
      <p className="muted small" style={{ marginTop: 'var(--space-4)' }}>
        Tip: a local export (Privacy &amp; data → Download backup) is a safety net that never depends on the cloud.
      </p>
    </div>
  )
}

const ACCENT_OPTIONS = [
  { value: 'gold',  label: 'Gold',    color: '#b68235' },
  { value: 'rose',  label: 'Rose',    color: '#a86a52' },
  { value: 'sage',  label: 'Sage',    color: '#7d8a6a' },
  { value: 'slate', label: 'Slate',   color: '#6a7d8a' },
  { value: 'plum',  label: 'Plum',    color: '#8a6a8a' },
  { value: 'teal',  label: 'Teal',    color: '#4a8a84' },
  { value: 'violet', label: 'Violet', color: '#7867b8' },
  { value: 'ocean', label: 'Ocean', color: '#397ca6' },
  { value: 'coral', label: 'Coral', color: '#c36f61' },
  { value: 'silver', label: 'Silver', color: '#7c858f' },
]

function Appearance({ settings, updateSettings, customFonts, systemFonts, installCustomFont, deleteCustomFont, refreshSystemFonts, fontName, setFontName, fontFileRef, toast }) {
  const themes = [
    ['light', 'Parchment', '#f4efe5', '#27221d'], ['sandstone', 'Sandstone', '#d8c0a2', '#3c2d22'],
    ['dark', 'Moonlight', '#17161c', '#e8e0d5'], ['ember', 'Ember', '#211713', '#f0c7a3'],
    ['moss', 'Moss', '#142019', '#d9e5d4'], ['midnight', 'Midnight', '#121225', '#dddaf5'], ['amoled', 'AMOLED', '#000', '#f4f4f4'],
  ]
  return (
    <section className="settings-panel">
      <div className="settings-panel-kicker">Look &amp; feel</div>
      <h2>Appearance</h2>
      <p className="muted">Shape the entire studio—from its atmosphere to how compact and tactile every control feels.</p>
      <div className="settings-subheading">Studio theme</div>
      <div className="theme-choice-grid">
        {themes.map(([value, label, bg, ink]) => <button key={value} className={`theme-choice ${(settings.theme || 'light') === value ? 'active' : ''}`} onClick={() => updateSettings({ theme: value })} aria-pressed={(settings.theme || 'light') === value}><span className="theme-choice-preview" style={{ background: bg, color: ink }}><i /><i /><i /></span><span>{label}</span>{(settings.theme || 'light') === value && <Icon icon="fa-solid fa-check" />}</button>)}
      </div>

      <div className="settings-row">
        <div>
          <div className="settings-row-title">Accent colour</div>
          <div className="settings-row-sub">Sets the gold ink used across buttons, links and highlights.</div>
        </div>
        <div className="accent-swatches">
          {ACCENT_OPTIONS.map((o) => (
            <button
              key={o.value}
              className={`accent-swatch ${(settings.accentColor || 'gold') === o.value ? 'active' : ''}`}
              style={{ background: o.color }}
              title={o.label}
              aria-label={o.label}
              onClick={() => updateSettings({ accentColor: o.value })}
            />
          ))}
        </div>
      </div>

      <div className="settings-row">
        <div>
          <div className="settings-row-title">Soft paper texture</div>
          <div className="settings-row-sub">A barely-there grain, like morning light on a page.</div>
        </div>
        <Toggle checked={!!settings.paperTexture} onChange={(v) => updateSettings({ paperTexture: v })} />
      </div>
      {settings.paperTexture && <div className="settings-row"><div><div className="settings-row-title">Paper character</div><div className="settings-row-sub">Choose how visible the fibres and warm grain should feel.</div></div><Select ariaLabel="Paper character" width={160} value={settings.paperStrength || 'soft'} onChange={(v) => updateSettings({ paperStrength: v })} options={[{ value: 'soft', label: 'Soft' }, { value: 'natural', label: 'Natural' }, { value: 'rich', label: 'Rich' }]} /></div>}

      <div className="settings-subheading">Fonts</div>
      <p className="settings-row-sub">MoonScribe can use built-in Google fonts, detected system fonts, and fonts you install from file.</p>
      <div className="settings-section-card">
        <div className="settings-section-head">
          <span className="settings-section-icon"><Icon icon="fa-solid fa-font" /></span>
          <div>
            <strong>Custom font installer</strong>
            <small>Upload .ttf, .otf, .woff or .woff2 files and use them in the editor and designer.</small>
          </div>
          <button className="button button-secondary" onClick={() => fontFileRef.current?.click()}>Choose file</button>
        </div>
        <div className="settings-row" style={{ marginTop: 'var(--space-4)' }}>
          <div>
            <div className="settings-row-title">Font family name</div>
            <div className="settings-row-sub">Leave blank to infer a name from the file.</div>
          </div>
          <input value={fontName} onChange={(event) => setFontName(event.target.value)} placeholder="e.g. Great Vibes" aria-label="Font family name" />
        </div>
        <input
          ref={fontFileRef}
          type="file"
          accept=".ttf,.otf,.woff,.woff2,font/*"
          hidden
          onChange={async (event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file) return
            try {
              await installCustomFont({ file, familyName: fontName })
              setFontName('')
            } catch (error) {
              toast(error.message)
            }
          }}
        />
      </div>

      <div className="settings-row">
        <div>
          <div className="settings-row-title">Detected system fonts</div>
          <div className="settings-row-sub">MoonScribe keeps a local list of fonts available on this device.</div>
        </div>
        <button className="button button-secondary" onClick={refreshSystemFonts}>Refresh fonts</button>
      </div>
      <div className="settings-font-chip-row">
        {(systemFonts || []).slice(0, 10).map((font) => <span key={font.id || font.family} className="settings-font-chip" style={{ fontFamily: font.family }}>{font.label || font.family}</span>)}
        {!systemFonts?.length && <span className="muted small">No system fonts detected yet.</span>}
      </div>

      <div className="settings-row">
        <div>
          <div className="settings-row-title">Installed custom fonts</div>
          <div className="settings-row-sub">These are stored locally with your MoonScribe data.</div>
        </div>
      </div>
      <div className="settings-font-chip-row">
        {(customFonts || []).map((font) => (
          <button key={font.id || font.family} className="settings-font-chip is-removable" style={{ fontFamily: font.family }} onClick={() => deleteCustomFont(font)} title="Remove font">
            <span>{font.label || font.family}</span>
            <Icon icon="fa-solid fa-xmark" />
          </button>
        ))}
        {!customFonts?.length && <span className="muted small">No custom fonts installed yet.</span>}
      </div>

      <div className="settings-subheading">Interface layout</div>
      <p className="settings-row-sub">Choose a familiar workspace arrangement. The preview shows the sidebar, toolbar and writing canvas placement.</p>
      <div className="layout-choice-grid">
        {[
          ['studio', 'Writer studio', 'Classic left binder', 'left'],
          ['sidebar-right', 'Right binder', 'Tools beside your writing hand', 'right'],
          ['library', 'Visual library', 'Roomier covers and references', 'left'],
          ['compact', 'Compact studio', 'More writing on screen', 'left'],
        ].map(([value, label, hint, side]) => (
          <button key={value} className={`layout-choice ${(settings.appLayout || 'studio') === value ? 'active' : ''}`} onClick={() => updateSettings({ appLayout: value })} aria-pressed={(settings.appLayout || 'studio') === value}>
            <span className={`layout-choice-preview side-${side} layout-${value}`}><i className="layout-mini-sidebar"/><i className="layout-mini-main"><b/><em/><em/></i></span>
            <span className="layout-choice-copy"><strong>{label}</strong><small>{hint}</small></span>
            {(settings.appLayout || 'studio') === value && <Icon icon="fa-solid fa-check" />}
          </button>
        ))}
      </div>

      <SidebarVisibility settings={settings} updateSettings={updateSettings} />

      <div className="settings-subheading">Sound &amp; feedback</div>
      <div className="settings-row"><div><div className="settings-row-title">App sounds</div><div className="settings-row-sub">Subtle local audio feedback. Nothing is recorded or uploaded.</div></div><Toggle checked={!!settings.soundEnabled} onChange={(v) => updateSettings({ soundEnabled: v })} /></div>
      {settings.soundEnabled && <>
        <div className="settings-row"><div><div className="settings-row-title">Interface clicks</div><div className="settings-row-sub">Quiet feedback for buttons, menus and navigation.</div></div><Toggle checked={settings.clickSounds !== false} onChange={(v) => updateSettings({ clickSounds: v })} /></div>
        <div className="settings-row"><div><div className="settings-row-title">Writing sounds</div><div className="settings-row-sub">A restrained typewriter texture while editing.</div></div><Toggle checked={!!settings.typingSounds} onChange={(v) => updateSettings({ typingSounds: v })} /></div>
        <div className="settings-row"><div><div className="settings-row-title">Notification sounds</div><div className="settings-row-sub">A soft chime for confirmations and toast notifications.</div></div><Toggle checked={settings.notificationSounds !== false} onChange={(v) => updateSettings({ notificationSounds: v })} /></div>
        <div className="settings-row"><div><div className="settings-row-title">Ambient background music</div><div className="settings-row-sub">A soft generative bed for longer sessions. It stays local and pauses when the tab is hidden.</div></div><Toggle checked={!!settings.ambientSound} onChange={(v) => updateSettings({ ambientSound: v })} /></div>
        {settings.ambientSound && <div className="settings-row"><div><div className="settings-row-title">Ambient mood</div><div className="settings-row-sub">Set the atmosphere of the room while you write.</div></div><Select ariaLabel="Ambient mood" width={190} value={settings.ambientMood || 'moonlit'} onChange={(v) => updateSettings({ ambientMood: v })} options={[{ value: 'moonlit', label: 'Moonlit studio', hint: 'airy and calm' }, { value: 'hearth', label: 'Hearth glow', hint: 'warm and intimate' }, { value: 'rainglass', label: 'Rain on glass', hint: 'cool and reflective' }]} /></div>}
        <div className="settings-row"><div><div className="settings-row-title">Sound volume</div><div className="settings-row-sub">Keep feedback comfortably beneath music and calls.</div></div><input className="settings-volume" type="range" min="0" max="100" value={Number(settings.soundVolume) || 35} onChange={(e) => updateSettings({ soundVolume: Number(e.target.value) })} aria-label="Sound volume" /></div>
      </>}
      <div className="settings-row"><div><div className="settings-row-title">Interface scale</div><div className="settings-row-sub">Resize navigation, dialogs, buttons and labels throughout MoonScribe.</div></div><Select ariaLabel="Interface scale" width={150} value={String(settings.interfaceScale || 100)} onChange={(v) => updateSettings({ interfaceScale: Number(v) })} options={[{ value: '90', label: '90%', hint: 'compact' }, { value: '100', label: '100%', hint: 'default' }, { value: '110', label: '110%', hint: 'large' }, { value: '120', label: '120%', hint: 'largest' }]} /></div>
      <div className="settings-row"><div><div className="settings-row-title">Control density</div><div className="settings-row-sub">Choose how much information fits on screen.</div></div><Select ariaLabel="Control density" width={160} value={settings.interfaceDensity || 'comfortable'} onChange={(v) => updateSettings({ interfaceDensity: v })} options={[{ value: 'compact', label: 'Compact' }, { value: 'comfortable', label: 'Comfortable' }, { value: 'spacious', label: 'Spacious' }]} /></div>
      <div className="settings-row"><div><div className="settings-row-title">Corner style</div><div className="settings-row-sub">Change the visual character of cards, menus and controls.</div></div><Select ariaLabel="Corner style" width={160} value={settings.cornerStyle || 'rounded'} onChange={(v) => updateSettings({ cornerStyle: v })} options={[{ value: 'square', label: 'Precise' }, { value: 'rounded', label: 'Rounded' }, { value: 'soft', label: 'Extra soft' }]} /></div>
      <div className="settings-row"><div><div className="settings-row-title">Simplify decoration</div><div className="settings-row-sub">Reduce grain, glow and ornamental effects while keeping the theme.</div></div><Toggle checked={!!settings.simplifiedDecorations} onChange={(v) => updateSettings({ simplifiedDecorations: v })} /></div>
    </section>
  )
}

function SidebarVisibility({ settings, updateSettings }) {
  const hidden = new Set(settings.hiddenSidebarTabs || [])
  const change = (key, visible) => {
    const next = new Set(hidden)
    if (visible) next.delete(key)
    else next.add(key)
    updateSettings({ hiddenSidebarTabs: [...next] })
  }
  return <>
    <div className="settings-subheading">Sidebar tools</div>
    <p className="settings-row-sub">Hide tools you do not use. Manuscript and the editor always remain available.</p>
    <div className="sidebar-tool-grid">
      {NOVEL_NAV.flatMap((group) => group.items.map((item) => ({ ...item, group: group.group }))).map((item) => {
        const visible = !hidden.has(item.to)
        return <div className={`sidebar-tool-choice ${visible ? '' : 'hidden-tool'}`} key={item.to}>
          <span className="sidebar-tool-icon"><Icon icon={item.icon}/></span>
          <span><strong>{item.label}</strong><small>{item.group}{visible ? '' : ' · available here in Settings'}</small></span>
          <Toggle checked={visible} onChange={(value) => change(item.to, value)} />
        </div>
      })}
    </div>
    {hidden.size > 0 && <button className="button button-secondary restore-sidebar-tools" onClick={() => updateSettings({ hiddenSidebarTabs: [] })}><Icon icon="fa-solid fa-rotate-left"/> Restore all hidden tools</button>}
  </>
}

function EditorSettings({ settings, updateSettings }) {
  return (
    <section className="settings-panel">
      <h2>Editor</h2>

      <div className="settings-row">
        <div>
          <div className="settings-row-title">Font size</div>
          <div className="settings-row-sub">The size of text in the writing area.</div>
        </div>
        <Select ariaLabel="Font size" width={160} value={settings.editorFontSize || 'md'} onChange={(v) => updateSettings({ editorFontSize: v })}
          options={[
            { value: 'sm', label: 'Small',   hint: '14px' },
            { value: 'md', label: 'Medium',  hint: '16px' },
            { value: 'lg', label: 'Large',   hint: '18.4px' },
            { value: 'xl', label: 'X-Large', hint: '20.8px' },
          ]}
        />
      </div>

      <div className="settings-row">
        <div>
          <div className="settings-row-title">Line height</div>
          <div className="settings-row-sub">Breathing room between lines.</div>
        </div>
        <Select ariaLabel="Line height" width={160} value={settings.editorLineHeight || 'normal'} onChange={(v) => updateSettings({ editorLineHeight: v })}
          options={[
            { value: 'compact',  label: 'Compact',  hint: '1.65' },
            { value: 'normal',   label: 'Normal',   hint: '1.85' },
            { value: 'spacious', label: 'Spacious', hint: '2.05' },
            { value: 'airy',     label: 'Airy',     hint: '2.3'  },
          ]}
        />
      </div>

      <div className="settings-row">
        <div>
          <div className="settings-row-title">Reading width</div>
          <div className="settings-row-sub">How wide the text column can grow — narrower is cosier for long sessions.</div>
        </div>
        <Select ariaLabel="Reading width" width={160} value={settings.editorMeasure || 'comfortable'} onChange={(v) => updateSettings({ editorMeasure: v })}
          options={[
            { value: 'narrow',      label: 'Narrow',      hint: '52ch' },
            { value: 'comfortable', label: 'Comfortable', hint: '68ch' },
            { value: 'wide',        label: 'Wide',        hint: '84ch' },
          ]}
        />
      </div>

      <div className="settings-row">
        <div>
          <div className="settings-row-title">Drop caps</div>
          <div className="settings-row-sub">Decorative large first letter on each chapter opening — makes prose feel like a real book.</div>
        </div>
        <Toggle checked={!!settings.dropCaps} onChange={(v) => updateSettings({ dropCaps: v })} />
      </div>

      <div className="settings-row">
        <div>
          <div className="settings-row-title">Typewriter scrolling</div>
          <div className="settings-row-sub">The current line stays vertically centred as you type; everything else softly dims. Like iA Writer.</div>
        </div>
        <Toggle checked={!!settings.typewriterMode} onChange={(v) => updateSettings({ typewriterMode: v })} />
      </div>

      <div className="settings-row">
        <div>
          <div className="settings-row-title">Evening warmth</div>
          <div className="settings-row-sub">After 5 pm the screen very gently warms toward amber — like f.lux, but just for MoonScribe.</div>
        </div>
        <Toggle checked={!!settings.timewarmth} onChange={(v) => updateSettings({ timewarmth: v })} />
      </div>

      <div className="settings-row">
        <div>
          <div className="settings-row-title">Spell check</div>
          <div className="settings-row-sub">Underline words the browser thinks are misspelt.</div>
        </div>
        <Toggle checked={settings.spellCheck !== false} onChange={(v) => updateSettings({ spellCheck: v })} />
      </div>
      <div className="settings-row">
        <div><div className="settings-row-title">Dictionary autocorrect</div><div className="settings-row-sub">Use the device dictionary for obvious typos. Character names and invented words remain under your control.</div></div>
        <Toggle checked={settings.autoCorrect !== false} onChange={(v) => updateSettings({ autoCorrect: v })} />
      </div>
    </section>
  )
}

function Performance({ settings, updateSettings }) {
  return (
    <section className="settings-panel">
      <div className="settings-panel-kicker">Experience</div>
      <h2>Performance</h2>
      <p className="muted">Tune MoonScribe for instant-feeling typing without sacrificing draft safety.</p>
      <div className="settings-row">
        <div><div className="settings-row-title">Autosave pause</div><div className="settings-row-sub">Save after you briefly stop typing. Writes are serialised so an older save cannot replace a newer draft.</div></div>
        <Select ariaLabel="Autosave pause" width={160} value={String(settings.autosaveDelay || 1800)} onChange={(v) => updateSettings({ autosaveDelay: Number(v) })} options={[
          { value: '800', label: 'Fast', hint: '0.8 sec' }, { value: '1800', label: 'Balanced', hint: '1.8 sec' }, { value: '3500', label: 'Relaxed', hint: '3.5 sec' },
        ]} />
      </div>
      <div className="settings-row">
        <div><div className="settings-row-title">Interface animations</div><div className="settings-row-sub">Smooth panels and transitions. Disable this on older devices or when motion is distracting.</div></div>
        <Toggle checked={!settings.reduceMotion} onChange={(v) => updateSettings({ reduceMotion: !v })} />
      </div>
      <div className="settings-health-card"><Icon icon="fa-solid fa-shield-heart" /><div><strong>Local-first draft protection</strong><span>Typing stays in the live document immediately; storage, snapshots and sync run behind it.</span></div></div>
    </section>
  )
}

const KEYBINDS = [
  ['Ctrl K', 'Search and jump anywhere'], ['Ctrl P', 'Open Settings'], ['Ctrl S', 'Save now'],
  ['Ctrl Z / Ctrl Y', 'Undo / redo'], ['Ctrl B / I / U', 'Bold / italic / underline'],
  ['Ctrl K in editor', 'Insert link'], ['Ctrl Shift E', 'Insert scene break'],
  ['Ctrl Shift P', 'Insert page break'], ['Ctrl Shift H', 'Remove highlighting'],
  ['Ctrl 1 / Ctrl 2', 'Heading levels'], ['Esc', 'Close the active panel or modal'],
]

function Keybinds() {
  return <section className="settings-panel"><h2>Keybinds</h2><p className="muted">A familiar writing workflow without reaching for the mouse.</p><div className="keybind-grid">{KEYBINDS.map(([keys, action]) => <div className="keybind-row" key={keys}><span>{action}</span><kbd>{keys}</kbd></div>)}</div></section>
}

function Accessibility({ settings, updateSettings }) {
  return (
    <section className="settings-panel">
      <div className="settings-panel-kicker">Comfort &amp; access</div>
      <h2>Accessibility</h2>
      <p className="muted">Adjust MoonScribe around your vision, motor preferences, reading comfort and sensitivity to motion.</p>

      <div className="settings-row">
        <div>
          <div className="settings-row-title">Reduce motion</div>
          <div className="settings-row-sub">Turn off entrance animations and transitions.</div>
        </div>
        <Toggle checked={!!settings.reduceMotion} onChange={(v) => updateSettings({ reduceMotion: v })} />
      </div>

      <div className="settings-row">
        <div>
          <div className="settings-row-title">Readable font</div>
          <div className="settings-row-sub">A plainer, dyslexia-friendly typeface across the app.</div>
        </div>
        <Toggle checked={!!settings.readableFont} onChange={(v) => updateSettings({ readableFont: v })} />
      </div>

      <div className="settings-row">
        <div>
          <div className="settings-row-title">High contrast</div>
          <div className="settings-row-sub">Stronger borders and fully ink-black text everywhere.</div>
        </div>
        <Toggle checked={!!settings.highContrast} onChange={(v) => updateSettings({ highContrast: v })} />
      </div>

      <div className="settings-row">
        <div>
          <div className="settings-row-title">Always show focus ring</div>
          <div className="settings-row-sub">Visible keyboard-focus outline on every focused element.</div>
        </div>
        <Toggle checked={!!settings.focusRingVisible} onChange={(v) => updateSettings({ focusRingVisible: v })} />
      </div>

      <div className="settings-row"><div><div className="settings-row-title">Larger interaction targets</div><div className="settings-row-sub">Increase the minimum size of buttons and menu items for easier pointer and touch use.</div></div><Toggle checked={!!settings.largeTargets} onChange={(v) => updateSettings({ largeTargets: v })} /></div>
      <div className="settings-row"><div><div className="settings-row-title">Underline interactive links</div><div className="settings-row-sub">Make links recognisable without relying on colour alone.</div></div><Toggle checked={!!settings.underlineLinks} onChange={(v) => updateSettings({ underlineLinks: v })} /></div>
      <div className="settings-row"><div><div className="settings-row-title">Reduce transparency</div><div className="settings-row-sub">Use opaque menus and dialogs for stronger separation and readability.</div></div><Toggle checked={!!settings.reduceTransparency} onChange={(v) => updateSettings({ reduceTransparency: v })} /></div>
      <div className="settings-row"><div><div className="settings-row-title">Colour-vision palette</div><div className="settings-row-sub">Adjust status colours and charts to remain distinguishable.</div></div><Select ariaLabel="Colour vision palette" width={170} value={settings.colorVision || 'default'} onChange={(v) => updateSettings({ colorVision: v })} options={[{ value: 'default', label: 'Default' }, { value: 'deuteranopia', label: 'Green-safe' }, { value: 'protanopia', label: 'Red-safe' }, { value: 'tritanopia', label: 'Blue-safe' }]} /></div>
      <div className="settings-access-preview"><Icon icon="fa-solid fa-eye" /><div><strong>Live preview</strong><span>Changes apply instantly and remain on this device.</span></div></div>

      <p className="muted small" style={{ marginTop: 'var(--space-4)' }}>
        Keyboard: <span className="palette-kbd">Ctrl K</span> to search &amp; jump, <span className="palette-kbd">Ctrl P</span> for settings.
      </p>
    </section>
  )
}

function LockSecurity({ appLock, enableAppLock, updateAppLock, disableAppLock, lockNow, toast, settings, updateSettings }) {
  const [kind, setKind] = useState('passphrase')
  const [pass, setPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [minutes, setMinutes] = useState(15)

  const turnOn = async () => {
    if (kind === 'pin' && !/^\d{4,6}$/.test(pass)) return toast('Choose a 4–6 digit PIN.')
    if (!pass.trim()) return toast('Enter a passphrase.')
    if (pass !== confirm) return toast("The two entries don’t match.")
    await enableAppLock({ passphrase: pass, kind, autoLockMinutes: Number(minutes) })
    setPass(''); setConfirm('')
    toast('App lock is on.')
  }
  const turnOff = async () => {
    const p = window.prompt('Enter your current PIN or passphrase to turn off the lock.')
    if (p === null) return
    toast((await disableAppLock(p)) ? 'App lock turned off.' : 'That didn\'t match — lock still on.')
  }
  const clean = (v) => (kind === 'pin' ? v.replace(/\D/g, '').slice(0, 6) : v)

  return (
    <section className="settings-panel">
      <div className="settings-panel-kicker">Privacy &amp; access control</div>
      <h2>Lock &amp; security</h2>
      <div className="security-overview">
        <span className={`security-score ${appLock?.enabled ? 'protected' : ''}`}><Icon icon={appLock?.enabled ? 'fa-solid fa-shield-check' : 'fa-solid fa-shield'} /></span>
        <div><strong>{appLock?.enabled ? 'Device protection is active' : 'Add a private access barrier'}</strong><small>{appLock?.enabled ? 'MoonScribe requires your secret after locking.' : 'Your local database is private to this browser, but currently opens without a challenge.'}</small></div>
        <span className={`settings-status-pill ${appLock?.enabled ? 'safe' : 'warn'}`}>{appLock?.enabled ? 'Protected' : 'Review'}</span>
      </div>
      {appLock?.enabled ? (
        <>
          <div className="privacy-list" style={{ marginBottom: 'var(--space-4)' }}>
            <li><span className="privacy-dot ok" /> Locked with a {appLock.kind === 'pin' ? 'PIN' : 'passphrase'}.</li>
            <li><span className="privacy-dot ok" /> Auto-lock after idle: {appLock.autoLockMinutes ? `${appLock.autoLockMinutes} min` : 'disabled'}.</li>
          </div>
          <div className="settings-row">
            <div><div className="settings-row-title">Auto-lock after idle</div><div className="settings-row-sub">Re-lock if left unattended.</div></div>
            <Select ariaLabel="Auto-lock" width={150} value={String(appLock.autoLockMinutes ?? 0)} onChange={(v) => updateAppLock({ autoLockMinutes: Number(v) })} options={IDLE_OPTIONS} />
          </div>
          <div className="actions-row" style={{ flexWrap: 'wrap' }}>
            <button className="button button-ghost" onClick={lockNow}>Lock now</button>
            <button className="button button-ghost" onClick={turnOff}>Turn off lock…</button>
          </div>
        </>
      ) : (
        <>
          <p className="muted small">Ask for a PIN or passphrase before the library opens — a quiet barrier against casual access. It never leaves this device.</p>
          <div className="pill-toggle" style={{ marginBottom: 'var(--space-3)' }}>
            <button className={`pill ${kind === 'passphrase' ? 'active' : ''}`} onClick={() => setKind('passphrase')}>Passphrase</button>
            <button className={`pill ${kind === 'pin' ? 'active' : ''}`} onClick={() => setKind('pin')}>PIN</button>
          </div>
          <div className="field"><input className="text-field" type="password" inputMode={kind === 'pin' ? 'numeric' : 'text'} value={pass} onChange={(e) => setPass(clean(e.target.value))} placeholder={kind === 'pin' ? 'Choose a 4–6 digit PIN' : 'Choose a passphrase'} /></div>
          <div className="field"><input className="text-field" type="password" inputMode={kind === 'pin' ? 'numeric' : 'text'} value={confirm} onChange={(e) => setConfirm(clean(e.target.value))} placeholder="Enter it again to confirm" /></div>
          <div className="settings-row">
            <div><div className="settings-row-title">Auto-lock after idle</div></div>
            <Select ariaLabel="Auto-lock" width={150} value={String(minutes)} onChange={(v) => setMinutes(Number(v))} options={IDLE_OPTIONS} />
          </div>
          <button className="button button-primary" onClick={turnOn} disabled={!pass || !confirm}>Turn on app lock</button>
        </>
      )}
      <p className="muted small" style={{ marginTop: 'var(--space-4)' }}>
        You can also lock an individual novel from its menu on the dashboard.
      </p>

      <div className="settings-subheading">Privacy controls</div>
      <div className="settings-row"><div><div className="settings-row-title">Lock when app is backgrounded</div><div className="settings-row-sub">Require the PIN or passphrase after switching tabs or minimising MoonScribe.</div></div><Toggle checked={!!settings.lockOnBackground} disabled={!appLock?.enabled} onChange={(v) => updateSettings({ lockOnBackground: v })} /></div>
      <div className="settings-row"><div><div className="settings-row-title">Conceal writing when focus is lost</div><div className="settings-row-sub">Blur the application while another window is active, helping protect against shoulder surfing and previews.</div></div><Toggle checked={!!settings.privacyBlur} onChange={(v) => updateSettings({ privacyBlur: v })} /></div>

      <div className="settings-row-title" style={{ marginTop: 'var(--space-5)' }}>Privacy tips</div>
      <ul className="privacy-list">
        <li><span className="privacy-dot ok" /> All writing stays on your device — the lock is a second layer.</li>
        <li><span className="privacy-dot ok" /> Encrypted backups (AES-256 / PBKDF2) let you export without risk.</li>
        <li><span className="privacy-dot warn" /> Screen-capture cannot be blocked in a web app — use the app on a private display if needed.</li>
      </ul>
    </section>
  )
}

function PrivacyData({ toast, refreshNovels, fileRef }) {
  const [confirmWipe, setConfirmWipe] = useState(false)
  const [dbStats, setDbStats] = useState(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const wipeTimer = useRef(null)
  const stamp = () => new Date().toISOString().slice(0, 10)

  const markBackup = () => setMeta('lastBackupAt', Date.now())

  const backup = async () => {
    const data = await exportBackup()
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `moonscribe-backup-${stamp()}.json`)
    markBackup()
    toast('Backup downloaded.')
  }
  const encryptedBackup = async () => {
    const pass = window.prompt('Choose a passphrase to encrypt this backup.\nThere is no recovery — keep it safe.')
    if (pass === null) return
    if (!pass.trim()) return toast('A passphrase is needed to encrypt.')
    try {
      const envelope = await encryptJSON(await exportBackup(), pass)
      downloadBlob(new Blob([JSON.stringify(envelope)], { type: 'application/json' }), `moonscribe-backup-${stamp()}.encrypted.json`)
      markBackup()
      toast('Encrypted backup downloaded.')
    } catch (err) { toast(err.message || 'Could not encrypt the backup.') }
  }
  const restore = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      let data = JSON.parse(await file.text())
      if (isEncryptedBackup(data)) {
        const pass = window.prompt('This backup is encrypted. Enter its passphrase to unlock.')
        if (pass === null) return
        data = await decryptJSON(data, pass)
      }
      await importBackup(data)
      await refreshNovels()
      toast('Everything restored. Welcome back.')
    } catch (err) { toast(err?.message?.includes('passphrase') ? err.message : 'That file didn\'t look right — nothing changed.') }
  }
  const deleteEverything = async () => {
    clearTimeout(wipeTimer.current)
    if (!confirmWipe) { setConfirmWipe(true); wipeTimer.current = setTimeout(() => setConfirmWipe(false), 4000); return }
    setConfirmWipe(false)
    await wipeEverything()
    toast('All data deleted from this device.')
    setTimeout(() => window.location.reload(), 400)
  }

  const loadDbStats = useCallback(async () => {
    setLoadingStats(true)
    try {
      const db = await getDB()
      const stores = db.objectStoreNames
      const stats = {}
      for (const name of stores) {
        try { stats[name] = await db.count(name) } catch { stats[name] = '?' }
      }
      setDbStats(stats)
    } catch (err) {
      toast('Could not read database stats.')
    } finally { setLoadingStats(false) }
  }, [toast])

  const clearSnapshots = useCallback(async () => {
    await clearOldSnapshots(Date.now()) // clear all
    toast('Replay snapshots cleared.')
    if (dbStats) loadDbStats()
  }, [toast, dbStats, loadDbStats])

  return (
    <section className="settings-panel">
      <h2>Privacy &amp; data</h2>
      <ul className="privacy-list">
        <li><span className="privacy-dot ok" /> Your writing is never used to train AI — not now, not ever.</li>
        <li><span className="privacy-dot ok" /> Your data stays on your device by default.</li>
        <li><span className="privacy-dot ok" /> Backups can be encrypted with AES-256 (PBKDF2). The passphrase never leaves this device.</li>
      </ul>

      <div className="settings-row-title" style={{ marginTop: 'var(--space-4)' }}>Backups</div>
      <div className="actions-row" style={{ flexWrap: 'wrap' }}>
        <button className="button button-ghost" onClick={backup}>Download backup</button>
        <button className="button button-ghost" onClick={encryptedBackup}>Encrypted backup…</button>
        <button className="button button-ghost" onClick={() => fileRef.current?.click()}>Restore backup</button>
        <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={restore} />
      </div>

      <div className="settings-row-title" style={{ marginTop: 'var(--space-5)' }}>Database recovery</div>
      <p className="muted small" style={{ margin: '4px 0 10px' }}>Check the state of your local database and clear optional caches.</p>
      <div className="actions-row" style={{ flexWrap: 'wrap', marginBottom: 'var(--space-3)' }}>
        <button className="button button-ghost" onClick={loadDbStats} disabled={loadingStats}>
          {loadingStats ? 'Checking…' : 'Check database health'}
        </button>
        <button className="button button-ghost" onClick={clearSnapshots}>Clear replay snapshots</button>
      </div>
      {dbStats && (
        <div className="db-stats">
          {Object.entries(dbStats).map(([name, count]) => (
            <div key={name} className="db-stat-row">
              <span className="db-stat-name">{name}</span>
              <span className="db-stat-count">{Number(count) || 0} records</span>
            </div>
          ))}
        </div>
      )}

      <div className="settings-row-title" style={{ marginTop: 'var(--space-5)' }}>Danger zone</div>
      <p className="muted small" style={{ margin: '4px 0 8px' }}>Erase everything on this device. This can't be undone — download a backup first.</p>
      <button className={`button ${confirmWipe ? 'button-rose' : 'button-ghost'}`} onClick={deleteEverything}>
        {confirmWipe ? 'Tap again to permanently delete everything' : 'Delete all my data…'}
      </button>
    </section>
  )
}

function Toggle({ checked, onChange, disabled = false }) {
  return (
    <label className={`switch${disabled ? ' disabled' : ''}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="track" />
    </label>
  )
}
