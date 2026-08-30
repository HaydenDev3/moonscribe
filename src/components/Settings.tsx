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
import Select from './Select'
import Icon from './Icon'
import RolePermissions from './RolePermissions'
import * as syncEngine from '../sync/engine'
import { NOVEL_NAV } from '../nav'
import { isSupabaseConfigured } from '../lib/supabase'
import { capabilities } from '../platform/capabilities'
import UpdateSettings from './UpdateSettings'
import { flushNativeMirrorFailures, listNativeBackups, pendingNativeMirrorFailures, restoreNativeStorage } from '../platform/nativeStorage'
import { readDesktopFile, takePendingDesktopBackup } from '../platform/fileOpen'
import { pendingSyncCount } from '../sync/engine'
import { DEFAULT_KEYBINDS, KEYBIND_LABELS, formatKeybind, keybindConflicts, keybindFromEvent, keybindsWithDefaults } from '../utils/keybinds'
import { discordPresenceStatus } from '../platform/discordPresence'

const IDLE_OPTIONS = [
  { value: '0', label: 'Never' },
  { value: '1', label: '1 minute' },
  { value: '5', label: '5 minutes' },
  { value: '15', label: '15 minutes' },
  { value: '30', label: '30 minutes' },
  { value: '60', label: '1 hour' }
]

const CATEGORIES = [
  { key: 'overview', label: 'Overview', icon: 'fa-solid fa-sliders', group: 'General', terms: 'home start screen preferences settings' },
  { key: 'appearance', label: 'Appearance', icon: 'fa-solid fa-palette', group: 'Experience', terms: 'theme colour paper custom motion' },
  { key: 'editor', label: 'Editor', icon: 'fa-solid fa-pen-nib', group: 'Experience', terms: 'writing font spelling autocorrect page' },
  { key: 'writing', label: 'Writing experience', icon: 'fa-solid fa-feather-pointed', group: 'Experience', terms: 'autosave typewriter focus writing session' },
  { key: 'sounds', label: 'Sounds & feedback', icon: 'fa-solid fa-volume-high', group: 'Experience', terms: 'sound ambient clicks notifications feedback' },
  { key: 'notifications', label: 'Notifications', icon: 'fa-regular fa-bell', group: 'Experience', terms: 'email reminder browser inbox collaboration announcement' },
  { key: 'dashboard', label: 'Dashboard', icon: 'fa-solid fa-house', group: 'Experience', terms: 'home library sidebar widgets landing view' },
  { key: 'sync', label: 'Sync', icon: 'fa-solid fa-arrows-rotate', group: 'Data & sync', terms: 'cloud sync offline conflicts server' },
  { key: 'privacy', label: 'Import, export & storage', icon: 'fa-solid fa-database', group: 'Data & sync', terms: 'backup export import delete encryption storage' },
  { key: 'backups', label: 'Backups', icon: 'fa-solid fa-box-archive', group: 'Data & sync', terms: 'backup restore download safety' },
  { key: 'lock', label: 'Lock & security', icon: 'fa-solid fa-lock', group: 'Privacy & safety', terms: 'password pin idle authorization security' },
  { key: 'sessions', label: 'Sessions & devices', icon: 'fa-solid fa-laptop', group: 'Privacy & safety', terms: 'devices sessions revoke login signed in' },
  { key: 'accessibility', label: 'Accessibility', icon: 'fa-solid fa-universal-access', group: 'Accessibility', terms: 'contrast readable motion keyboard focus' },
  { key: 'keybinds', label: 'Keybinds', icon: 'fa-regular fa-keyboard', group: 'Accessibility', terms: 'shortcuts keyboard commands' },
  { key: 'performance', label: 'Performance', icon: 'fa-solid fa-gauge-high', group: 'Advanced', terms: 'speed autosave responsiveness animation' },
  ...(capabilities.nativeUpdater ? [{ key: 'updates', label: 'Updates', icon: 'fa-solid fa-cloud-arrow-down', group: 'Advanced', terms: 'desktop version updater stable download restart' }] : []),
  { key: 'about', label: 'About', icon: 'fa-solid fa-moon', group: 'Advanced', terms: 'version app release notes' }
]

export default function Settings() {
  const app = useApp()
  const { settings, updateSettings, refreshNovels, toast, settingsOpen, openSettings, closeSettings,
    appLock, enableAppLock, updateAppLock, disableAppLock, lockNow,
    customFonts, systemFonts, installCustomFont, deleteCustomFont, refreshSystemFonts,
    } = app

  const [cat, setCat] = useState('overview')
  const [query, setQuery] = useState('')
  const [fontName, setFontName] = useState('')
  const fileRef = useRef(null)
  const fontFileRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => {
      const shortcut = settings.keybinds?.settings || 'Mod+P'
      if (keybindFromEvent(e) === shortcut) {
        e.preventDefault()
        if (settingsOpen) closeSettings()
        else openSettings()
      } else if (e.key === 'Escape' && settingsOpen) {
        closeSettings()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [settings.keybinds, settingsOpen, openSettings, closeSettings])

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
              <button key={c.key} className={`settings-rail-item ${cat === c.key || (c.key === 'account' && cat === 'sync') ? 'active' : ''}`} onClick={() => setCat(c.key === 'account' ? 'sync' : c.key)}><span className="settings-rail-icon"><Icon icon={c.icon} /></span>{c.label}<Icon icon="fa-solid fa-chevron-right" className="settings-rail-chevron" /></button>
            ))}</div>
          })}
          <div className="settings-rail-foot">
            <span className="palette-kbd">Ctrl P</span>
          </div>
        </nav>

        <div className="settings-content">
          <div className="settings-content-chrome"><span className="settings-content-kicker">MoonScribe studio</span><span className="settings-content-title">Preferences</span></div>
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
          {!query && cat === 'overview' && <SettingsOverview onOpenCategory={setCat} />}
          {!query && cat === 'writing' && <WritingExperience settings={settings} updateSettings={updateSettings} />}
          {!query && cat === 'sounds' && <SoundsFeedback settings={settings} updateSettings={updateSettings} />}
          {!query && cat === 'notifications' && <NotificationPreferences settings={settings} updateSettings={updateSettings} />}
          {!query && cat === 'dashboard' && <DashboardPreferences settings={settings} updateSettings={updateSettings} />}
          {!query && cat === 'performance' && <Performance settings={settings} updateSettings={updateSettings} />}
          {!query && cat === 'updates' && capabilities.nativeUpdater && <UpdateSettings />}
          {!query && cat === 'accessibility' && <Accessibility settings={settings} updateSettings={updateSettings} />}
          {!query && cat === 'keybinds' && <Keybinds settings={settings} updateSettings={updateSettings} />}
          {!query && cat === 'lock' && (
            <LockSecurity appLock={appLock} enableAppLock={enableAppLock} updateAppLock={updateAppLock} disableAppLock={disableAppLock} lockNow={lockNow} toast={toast} settings={settings} updateSettings={updateSettings} />
          )}
          {!query && (cat === 'privacy' || cat === 'backups') && (
            <PrivacyData toast={toast} refreshNovels={refreshNovels} fileRef={fileRef} />
          )}
          {!query && cat === 'sync' && (
            <section className="settings-panel">
              <div className="settings-panel-kicker">Identity &amp; devices</div>
              <h2>Sync</h2>
              <p className="muted">Manage who you are in MoonScribe, where your library lives, and which devices can reach it.</p>
              <SyncPanel onOpen={() => setCat('sync')} />
              <DiscordPresencePanel settings={settings} updateSettings={updateSettings} />
              <RolePermissions />
              <div className="settings-section-card">
                <div className="settings-section-head"><span className="settings-section-icon"><Icon icon="fa-solid fa-laptop-file" /></span><div><strong>Local writing identity</strong><small>Your offline library is available without an account.</small></div><span className="settings-status-pill safe">Active</span></div>
                <div className="settings-detail-grid"><span><small>Storage</small><b>This browser</b></span><span><small>Ownership</small><b>Private to you</b></span><span><small>Offline access</small><b>Available</b></span></div>
              </div>
            </section>
          )}
          {!query && cat === 'sessions' && <SessionsDevices />}
          {!query && cat === 'about' && (
            <section className="settings-panel">
              <div className="settings-panel-kicker">The quiet writing studio</div>
              <h2>MoonScribe</h2>
              <p className="muted">A quiet, private place to write — made with love, for Storm Tattersall. Every word stays on your device by default; nothing is ever counted against you.</p>
              <p className="muted small">Online across your devices · offline-safe · yours.</p>
              <div className="settings-detail-grid about-detail-grid">
                <span><small>Built for</small><b>Long-form stories</b></span><span><small>Privacy</small><b>Local-first</b></span><span><small>Writing modes</small><b>Draft · Plan · Design</b></span>
              </div>
              <div className="settings-section-card about-feature-card"><div className="settings-section-head"><span className="settings-section-icon"><Icon icon="fa-solid fa-feather-pointed" /></span><div><strong>Everything your story needs</strong><small>Draft chapters, remember your world, review together, and carry the book through publication.</small></div></div><div className="about-feature-list"><span><Icon icon="fa-solid fa-cloud-arrow-down" /> Offline by default</span><span><Icon icon="fa-solid fa-shield-halved" /> Your manuscript stays yours</span><span><Icon icon="fa-solid fa-book-open" /> Built for the whole book</span></div></div>
              <div className="settings-row" style={{ marginTop: 'var(--space-5)' }}>
                <div><div className="settings-row-title">Version 1.1.2</div><div className="settings-row-sub">Released 31 August 2026 — The Complete Writer’s Studio</div><div className="settings-row-detail">Story Memory and evidence links, family-tree relationship mapping, prose tools, continuity and timeline improvements, richer moodboards, book-design upgrades, responsive mobile layouts, media-library organization, account and admin refinements, reliable offline sync, and a clearer notification layer.</div></div>
              </div>
              <div className="settings-row" style={{ marginTop: 'var(--space-5)' }}>
                <div><div className="settings-row-title">Version 1.1.1</div><div className="settings-row-sub">Released 28 August 2026 — Quality-of-life update</div></div>
              </div>
              <div className="settings-row">
                <div><div className="settings-row-title">Version 1.1.0</div><div className="settings-row-sub">Released 26 August 2026 — Parchment</div></div>
              </div>
              <div className="settings-row">
                <div><div className="settings-row-title">Version 1.0.0</div><div className="settings-row-sub">Released 5 August 2026 — First public release</div></div>
              </div>
            </section>
          )}
        </div>
      </div>

    </div>,
    document.body
  )
}

function DiscordPresencePanel({ settings, updateSettings }) {
  const [status, setStatus] = useState<{ available: boolean; connected: boolean; reason?: string } | null>(null)
  useEffect(() => { void discordPresenceStatus().then(setStatus) }, [settings.discordRichPresence])
  const label = !status ? 'Checking…' : status.connected ? 'Connected' : status.available ? 'Disconnected' : status.reason === 'web' ? 'Desktop only' : 'Discord unavailable'
  return <div className="settings-section-card">
    <div className="settings-section-head"><span className="settings-section-icon"><Icon icon="fa-brands fa-discord" /></span><div><strong>Discord Rich Presence</strong><small>Let friends see what kind of work you are doing in MoonScribe.</small></div><span className={`settings-status-pill ${status?.connected ? 'safe' : ''}`}>{label}</span></div>
    <div className="settings-row"><div><div className="settings-row-title">Share my MoonScribe activity</div><div className="settings-row-sub">Only generic activities are shared — never novel, chapter, or document names. Discord’s desktop app must be running.</div></div><Toggle checked={!!settings.discordRichPresence} onChange={(value) => updateSettings({ discordRichPresence: value })} /></div>
  </div>
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

function SettingsOverview({ onOpenCategory }) {
  const shortcuts = [
    ['appearance', 'Appearance', 'Theme, typography and atmosphere', 'fa-solid fa-palette'],
    ['writing', 'Writing experience', 'Autosave, focus and session comfort', 'fa-solid fa-feather-pointed'],
    ['dashboard', 'Dashboard', 'Home, library and sidebar preferences', 'fa-solid fa-house'],
  ]
  return (
    <section className="settings-panel">
      <div className="settings-panel-kicker">General</div>
      <h2>Settings, made for your way of writing.</h2>
      <p className="muted">Account preferences follow your MoonScribe identity. Device-specific controls stay local to this browser.</p>
      <div className="settings-overview-grid">
        {shortcuts.map(([key, title, description, icon]) => (
          <button key={key} className="settings-overview-card" onClick={() => onOpenCategory(key)}>
            <Icon icon={icon} />
            <span><strong>{title}</strong><small>{description}</small></span>
            <Icon icon="fa-solid fa-arrow-right" />
          </button>
        ))}
      </div>
    </section>
  )
}

function Profile({ settings, updateSettings }) {
  const { syncUsername, syncDiscordAvatar } = useApp()
  return (
    <section className="settings-panel">
      <div className="settings-panel-kicker">General</div>
      <h2>Profile</h2>
      <p className="muted">Your account name identifies MoonScribe. Your writer name is used for exports when you choose it.</p>
      <div className="settings-profile-card">
        {syncDiscordAvatar ? <img src={syncDiscordAvatar} alt="" /> : <span><Icon icon="fa-solid fa-feather-pointed" /></span>}
        <div><strong>{syncUsername || 'Local writer'}</strong><small>MoonScribe account</small></div>
      </div>
      <div className="settings-form-grid">
        <label className="field"><span>Display name</span><input className="text-field" value={settings.displayName || ''} onChange={(event) => updateSettings({ displayName: event.target.value })} placeholder={syncUsername || 'How MoonScribe addresses you'} /></label>
        <label className="field"><span>Writer name <em>Optional pen name</em></span><input className="text-field" value={settings.writerName || ''} onChange={(event) => updateSettings({ writerName: event.target.value })} placeholder="Name used on exports" /></label>
        <label className="field settings-form-wide"><span>Bio <em>Optional</em></span><input className="text-field" value={settings.profileBio || ''} onChange={(event) => updateSettings({ profileBio: event.target.value })} placeholder="Fantasy writer · worldbuilder" /></label>
        <div className="settings-row"><div><div className="settings-row-title">Timezone</div><div className="settings-row-sub">Used for daily goals and writing streaks.</div></div><Select ariaLabel="Timezone" width={210} value={settings.timezone || 'UTC'} onChange={(value) => updateSettings({ timezone: value })} options={['Australia/Brisbane', 'Australia/Sydney', 'America/New_York', 'Europe/London', 'UTC'].map((value) => ({ value, label: value.replace('_', ' ') }))} /></div>
        <div className="settings-row"><div><div className="settings-row-title">Language</div><div className="settings-row-sub">Interface and date formatting preference.</div></div><Select ariaLabel="Language" width={210} value={settings.language || 'en-AU'} onChange={(value) => updateSettings({ language: value })} options={[{ value: 'en-AU', label: 'English (Australia)' }, { value: 'en-US', label: 'English (United States)' }, { value: 'en-GB', label: 'English (United Kingdom)' }]} /></div>
      </div>
    </section>
  )
}

function AppConnections({ onOpen, onConnectDiscord, onConnectGoogle }) {
  const { syncUsername, syncDiscordAvatar, syncStatus, syncProvider, toast } = useApp() as any
  const [passkeys, setPasskeys] = useState<any[]>([])
  const [passkeyBusy, setPasskeyBusy] = useState(false)
  const connected = !!syncUsername
  const provider = syncProvider === 'google' ? 'Google' : 'Discord'
  const loadPasskeys = useCallback(async () => {
    const cfg = await syncEngine.getConfig()
    if (!cfg.server || !cfg.token) return setPasskeys([])
    const response = await fetch(`${cfg.server}/api/auth/passkeys`, { headers: { Authorization: `Bearer ${cfg.token}` } })
    if (response.ok) setPasskeys((await response.json()).passkeys || [])
  }, [])
  useEffect(() => { void loadPasskeys() }, [loadPasskeys, syncUsername])
  const addPasskey = async () => {
    if (!window.PublicKeyCredential) return toast('Passkeys are not supported by this browser or device.')
    setPasskeyBusy(true)
    try {
      const cfg = await syncEngine.getConfig()
      if (!cfg.server || !cfg.token) throw new Error('Sign in before adding a passkey.')
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.token}` }
      const start = await fetch(`${cfg.server}/api/auth/passkeys/register/options`, { method: 'POST', headers, body: '{}' })
      const request = await start.json().catch(() => ({}))
      if (!start.ok) throw new Error(request.error || 'Could not start passkey setup.')
      const { startRegistration } = await import('@simplewebauthn/browser')
      const credential = await startRegistration({ optionsJSON: request.options })
      const finish = await fetch(`${cfg.server}/api/auth/passkeys/register/verify`, { method: 'POST', headers, body: JSON.stringify({ challengeId: request.challengeId, response: credential, name: 'Passkey' }) })
      const result = await finish.json().catch(() => ({}))
      if (!finish.ok) throw new Error(result.error || 'Could not save that passkey.')
      await loadPasskeys()
      toast('Passkey added.')
    } catch (error: any) {
      toast(error?.name === 'NotAllowedError' ? 'Passkey setup was cancelled.' : error?.message || 'Could not add a passkey.')
    } finally { setPasskeyBusy(false) }
  }
  const removePasskey = async (credentialId: string) => {
    if (!window.confirm('Remove this passkey from your MoonScribe account?')) return
    try {
      const cfg = await syncEngine.getConfig()
      const response = await fetch(`${cfg.server}/api/auth/passkeys/remove`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.token}` }, body: JSON.stringify({ credentialId }) })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Could not remove that passkey.')
      await loadPasskeys()
      toast('Passkey removed.')
    } catch (error: any) { toast(error?.message || 'Could not remove that passkey.') }
  }
  return (
    <section className="settings-panel">
      <div className="settings-panel-kicker">Account</div>
      <h2>Authentication</h2>
      <p className="muted">Use any connected method to access the same MoonScribe account and library. These methods authenticate one account; none owns it.</p>
      <div className="settings-identity-card">
        {syncDiscordAvatar ? <img src={syncDiscordAvatar} alt="" /> : <span><Icon icon="fa-solid fa-moon" /></span>}
        <div><strong>{syncUsername || 'Your MoonScribe identity'}</strong><small>{connected ? 'Connected and ready to sync' : 'Connect a provider to sync this library'}</small></div>
        <span className={`settings-status-pill ${syncStatus === 'synced' ? 'safe' : 'warn'}`}>{connected ? 'Active' : 'Local only'}</span>
      </div>
      <div className="settings-subheading">Sign-in methods</div>
      <ConnectionRow icon="fa-brands fa-discord" name="Discord" detail={connected && provider === 'Discord' ? `Connected as ${syncUsername}` : 'Use your Discord account'} connected={connected && provider === 'Discord'} onManage={connected && provider === 'Discord' ? onOpen : onConnectDiscord} />
      <ConnectionRow icon="fa-brands fa-google" name="Google" detail={connected && provider === 'Google' ? `Connected as ${syncUsername}` : 'Use your Google account'} connected={connected && provider === 'Google'} onManage={connected && provider === 'Google' ? onOpen : onConnectGoogle} />
      <ConnectionRow icon="fa-solid fa-key" name="MoonScribe password" detail="Sign in with an email and password" connected={false} onManage={onOpen} />
      <ConnectionRow icon="fa-solid fa-fingerprint" name="Passkey" detail={passkeys.length ? `${passkeys.length} passkey${passkeys.length === 1 ? '' : 's'} registered` : 'Use your device lock, fingerprint, or security key'} connected={passkeys.length > 0} onManage={addPasskey} disabled={!connected || passkeyBusy} />
      {passkeys.map((passkey) => <div className="settings-row" key={passkey.id}><div><div className="settings-row-title">{passkey.name}</div><div className="settings-row-sub">Added {new Date(passkey.createdAt).toLocaleDateString()}{passkey.lastUsedAt ? ` · Last used ${new Date(passkey.lastUsedAt).toLocaleDateString()}` : ''}</div></div><button className="button button-secondary" type="button" onClick={() => void removePasskey(passkey.id)}>Remove</button></div>)}
      <div className="settings-help-card"><Icon icon="fa-solid fa-circle-info" /><span><strong>New to MoonScribe?</strong><small>Connect Discord or Google to keep your library available across devices. Your local writing remains available without an account.</small></span></div>
    </section>
  )
}

function ConnectionRow({ icon, name, detail, connected, onManage = () => {}, disabled = false }) {
  return <div className="settings-row settings-connection-row"><div><div className="settings-row-title"><Icon icon={icon} /> {name}</div><div className="settings-row-sub">{detail}</div></div><button className="button button-secondary" disabled={disabled} onClick={onManage}>{connected ? 'Connected' : disabled ? 'Unavailable' : 'Set up'}</button></div>
}

function WritingExperience({ settings, updateSettings }) {
  return (
    <section className="settings-panel">
      <div className="settings-panel-kicker">Experience</div>
      <h2>Writing experience</h2>
      <p className="muted">Set how MoonScribe behaves while you are inside a writing session.</p>
      <div className="settings-row"><div><div className="settings-row-title">Autosave delay</div><div className="settings-row-sub">Save after you pause typing.</div></div><Select ariaLabel="Autosave delay" width={160} value={String(settings.autosaveDelay || 1800)} onChange={(value) => updateSettings({ autosaveDelay: Number(value) })} options={[{ value: '800', label: '0.8 seconds' }, { value: '1800', label: '1.8 seconds' }, { value: '3500', label: '3.5 seconds' }]} /></div>
      <div className="settings-row"><div><div className="settings-row-title">Resume cursor position</div><div className="settings-row-sub">Return to the last place you were writing.</div></div><Toggle checked={settings.resumeCursorPosition !== false} onChange={(value) => updateSettings({ resumeCursorPosition: value })} /></div>
      <div className="settings-row"><div><div className="settings-row-title">Remember scroll position</div><div className="settings-row-sub">Keep your reading place inside long chapters.</div></div><Toggle checked={settings.rememberScrollPosition !== false} onChange={(value) => updateSettings({ rememberScrollPosition: value })} /></div>
      <div className="settings-row"><div><div className="settings-row-title">Open last chapter on launch</div><div className="settings-row-sub">Resume the most recently opened chapter when entering a story.</div></div><Toggle checked={settings.openLastChapter !== false} onChange={(value) => updateSettings({ openLastChapter: value })} /></div>
      <div className="settings-row"><div><div className="settings-row-title">Writing goal reminders</div><div className="settings-row-sub">How assertively MoonScribe should nudge daily goals.</div></div><Select ariaLabel="Writing goal reminders" width={160} value={settings.writingGoalReminders || 'gentle'} onChange={(value) => updateSettings({ writingGoalReminders: value })} options={[{ value: 'off', label: 'Off' }, { value: 'gentle', label: 'Gentle' }, { value: 'regular', label: 'Regular' }]} /></div>
      <div className="settings-row"><div><div className="settings-row-title">Writing celebrations</div><div className="settings-row-sub">Keep progress moments quiet or turn them off.</div></div><Select ariaLabel="Writing celebrations" width={160} value={settings.writingCelebrations || 'subtle'} onChange={(value) => updateSettings({ writingCelebrations: value })} options={[{ value: 'off', label: 'Off' }, { value: 'subtle', label: 'Subtle' }, { value: 'full', label: 'Full' }]} /></div>
    </section>
  )
}

function SoundsFeedback({ settings, updateSettings }) {
  const previewAmbience = () => {
    updateSettings({ soundEnabled: true, ambientSound: true })
    import('../utils/sounds').then(({ startAmbientSound }) => startAmbientSound(settings.ambientSoundVolume, settings.ambientMood || 'moonlit'))
  }
  return (
    <section className="settings-panel">
      <div className="settings-panel-kicker">Experience</div>
      <h2>Sounds &amp; feedback</h2>
      <p className="muted">MoonScribe uses separate interface, writing, notification and ambience channels. All sound is generated locally and nothing from your writing is recorded.</p>
      <div className="settings-row"><div><div className="settings-row-title">Master sounds</div><div className="settings-row-sub">Enable sound feedback across MoonScribe.</div></div><Toggle checked={!!settings.soundEnabled} onChange={(value) => updateSettings({ soundEnabled: value })} /></div>
      <SoundLevel label="Master volume" value={settings.soundVolume} onChange={(value) => updateSettings({ soundVolume: value })} />
      <div className="settings-row"><div><div className="settings-row-title">Interface sounds</div><div className="settings-row-sub">Short clicks and toggles for controls and navigation.</div></div><Toggle checked={settings.clickSounds !== false} onChange={(value) => updateSettings({ clickSounds: value })} /></div>
      <SoundLevel label="Interface volume" value={settings.interfaceSoundVolume} onChange={(value) => updateSettings({ interfaceSoundVolume: value })} />
      <div className="settings-row"><div><div className="settings-row-title">Writing sounds</div><div className="settings-row-sub">Varied key and return sounds while typing.</div></div><Toggle checked={!!settings.typingSounds} onChange={(value) => updateSettings({ typingSounds: value })} /></div>
      <SoundLevel label="Writing volume" value={settings.writingSoundVolume} onChange={(value) => updateSettings({ writingSoundVolume: value })} />
      <div className="settings-row"><div><div className="settings-row-title">Notification sounds</div><div className="settings-row-sub">Distinct chimes for attention-worthy events.</div></div><Toggle checked={settings.notificationSounds !== false} onChange={(value) => updateSettings({ notificationSounds: value })} /></div>
      <SoundLevel label="Notification volume" value={settings.notificationSoundVolume} onChange={(value) => updateSettings({ notificationSoundVolume: value })} />
      <div className="settings-row"><div><div className="settings-row-title">Daily digest at startup</div><div className="settings-row-sub">Show a calm daily writing summary when MoonScribe opens.</div></div><Toggle checked={settings.startupDigest !== false} onChange={(value) => updateSettings({ startupDigest: value })} /></div>
      <div className="settings-row"><div><div className="settings-row-title">Startup sound</div><div className="settings-row-sub">Play the MoonScribe startup sound with the daily digest.</div></div><Toggle checked={settings.startupSound !== false} onChange={(value) => updateSettings({ startupSound: value })} /></div>
      <SoundLevel label="Startup volume" value={settings.startupSoundVolume} onChange={(value) => updateSettings({ startupSoundVolume: value })} />
      <div className="settings-row"><div><div className="settings-row-title">Ambient soundscape</div><div className="settings-row-sub">A persistent ambience that continues while moving between pages.</div></div><Select ariaLabel="Ambient soundscape" width={180} value={settings.ambientSound ? settings.ambientMood || 'moonlit' : 'off'} onChange={(value) => updateSettings({ ambientMood: value === 'off' ? settings.ambientMood : value, ambientSound: value !== 'off' })} options={[{ value: 'off', label: 'Off' }, { value: 'moonlit', label: 'Moonlit studio' }, { value: 'rainglass', label: 'Rain on glass' }, { value: 'hearth', label: 'Fireplace' }, { value: 'forest', label: 'Forest night' }, { value: 'ocean', label: 'Ocean room' }, { value: 'library', label: 'Quiet library' }, { value: 'cafe', label: 'Café' }, { value: 'clockwork', label: 'Clockwork room' }, { value: 'underwater', label: 'Deep sea' }, { value: 'treetop', label: 'Wind through trees' }]} /></div>
      <SoundLevel label="Ambient volume" value={settings.ambientSoundVolume} onChange={(value) => updateSettings({ ambientSoundVolume: value })} />
      <button className="button button-secondary" onClick={previewAmbience}><Icon icon="fa-solid fa-play" /> Preview ambience</button>
    </section>
  )
}

function SoundLevel({ label, value, onChange }) {
  const current = Number(value) || 0
  return <div className="settings-row"><div><div className="settings-row-title">{label}</div></div><label className="settings-volume-control"><input className="settings-volume" type="range" min="0" max="100" value={current} onChange={(event) => onChange(Number(event.target.value))} aria-label={label} /><span>{current}%</span></label></div>
}

function NotificationPreferences({ settings, updateSettings }) {
  const preferences = settings.notificationPreferences || {}
  const setPreference = (key, value) => updateSettings({ notificationPreferences: { ...preferences, [key]: value } })
  const requestBrowserPermission = async (enabled) => {
    if (!enabled) return updateSettings({ browserNotifications: false })
    if (!('Notification' in window)) return
    const permission = await Notification.requestPermission()
    updateSettings({ browserNotifications: permission === 'granted' })
  }
  return (
    <section className="settings-panel">
      <div className="settings-panel-kicker">Experience</div>
      <h2>Notifications</h2>
      <p className="muted">MoonScribe decides which events deserve attention. Toasts remain temporary; these preferences are for reminders and events worth returning to.</p>
      <div className="settings-subheading">General</div>
      <div className="settings-row"><div><div className="settings-row-title">In-app notifications</div><div className="settings-row-sub">Keep important writing, account and collaboration events in your notification centre.</div></div><Toggle checked={preferences.inApp !== false} onChange={(value) => setPreference('inApp', value)} /></div>
      <div className="settings-row"><div><div className="settings-row-title">Browser notifications</div><div className="settings-row-sub">Only used for reminders and collaboration when MoonScribe is not in view.</div></div><Toggle checked={!!settings.browserNotifications} onChange={requestBrowserPermission} /></div>
      {capabilities.nativeNotifications && <div className="settings-row"><div><div className="settings-row-title">Desktop notifications</div><div className="settings-row-sub">Show native notifications for new collaboration, writing, and sync events.</div></div><Toggle checked={settings.desktopNotifications !== false} onChange={(value) => updateSettings({ desktopNotifications: value })} /></div>}
      <div className="settings-subheading">Writing</div>
      <PreferenceRow label="Writing reminders" setting="writingReminders" preferences={preferences} onChange={setPreference} />
      <PreferenceRow label="Daily goal updates" setting="dailyGoalUpdates" preferences={preferences} onChange={setPreference} />
      <PreferenceRow label="Writing streaks and milestones" setting="milestones" preferences={preferences} onChange={setPreference} />
      <div className="settings-subheading">Stories &amp; account</div>
      <PreferenceRow label="Shared-story activity" setting="collaboration" preferences={preferences} onChange={setPreference} />
      <PreferenceRow label="Sync problems and backup reminders" setting="syncProblems" preferences={preferences} onChange={setPreference} />
      <PreferenceRow label="Announcements and new features" setting="announcements" preferences={preferences} onChange={setPreference} />
      <div className="settings-subheading">Email delivery</div>
      <div className="settings-row"><div><div className="settings-row-title">Account &amp; security</div><div className="settings-row-sub">Sign-in, account recovery and security changes are always delivered when email is available.</div></div><span className="settings-status-pill safe">Required</span></div>
      <PreferenceRow label="Weekly writing summary" setting="emailWeeklySummary" preferences={preferences} onChange={setPreference} />
      <PreferenceRow label="Writing reminders by email" setting="emailWritingReminders" preferences={preferences} onChange={setPreference} />
      <PreferenceRow label="Milestones and collaboration by email" setting="emailMilestones" preferences={preferences} onChange={setPreference} />
      <PreferenceRow label="Announcements by email" setting="emailAnnouncements" preferences={preferences} onChange={setPreference} />
    </section>
  )
}

function PreferenceRow({ label, setting, preferences, onChange }) {
  return <div className="settings-row"><div><div className="settings-row-title">{label}</div></div><Toggle checked={preferences[setting] !== false} onChange={(value) => onChange(setting, value)} /></div>
}

function DashboardPreferences({ settings, updateSettings }) {
  return (
    <section className="settings-panel">
      <div className="settings-panel-kicker">Experience</div>
      <h2>Dashboard</h2>
      <p className="muted">Choose the information MoonScribe shows before you begin writing.</p>
      <div className="settings-card-grid">
        <div className="settings-section-card"><div className="settings-subheading">Home</div><div className="settings-row"><div><div className="settings-row-title">Hero style</div><div className="settings-row-sub">Size of your continue-writing card.</div></div><Select ariaLabel="Hero style" width={140} value={settings.dashboardHeroStyle || 'large'} onChange={(value) => updateSettings({ dashboardHeroStyle: value })} options={[{ value: 'large', label: 'Large' }, { value: 'compact', label: 'Compact' }]} /></div><div className="settings-row"><div><div className="settings-row-title">Show greeting</div></div><Toggle checked={settings.dashboardShowGreeting !== false} onChange={(value) => updateSettings({ dashboardShowGreeting: value })} /></div><div className="settings-row"><div><div className="settings-row-title">Show writing streak</div></div><Toggle checked={settings.dashboardShowStreak !== false} onChange={(value) => updateSettings({ dashboardShowStreak: value })} /></div><div className="settings-row"><div><div className="settings-row-title">Show recent chapters</div></div><Toggle checked={settings.dashboardShowRecent !== false} onChange={(value) => updateSettings({ dashboardShowRecent: value })} /></div></div>
        <div className="settings-section-card"><div className="settings-subheading">Sidebar</div><div className="settings-row"><div><div className="settings-row-title">Default state</div><div className="settings-row-sub">New dashboard sessions begin expanded.</div></div><Select ariaLabel="Sidebar default state" width={140} value={settings.dashboardSidebarDefault || 'expanded'} onChange={(value) => updateSettings({ dashboardSidebarDefault: value })} options={[{ value: 'expanded', label: 'Expanded' }, { value: 'collapsed', label: 'Collapsed' }]} /></div><div className="settings-row"><div><div className="settings-row-title">Show current story</div></div><Toggle checked={settings.dashboardShowCurrentStory !== false} onChange={(value) => updateSettings({ dashboardShowCurrentStory: value })} /></div><div className="settings-row"><div><div className="settings-row-title">Show tool labels</div></div><Toggle checked={settings.dashboardShowToolLabels !== false} onChange={(value) => updateSettings({ dashboardShowToolLabels: value })} /></div><div className="settings-row"><div><div className="settings-row-title">Animate collapse</div></div><Toggle checked={settings.dashboardAnimateCollapse !== false} onChange={(value) => updateSettings({ dashboardAnimateCollapse: value })} /></div></div>
      </div>
      <SidebarVisibility settings={settings} updateSettings={updateSettings} />
    </section>
  )
}

function SessionsDevices() {
  return <section className="settings-panel"><div className="settings-panel-kicker">Privacy &amp; safety</div><h2>Sessions &amp; devices</h2><p className="muted">Review every device with access to your MoonScribe account and revoke anything you no longer use.</p><AccountSessions /></section>
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
      {profile && <div className="settings-section-head"><span className="settings-section-icon"><Icon icon="fa-solid fa-shield-halved" /></span><div><strong>Security &amp; signed-in devices</strong><small>{profile.emailVerified ? 'Your identity is verified; review devices you no longer use.' : 'Verify your email to strengthen account recovery and enable two-factor authentication.'}</small></div><span className={`settings-status-pill ${profile.emailVerified && profile.twoFactorEnabled ? 'safe' : 'warn'}`}>{profile.emailVerified && profile.twoFactorEnabled ? 'Protected' : 'Needs attention'}</span></div>}
      {profile && <div className="settings-detail-grid"><span><small>Account</small><b>{profile.username}</b></span><span><small>Provider</small><b>{profile.provider === 'discord' ? 'Discord OAuth' : profile.provider === 'google' ? 'Google OAuth' : 'MoonScribe'}</b></span><span><small>Email</small><b>{profile.emailVerified ? 'Verified' : 'Unverified'}</b></span><span><small>Member since</small><b>{new Date(profile.createdAt).toLocaleDateString()}</b></span></div>}
      <div className="settings-subheading">Active sessions</div>
      {loading && !sessions.length ? <p className="muted small">Checking devices…</p> : !sessions.length ? <p className="muted small">No active sessions were returned. Try refreshing.</p> : sessions.map((session) => (
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
  const { syncUsername, syncDiscordAvatar, syncServer, syncStatus, disconnectSync, toast, syncNow } = useApp()
  const [pending, setPending] = useState(0)
  const [nativePending, setNativePending] = useState(0)
  const [queue, setQueue] = useState([])
  const [queueOpen, setQueueOpen] = useState(false)
  const refresh = () => { void pendingSyncCount().then(setPending).catch(() => {}); setNativePending(pendingNativeMirrorFailures()) }
  const inspectQueue = async () => { setQueue(await syncEngine.collectPending()); setQueueOpen(true) }
  useEffect(() => {
    refresh()
    const timer = window.setInterval(refresh, 5000)
    window.addEventListener('moonscribe:record-written', refresh)
    window.addEventListener('moonscribe:native-mirror-failed', refresh)
    return () => { window.clearInterval(timer); window.removeEventListener('moonscribe:record-written', refresh); window.removeEventListener('moonscribe:native-mirror-failed', refresh) }
  }, [])
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
          <div className="sync-queue-card" role="status"><div><strong>{pending + nativePending}</strong><span>{nativePending ? `${nativePending} local desktop retry${nativePending === 1 ? '' : 'ies'} pending` : (pending === 1 ? 'queued change' : 'queued changes')}</span></div><div className="sync-queue-actions"><button className="button button-quiet" type="button" onClick={() => void inspectQueue()} disabled={!pending}>View details</button><button className="button button-quiet" type="button" onClick={async () => { await flushNativeMirrorFailures(); void syncNow?.(); refresh(); toast('Sync and local recovery retry requested.') }} disabled={(!pending && !nativePending) || syncStatus === 'syncing'}>{syncStatus === 'syncing' ? 'Syncing…' : 'Retry now'}</button></div></div>
          {queueOpen && <div className="sync-queue-details"><div className="settings-row-title">Pending local changes <button type="button" className="button button-quiet" onClick={() => setQueueOpen(false)}>Close</button></div>{queue.length ? queue.map((item) => <div className="sync-queue-item" key={`${item.store}:${item.id}`}><strong>{item.store}</strong><span>{item.deleted ? 'Deletion waiting to sync' : 'Change waiting to sync'} · {new Date(item.updatedAt).toLocaleString()}</span></div>) : <p className="muted small">No queued changes remain.</p>}</div>}
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
      {(pending > 0 || nativePending > 0) && <div className="sync-queue-card" role="status"><div><strong>{pending + nativePending}</strong><span>{nativePending ? `${nativePending} local desktop retry${nativePending === 1 ? '' : 'ies'} pending` : 'local changes waiting for sync'}</span></div><button className="button button-quiet" type="button" onClick={async () => { await flushNativeMirrorFailures(); void syncNow?.(); refresh(); toast('Local recovery retry requested.') }}>Retry now</button></div>}
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
  const [fontQuery, setFontQuery] = useState('')
  const [fontFilter, setFontFilter] = useState('all')
  const themes = [
    ['light', 'Parchment', '#f4efe5', '#27221d'], ['sandstone', 'Sandstone', '#d8c0a2', '#3c2d22'],
    ['dark', 'Moonlight', '#17161c', '#e8e0d5'], ['ember', 'Ember', '#211713', '#f0c7a3'],
    ['moss', 'Moss', '#142019', '#d9e5d4'], ['midnight', 'Midnight', '#121225', '#dddaf5'], ['amoled', 'AMOLED', '#000', '#f4f4f4'],
  ]

  const renderFontShelf = (fonts, kind) => {
    const query = fontQuery.trim().toLowerCase()
    const filteredFonts = (fonts || []).filter((font) => {
      const label = String(font.label || font.family).toLowerCase()
      const family = String(font.family || '').toLowerCase()
      const haystack = `${label} ${family}`
      const matchesQuery = !query || haystack.includes(query)
      const matchesFilter = fontFilter === 'all' || String(font.category || font.kind || '').toLowerCase().includes(fontFilter)
      return matchesQuery && matchesFilter
    })
    const grouped = (Object.entries(
      ((filteredFonts || []) as Array<any>).reduce((acc: Record<string, any[]>, font: any) => {
        const groupKey = font.group || (kind === 'custom' ? 'Custom' : 'System')
        if (!acc[groupKey]) acc[groupKey] = []
        acc[groupKey].push(font)
        return acc
      }, {} as Record<string, any[]>)) as Array<[string, any[]]>
    ).sort(([left], [right]) => left.localeCompare(right))

    return grouped.map(([group, items]) => (
      <div className="font-shelf-group" key={`${kind}-${group}`}>
        <div className="font-shelf-group-label">{group}</div>
        <div className="font-shelf-list">
          {(items || []).map((font) => (
            <div key={`${kind}-${font.id || font.family}-${font.label || font.family}`} className="font-shelf-row" style={{ fontFamily: font.family }}>
              <div className="font-shelf-preview" title={font.label || font.family}>Aa</div>
              <div className="font-shelf-name"><strong>{font.label || font.family}</strong><small>{font.kind || (kind === 'custom' ? 'Installed' : 'Available on this device')}</small></div>
              <div className="font-shelf-meta">
                {kind === 'custom' && (
                  <button type="button" className="font-shelf-remove" onClick={() => deleteCustomFont(font)} aria-label={`Remove ${font.label || font.family}`}>
                    <Icon icon="fa-solid fa-xmark" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    ))
  }

  const supabaseReady = isSupabaseConfigured()

  return (
    <section className="settings-panel">
      <div className="settings-panel-kicker">Look &amp; feel</div>
      <h2>Appearance</h2>
      <p className="muted">Shape the entire studio—from its atmosphere to how compact and tactile every control feels.</p>
      <div className="settings-subheading">Studio theme</div>
      <div className="theme-choice-grid">
        {themes.map(([value, label, bg, ink]) => <button key={value} className={`theme-choice ${(settings.theme || 'light') === value ? 'active' : ''}`} onClick={() => updateSettings({ theme: value })} aria-pressed={(settings.theme || 'light') === value}><span className="theme-choice-preview" style={{ background: bg, color: ink }}><i /><i /><i /></span><span>{label}</span>{(settings.theme || 'light') === value && <Icon icon="fa-solid fa-check" />}</button>)}
        <button type="button" className={`theme-choice theme-choice-custom ${(settings.theme || 'light') === 'custom' ? 'active' : ''}`} onClick={() => updateSettings({ theme: 'custom' })} aria-pressed={(settings.theme || 'light') === 'custom'}>
          <span className="theme-choice-preview" style={{ background: `linear-gradient(135deg, ${settings.customGradientStart || '#17161c'}, ${settings.customGradientEnd || '#3b2b22'})`, color: settings.accentColor === 'blue' ? '#9bb8d4' : '#d8b878' }}><i /><i /><i /></span>
          <span>Custom theme</span>{(settings.theme || 'light') === 'custom' && <Icon icon="fa-solid fa-check" />}
        </button>
      </div>

      <div className="settings-subheading">Custom theme colours</div>
      <p className="settings-row-sub">Build a personal studio atmosphere. The live preview updates as you choose each colour.</p>
      <div className="custom-gradient-card">
        <div className="custom-gradient-preview" style={{ background: `linear-gradient(135deg, ${settings.customGradientStart || '#17161c'}, ${settings.customGradientEnd || '#3b2b22'})` }}><span>MoonScribe</span><small>Custom studio preview</small></div>
        <div className="custom-gradient-controls">
          <label>Start<input type="color" value={settings.customGradientStart || '#17161c'} onChange={(event) => updateSettings({ customGradientStart: event.target.value })} /></label>
          <label>End<input type="color" value={settings.customGradientEnd || '#3b2b22'} onChange={(event) => updateSettings({ customGradientEnd: event.target.value })} /></label>
          <button type="button" className="button button-secondary" onClick={() => updateSettings({ customGradientStart: '', customGradientEnd: '' })}>Reset</button>
        </div>
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
      <div className="font-browser-toolbar">
        <label className="font-browser-search"><Icon icon="fa-solid fa-magnifying-glass" /><input value={fontQuery} onChange={(event) => setFontQuery(event.target.value)} placeholder="Search installed fonts" aria-label="Search installed fonts" /></label>
        <div className="font-filter-chips" role="group" aria-label="Filter fonts">
          {['all', 'serif', 'sans', 'mono'].map((filter) => <button type="button" key={filter} className={fontFilter === filter ? 'active' : ''} onClick={() => setFontFilter(filter)}>{filter === 'all' ? 'All fonts' : filter[0].toUpperCase() + filter.slice(1)}</button>)}
        </div>
      </div>
      {supabaseReady && <div className="settings-status-pill safe" style={{ marginBottom: 14 }}>Supabase ready</div>}
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
      <div className="font-shelf">
        {renderFontShelf((systemFonts || []).sort((a, b) => String(a.label || a.family).localeCompare(String(b.label || b.family))), 'system')}
        {!systemFonts?.length && <span className="muted small">No system fonts detected yet.</span>}
      </div>

      <div className="settings-row">
        <div>
          <div className="settings-row-title">Installed custom fonts</div>
          <div className="settings-row-sub">These are stored locally with your MoonScribe data.</div>
        </div>
      </div>
      <div className="font-shelf">
        {renderFontShelf((customFonts || []).sort((a, b) => String(a.label || a.family).localeCompare(String(b.label || b.family))), 'custom')}
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

      <div className="settings-row"><div><div className="settings-row-title">Interface scale</div><div className="settings-row-sub">Resize navigation, dialogs, buttons and labels throughout MoonScribe.</div></div><Select ariaLabel="Interface scale" width={150} value={String(settings.interfaceScale || 100)} onChange={(v) => updateSettings({ interfaceScale: Number(v) })} options={[{ value: '90', label: '90%', hint: 'compact' }, { value: '100', label: '100%', hint: 'default' }, { value: '110', label: '110%', hint: 'large' }, { value: '120', label: '120%', hint: 'largest' }]} /></div>
      <div className="settings-row"><div><div className="settings-row-title">Control density</div><div className="settings-row-sub">Choose how much information fits on screen.</div></div><Select ariaLabel="Control density" width={160} value={settings.interfaceDensity || 'comfortable'} onChange={(v) => updateSettings({ interfaceDensity: v })} options={[{ value: 'compact', label: 'Compact' }, { value: 'comfortable', label: 'Comfortable' }, { value: 'spacious', label: 'Spacious' }]} /></div>
      <div className="settings-row"><div><div className="settings-row-title">Corner style</div><div className="settings-row-sub">Change the visual character of cards, menus and controls.</div></div><Select ariaLabel="Corner style" width={160} value={settings.cornerStyle || 'rounded'} onChange={(v) => updateSettings({ cornerStyle: v })} options={[{ value: 'square', label: 'Precise' }, { value: 'rounded', label: 'Rounded' }, { value: 'soft', label: 'Extra soft' }]} /></div>
      <div className="settings-subheading">Text effects</div>
      <div className="settings-section-card effects-card">
        <div className="effects-card-intro"><strong>Keep the page calm</strong><small>Choose how much visual texture MoonScribe adds around your writing.</small></div>
        <div className="settings-row"><div><div className="settings-row-title">Paper texture</div><div className="settings-row-sub">A subtle grain behind pages and previews.</div></div><Toggle checked={!!settings.paperTexture} onChange={(v) => updateSettings({ paperTexture: v })} /></div>
        <div className="settings-row"><div><div className="settings-row-title">Decorative effects</div><div className="settings-row-sub">Keep glow, ornaments and atmospheric accents.</div></div><Toggle checked={!settings.simplifiedDecorations} onChange={(v) => updateSettings({ simplifiedDecorations: !v })} /></div>
      </div>
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

function Keybinds({ settings, updateSettings }) {
  const bindings = keybindsWithDefaults(settings.keybinds)
  const conflicts = keybindConflicts(bindings)
  const [recording, setRecording] = useState('')
  const setBinding = (id, value) => updateSettings({ keybinds: { ...bindings, [id]: value } })
  return <section className="settings-panel"><h2>Keybinds</h2><p className="muted">Choose shortcuts that fit your hands. Click a shortcut, then press the keys you want to use.</p><div className="keybind-grid">{Object.entries(KEYBIND_LABELS).map(([id, action]) => <div className={`keybind-row ${conflicts.has(id) ? 'keybind-conflict' : ''}`} key={id}><span><strong>{action}</strong>{conflicts.has(id) && <small>Shortcut conflicts with another action.</small>}</span><button type="button" className="keybind-editor" onClick={() => setRecording(id)}>{recording === id ? 'Press keys…' : formatKeybind(bindings[id])}</button>{recording === id && <input autoFocus className="keybind-capture" aria-label={`New shortcut for ${action}`} onKeyDown={(event) => { event.preventDefault(); if (event.key === 'Escape') { setRecording(''); return } const value = event.key === 'Backspace' ? '' : keybindFromEvent(event); if (value) { setBinding(id, value); setRecording('') } }} />}</div>)}</div><div className="keybind-actions"><button className="button button-secondary" type="button" onClick={() => updateSettings({ keybinds: { ...DEFAULT_KEYBINDS } })}>Restore defaults</button><span className="muted small">Shortcuts use Ctrl on Windows/Linux and Command on macOS.</span></div></section>
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
  const [nativeBackups, setNativeBackups] = useState<string[]>([])
  const [selectedNativeBackup, setSelectedNativeBackup] = useState('')
  const [restoringNative, setRestoringNative] = useState(false)
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
  const restoreDesktopBackup = useCallback(async (path) => {
    try {
      const data = JSON.parse(new TextDecoder().decode(await readDesktopFile(path)))
      if (isEncryptedBackup(data)) {
        const pass = window.prompt('This backup is encrypted. Enter its passphrase to unlock.')
        if (pass === null) return
        await importBackup(await decryptJSON(data, pass))
      } else await importBackup(data)
      await refreshNovels()
      toast('Everything restored. Welcome back.')
    } catch (err) { toast(err?.message?.includes('passphrase') ? err.message : 'That file didn\'t look right — nothing changed.') }
  }, [refreshNovels, toast])

  useEffect(() => {
    const consume = () => {
      const path = takePendingDesktopBackup()
      if (path) void restoreDesktopBackup(path)
    }
    consume()
    window.addEventListener('moonscribe:desktop-files-opened', consume)
    return () => window.removeEventListener('moonscribe:desktop-files-opened', consume)
  }, [restoreDesktopBackup])
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

  const loadNativeBackups = async () => {
    const backups = await listNativeBackups()
    setNativeBackups(backups)
    setSelectedNativeBackup((current) => current && backups.includes(current) ? current : backups[0] || '')
  }

  const restoreNative = async () => {
    if (!selectedNativeBackup || restoringNative) return
    if (!window.confirm(`Restore the desktop database from ${selectedNativeBackup}? MoonScribe will make a safety copy before replacing the current native database.`)) return
    setRestoringNative(true)
    try {
      await restoreNativeStorage(selectedNativeBackup)
      toast('Desktop database restored. MoonScribe will reload now.')
      window.setTimeout(() => window.location.reload(), 450)
    } catch (err) {
      toast(err?.message || 'Could not restore the desktop database.')
    } finally { setRestoringNative(false) }
  }

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
      {capabilities.desktop && <>
        <div className="settings-row-title" style={{ marginTop: 'var(--space-5)' }}>Desktop database snapshots</div>
        <p className="muted small" style={{ margin: '4px 0 10px' }}>Native snapshots are created before desktop updates and can be restored without selecting arbitrary files.</p>
        <div className="actions-row" style={{ flexWrap: 'wrap' }}>
          <button className="button button-ghost" onClick={() => void loadNativeBackups()}>Find desktop snapshots</button>
          {nativeBackups.length > 0 && <Select ariaLabel="Desktop database snapshot" width={260} value={selectedNativeBackup} onChange={setSelectedNativeBackup} options={nativeBackups.map((name) => ({ value: name, label: name }))} />}
          {nativeBackups.length > 0 && <button className="button button-secondary" disabled={!selectedNativeBackup || restoringNative} onClick={() => void restoreNative()}>{restoringNative ? 'Restoring…' : 'Restore snapshot'}</button>}
        </div>
      </>}

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
