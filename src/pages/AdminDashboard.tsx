import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import * as syncEngine from '../sync/engine'
import Select from '../components/Select'
import UserInspector from '../components/admin/UserInspector'
import { useContextMenu } from '../components/ContextMenu'
import { markdownToAnnouncementHtml, sanitizeAnnouncementHtml } from '../utils/announcementMarkup'
import {
  AdminShell,
  AdminOverview,
  AdminHealthPanel,
  AdminUsersPage,
  AdminAuditPage,
} from '../components/admin/ControlRoom'
import '../styles/admin.css'
import '../styles/admin-audit.css'
import '../styles/admin-flags.css'
import '../styles/admin-rich.css'

type AdminUser = {
  id: string
  username: string
  email?: string | null
  avatarUrl?: string | null
  bannerUrl?: string | null
  displayName?: string | null
  writerName?: string | null
  profileBio?: string | null
  roles: string[]
  disabledAt?: number | null
  createdAt?: number
  emailVerified?: boolean
  twoFactorEnabled?: boolean
  online?: boolean
  lastSeenAt?: number | null
}
type Health = {
  online?: boolean
  emailDelivery?: boolean
  emailAuth?: boolean
  database?: string
  activeSessions?: number
}
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
type Announcement = {
  id: string
  title: string
  body: string
  severity: string
  published?: boolean
  createdAt: number
  created_by?: string
}
type AdminMail = {
  id: string
  direction: 'received' | 'sent'
  sender: string
  recipients: string
  subject: string
  text: string
  html?: string
  status: string
  readAt?: number | null
  createdAt: number
}
const roleFor = (roles: string[]) =>
  roles.includes('admin') ? 'admin' : roles.includes('developer') ? 'developer' : 'user'

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
  const setMessage = (message: string) => app.toast?.(message)
  const isAdmin = Boolean(app.hasRole?.('admin'))
  const { openContextMenu } = useContextMenu()
  const [expandedAudit, setExpandedAudit] = useState<number | null>(null)
  const [auditFilter, setAuditFilter] = useState('all')
  const [announcementTitle, setAnnouncementTitle] = useState('')
  const [announcementBody, setAnnouncementBody] = useState('')
  const [announcementMode, setAnnouncementMode] = useState<'visual' | 'markdown' | 'html'>('visual')
  const announcementEditorRef = useRef<HTMLDivElement | null>(null)
  const [announcementSeverity, setAnnouncementSeverity] = useState('info')
  const [publishingAnnouncement, setPublishingAnnouncement] = useState(false)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [announcementSearch, setAnnouncementSearch] = useState('')
  const [mail, setMail] = useState<AdminMail[]>([])
  const [mailTo, setMailTo] = useState('')
  const [mailSubject, setMailSubject] = useState('')
  const [mailBody, setMailBody] = useState('')
  const [selectedMail, setSelectedMail] = useState<AdminMail | null>(null)
  const [loadError, setLoadError] = useState('')
  const [retry, setRetry] = useState(0)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!isAdmin) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setLoadError('')
      try {
        const cfg = await syncEngine.getConfig()
        if (!cfg.server || !cfg.token) throw new Error('No authenticated server session.')
        const base = cfg.server.replace(/\/+$/, '')
        const [
          usersResponse,
          healthResponse,
          auditResponse,
          flagsResponse,
          announcementsResponse,
          mailResponse,
        ] = await Promise.all([
          fetch(`${base}/api/admin/users`, { headers: { Authorization: `Bearer ${cfg.token}` } }),
          fetch(`${base}/api/auth/status`),
          fetch(`${base}/api/admin/audit`, { headers: { Authorization: `Bearer ${cfg.token}` } }),
          fetch(`${base}/api/admin/feature-flags`, {
            headers: { Authorization: `Bearer ${cfg.token}` },
          }),
          fetch(`${base}/api/admin/announcements`, {
            headers: { Authorization: `Bearer ${cfg.token}` },
          }),
          fetch(`${base}/api/admin/mail`, { headers: { Authorization: `Bearer ${cfg.token}` } }),
        ])
        const userPayload = await usersResponse.json().catch(() => ({}))
        const healthPayload = await healthResponse.json().catch(() => ({}))
        const auditPayload = await auditResponse.json().catch(() => ({}))
        const flagsPayload = await flagsResponse.json().catch(() => ({}))
        const announcementsPayload = await announcementsResponse.json().catch(() => ({}))
        const mailPayload = await mailResponse.json().catch(() => ({}))
        if (!usersResponse.ok) throw new Error(userPayload.error || 'Could not load users.')
        if (!cancelled) {
          setUsers(userPayload.users || [])
          setHealth(healthResponse.ok ? healthPayload : { online: false })
          setLoaded(true)
          const failures = [
            [healthResponse, 'API health'],
            [auditResponse, 'Audit log'],
            [flagsResponse, 'Feature flags'],
            [announcementsResponse, 'Announcements'],
            [mailResponse, 'Email'],
          ]
            .filter(([response]) => !(response as { ok: boolean }).ok)
            .map(([, label]) => label)
          if (failures.length) setLoadError(`Could not refresh: ${failures.join(', ')}.`)
          setAudit(auditPayload.events || [])
          setFlags(flagsPayload.flags || [])
          setAnnouncements(announcementsPayload.announcements || [])
          setMail(mailPayload.messages || [])
        }
      } catch (error: any) {
        if (!cancelled) {
          setLoadError(error.message || 'Could not load admin data.')
          setHealth(null)
          setLoaded(false)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    const refreshTimer = window.setInterval(() => {
      void load()
    }, 15000)
    return () => {
      cancelled = true
      window.clearInterval(refreshTimer)
    }
  }, [isAdmin, retry])

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
    if (user.roles.includes('admin')) {
      setMessage('Administrator accounts cannot be deleted.')
      return
    }
    const confirmation = window.prompt(
      `Permanently delete ${user.username} and all writing owned by this account?\n\nType ${user.username} to confirm.`
    )
    if (confirmation === null) return
    if (confirmation.trim().toLowerCase() !== user.username.toLowerCase()) {
      setMessage(`Deletion cancelled: type ${user.username} exactly.`)
      return
    }
    const cfg = await syncEngine.getConfig()
    if (!cfg.server || !cfg.token) return
    const response = await fetch(
      `${cfg.server.replace(/\/+$/, '')}/api/admin/users/${user.id}/delete`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.token}` },
        body: JSON.stringify({ confirmation }),
      }
    )
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      setMessage(payload.error || 'Could not delete the account.')
      return
    }
    setUsers((current) => current.filter((item) => item.id !== user.id))
    setMessage(`${user.username} and their owned data were permanently deleted.`)
  }
  const toggleDisabled = async (user: AdminUser) => {
    if (user.roles.includes('admin')) {
      setMessage('Administrator accounts cannot be disabled.')
      return
    }
    const cfg = await syncEngine.getConfig()
    if (!cfg.server || !cfg.token) return
    const action = user.disabledAt ? 'enable' : 'disable'
    const response = await fetch(
      `${cfg.server.replace(/\/+$/, '')}/api/admin/users/${user.id}/${action}`,
      { method: 'POST', headers: { Authorization: `Bearer ${cfg.token}` } }
    )
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      setMessage(payload.error || `Could not ${action} the account.`)
      return
    }
    setUsers((current) =>
      current.map((item) =>
        item.id === user.id
          ? { ...item, disabledAt: action === 'disable' ? Date.now() : null }
          : item
      )
    )
    setMessage(`${user.username} ${action === 'disable' ? 'disabled' : 'restored'}.`)
  }

  const updateFlag = async (flag: FeatureFlag) => {
    const cfg = await syncEngine.getConfig()
    if (!cfg.server || !cfg.token) return
    const response = await fetch(
      `${cfg.server.replace(/\/+$/, '')}/api/admin/feature-flags/${flag.key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.token}` },
        body: JSON.stringify({ enabled: !flag.enabled, rollout: flag.rollout }),
      }
    )
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      setMessage(payload.error || 'Could not update feature flag.')
      return
    }
    setFlags((current) =>
      current.map((item) =>
        item.key === flag.key
          ? { ...item, enabled: payload.enabled, rollout: payload.rollout }
          : item
      )
    )
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
        body: JSON.stringify({
          title: announcementTitle,
          body: sanitizeAnnouncementHtml(
            announcementMode === 'markdown'
              ? markdownToAnnouncementHtml(announcementBody)
              : announcementBody
          ),
          severity: announcementSeverity,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Could not publish announcement.')
      setAnnouncementTitle('')
      setAnnouncementBody('')
      if (announcementEditorRef.current) announcementEditorRef.current.innerHTML = ''
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
  useEffect(() => {
    if (announcementMode === 'visual' && announcementEditorRef.current && announcementEditorRef.current.innerHTML !== announcementBody) {
      announcementEditorRef.current.innerHTML = announcementBody
    }
  }, [announcementMode, announcementBody])
  const deleteAnnouncement = async (item: Announcement) => {
    const cfg = await syncEngine.getConfig()
    if (!cfg.server || !cfg.token || !window.confirm(`Delete “${item.title}”?`)) return
    const response = await fetch(
      `${cfg.server.replace(/\/+$/, '')}/api/admin/announcements/${item.id}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${cfg.token}` } }
    )
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      setMessage(payload.error || 'Could not delete announcement.')
      return
    }
    setAnnouncements((current) => current.filter((announcement) => announcement.id !== item.id))
    setMessage('Announcement deleted.')
  }
  const sendMail = async (event: FormEvent) => {
    event.preventDefault()
    const cfg = await syncEngine.getConfig()
    if (!cfg.server || !cfg.token) return
    const response = await fetch(`${cfg.server.replace(/\/+$/, '')}/api/admin/mail/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.token}` },
      body: JSON.stringify({ to: mailTo, subject: mailSubject, text: mailBody }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      setMessage(payload.error || 'Could not send email.')
      return
    }
    setMailTo('')
    setMailSubject('')
    setMailBody('')
    setMessage('Email sent.')
    setSection('Email')
  }
  const markMailRead = async (item: AdminMail) => {
    setSelectedMail(item)
    if (item.readAt) return
    const cfg = await syncEngine.getConfig()
    if (!cfg.server || !cfg.token) return
    await fetch(`${cfg.server.replace(/\/+$/, '')}/api/admin/mail/${item.id}/read`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.token}` },
    })
    setMail((current) =>
      current.map((mailItem) =>
        mailItem.id === item.id ? { ...mailItem, readAt: Date.now() } : mailItem
      )
    )
  }
  const visibleAudit = audit.filter(
    (event) => auditFilter === 'all' || event.action === auditFilter
  )
  const auditActions = [...new Set(audit.map((event) => event.action))]
  const auditMenu = (event: MouseEvent, item: AuditEvent) =>
    openContextMenu(event, [
      {
        label: expandedAudit === item.id ? 'Collapse details' : 'Show details',
        icon: 'fa-solid fa-chevron-down',
        onClick: () => setExpandedAudit((current) => (current === item.id ? null : item.id)),
      },
      {
        label: 'Copy event detail',
        icon: 'fa-solid fa-copy',
        onClick: () =>
          navigator.clipboard?.writeText(
            `${item.actor} ${item.detail} · ${new Date(item.createdAt).toISOString()}`
          ),
      },
      'divider',
      {
        label: 'Filter to this action',
        icon: 'fa-solid fa-filter',
        onClick: () => setAuditFilter(item.action),
      },
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

  return (
    <AdminShell
      section={section}
      onNavigate={setSection}
      username={app.syncUsername || 'Admin'}
      server={app.syncServer || ''}
      avatarUrl={app.profileAvatar || app.syncDiscordAvatar || null}
      onAccountCentre={app.openAccountCentre}
      onSettings={app.openSettings}
      onSync={() => void app.syncNow?.()}
      onSignOut={() => void app.disconnectSync?.()}
    >
      {loadError && (
        <div
          role="alert"
          className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-400/25 bg-red-400/5 p-4 text-sm text-red-200"
        >
          <span>{loadError} Current information may be unavailable.</span>
          <button
            className="min-h-11 rounded-lg border border-white/10 px-4"
            onClick={() => setRetry((value) => value + 1)}
          >
            Retry
          </button>
        </div>
      )}
      {section === 'Dashboard' && (
        <AdminOverview
          users={loaded ? users : null}
          health={health}
          audit={audit}
          flags={loaded ? flags : null}
          announcements={announcements}
          loading={loading && !loaded}
          unavailable={!loaded && !loading}
          username={app.syncUsername || 'Admin'}
          server={app.syncServer || ''}
          onNavigate={setSection}
        />
      )}
      {section === 'Users' && (
        <>
          <AdminUsersPage
            users={users}
            loading={loading}
            query={query}
            onQuery={setQuery}
            onNavigate={setSection}
            onProfile={setSelectedUser}
            selectedUserId={selectedUser?.id}
            onRole={(user, value) => void updateRole(user.id, value)}
            onDisable={(user) => void toggleDisabled(user)}
            onDelete={(user) => void deleteUser(user)}
          />
          {selectedUser &&
            users.find((user) => user.id === selectedUser.id) &&
            (() => {
              const user = users.find((user) => user.id === selectedUser.id)!
              return (
                <UserInspector
                  key={user.id}
                  user={user}
                  onClose={() => setSelectedUser(null)}
                  onRole={(value) => updateRole(user.id, value)}
                  onDisable={() => toggleDisabled(user)}
                  onDelete={() => deleteUser(user)}
                />
              )
            })()}
        </>
      )}
      {section === 'Audit log' && (
        <AdminAuditPage events={audit} users={users} loading={loading} />
      )}
      {section === 'Feature flags' && (
        <article className="admin-panel admin-placeholder">
          <span className="admin-kicker">Feature flags</span>
          <h2>Feature flags</h2>
          <p>Live flags stored by the account service. Changes are audited.</p>
          <div className="admin-flag-list">
            {flags.map((flag) => (
              <div
                className="admin-flag-row"
                key={flag.key}
                onContextMenu={(event) =>
                  openContextMenu(event, [
                    {
                      label: flag.enabled ? 'Disable flag' : 'Enable flag',
                      icon: 'fa-solid fa-toggle-on',
                      onClick: () => void updateFlag(flag),
                    },
                    {
                      label: 'Copy flag key',
                      icon: 'fa-solid fa-copy',
                      onClick: () => navigator.clipboard?.writeText(flag.key),
                    },
                  ])
                }
              >
                <div>
                  <strong>{flag.label}</strong>
                  <small>
                    {flag.key} · rollout {flag.rollout}%
                  </small>
                </div>
                <Select
                  value={flag.enabled ? 'on' : 'off'}
                  onChange={() => updateFlag(flag)}
                  ariaLabel={`Toggle ${flag.label}`}
                  width={150}
                  options={[
                    { value: 'on', label: 'Enabled' },
                    { value: 'off', label: 'Disabled' },
                  ]}
                />
              </div>
            ))}
          </div>
        </article>
      )}
      {section === 'Announcements' && (
        <article className="admin-announcement-modern">
          <div className="announcement-hero" style={{ backgroundImage: "url('/assets/moonscribebackground.png')" }}>
            <div className="announcement-hero-overlay" />
            <div className="relative z-10"><span className="admin-kicker">MoonScribe control room / Announcements</span><h2>Announcements</h2><p>Share important updates with the MoonScribe writing community.</p></div>
          </div>
          <section className="announcement-composer">
            <div className="announcement-composer-heading"><div><h3><i className="fa-solid fa-bullhorn" /> Create announcement</h3><p>Post a server-backed message for signed-in MoonScribe writers.</p></div></div>
          <form className="admin-announcement-form" onSubmit={publishAnnouncement}>
            <label>
              Title
              <input
                value={announcementTitle}
                onChange={(event) => setAnnouncementTitle(event.target.value)}
                maxLength={160}
                required
                placeholder="A short, clear title for your announcement..."
              />
            </label>
            <div className="admin-rich-editor">
              <div className="admin-rich-tabs" role="tablist" aria-label="Announcement editor mode">
                {(['visual', 'markdown', 'html'] as const).map((mode) => (
                  <button
                    type="button"
                    key={mode}
                    className={announcementMode === mode ? 'active' : ''}
                    onClick={() => setAnnouncementMode(mode)}
                  >
                    {mode === 'visual' ? 'Visual' : mode === 'markdown' ? 'Markdown' : 'HTML'}
                  </button>
                ))}
              </div>
              {announcementMode === 'visual' ? (
                <>
                  <div className="admin-rich-toolbar" aria-label="Formatting tools">
                    {['bold','italic','underline','strikeThrough','insertUnorderedList','insertOrderedList','justifyLeft','justifyCenter','createLink'].map((command) => <button key={command} type="button" aria-label={command} onMouseDown={(event) => event.preventDefault()} onClick={() => { const value = command === 'createLink' ? window.prompt('Link URL', 'https://') : null; document.execCommand(command, false, value || undefined) }}><i className={`fa-solid fa-${command === 'strikeThrough' ? 'strikethrough' : command === 'insertUnorderedList' ? 'list' : command === 'insertOrderedList' ? 'list-ol' : command === 'createLink' ? 'link' : command === 'justifyLeft' ? 'align-left' : command === 'justifyCenter' ? 'align-center' : command}`} /></button>)}
                    <button type="button" aria-label="Clear formatting" onMouseDown={(event) => event.preventDefault()} onClick={() => document.execCommand('removeFormat')}><i className="fa-solid fa-eraser" /></button>
                  </div>
                  <div
                    ref={announcementEditorRef}
                    className="admin-rich-surface"
                    contentEditable
                    suppressContentEditableWarning
                    onInput={(event) => setAnnouncementBody(event.currentTarget.innerHTML)}
                    data-placeholder="Write your announcement…"
                  />
                </>
              ) : (
                <textarea
                  value={announcementBody}
                  onChange={(event) => setAnnouncementBody(event.target.value)}
                  maxLength={4000}
                  required
                  rows={8}
                  placeholder={
                    announcementMode === 'markdown'
                      ? '# What changed?\n\nUse **bold**, *italic*, and headings.'
                      : '<p>Write your announcement in HTML</p>'
                  }
                />
              )}
              <div className="admin-rich-preview">
                <span><i className="fa-solid fa-eye" /> Live preview</span>
                <small>This is how it will appear to writers.</small>
                <div
                  dangerouslySetInnerHTML={{
                    __html: sanitizeAnnouncementHtml(
                      announcementMode === 'markdown'
                        ? markdownToAnnouncementHtml(announcementBody)
                        : announcementBody
                    ),
                  }}
                />
                <footer><i className="fa-regular fa-clock" /> Posted just now</footer>
              </div>
            </div>
            <fieldset className="announcement-severity"><legend>Severity</legend>{[['info','Information','General updates','circle-info'],['warning','Important','Notable changes','star'],['critical','Critical','Urgent / requires attention','triangle-exclamation']].map(([value,title,note,ic]) => <label key={value} className={announcementSeverity === value ? 'selected' : ''}><input type="radio" name="announcement-severity" value={value} checked={announcementSeverity === value} onChange={(e) => setAnnouncementSeverity(e.target.value)} /><i className={`fa-solid fa-${ic}`} /><span><b>{title}</b><small>{note}</small></span></label>)}</fieldset>
            <button className="button button-primary announcement-publish" disabled={publishingAnnouncement}>
              <i className="fa-solid fa-paper-plane" />
              {publishingAnnouncement ? 'Publishing…' : 'Publish announcement'}
            </button>
          </form>
          </section>
          <section className="announcement-history">
            <div className="announcement-history-heading"><div><h3>Published announcements</h3><p>Manage and view all published announcements.</p></div><label className="announcement-search"><i className="fa-solid fa-magnifying-glass" /><input value={announcementSearch} onChange={(e) => setAnnouncementSearch(e.target.value)} placeholder="Search announcements..." /></label></div>
            {announcements.filter((item) => !announcementSearch || `${item.title} ${item.body}`.toLowerCase().includes(announcementSearch.toLowerCase())).length ? (
              announcements.filter((item) => !announcementSearch || `${item.title} ${item.body}`.toLowerCase().includes(announcementSearch.toLowerCase())).map((item) => (
                <div
                  className="announcement-row"
                  key={item.id}
                  onContextMenu={(event) =>
                    openContextMenu(event, [
                      {
                        label: 'Delete announcement',
                        icon: 'fa-solid fa-trash',
                        onClick: () => void deleteAnnouncement(item),
                      },
                    ])
                  }
                >
                  <div>
                    <strong>{item.title}</strong>
                    <small>{item.body.replace(/<[^>]+>/g, '').slice(0, 110)}</small>
                  </div>
                  <div className="announcement-row-meta"><span className={`announcement-badge severity-${item.severity}`}>{item.severity}</span><time>{new Date(item.createdAt).toLocaleString()}</time><small>By {item.created_by || 'Administrator'}</small></div><button
                    className="button button-quiet announcement-delete"
                    onClick={() => void deleteAnnouncement(item)}
                    aria-label={`Delete ${item.title}`}
                  >
                    •••
                  </button>
                </div>
              ))
            ) : (
              <span className="admin-muted">No announcements have been published.</span>
            )}
          </section>
        </article>
      )}
      {section === 'Email' && (
        <article className="admin-panel admin-mail-panel">
          <div className="admin-panel-heading">
            <div>
              <span className="admin-kicker">Mailbox</span>
              <h2>Email</h2>
              <p>Receive inbound messages and send mail from the MoonScribe account service.</p>
            </div>
            <span className="admin-mail-count">
              {mail.filter((item) => item.direction === 'received' && !item.readAt).length} unread
            </span>
          </div>
          <div className="admin-mail-layout">
            <div className="admin-mail-list">
              {mail.length ? (
                mail.map((item) => (
                  <button
                    type="button"
                    className={`admin-mail-row ${item.readAt ? '' : 'unread'}`}
                    key={item.id}
                    onClick={() => void markMailRead(item)}
                  >
                    <span className="admin-mail-direction">
                      {item.direction === 'received' ? 'IN' : 'OUT'}
                    </span>
                    <span>
                      <strong>{item.subject}</strong>
                      <small>
                        {item.direction === 'received' ? item.sender : `To ${item.recipients}`} ·{' '}
                        {new Date(item.createdAt).toLocaleString()}
                      </small>
                    </span>
                  </button>
                ))
              ) : (
                <span className="admin-muted">
                  No messages yet. Configure the inbound webhook to receive mail.
                </span>
              )}
            </div>
            <div className="admin-mail-reader">
              {selectedMail ? (
                <>
                  <small>
                    {selectedMail.direction === 'received'
                      ? `From ${selectedMail.sender}`
                      : `To ${selectedMail.recipients}`}
                  </small>
                  <h3>{selectedMail.subject}</h3>
                  <time>{new Date(selectedMail.createdAt).toLocaleString()}</time>
                  <pre>{selectedMail.text || 'No plain-text body.'}</pre>
                </>
              ) : (
                <span className="admin-muted">Select a message to read it.</span>
              )}
            </div>
          </div>
          <form className="admin-mail-compose" onSubmit={sendMail}>
            <h3>Compose</h3>
            <input
              type="email"
              required
              value={mailTo}
              onChange={(event) => setMailTo(event.target.value)}
              placeholder="Recipient email"
            />
            <input
              required
              value={mailSubject}
              onChange={(event) => setMailSubject(event.target.value)}
              placeholder="Subject"
            />
            <textarea
              required
              rows={5}
              value={mailBody}
              onChange={(event) => setMailBody(event.target.value)}
              placeholder="Write your message…"
            />
            <button className="button button-primary">Send email</button>
          </form>
        </article>
      )}
      {section === 'Health' && <AdminHealthPanel health={health} loading={loading} />}
    </AdminShell>
  )
}
