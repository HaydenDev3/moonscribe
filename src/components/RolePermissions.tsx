import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'
import * as syncEngine from '../sync/engine'

const ROLE_META = {
  user: { label: 'User', tone: 'safe' },
  developer: { label: 'Developer', tone: 'warn' },
  beta_tester: { label: 'Beta Tester', tone: 'warn' },
  admin: { label: 'Admin', tone: 'danger' },
}

function getFeatureGuardState() {
  const entries: Array<{ name: string, message: string, reason?: string, at?: number }> = []
  if (typeof window === 'undefined') return entries
  for (const key of Object.keys(window.localStorage)) {
    if (!key.startsWith('moonscribe:feature-status:')) continue
    const featureName = key.replace('moonscribe:feature-status:', '')
    try {
      const raw = window.localStorage.getItem(key)
      const parsed = raw ? JSON.parse(raw) : null
      if (!parsed?.disabled) continue
      entries.push({
        name: featureName,
        message: parsed.message || 'Feature temporarily unavailable',
        reason: parsed.reason || 'Guarded by the app',
        at: parsed.at || 0,
      })
    } catch {
      // Ignore malformed feature status entries.
    }
  }
  return entries.sort((a, b) => (b.at || 0) - (a.at || 0))
}

export default function RolePermissions() {
  const app = useApp() as {
    accountRoles?: string[]
    userRoleLabel?: string
    hasRole?: (role: string) => boolean
    syncServer?: string | null
  }
  const { accountRoles = ['user'], userRoleLabel = 'User', hasRole = () => false, syncServer } = app
  const [users, setUsers] = useState<Array<{ id: string, username: string, roles: string[] }>>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    const loadUsers = async () => {
      if (!hasRole('admin')) return
      try {
        setLoading(true)
        const cfg = await syncEngine.getConfig()
        if (!cfg.server || !cfg.token || cancelled) return
        const response = await fetch(`${cfg.server.replace(/\/+$/, '')}/api/admin/users`, {
          headers: { Authorization: `Bearer ${cfg.token}` },
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || 'Could not load user list.')
        if (!cancelled) setUsers(Array.isArray(payload.users) ? payload.users : [])
      } catch (error) {
        console.error('[Role permissions]', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadUsers()
    return () => { cancelled = true }
  }, [hasRole, syncServer])

  const guardedFeatures = getFeatureGuardState()
  const roleBadges = (accountRoles.length ? accountRoles : ['user']).map((role) => {
    const meta = ROLE_META[role] || { label: role, tone: 'safe' }
    return <span key={role} className={`settings-status-pill ${meta.tone}`}>{meta.label}</span>
  })

  const updateRole = async (userId: string, nextRoles: string[]) => {
    try {
      const cfg = await syncEngine.getConfig()
      if (!cfg.server || !cfg.token) return
      const response = await fetch(`${cfg.server.replace(/\/+$/, '')}/api/admin/users/${userId}/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.token}` },
        body: JSON.stringify({ roles: nextRoles }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Could not update role.')
      setUsers((current) => current.map((user) => (user.id === userId ? { ...user, roles: nextRoles } : user)))
    } catch (error) {
      console.error('[Role permissions update]', error)
    }
  }

  return (
    <section className="settings-panel">
      <div className="settings-panel-kicker">Access control</div>
      <h2>Permissions</h2>
      <p className="muted">MoonScribe roles default to User; Admin and Developer permissions can be granted as needed.</p>

      <div className="settings-row">
        <div>
          <div className="settings-row-title">Current role</div>
          <div className="settings-row-sub">{userRoleLabel}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>{roleBadges}</div>
      </div>

      {(hasRole('developer') || hasRole('admin')) && (
        <div className="settings-section-card" style={{ marginTop: 16 }}>
          <div className="settings-section-head">
            <span className="settings-section-icon"><i className="fa-solid fa-shield-heart" /></span>
            <div>
              <strong>Developer toolkit</strong>
              <small>Audit feature guard states and system health.</small>
            </div>
          </div>

          {guardedFeatures.length === 0 ? (
            <div className="settings-detail-grid" style={{ marginTop: 12 }}>
              <span><small>Guarded features</small><b>none</b></span>
              <span><small>Audit</small><b>Healthy</b></span>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
              {guardedFeatures.map((feature) => (
                <div key={`${feature.name}-${feature.at}`} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 10 }}>
                  <strong>{feature.name}</strong>
                  <div style={{ fontSize: 12, color: 'var(--grey)' }}>{feature.message}</div>
                  <small style={{ color: 'var(--grey)' }}>{feature.reason}</small>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {hasRole('admin') && (
        <div className="settings-section-card" style={{ marginTop: 16 }}>
          <div className="settings-section-head">
            <span className="settings-section-icon"><i className="fa-solid fa-users-gear" /></span>
            <div>
              <strong>Manage user roles</strong>
              <small>Admins can assign or revoke app-wide permissions.</small>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
            {loading ? <div className="muted">Loading members…</div> : users.length === 0 ? <div className="muted">No other users are connected yet.</div> : users.map((user) => (
              <div key={user.id} style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr auto', alignItems: 'center', border: '1px solid var(--border)', padding: 10, borderRadius: 12 }}>
                <div>
                  <strong>{user.username}</strong>
                  <div style={{ fontSize: 12, color: 'var(--grey)' }}>{user.roles.join(', ') || 'user'}</div>
                </div>
                <select
                  value={user.roles.includes('admin') ? 'admin' : user.roles.includes('developer') ? 'developer' : user.roles.includes('beta_tester') ? 'beta_tester' : 'user'}
                  onChange={(event) => {
                    const next = event.target.value === 'admin' ? ['user', 'admin'] : event.target.value === 'developer' ? ['user', 'developer'] : event.target.value === 'beta_tester' ? ['user', 'beta_tester'] : ['user']
                    updateRole(user.id, next)
                  }}
                  aria-label={`Set role for ${user.username}`}
                  style={{ minWidth: 140 }}
                >
                  <option value="user">User</option>
                  <option value="developer">Developer</option>
                  <option value="beta_tester">Beta Tester</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
