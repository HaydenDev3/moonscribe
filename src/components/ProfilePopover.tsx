import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon'
import ProfileAvatar from './ProfileAvatar'

export type ProfilePopoverData = {
  username?: string | null
  displayName?: string | null
  writerName?: string | null
  bio?: string | null
  avatarUrl?: string | null
  bannerUrl?: string | null
  role?: string | null
  presence?: 'online' | 'idle' | 'offline'
  activity?: string | null
  joinedAt?: number | null
  showBanner?: boolean
  showBio?: boolean
  showPresence?: boolean
  showActivity?: boolean
}

const presenceMeta = {
  online: ['Online', '#78c7a0'],
  idle: ['Idle', '#d4ab62'],
  offline: ['Offline', '#777b85'],
} as const

export default function ProfilePopover({ anchor, profile, open, onClose, actions = [] }: { anchor: HTMLElement | null; profile: ProfilePopoverData; open: boolean; onClose: () => void; actions?: Array<{ label: string; icon?: string; onClick: () => void }> }) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [mobile, setMobile] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const [visible, setVisible] = useState(open)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  useEffect(() => {
    if (open) setVisible(true)
    else if (visible) {
      const timer = window.setTimeout(() => setVisible(false), 180)
      return () => window.clearTimeout(timer)
    }
  }, [open, visible])
  useEffect(() => {
    if (!open) return
    const update = () => {
      const narrow = window.innerWidth <= 640
      setMobile(narrow)
      if (narrow || !anchor) return
      const rect = anchor.getBoundingClientRect()
      const width = Math.min(320, window.innerWidth - 24)
      setPosition({ top: Math.min(rect.bottom + 10, window.innerHeight - 460), left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)) })
    }
    // Dismiss after click bubbling so action buttons always receive their
    // handler before an outside click can close the portal.
    const outside = (event: MouseEvent) => { if (!anchor?.contains(event.target as Node) && !panelRef.current?.contains(event.target as Node)) onClose() }
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    update(); document.addEventListener('click', outside); document.addEventListener('keydown', key); window.addEventListener('resize', update); window.addEventListener('scroll', update, true)
    return () => { document.removeEventListener('click', outside); document.removeEventListener('keydown', key); window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true) }
  }, [open, anchor, onClose])
  if (!visible) return null
  const username = profile.username || 'MoonScribe writer'
  const name = profile.displayName || profile.writerName || username
  const presence = profile.presence || 'offline'
  const [presenceLabel, presenceColor] = presenceMeta[presence]
  return createPortal(<div ref={panelRef} onPointerDown={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()} className={`profile-popover${mobile ? ' profile-popover-mobile' : ''}${open ? ' profile-popover-open' : ' profile-popover-closing'}`} style={mobile ? undefined : { top: position.top, left: position.left }} role="dialog" aria-label={`${username} profile`}>
    <div className="profile-popover-banner" style={profile.showBanner !== false && profile.bannerUrl ? { backgroundImage: `linear-gradient(180deg, rgba(10,11,15,.18), rgba(10,11,15,.92)), url(${profile.bannerUrl})` } : undefined} />
    <div className="profile-popover-body"><div className="profile-popover-avatar"><ProfileAvatar src={profile.avatarUrl} name={username} /><i style={{ background: presenceColor }} /></div><div className="profile-popover-identity"><strong>{name}</strong><span>@{username}</span>{profile.role && <em>{profile.role}</em>}</div><button type="button" className="profile-popover-close" onClick={onClose} aria-label="Close profile"><Icon icon="fa-solid fa-xmark" /></button></div>
    {profile.showPresence !== false && <div className="profile-popover-presence"><i style={{ background: presenceColor }} />{presenceLabel}</div>}
    {profile.showBio !== false && (profile.bio || profile.writerName) && <p className="profile-popover-bio">{profile.bio || profile.writerName}</p>}
    {profile.showActivity !== false && profile.activity && <div className="profile-popover-activity"><Icon icon="fa-solid fa-pen-nib" />{profile.activity}</div>}
    {profile.joinedAt && <small className="profile-popover-joined">Member since {new Date(profile.joinedAt).toLocaleDateString()}</small>}
    {actions.length > 0 && <div className="profile-popover-actions">{actions.map((action) => <button type="button" key={action.label} disabled={busyAction === action.label} onPointerDown={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()} onClick={async () => { setBusyAction(action.label); try { await action.onClick() } finally { setBusyAction(null); onClose() } }}>{action.icon && <Icon icon={action.icon} />}{busyAction === action.label ? 'Working…' : action.label}</button>)}</div>}
  </div>, document.body)
}
