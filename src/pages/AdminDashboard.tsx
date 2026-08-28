import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import * as syncEngine from '../sync/engine'
import Select from '../components/Select'
import { useContextMenu } from '../components/ContextMenu'
import { markdownToAnnouncementHtml, sanitizeAnnouncementHtml } from '../utils/announcementMarkup'
import '../styles/admin.css'
import '../styles/admin-audit.css'
import '../styles/admin-flags.css'
import '../styles/admin-rich.css'

type AdminUser = { id: string; username: string; email?: string | null; avatarUrl?: string | null; roles: string[]; disabledAt?: number | null; createdAt?: number; emailVerified?: boolean; twoFactorEnabled?: boolean; online?: boolean; lastSeenAt?: number | null }
type Health = { online?: boolean; emailDelivery?: boolean }
type FeatureFlag = {
  key: string
  label: string
  enabled: boolean
  rollout: number
  updatedAt: number
}
type AuditEvent = {
  id: number
  actor: string
  action: string
  target?: string
  detail: string
  createdAt: number
}
type Announcement = { id: string; title: string; body: string; severity: string; published?: boolean; createdAt: number; created_by?: string }
const roleFor = (roles: string[]) =>
  roles.includes('admin') ? 'admin' : roles.includes('developer') ? 'developer' : 'user'

function AdminUserProfile({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  return <section className="admin-user-profile" aria-label={`Profile for ${user.username}`}>
    <header><div><span className={`admin-status-dot large ${user.online ? 'online' : 'offline'}`} /><div><h3>{user.username}</h3><p>{user.online ? 'Online now' : user.lastSeenAt ? `Last seen ${new Date(user.lastSeenAt).toLocaleString()}` : 'Offline'}</p></div></div><button type="button" onClick={onClose} aria-label="Close profile">×</button></header>
    <div className="admin-profile-grid"><div><small>User ID</small><strong>{user.id}</strong></div><div><small>Email</small><strong>{user.email || 'Not attached'}</strong></div><div><small>Role</small><strong>{roleFor(user.roles)}</strong></div><div><small>All roles</small><strong>{user.roles.join(', ')}</strong></div><div><small>Created</small><strong>{user.createdAt ? new Date(user.createdAt).toLocaleString() : 'Unknown'}</strong></div><div><small>Email verification</small><strong>{user.emailVerified ? 'Verified' : 'Not verified'}</strong></div><div><small>Two-factor authentication</small><strong>{user.twoFactorEnabled ? 'Enabled' : 'Disabled'}</strong></div><div><small>Account state</small><strong>{user.disabledAt ? 'Disabled' : 'Active'}</strong></div></div>
  </section>
}

export default function AdminDashboard() {
  const app = useApp() as any
  const [section, setSection] = useState('Dashboard')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [health, setHealth] = useState<Health | null>(null)
  const [audit, setAudit] = useState<AuditEvent[]>([])
  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [query, setQuery] = useState('')
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const isAdmin = Boolean(app.hasRole?.('admin'))
  const { openContextMenu } = useContextMenu()
  const [expandedAudit, setExpandedAudit] = useState<number | null>(null)
  const [auditFilter, setAuditFilter] = useState('all')
  const [announcementTitle, setAnnouncementTitle] = useState('')
  const [announcementBody, setAnnouncementBody] = useState('')
  const [announcementMode, setAnnouncementMode] = useState<'visual' | 'markdown' | 'html'>('visual')
  const [announcementSeverity, setAnnouncementSeverity] = useState('info')
  const [publishingAnnouncement, setPublishingAnnouncement] = useState(false)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])

  useEffect(() => {
    if (!isAdmin) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const cfg = await syncEngine.getConfig()
        if (!cfg.server || !cfg.token) throw new Error('No authenticated server session.')
        const base = cfg.server.replace(/\/+$/, '')
        const [usersResponse, healthResponse, auditResponse, flagsResponse, announcementsResponse] = await Promise.all([
          fetch(`${base}/api/admin/users`, { headers: { Authorization: `Bearer ${cfg.token}` } }),
          fetch(`${base}/api/auth/status`),
          fetch(`${base}/api/admin/audit`, { headers: { Authorization: `Bearer ${cfg.token}` } }),
          fetch(`${base}/api/admin/feature-flags`, {
            headers: { Authorization: `Bearer ${cfg.token}` },
          }),
          fetch(`${base}/api/admin/announcements`, { headers: { Authorization: `Bearer ${cfg.token}` } }),
        ])
        const userPayload = await usersResponse.json().catch(() => ({}))
        const healthPayload = await healthResponse.json().catch(() => ({}))
        const auditPayload = await auditResponse.json().catch(() => ({}))
        const flagsPayload = await flagsResponse.json().catch(() => ({}))
        const announcementsPayload = await announcementsResponse.json().catch(() => ({}))
        if (!usersResponse.ok) throw new Error(userPayload.error || 'Could not load users.')
        if (!cancelled) {
          setUsers(userPayload.users || [])
          setHealth(healthPayload)
          setAudit(auditPayload.events || [])
          setFlags(flagsPayload.flags || [])
          setAnnouncements(announcementsPayload.announcements || [])
        }
      } catch (error: any) {
        if (!cancelled) setMessage(error.message || 'Could not load admin data.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    const refreshTimer = window.setInterval(() => { void load() }, 15000)
    return () => {
      cancelled = true
      window.clearInterval(refreshTimer)
    }
  }, [isAdmin])

  const filteredUsers = useMemo(
    () =>
      users.filter((user) =>
        `${user.username} ${user.email || ''}`.toLowerCase().includes(query.toLowerCase())
      ),
    [users, query]
  )
  const updateRole = async (userId: string, role: string) => {
    const cfg = await syncEngine.getConfig()
    if (!cfg.server || !cfg.token) return
    const roles =
      role === 'admin'
        ? ['user', 'admin']
        : role === 'developer'
          ? ['user', 'developer']
          : role === 'beta_tester'
            ? ['user', 'beta_tester']
            : ['user']
    const response = await fetch(
      `${cfg.server.replace(/\/+$/, '')}/api/admin/users/${userId}/roles`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.token}` },
        body: JSON.stringify({ roles }),
      }
    )
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      setMessage(payload.error || 'Could not update role.')
      return
    }
    setUsers((current) => current.map((user) => (user.id === userId ? { ...user, roles } : user)))
    setMessage('Role updated.')
  }
  const deleteUser = async (user: AdminUser) => {
    if (user.roles.includes('admin')) { setMessage('Administrator accounts cannot be deleted.'); return }
    const confirmation = window.prompt(`Permanently delete ${user.username} and all writing owned by this account?\n\nType ${user.username} to confirm.`)
    if (confirmation === null) return
    if (confirmation.trim().toLowerCase() !== user.username.toLowerCase()) { setMessage(`Deletion cancelled: type ${user.username} exactly.`); return }
    const cfg = await syncEngine.getConfig()
    if (!cfg.server || !cfg.token) return
    const response = await fetch(`${cfg.server.replace(/\/+$/, '')}/api/admin/users/${user.id}/delete`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.token}` }, body: JSON.stringify({ confirmation }) })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) { setMessage(payload.error || 'Could not delete the account.'); return }
    setUsers((current) => current.filter((item) => item.id !== user.id))
    setMessage(`${user.username} and their owned data were permanently deleted.`)
  }
  const toggleDisabled = async (user: AdminUser) => {
    if (user.roles.includes('admin')) { setMessage('Administrator accounts cannot be disabled.'); return }
    const cfg = await syncEngine.getConfig()
    if (!cfg.server || !cfg.token) return
    const action = user.disabledAt ? 'enable' : 'disable'
    const response = await fetch(`${cfg.server.replace(/\/+$/, '')}/api/admin/users/${user.id}/${action}`, { method: 'POST', headers: { Authorization: `Bearer ${cfg.token}` } })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) { setMessage(payload.error || `Could not ${action} the account.`); return }
    setUsers((current) => current.map((item) => item.id === user.id ? { ...item, disabledAt: action === 'disable' ? Date.now() : null } : item))
    setMessage(`${user.username} ${action === 'disable' ? 'disabled' : 'restored'}.`)
  }

  const updateFlag = async (flag: FeatureFlag) => {
    const cfg = await syncEngine.getConfig()
    if (!cfg.server || !cfg.token) return
    const response = await fetch(`${cfg.server.replace(/\/+$/, '')}/api/admin/feature-flags/${flag.key}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.token}` }, body: JSON.stringify({ enabled: !flag.enabled, rollout: flag.rollout }) })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) { setMessage(payload.error || 'Could not update feature flag.'); return }
    setFlags((current) => current.map((item) => item.key === flag.key ? { ...item, enabled: payload.enabled, rollout: payload.rollout } : item))
    setMessage(`${flag.label} ${payload.enabled ? 'enabled' : 'disabled'}.`)
  }
  const publishAnnouncement = async (event: FormEvent) => {
    event.preventDefault()
    const cfg = await syncEngine.getConfig()
    if (!cfg.server || !cfg.token) return
    setPublishingAnnouncement(true)
    try {
      const response = await fetch(`${cfg.server.replace(/\/+$/, '')}/api/admin/announcements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.token}` },
        body: JSON.stringify({ title: announcementTitle, body: sanitizeAnnouncementHtml(announcementMode === 'markdown' ? markdownToAnnouncementHtml(announcementBody) : announcementBody), severity: announcementSeverity }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Could not publish announcement.')
      setAnnouncementTitle('')
      setAnnouncementBody('')
      setAnnouncementMode('visual')
      setAnnouncementSeverity('info')
      setMessage('Announcement published.')
      setSection('Dashboard')
    } catch (error: any) {
      setMessage(error.message || 'Could not publish announcement.')
    } finally {
      setPublishingAnnouncement(false)
    }
  }
  const deleteAnnouncement = async (item: Announcement) => {
    const cfg = await syncEngine.getConfig()
    if (!cfg.server || !cfg.token || !window.confirm(`Delete “${item.title}”?`)) return
    const response = await fetch(`${cfg.server.replace(/\/+$/, '')}/api/admin/announcements/${item.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${cfg.token}` } })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) { setMessage(payload.error || 'Could not delete announcement.'); return }
    setAnnouncements((current) => current.filter((announcement) => announcement.id !== item.id))
    setMessage('Announcement deleted.')
  }
  const visibleAudit = audit.filter((event) => auditFilter === 'all' || event.action === auditFilter)
  const auditActions = [...new Set(audit.map((event) => event.action))]
  const auditMenu = (event: MouseEvent, item: AuditEvent) => openContextMenu(event, [
    { label: expandedAudit === item.id ? 'Collapse details' : 'Show details', icon: 'fa-solid fa-chevron-down', onClick: () => setExpandedAudit((current) => current === item.id ? null : item.id) },
    { label: 'Copy event detail', icon: 'fa-solid fa-copy', onClick: () => navigator.clipboard?.writeText(`${item.actor} ${item.detail} · ${new Date(item.createdAt).toISOString()}`) },
    'divider',
    { label: 'Filter to this action', icon: 'fa-solid fa-filter', onClick: () => setAuditFilter(item.action) },
  ])

  if (!isAdmin)
    return (
      <main className="admin-page">
        <div className="admin-shell">
          <Link className="admin-back" to="/dashboard">
            ← Back to studio
          </Link>
          <section className="admin-hero">
            <span className="admin-kicker">MoonScribe access</span>
            <h1>Admin access required.</h1>
            <p>Your account does not have the server-enforced Admin role.</p>
            <Link className="button button-primary" to="/dashboard">
              Return to studio
            </Link>
          </section>
        </div>
      </main>
    )

  const nav = [
    ['Dashboard', 'Overview'],
    ['Users', 'People'],
    ['Health', 'System'],
    ['Audit log', 'System'],
    ['Feature flags', 'Releases'],
    ['Announcements', 'Releases'],
  ]
  const healthy = health?.online !== false
  return (
    <main className="admin-console">
      <aside className="admin-sidebar">
        <Link to="/dashboard" className="admin-brand">
          MoonScribe <span>Admin</span>
        </Link>
        {['Overview', 'People', 'System', 'Releases'].map((group) => (
          <div className="admin-nav-group" key={group}>
            <small>{group}</small>
            {nav
              .filter(([, sectionName]) => sectionName === group)
              .map(([label]) => (
                <button
                  key={label}
                  className={section === label ? 'active' : ''}
                  onClick={() => setSection(label)}
                >
                  {label}
                </button>
              ))}
          </div>
        ))}
        <Link className="admin-back-link" to="/dashboard">
          ← Return to studio
        </Link>
      </aside>
      <section className="admin-main">
        <header className="admin-topbar">
          <div>
            <span className="admin-kicker">MoonScribe control room</span>
            <h1>{section}</h1>
          </div>
          <div className="admin-environment">
            <span className={`admin-env-dot ${/moonscribe\.cc$/i.test(app.syncServer || '') ? 'production' : ''}`} />
            {/moonscribe\.cc$/i.test(app.syncServer || '') ? 'PRODUCTION' : 'LOCAL / STAGING'} <b>Admin verified</b>
          </div>
        </header>
        {message && <div className="admin-notice">{message}</div>}
        {section === 'Dashboard' && (
          <>
            <div className="admin-welcome" onContextMenu={(event) => openContextMenu(event, [
              { label: 'Refresh admin data', icon: 'fa-solid fa-rotate', onClick: () => window.location.reload() },
              { label: 'Open audit log', icon: 'fa-solid fa-list-check', onClick: () => setSection('Audit log') },
            ])}>
              <div>
                <h2>Good evening, {app.syncUsername || 'Admin'}</h2>
                <p>MoonScribe service overview based on the connected server.</p>
              </div>
              <span className={`admin-health-dot ${healthy ? 'healthy' : 'critical'}`}>
                {healthy ? 'System healthy' : 'System unavailable'}
              </span>
            </div>
            <div className="admin-metric-grid">
              <div>
                <small>Total users</small>
                <strong>{loading ? '—' : users.length}</strong>
              </div>
              <div>
                <small>Admins</small>
                <strong>
                  {loading ? '—' : users.filter((u) => u.roles.includes('admin')).length}
                </strong>
              </div>
              <div>
                <small>API</small>
                <strong>{health ? (health.online ? 'Healthy' : 'Offline') : '—'}</strong>
              </div>
              <div>
                <small>Resend</small>
                <strong>
                  {health ? (health.emailDelivery ? 'Configured' : 'Not configured') : '—'}
                </strong>
              </div>
            </div>
            <div className="admin-commandbar">
              <div><span>OPERATIONS SNAPSHOT</span><strong>{users.length ? `${users.filter((user) => user.online).length} active writers online` : 'Loading account activity'}</strong></div>
              <div className="admin-mini-bars" aria-label="User activity visualisation">{[28, 46, 38, 62, 52, 78, 66, 88, 74, 94].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div>
              <button className="button button-quiet" onClick={() => setSection('Users')}>Manage people <span>→</span></button>
            </div>
            <div className="admin-panel-grid">
              <article className="admin-panel" onContextMenu={(event) => openContextMenu(event, [{ label: 'Open Health', icon: 'fa-solid fa-heart-pulse', onClick: () => setSection('Health') }])}>
                <h3>System health</h3>
                <p>Live checks from the account service.</p>
                <div className="health-list">
                  <span>
                    API <b>{health?.online ? 'Healthy' : 'Unknown'}</b>
                  </span>
                  <span>
                    Authentication <b>{health?.online ? 'Healthy' : 'Unknown'}</b>
                  </span>
                  <span>
                    Resend <b>{health?.emailDelivery ? 'Configured' : 'Not configured'}</b>
                  </span>
                </div>
              </article>
              <article className="admin-panel" onContextMenu={(event) => openContextMenu(event, [{ label: 'Open full audit log', icon: 'fa-solid fa-list-check', onClick: () => setSection('Audit log') }])}>
                <h3>Recent activity</h3>
                <div className="admin-audit-list">
                  {audit.length ? (
                    audit.slice(0, 6).map((event) => (
                      <div className="admin-audit-item" key={event.id}>
                        <span className="admin-audit-icon">
                          <i className="fa-solid fa-users-gear" />
                        </span>
                        <div>
                          <strong>
                            {event.actor} {event.detail.toLowerCase()}
                          </strong>
                          <small>{new Date(event.createdAt).toLocaleString()}</small>
                        </div>
                        <b>›</b>
                      </div>
                    ))
                  ) : (
                    <span className="admin-muted">No recorded admin activity yet.</span>
                  )}
                </div>
              </article>
            </div>
          </>
        )}
        {section === 'Users' && (
          <article className="admin-panel admin-users">
            <div className="admin-panel-heading">
              <div>
                <h2>Users</h2>
                <p>Manage server accounts and roles.</p>
              </div>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search users…"
                aria-label="Search users"
              />
            </div>
            <div className="admin-table">
              <div className="admin-table-head">
                <span>User</span>
                <span>Role</span>
                <span>Account</span>
                <span>Actions</span>
              </div>
              {loading ? (
                <p className="admin-muted">Loading users…</p>
              ) : (
                filteredUsers.map((user) => (
                  <div className="admin-table-row" key={user.id} onContextMenu={(event) => openContextMenu(event, [
                    { label: 'Copy username', icon: 'fa-solid fa-copy', onClick: () => navigator.clipboard?.writeText(user.username) },
                    { label: 'Set as Beta Tester', icon: 'fa-solid fa-flask', onClick: () => void updateRole(user.id, 'beta_tester') },
                    { label: 'Set as Admin', icon: 'fa-solid fa-shield-halved', onClick: () => void updateRole(user.id, 'admin') },
                    ...(!user.roles.includes('admin') ? [{ label: user.disabledAt ? 'Restore account' : 'Disable account', icon: user.disabledAt ? 'fa-solid fa-unlock' : 'fa-solid fa-ban', onClick: () => void toggleDisabled(user) }] : []),
                    ...(!user.roles.includes('admin') ? ['divider' as const, { label: 'Delete user permanently', icon: 'fa-solid fa-trash', danger: true, onClick: () => void deleteUser(user) }] : []),
                  ])}>
                    <span className="admin-user-identity">
                      <button type="button" className="admin-profile-trigger" onClick={() => setSelectedUser(user)}>
                        {user.avatarUrl ? <img className="admin-user-avatar" src={user.avatarUrl} alt="" /> : <span className="admin-user-avatar admin-user-avatar-fallback" aria-hidden="true">{user.username.slice(0, 1).toUpperCase()}</span>}
                        <strong>{user.username}</strong>
                      </button>
                      <small>{user.email || 'No email attached'}</small>
                    </span>
                    <span className={`admin-role role-${roleFor(user.roles)}`}>
                      {roleFor(user.roles)}
                    </span>
                    <span className={user.disabledAt ? 'admin-disabled-status' : ''}>{user.disabledAt ? 'Disabled' : 'Connected'}</span>
                    <div className="admin-user-actions"><Select
                      value={roleFor(user.roles)}
                      onChange={(value) => updateRole(user.id, value)}
                      ariaLabel={`Role for ${user.username}`}
                      width={150}
                      options={[
                        { value: 'user', label: 'User' },
                        { value: 'developer', label: 'Developer' },
                        { value: 'beta_tester', label: 'Beta Tester' },
                        { value: 'admin', label: 'Admin' },
                      ]}
                      popClassName="admin-role-menu"
                    />{!user.roles.includes('admin') && <><button type="button" className="admin-disable-user" onClick={() => void toggleDisabled(user)} aria-label={`${user.disabledAt ? 'Restore' : 'Disable'} ${user.username}`} title={`${user.disabledAt ? 'Restore' : 'Disable'} account`}><i className={`fa-solid ${user.disabledAt ? 'fa-unlock' : 'fa-ban'}`} /></button><button type="button" className="admin-delete-user" onClick={() => void deleteUser(user)} aria-label={`Delete ${user.username}`} title="Delete user permanently"><i className="fa-solid fa-trash" /></button></>}</div>
                  </div>
                ))
              )}
            </div>
            {selectedUser && <AdminUserProfile user={selectedUser} onClose={() => setSelectedUser(null)} />}
          </article>
        )}
        {section === 'Audit log' && (
          <article className="admin-panel admin-audit-page">
            <div className="admin-panel-heading">
              <div>
                <h2>Audit log</h2>
                <p>Persisted administrative actions from the account service.</p>
              </div>
            </div>
            <div className="admin-audit-filters">
              <Select value={auditFilter} onChange={setAuditFilter} ariaLabel="Filter audit actions" width={210} options={[{ value: 'all', label: 'All actions' }, ...auditActions.map((action) => ({ value: action, label: action }))]} />
              {auditFilter !== 'all' && <button className="button button-quiet" onClick={() => setAuditFilter('all')}>Clear filter</button>}
            </div>
            {visibleAudit.length ? (
              visibleAudit.map((event) => (
                <div className={`admin-audit-item ${expandedAudit === event.id ? 'expanded' : ''}`} key={event.id} onClick={() => setExpandedAudit((current) => current === event.id ? null : event.id)} onContextMenu={(e) => auditMenu(e, event)}>
                  <span className="admin-audit-icon">
                    <i className="fa-solid fa-shield-halved" />
                  </span>
                  <div>
                    <strong>
                      {event.actor} {event.detail.toLowerCase()}
                    </strong>
                    <small>{new Date(event.createdAt).toLocaleString()}</small>
                  </div>
                  <b>{expandedAudit === event.id ? '⌄' : '›'}</b>
                  {expandedAudit === event.id && <div className="admin-audit-details"><span><b>Action</b> {event.action}</span><span><b>Actor</b> {event.actor}</span><span><b>Target</b> {event.target || '—'}</span><span><b>Recorded</b> {new Date(event.createdAt).toISOString()}</span><span><b>Detail</b> {event.detail}</span></div>}
                </div>
              ))
            ) : (
              <span className="admin-muted">No recorded admin activity yet.</span>
            )}
          </article>
        )}
        {section === 'Feature flags' && (
          <article className="admin-panel admin-placeholder">
            <span className="admin-kicker">Feature flags</span>
            <h2>Feature flags</h2>
            <p>Live flags stored by the account service. Changes are audited.</p>
            <div className="admin-flag-list">{flags.map((flag) => <div className="admin-flag-row" key={flag.key} onContextMenu={(event) => openContextMenu(event, [{ label: flag.enabled ? 'Disable flag' : 'Enable flag', icon: 'fa-solid fa-toggle-on', onClick: () => void updateFlag(flag) }, { label: 'Copy flag key', icon: 'fa-solid fa-copy', onClick: () => navigator.clipboard?.writeText(flag.key) }])}><div><strong>{flag.label}</strong><small>{flag.key} · rollout {flag.rollout}%</small></div><Select value={flag.enabled ? 'on' : 'off'} onChange={() => updateFlag(flag)} ariaLabel={`Toggle ${flag.label}`} width={150} options={[{ value: 'on', label: 'Enabled' }, { value: 'off', label: 'Disabled' }]} /></div>)}</div>
          </article>
        )}
        {section === 'Announcements' && (
          <article className="admin-panel admin-announcement-panel">
            <span className="admin-kicker">Communications</span>
            <h2>Publish announcement</h2>
            <p>Post a server-backed message for signed-in MoonScribe writers.</p>
            <form className="admin-announcement-form" onSubmit={publishAnnouncement}>
              <label>Title<input value={announcementTitle} onChange={(event) => setAnnouncementTitle(event.target.value)} maxLength={160} required placeholder="A short update for writers" /></label>
              <div className="admin-rich-editor">
                <div className="admin-rich-tabs" role="tablist" aria-label="Announcement editor mode">
                  {(['visual', 'markdown', 'html'] as const).map((mode) => <button type="button" key={mode} className={announcementMode === mode ? 'active' : ''} onClick={() => setAnnouncementMode(mode)}>{mode === 'visual' ? 'Visual' : mode === 'markdown' ? 'Markdown' : 'HTML'}</button>)}
                </div>
                {announcementMode === 'visual' ? <>
                  <div className="admin-rich-toolbar" aria-label="Formatting tools">
                    <button type="button" onClick={() => setAnnouncementBody((value) => `${value}<strong>Bold text</strong>`)}><b>B</b></button>
                    <button type="button" onClick={() => setAnnouncementBody((value) => `${value}<em>Italic text</em>`)}><i>I</i></button>
                    <button type="button" onClick={() => setAnnouncementBody((value) => `${value}<h2>Heading</h2>`)}>H2</button>
                    <button type="button" onClick={() => setAnnouncementBody((value) => `${value}<p>New paragraph</p>`)}>¶</button>
                  </div>
                  <div className="admin-rich-surface" contentEditable suppressContentEditableWarning onInput={(event) => setAnnouncementBody(event.currentTarget.innerHTML)} dangerouslySetInnerHTML={{ __html: announcementBody }} data-placeholder="Write your announcement…" />
                </> : <textarea value={announcementBody} onChange={(event) => setAnnouncementBody(event.target.value)} maxLength={4000} required rows={8} placeholder={announcementMode === 'markdown' ? '# What changed?\n\nUse **bold**, *italic*, and headings.' : '<p>Write your announcement in HTML</p>'} />}
                <div className="admin-rich-preview"><span>Live preview</span><div dangerouslySetInnerHTML={{ __html: sanitizeAnnouncementHtml(announcementMode === 'markdown' ? markdownToAnnouncementHtml(announcementBody) : announcementBody) }} /></div>
              </div>
              <label>Severity<Select value={announcementSeverity} onChange={setAnnouncementSeverity} ariaLabel="Announcement severity" width={190} options={[{ value: 'info', label: 'Information' }, { value: 'success', label: 'Success' }, { value: 'warning', label: 'Warning' }, { value: 'critical', label: 'Critical' }]} /></label>
              <button className="button button-primary" disabled={publishingAnnouncement}>{publishingAnnouncement ? 'Publishing…' : 'Publish announcement'}</button>
            </form>
            <div className="admin-announcement-history"><h3>Published announcements</h3>{announcements.length ? announcements.map((item) => <div className="admin-announcement-item" key={item.id} onContextMenu={(event) => openContextMenu(event, [{ label: 'Delete announcement', icon: 'fa-solid fa-trash', onClick: () => void deleteAnnouncement(item) }])}><div><strong>{item.title}</strong><small>{item.severity} · {new Date(item.createdAt).toLocaleString()}</small><p>{item.body}</p></div><button className="button button-quiet" onClick={() => void deleteAnnouncement(item)} aria-label={`Delete ${item.title}`}><i className="fa-solid fa-trash" /></button></div>) : <span className="admin-muted">No announcements have been published.</span>}</div>
          </article>
        )}
        {section === 'Health' && (
          <article className="admin-panel admin-placeholder">
            <span className="admin-kicker">{section}</span>
            <h2>{section}</h2>
            <p>
              {section === 'Health'
                ? 'Live API and email delivery checks are available on the Overview.'
                : 'This area is reserved for the next server-backed admin capability.'}
            </p>
            <span className="admin-muted">No placeholder data is being presented as real.</span>
          </article>
        )}
      </section>
    </main>
  )
}
