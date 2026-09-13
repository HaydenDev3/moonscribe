import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, ReactElement, TouchEvent } from 'react'
import { useApp } from '../context/AppContext'
import { accountProfile, getConfig, listSessions, revokeSession, setConfig } from '../sync/engine'
import ProfileAvatar from './ProfileAvatar'
import Icon from './Icon'
import { Button } from './ui/button'
import Select from './Select'

type Account = {
  id: string
  username: string
  email: string | null
  provider: 'discord' | 'google' | 'email'
  avatarUrl?: string | null
  bannerUrl?: string | null
  discordUsername?: string | null
  discordAvatar?: string | null
  emailVerified: boolean
  twoFactorEnabled: boolean
  createdAt: number
  role?: string
  roles?: string[]
  linkedProviders?: { discord?: boolean; google?: boolean; password?: boolean }
}
type Session = {
  id: string
  deviceId?: string | null
  current: boolean
  deviceName: string
  createdAt: number
  lastSeenAt: number
}
type Notice = {
  id: string
  title: string
  body: string
  category?: string
  type?: string
  createdAt: number
}

const nav = [
  ['overview', 'Overview', 'fa-solid fa-house'],
  ['profile', 'Profile', 'fa-solid fa-user'],
  ['email', 'Email & password', 'fa-solid fa-envelope'],
  ['connections', 'Connections', 'fa-solid fa-link'],
  ['sessions', 'Sessions', 'fa-solid fa-laptop'],
  ['security', 'Security activity', 'fa-solid fa-shield-halved'],
]

function Row({
  title,
  detail,
  action,
  onClick,
  icon = 'fa-solid fa-chevron-right',
  tone = '',
  disabled = false,
}: {
  title: string
  detail: string
  action?: string
  onClick?: () => void
  icon?: string
  tone?: string
  disabled?: boolean
}) {
  return (
    <div className="account-row">
      <span className={`account-row-icon ${tone}`}>
        <Icon icon={icon} />
      </span>
      <span className="account-row-copy">
        <strong>{title}</strong>
        <small>{detail}</small>
      </span>
      {action && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="account-row-action"
          onClick={onClick}
          disabled={disabled}
        >
          {action} <Icon icon="fa-solid fa-arrow-right" />
        </Button>
      )}
    </div>
  )
}

const dateTime = (value?: number | null) => (value ? new Date(value).toLocaleString() : 'Unknown')
const relativeTime = (value?: number | null) => {
  if (!value) return 'Unknown'
  const seconds = Math.max(0, Math.floor((Date.now() - value) / 1000))
  if (seconds < 60) return 'Active now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export default function AccountCentre({ onClose }: { onClose: () => void }) {
  const app = useApp() as any
  const authFlow = app.authFlow
  const previewAccountMerge = app.previewAccountMerge
  const [section, setSection] = useState('overview')
  const [account, setAccount] = useState<Account | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [mergePreview, setMergePreview] = useState<any>(null)
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [profileDraft, setProfileDraft] = useState({
    displayName: '',
    writerName: '',
    profileBio: '',
    timezone: 'UTC',
    language: 'en-AU',
    profileGenres: [] as string[],
  })
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null)
  const [profileBanner, setProfileBanner] = useState<string | null>(null)
  const profileBannerRef = useRef<HTMLInputElement | null>(null)
  const profileAvatarRef = useRef<HTMLInputElement | null>(null)
  const [password, setPassword] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [disableOpen, setDisableOpen] = useState(false)
  const [disableText, setDisableText] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteText, setDeleteText] = useState('')
  const touchStartX = useRef<number | null>(null)
  const accountSections = nav.map(([key]) => key)
  const handleTouchStart = (event: TouchEvent<HTMLElement>) => {
    touchStartX.current = event.touches[0]?.clientX ?? null
  }
  const handleTouchEnd = (event: TouchEvent<HTMLElement>) => {
    const start = touchStartX.current
    touchStartX.current = null
    if (start === null) return
    const delta = (event.changedTouches[0]?.clientX ?? start) - start
    if (Math.abs(delta) < 56) return
    const current = accountSections.indexOf(section)
    const next = accountSections[current + (delta < 0 ? 1 : -1)]
    if (next) setSection(next)
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const config = await getConfig()
      if (!config.server || !config.token) throw new Error('Sign in to view account data.')
      const [profile, activeSessions, noticeResponse] = await Promise.all([
        accountProfile(config.server, config.token),
        listSessions(),
        fetch(`${config.server.replace(/\/$/, '')}/api/notifications`, {
          headers: { Authorization: `Bearer ${config.token}` },
        }),
      ])
      const noticeData = await noticeResponse.json().catch(() => ({}))
      if (!noticeResponse.ok)
        throw new Error(noticeData.error || 'Could not load security activity.')
      const uniqueSessions = activeSessions.filter(
        (session, index, list) =>
          !session.deviceId ||
          list.findIndex((candidate) => candidate.deviceId === session.deviceId) === index
      )
      setAccount(profile)
      setProfileAvatar(profile.avatarUrl || profile.discordAvatar || null)
      setProfileBanner(
        profile.bannerUrl || profile.profile?.bannerUrl || app.settings?.bannerUrl || null
      )
      setEmail(profile.email || '')
      setUsername(profile.username || '')
      setProfileDraft({
        displayName: (profile.profile?.displayName ?? app.settings?.displayName) || '',
        writerName: (profile.profile?.writerName ?? app.settings?.writerName) || '',
        profileBio: (profile.profile?.profileBio ?? app.settings?.profileBio) || '',
        timezone: (profile.profile?.timezone ?? app.settings?.timezone) || 'UTC',
        language: (profile.profile?.language ?? app.settings?.language) || 'en-AU',
        profileGenres: profile.profile?.profileGenres || [],
      })
      setSessions(uniqueSessions)
      setNotices(noticeData.notifications || [])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load account data.')
    } finally {
      setLoading(false)
    }
  }, [
    app.settings?.displayName,
    app.settings?.writerName,
    app.settings?.profileBio,
    app.settings?.timezone,
    app.settings?.language,
    app.settings?.bannerUrl,
  ])
  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    const refresh = () => void load()
    window.addEventListener('moonscribe:account-updated', refresh)
    window.addEventListener('moonscribe:profile-updated', refresh)
    return () => {
      window.removeEventListener('moonscribe:account-updated', refresh)
      window.removeEventListener('moonscribe:profile-updated', refresh)
    }
  }, [load])
  useEffect(() => {
    const conflictId = authFlow?.conflictId
    if (!conflictId || !previewAccountMerge) return
    previewAccountMerge(conflictId)
      .then(setMergePreview)
      .catch((reason) => setError(reason.message || 'Could not load merge preview.'))
  }, [authFlow?.conflictId, previewAccountMerge])

  const request = async (path: string, body: object) => {
    const config = await getConfig()
    if (!config.server || !config.token) throw new Error('Sign in first.')
    const response = await fetch(`${config.server.replace(/\/$/, '')}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.token}` },
      body: JSON.stringify(body),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || 'The account change could not be saved.')
    return data
  }
  const run = async (key: string, action: () => Promise<unknown>, success: string) => {
    setBusy(key)
    setError('')
    try {
      await action()
      app.toast?.(success)
      await load()
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'The action failed.'
      setError(message)
      app.toast?.(message)
    } finally {
      setBusy('')
    }
  }
  const saveEmail = () => {
    const address = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setError('Enter a valid email address before saving.')
      return
    }
    return run(
      'email',
      () => request('/api/auth/update-account', { email: address }),
      account?.email === address
        ? 'Email is already current.'
        : 'Email updated. Check your inbox to verify it.'
    )
  }
  const sendVerification = () =>
    run(
      'verification',
      () => request('/api/auth/request-verification', { email: email || account?.email }),
      'Verification code sent. Check your inbox.'
    )
  const verifyEmail = () =>
    run(
      'verify-email',
      async () => {
        await request('/api/auth/verify-email', { code: verificationCode.trim() })
        setVerificationCode('')
      },
      'Email verified.'
    )
  const saveAccountProfile = () =>
    run(
      'profile',
      async () => {
        const result = await request('/api/auth/update-account', {
          username,
          ...profileDraft,
          avatarUrl: profileAvatar,
          bannerUrl: profileBanner,
          profileSetupCompleted: true,
        })
        await setConfig({ username: result.username || username })
        await app.updateSettings?.({
          displayName: profileDraft.displayName,
          writerName: profileDraft.writerName,
          profileBio: profileDraft.profileBio,
          timezone: profileDraft.timezone,
          language: profileDraft.language,
          bannerUrl: profileBanner,
        })
        setAccount((current) =>
          current
            ? {
                ...current,
                username: result.username || username,
                avatarUrl: result.avatarUrl || profileAvatar,
                bannerUrl: profileBanner,
                profile: result.profile,
              }
            : current
        )
      },
      'Profile updated.'
    )
  const readImage = (file: File, maxSize: number, quality = 0.82) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(reader.error)
      reader.onload = () => {
        const image = new Image()
        image.onerror = () => reject(new Error('That image could not be read.'))
        image.onload = () => {
          const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
          const canvas = document.createElement('canvas')
          canvas.width = Math.max(1, Math.round(image.width * scale))
          canvas.height = Math.max(1, Math.round(image.height * scale))
          const context = canvas.getContext('2d')
          if (!context) return reject(new Error('Image processing is unavailable.'))
          context.drawImage(image, 0, 0, canvas.width, canvas.height)
          resolve(canvas.toDataURL('image/jpeg', quality))
        }
        image.src = String(reader.result || '')
      }
      reader.readAsDataURL(file)
    })
  const chooseAvatar = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    void readImage(file, 256, 0.72)
      .then(setProfileAvatar)
      .catch(() => setError('That profile picture could not be processed.'))
  }
  const chooseBanner = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    void readImage(file, 420, 0.36)
      .then((value) => {
        if (value.length > 450000) throw new Error('Image is still too large.')
        setProfileBanner(value)
      })
      .catch(() => setError('That banner image could not be processed.'))
  }
  const saveProfile = saveAccountProfile
  const savePassword = () =>
    run(
      'password',
      async () => {
        await request('/api/auth/update-account', {
          password,
          notify: 'Your MoonScribe password was changed.',
        })
        setPassword('')
      },
      'Password updated.'
    )
  const toggle2fa = () =>
    run(
      '2fa',
      () => request('/api/auth/enable-2fa', { enable: !account?.twoFactorEnabled }),
      account?.twoFactorEnabled
        ? 'Two-factor authentication disabled.'
        : 'Two-factor authentication enabled. Check your email for the security code.'
    )
  const disableAccount = async () => {
    setBusy('disable')
    setError('')
    try {
      await request('/api/auth/disable-account', { confirmation: disableText })
      app.toast?.('Your account is disabled and every device has been signed out.')
      onClose()
      await app.disconnectSync?.()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The account could not be disabled.')
    } finally {
      setBusy('')
    }
  }
  const deleteAccount = async () => {
    setBusy('delete')
    setError('')
    try {
      await request('/api/auth/delete-account', { confirmation: deleteText })
      app.toast?.('Your account and cloud data were permanently deleted.')
      await app.disconnectSync?.()
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The account could not be deleted.')
    } finally {
      setBusy('')
    }
  }
  const removeSession = (session: Session) =>
    run(`session:${session.id}`, () => revokeSession(session.id), 'Device signed out.')
  const connect = (name: 'connectDiscord' | 'connectGoogle') => {
    setBusy(name)
    setError('')
    void app[name]?.()
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setBusy(''))
  }
  const unlink = (provider: 'discord' | 'google') =>
    run(
      `unlink:${provider}`,
      () => request('/api/auth/unlink-provider', { provider }),
      `${provider[0].toUpperCase()}${provider.slice(1)} disconnected.`
    )
  const providerLabel =
    account?.provider === 'discord'
      ? 'Discord'
      : account?.provider === 'google'
        ? 'Google'
        : 'Email and password'
  const accountNotices = useMemo(
    () => notices.filter((item) => item.category === 'account' || item.type === 'account'),
    [notices]
  )

  if (loading)
    return (
      <div className="account-centre-overlay">
        <div className="account-centre account-centre-loading">
          <div className="account-loading-mark">
            <span>
              <Icon icon="fa-solid fa-moon" />
            </span>
          </div>
          <div className="account-loading-copy">
            <span className="account-brand">MOONSCRIBE</span>
            <h2>Opening your account centre</h2>
            <p>Loading your live profile and security details…</p>
            <div className="account-loading-bar">
              <i />
            </div>
          </div>
        </div>
      </div>
    )

  const content = {
    overview: (
      <>
        <div
          className="account-hero"
          style={
            account?.bannerUrl
              ? {
                  backgroundImage: `linear-gradient(90deg, rgba(15,16,18,.92), rgba(15,16,18,.5)), url(${account.bannerUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  borderRadius: '14px',
                  padding: '20px',
                }
              : undefined
          }
        >
          <div className="account-avatar">
            <ProfileAvatar
              src={account?.avatarUrl || account?.discordAvatar}
              name={account?.username}
            />
          </div>
          <div>
            <div className="account-eyebrow">SIGNED IN AS</div>
            <h3>{account?.username || app.syncUsername}</h3>
            <p>
              {account?.email || 'No email attached'}{' '}
              {account?.email && (
                <span
                  className={`account-verification-pill ${account.emailVerified ? 'is-verified' : 'is-unverified'}`}
                  title={account.emailVerified ? 'Email verified' : 'Email not verified'}
                  aria-label={account.emailVerified ? 'Email verified' : 'Email not verified'}
                >
                  <Icon icon={account.emailVerified ? 'fa-solid fa-check' : 'fa-solid fa-xmark'} />
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="account-grid">
          <div className="account-info">
            <span>Account ID</span>
            <b>{account?.id || 'Unavailable'}</b>
          </div>
          <div className="account-info">
            <span>Sync</span>
            <b className={app.syncStatus === 'synced' ? 'account-success' : ''}>
              ● {app.syncStatus || 'Unknown'}
            </b>
          </div>
          <div className="account-info">
            <span>Signed-in devices</span>
            <b>{sessions.length}</b>
          </div>
          <div className="account-info">
            <span>Member since</span>
            <b>
              {account?.createdAt ? new Date(account.createdAt).toLocaleDateString() : 'Unknown'}
            </b>
          </div>
        </div>
        <h4>Sign-in and security</h4>
        <Row
          title={providerLabel}
          detail="Primary account connector"
          action="Manage"
          onClick={() => setSection('connections')}
          icon="fa-solid fa-circle-check"
          tone="success"
        />
        <Row
          title="Two-factor authentication"
          detail={account?.twoFactorEnabled ? 'Enabled' : 'Not enabled'}
          action="Manage"
          onClick={() => setSection('security')}
          icon="fa-solid fa-shield-halved"
        />
        <Row
          title="Sessions"
          detail={`${sessions.length} signed-in device${sessions.length === 1 ? '' : 's'}`}
          action="Review"
          onClick={() => setSection('sessions')}
          icon="fa-solid fa-laptop"
        />
      </>
    ),
    profile: (
      <>
        <div
          className="account-profile-banner"
          style={
            profileBanner
              ? {
                  backgroundImage: `linear-gradient(90deg, rgba(18,16,22,.9), rgba(18,16,22,.45)), url(${profileBanner})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
              : undefined
          }
        >
          <div className="account-profile-banner-glow" />
          <div className="account-profile-avatar-wrap">
            <ProfileAvatar
              src={profileAvatar || account?.avatarUrl || account?.discordAvatar}
              name={account?.username}
              className="account-profile-avatar"
            />
            <button
              type="button"
              className="account-avatar-edit"
              onClick={() => profileAvatarRef.current?.click()}
              aria-label="Change profile picture"
            >
              <Icon icon="fa-solid fa-camera" />
            </button>
            <input
              ref={profileAvatarRef}
              hidden
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={chooseAvatar}
            />
          </div>
          <div>
            <span className="account-eyebrow">WRITER PROFILE</span>
            <h3>{profileDraft.displayName || username || 'Your profile'}</h3>
            <p>
              {profileDraft.writerName || 'MoonScribe writer'}
              {account?.email ? ` · ${account.email}` : ''}
            </p>
            <div className="account-profile-badges">
              <span data-tooltip={account?.role || 'user'} aria-label={account?.role || 'user'}>
                <Icon
                  icon={
                    account?.role === 'admin' ? 'fa-solid fa-shield-halved' : 'fa-solid fa-user'
                  }
                />
              </span>
              {(account?.linkedProviders?.google || account?.provider === 'google') && (
                <span data-tooltip="Google connected">
                  <Icon icon="fa-brands fa-google" />
                </span>
              )}
              {(account?.linkedProviders?.discord || account?.provider === 'discord') && (
                <span data-tooltip="Discord connected">
                  <Icon icon="fa-brands fa-discord" />
                </span>
              )}
              {(account?.linkedProviders?.password || account?.provider === 'email') && (
                <span data-tooltip="MoonScribe password">
                  <Icon icon="fa-solid fa-key" />
                </span>
              )}
              <span
                data-tooltip={
                  account?.createdAt
                    ? `Member since ${new Date(account.createdAt).toLocaleDateString()}`
                    : 'Member'
                }
              >
                <Icon icon="fa-solid fa-calendar" />
              </span>
            </div>
            <button
              type="button"
              className="account-banner-edit"
              onClick={() => profileBannerRef.current?.click()}
            >
              <Icon icon="fa-solid fa-image" /> {profileBanner ? 'Change banner' : 'Add banner'}
            </button>
            <input
              ref={profileBannerRef}
              hidden
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={chooseBanner}
            />
          </div>
        </div>
        <div className="account-eyebrow">ACCOUNT</div>
        <h3>Profile</h3>
        <p className="account-lead">
          Update the identity and writer details used throughout your MoonScribe studio.
        </p>
        <label className="account-field">
          <span>MoonScribe username</span>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            minLength={2}
            maxLength={40}
            autoComplete="username"
          />
        </label>
        <label className="account-field">
          <span>Display name</span>
          <input
            value={profileDraft.displayName}
            onChange={(event) =>
              setProfileDraft({ ...profileDraft, displayName: event.target.value })
            }
            placeholder={username || 'How MoonScribe addresses you'}
          />
        </label>
        <label className="account-field">
          <span>Writer name / pen name</span>
          <input
            value={profileDraft.writerName}
            onChange={(event) =>
              setProfileDraft({ ...profileDraft, writerName: event.target.value })
            }
            placeholder="Optional name used on exports"
          />
        </label>
        <label className="account-field">
          <span>Bio</span>
          <textarea
            value={profileDraft.profileBio}
            onChange={(event) =>
              setProfileDraft({ ...profileDraft, profileBio: event.target.value })
            }
            placeholder="A short note about you as a writer"
            rows={3}
          />
        </label>
        <div className="account-profile-grid">
          <label className="account-field">
            <span>Timezone</span>
            <Select
              value={profileDraft.timezone}
              onChange={(value) => setProfileDraft({ ...profileDraft, timezone: value })}
              options={['Australia/Brisbane', 'Australia/Sydney', 'America/New_York', 'Europe/London', 'UTC'].map((value) => ({ value, label: value }))}
            />
          </label>
          <label className="account-field">
            <span>Language</span>
            <Select
              value={profileDraft.language}
              onChange={(value) => setProfileDraft({ ...profileDraft, language: value })}
              options={[
                { value: 'en-AU', label: 'English (Australia)' },
                { value: 'en-US', label: 'English (United States)' },
                { value: 'en-GB', label: 'English (United Kingdom)' },
              ]}
            />
          </label>
        </div>
        <button
          className="account-primary"
          disabled={
            busy === 'profile' ||
            (username.trim() === account?.username &&
              JSON.stringify(profileDraft) ===
                JSON.stringify({
                  displayName: app.settings?.displayName || '',
                  writerName: app.settings?.writerName || '',
                  profileBio: app.settings?.profileBio || '',
                  timezone: app.settings?.timezone || 'UTC',
                  language: app.settings?.language || 'en-AU',
                }))
          }
          onClick={async () => {
            await saveProfile()
            await app.updateSettings?.(profileDraft)
          }}
        >
          {busy === 'profile' ? 'Saving…' : 'Save profile'}
        </button>
        <div className="account-note">
          <Icon icon="fa-solid fa-circle-info" />
          <span>
            Your username is unique and visible to collaborators. Profile details are persisted to
            your MoonScribe settings.
          </span>
        </div>
      </>
    ),
    email: (
      <>
        <div className="account-eyebrow">ACCOUNT</div>
        <h3>Email &amp; password</h3>
        <p className="account-lead">Changes are written directly to your authenticated account.</p>
        <label className="account-field">
          <span>Primary email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </label>
        <button
          className="account-primary"
          disabled={busy === 'email' || !email.trim()}
          onClick={saveEmail}
        >
          {busy === 'email' ? 'Saving…' : account?.email ? 'Update email' : 'Add email'}
        </button>
        <div className="account-note">
          <Icon
            icon={
              account?.emailVerified ? 'fa-solid fa-circle-check' : 'fa-solid fa-circle-exclamation'
            }
          />
          <span>
            {account?.email
              ? account.emailVerified
                ? 'This email is verified.'
                : 'This email still needs verification.'
              : 'Add and verify an email to use two-factor authentication.'}
          </span>
          {account?.email && !account.emailVerified && (
            <button type="button" onClick={sendVerification} disabled={busy === 'verification'}>
              {busy === 'verification' ? 'Sending…' : 'Send code'}
            </button>
          )}
        </div>
        {account?.email && !account.emailVerified && (
          <div className="account-card">
            <div>
              <span className="account-label">EMAIL VERIFICATION</span>
              <strong>Enter verification code</strong>
              <small>Use the 6-digit code sent to {account.email}.</small>
            </div>
            <label className="account-field">
              <span>Verification code</span>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                value={verificationCode}
                onChange={(event) =>
                  setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))
                }
                placeholder="123456"
              />
            </label>
            <button
              className="account-secondary"
              disabled={busy === 'verify-email' || verificationCode.length < 6}
              onClick={verifyEmail}
            >
              {busy === 'verify-email' ? 'Checking…' : 'Verify email'}
            </button>
          </div>
        )}
        <label className="account-field">
          <span>New password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={10}
            autoComplete="new-password"
            placeholder="At least 10 characters"
          />
        </label>
        <button
          className="account-secondary"
          disabled={busy === 'password' || password.length < 10}
          onClick={savePassword}
        >
          {busy === 'password' ? 'Updating…' : 'Change password'}
        </button>
      </>
    ),
    connections: (
      <>
        <div className="account-eyebrow">ACCOUNT</div>
        <h3>Sign-in methods</h3>
        <p className="account-lead">
          Connect another identity provider to this account. Your primary connector remains the
          source of your profile picture and account identity.
        </p>
        <Row
          title="Discord"
          detail={
            account?.linkedProviders?.discord
              ? `Connected${account.discordUsername ? ` · ${account.discordUsername}` : ''}${account?.provider === 'discord' ? ' · Primary' : ''}`
              : 'Not connected'
          }
          action={
            account?.linkedProviders?.discord
              ? account?.provider === 'discord'
                ? undefined
                : 'Disconnect'
              : busy === 'connectDiscord'
                ? 'Connecting…'
                : 'Connect'
          }
          disabled={busy === 'connectDiscord' || busy === 'unlink:discord'}
          onClick={
            account?.linkedProviders?.discord && account?.provider !== 'discord'
              ? () => unlink('discord')
              : () => connect('connectDiscord')
          }
          icon="fa-brands fa-discord"
          tone={account?.linkedProviders?.discord ? 'success' : ''}
        />
        <Row
          title="Google"
          detail={
            account?.linkedProviders?.google
              ? `Connected${account.email ? ` · ${account.email}` : ''}${account?.provider === 'google' ? ' · Primary' : ''}`
              : 'Not connected'
          }
          action={
            account?.linkedProviders?.google
              ? account?.provider === 'google'
                ? undefined
                : 'Disconnect'
              : busy === 'connectGoogle'
                ? 'Connecting…'
                : 'Connect'
          }
          disabled={busy === 'connectGoogle' || busy === 'unlink:google'}
          onClick={
            account?.linkedProviders?.google && account?.provider !== 'google'
              ? () => unlink('google')
              : () => connect('connectGoogle')
          }
          icon="fa-brands fa-google"
          tone={account?.linkedProviders?.google ? 'success' : ''}
        />
        <Row
          title="MoonScribe password"
          detail={
            account?.linkedProviders?.password
              ? `Configured${account?.email ? ` · ${account.email}` : ''}${account?.provider === 'email' ? ' · Primary' : ''}`
              : 'Not configured'
          }
          action="Manage"
          onClick={() => setSection('email')}
          icon="fa-solid fa-key"
        />
        <div className="account-note">
          <Icon icon="fa-solid fa-shield-halved" />
          <span>
            OAuth links the provider ID to this existing account. It does not replace the primary
            connector or its profile picture.
          </span>
        </div>
      </>
    ),
    sessions: (
      <>
        <div className="account-eyebrow">PRIVACY</div>
        <h3>Sessions</h3>
        <p className="account-lead">
          Live server sessions for this account. MoonScribe does not invent location information.
        </p>
        {sessions.length ? (
          sessions.map((session) =>
            session.current ? (
              <div className="account-session-current" key={session.id}>
                <span className="account-live" />
                <div>
                  <strong>{session.deviceName}</strong>
                  <small>
                    Created {dateTime(session.createdAt)} · {relativeTime(session.lastSeenAt)}
                  </small>
                </div>
                <span className="account-current">THIS DEVICE</span>
              </div>
            ) : (
              <Row
                key={session.id}
                title={session.deviceName}
                detail={`Last active ${relativeTime(session.lastSeenAt)} · Created ${dateTime(session.createdAt)}`}
                action={busy === `session:${session.id}` ? 'Signing out…' : 'Sign out'}
                disabled={busy === `session:${session.id}`}
                onClick={() => removeSession(session)}
                icon="fa-solid fa-laptop"
              />
            )
          )
        ) : (
          <p className="account-lead">No active sessions were returned.</p>
        )}
        <button
          className="account-secondary"
          disabled={busy === 'others' || sessions.every((item) => item.current)}
          onClick={() =>
            run('others', () => app.signOutOtherDevices(), 'All other devices were signed out.')
          }
        >
          Sign out all other devices
        </button>
      </>
    ),
    security: (
      <>
        <div className="account-eyebrow">PRIVACY</div>
        <h3>Security activity</h3>
        <p className="account-lead">Live account notices and current security controls.</p>
        <div className="account-card">
          <div>
            <span className="account-label">TWO-FACTOR AUTHENTICATION</span>
            <strong>{account?.twoFactorEnabled ? 'Enabled' : 'Disabled'}</strong>
            <small>
              {account?.emailVerified
                ? `Security codes use ${account.email}`
                : 'A verified email is required.'}
            </small>
          </div>
          <button
            className="account-secondary"
            disabled={busy === '2fa' || (!account?.twoFactorEnabled && !account?.emailVerified)}
            onClick={toggle2fa}
          >
            {busy === '2fa' ? 'Saving…' : account?.twoFactorEnabled ? 'Disable' : 'Enable'}
          </button>
        </div>
        {accountNotices.length ? (
          accountNotices.map((notice) => (
            <div className="account-activity" key={notice.id}>
              <span className="account-activity-dot" />
              <div>
                <strong>{notice.title}</strong>
                <small>
                  {dateTime(notice.createdAt)} · {notice.body}
                </small>
              </div>
            </div>
          ))
        ) : (
          <div className="account-note">
            <Icon icon="fa-solid fa-circle-check" />
            <span>No account security notices are currently recorded.</span>
          </div>
        )}
      </>
    ),
  } as Record<string, ReactElement>

  return (
    <>
      <div className="account-mobile-overlay">
        <div className="account-mobile-shell">
          <header className="account-mobile-header">
            {section !== 'overview' && (
              <button
                type="button"
                className="account-mobile-back"
                onClick={() => setSection('overview')}
                aria-label="Back to account overview"
              >
                <Icon icon="fa-solid fa-arrow-left" />
              </button>
            )}
            <div>
              <span className="account-brand">☾ MoonScribe</span>
              <h2>
                {section === 'overview'
                  ? 'Account & security'
                  : nav.find(([key]) => key === section)?.[1]}
              </h2>
              {section === 'overview' && <p>Manage your account, security and device settings.</p>}
            </div>
            <button className="account-close" onClick={onClose} aria-label="Close">
              <Icon icon="fa-solid fa-xmark" />
            </button>
          </header>
          <main
            className="account-mobile-content"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {error && (
              <div className="account-note">
                <Icon icon="fa-solid fa-circle-exclamation" />
                <span>{error}</span>
                <button type="button" onClick={() => void load()}>
                  Retry
                </button>
              </div>
            )}
            {section === 'overview' ? (
              <>
                <button
                  type="button"
                  className="account-mobile-hero"
                  onClick={() => setSection('profile')}
                  aria-label="Open profile"
                >
                  <div className="account-avatar">
                    <ProfileAvatar
                      src={account?.avatarUrl || account?.discordAvatar}
                      name={account?.username}
                    />
                  </div>
                  <div>
                    <span className="account-eyebrow">SIGNED IN AS</span>
                    <strong>{account?.username || app.syncUsername}</strong>
                    <small>{account?.email || 'No email attached'}</small>
                    <span className="account-mobile-status">
                      <i /> Free plan
                    </span>
                  </div>
                  <Icon icon="fa-solid fa-chevron-right" />
                </button>
                <section className="account-mobile-group">
                  <span className="account-mobile-group-title">ACCOUNT</span>
                  <button onClick={() => setSection('profile')}>
                    <Icon icon="fa-solid fa-user" />
                    <span>
                      Profile<small>Personal details and writer identity</small>
                    </span>
                    <Icon icon="fa-solid fa-chevron-right" />
                  </button>
                  <button onClick={() => setSection('email')}>
                    <Icon icon="fa-solid fa-envelope" />
                    <span>
                      Email &amp; password<small>Sign-in email and password</small>
                    </span>
                    <Icon icon="fa-solid fa-chevron-right" />
                  </button>
                  <button onClick={() => setSection('connections')}>
                    <Icon icon="fa-solid fa-link" />
                    <span>
                      Connected accounts<small>Google, Discord and more</small>
                    </span>
                    <Icon icon="fa-solid fa-chevron-right" />
                  </button>
                </section>
                <section className="account-mobile-group">
                  <span className="account-mobile-group-title">SECURITY</span>
                  <button onClick={() => setSection('security')}>
                    <Icon icon="fa-solid fa-shield-halved" />
                    <span>
                      Security &amp; sign-in<small>Two-factor authentication and activity</small>
                    </span>
                    <Icon icon="fa-solid fa-chevron-right" />
                  </button>
                  <button onClick={() => setSection('sessions')}>
                    <Icon icon="fa-solid fa-laptop" />
                    <span>
                      Active sessions
                      <small>
                        {sessions.length} signed-in device{sessions.length === 1 ? '' : 's'}
                      </small>
                    </span>
                    <Icon icon="fa-solid fa-chevron-right" />
                  </button>
                </section>
                <section className="account-mobile-group">
                  <span className="account-mobile-group-title">DATA &amp; SYNC</span>
                  <button
                    type="button"
                    disabled={busy === 'sync'}
                    onClick={() =>
                      void run(
                        'sync',
                        async () => {
                          await app.syncNow?.()
                        },
                        'Sync requested.'
                      )
                    }
                  >
                    <Icon icon="fa-solid fa-rotate" />
                    <span>
                      Sync &amp; storage
                      <small>
                        {busy === 'sync' ? 'Syncing…' : app.syncStatus || 'Local changes saved'}
                      </small>
                    </span>
                    <Icon icon="fa-solid fa-chevron-right" />
                  </button>
                </section>
                <section className="account-mobile-actions">
                  <span className="account-mobile-group-title">ACCOUNT ACTIONS</span>
                  <button onClick={() => app.disconnectSync?.()}>
                    <Icon icon="fa-solid fa-arrow-right-from-bracket" />
                    Sign out
                    <Icon icon="fa-solid fa-chevron-right" />
                  </button>
                  <button
                    onClick={() => {
                      setSection('security')
                      setDisableOpen(true)
                    }}
                  >
                    <Icon icon="fa-solid fa-user-slash" />
                    Disable account
                    <Icon icon="fa-solid fa-chevron-right" />
                  </button>
                  <button
                    onClick={() => {
                      setSection('security')
                      setDeleteOpen(true)
                    }}
                  >
                    <Icon icon="fa-solid fa-trash" />
                    Delete account
                    <Icon icon="fa-solid fa-chevron-right" />
                  </button>
                </section>
              </>
            ) : (
              <>
                <div className="account-mobile-subtitle">
                  {section === 'profile'
                    ? 'Your writer identity and personal details.'
                    : section === 'email'
                      ? 'Manage how you sign in to MoonScribe.'
                      : section === 'connections'
                        ? 'Link services to your MoonScribe account.'
                        : section === 'sessions'
                          ? 'Review signed-in devices.'
                          : 'Live security activity and controls.'}
                </div>
                {content[section]}
              </>
            )}
            {(disableOpen || deleteOpen) && (
              <div className="account-action-sheet">
                <strong>{deleteOpen ? 'Permanently delete account' : 'Disable account'}</strong>
                <p>
                  {deleteOpen
                    ? 'This permanently removes your MoonScribe account, writing records and sessions. This cannot be undone.'
                    : 'This signs out every device and blocks sign-in until the account is restored.'}
                </p>
                <input
                  value={deleteOpen ? deleteText : disableText}
                  onChange={(event) =>
                    deleteOpen
                      ? setDeleteText(event.target.value)
                      : setDisableText(event.target.value)
                  }
                  placeholder={`Type ${account?.username} to confirm`}
                />
                <div>
                  <button
                    className="account-secondary"
                    onClick={() => {
                      setDisableOpen(false)
                      setDeleteOpen(false)
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="account-danger-btn"
                    disabled={
                      busy === (deleteOpen ? 'delete' : 'disable') ||
                      (deleteOpen
                        ? deleteText !== account?.username
                        : disableText.toLowerCase() !== account?.username?.toLowerCase())
                    }
                    onClick={deleteOpen ? deleteAccount : disableAccount}
                  >
                    {busy === (deleteOpen ? 'delete' : 'disable')
                      ? 'Working…'
                      : deleteOpen
                        ? 'Delete permanently'
                        : 'Disable account'}
                  </button>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
      <div className="account-centre-overlay">
        <div className="account-centre">
          <header className="account-header">
            <div>
              <div className="account-brand">☾ MoonScribe</div>
              <h2>Your account &amp; security</h2>
              <p>Live information from your signed-in MoonScribe account.</p>
            </div>
            <button className="account-close" onClick={onClose} aria-label="Close">
              <Icon icon="fa-solid fa-xmark" />
            </button>
          </header>
          <div className="account-body">
            <nav className="account-nav">
              <span className="account-nav-title">ACCOUNT</span>
              {nav.map(([key, label, icon]) => (
                <button
                  key={key}
                  className={section === key ? 'active' : ''}
                  onClick={() => setSection(key)}
                >
                  <Icon icon={icon} />
                  {label}
                </button>
              ))}
              <span className="account-nav-title account-nav-actions">ACCOUNT ACTIONS</span>
              <button onClick={() => app.disconnectSync?.()}>
                <Icon icon="fa-solid fa-arrow-right-from-bracket" />
                Sign out
              </button>
              <button
                className="account-nav-danger"
                onClick={() => {
                  setSection('security')
                  setDisableOpen(true)
                }}
              >
                <Icon icon="fa-solid fa-user-slash" />
                Disable account
              </button>
              <button
                className="account-nav-danger"
                onClick={() => {
                  setSection('security')
                  setDeleteOpen(true)
                }}
              >
                <Icon icon="fa-solid fa-trash" />
                Delete account
              </button>
            </nav>
            <main
              className="account-content"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              {error && (
                <div className="account-note">
                  <Icon icon="fa-solid fa-circle-exclamation" />
                  <span>{error}</span>
                  <button type="button" onClick={() => void load()}>
                    Retry
                  </button>
                </div>
              )}
              {mergePreview && (
                <div className="account-note">
                  <Icon icon="fa-solid fa-code-merge" />
                  <span>
                    Merge{' '}
                    {mergePreview.provider?.account?.username ||
                      mergePreview.conflict?.providerUsername ||
                      'this provider'}{' '}
                    into {mergePreview.current?.account?.username || 'your account'}? This moves the
                    listed writing data and keeps your current account.
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      void app
                        .confirmAccountMerge?.(mergePreview.conflict.id)
                        .then(() => setMergePreview(null))
                    }
                  >
                    Confirm merge
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void app
                        .cancelAccountMerge?.(mergePreview.conflict.id)
                        .then(() => setMergePreview(null))
                    }
                  >
                    Cancel
                  </button>
                </div>
              )}
              {app.authFlow?.state === 'processing' && (
                <div className="account-note">
                  <Icon icon="fa-solid fa-spinner" />
                  <span>
                    Finishing {app.authFlow.provider === 'google' ? 'Google' : 'Discord'}{' '}
                    connection…
                  </span>
                </div>
              )}
              {app.authFlow?.state === 'error' && (
                <div className="account-note">
                  <Icon icon="fa-solid fa-circle-exclamation" />
                  <span>{app.authFlow.error || 'The provider could not be connected.'}</span>
                </div>
              )}
              {content[section]}
              {(disableOpen || deleteOpen) && (
                <div className="account-action-sheet">
                  <strong>{deleteOpen ? 'Permanently delete account' : 'Disable account'}</strong>
                  <p>
                    {deleteOpen
                      ? 'This permanently removes your MoonScribe account, writing records and sessions. This cannot be undone.'
                      : 'This signs out every device and blocks sign-in until the account is restored.'}
                  </p>
                  <input
                    value={deleteOpen ? deleteText : disableText}
                    onChange={(event) =>
                      deleteOpen
                        ? setDeleteText(event.target.value)
                        : setDisableText(event.target.value)
                    }
                    placeholder={`Type ${account?.username} to confirm`}
                  />
                  <div>
                    <button
                      className="account-secondary"
                      onClick={() => {
                        setDisableOpen(false)
                        setDeleteOpen(false)
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      className="account-danger-btn"
                      disabled={
                        busy === (deleteOpen ? 'delete' : 'disable') ||
                        (deleteOpen
                          ? deleteText !== account?.username
                          : disableText.toLowerCase() !== account?.username?.toLowerCase())
                      }
                      onClick={deleteOpen ? deleteAccount : disableAccount}
                    >
                      {busy === (deleteOpen ? 'delete' : 'disable')
                        ? 'Working…'
                        : deleteOpen
                          ? 'Delete permanently'
                          : 'Disable account'}
                    </button>
                  </div>
                </div>
              )}
            </main>
          </div>
        </div>
      </div>
    </>
  )
}
