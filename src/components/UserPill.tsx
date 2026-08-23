import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../context/AppContext'
import Icon from './Icon'
import ProfileAvatar from './ProfileAvatar'

export default function UserPill({ onConnectClick }) {
  const { syncUsername, syncServer, syncStatus, syncDiscordAvatar, syncProvider, disconnectSync, syncNow, openSettings, toast } = useApp()
  const [open, setOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 16, width: 220 })
  const ref = useRef(null)
  const menuRef = useRef(null)

  const positionMenu = () => {
    const trigger = ref.current?.querySelector('.user-pill')
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const menuWidth = 220
    setMenuPosition({
      top: Math.min(rect.bottom + 8, window.innerHeight - 12),
      right: Math.max(12, window.innerWidth - rect.right),
      width: Math.min(menuWidth, window.innerWidth - 24),
    })
  }

  useEffect(() => {
    if (!open) return
    positionMenu()
    const reposition = () => positionMenu()
    const close = (e) => {
      if (!ref.current?.contains(e.target) && !menuRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      document.removeEventListener('mousedown', close)
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [open])

  const copyId = () => {
    const id = syncUsername || ''
    if (!id) return
    navigator.clipboard?.writeText(id).then(() => toast('Username copied.'))
    setOpen(false)
  }

  const signOut = async () => {
    try {
      await disconnectSync()
      toast('Signed out.')
    } finally { setOpen(false) }
  }

  const sync = async () => {
    setOpen(false)
    try { await syncNow?.(); toast('Synced.') } catch { toast('Sync needs attention.') }
  }

  if (!syncUsername) {
    return (
      <button className="user-pill user-pill-anon" onClick={onConnectClick}>
        <span className="user-pill-avatar user-pill-avatar-anon">
          <Icon icon="fa-solid fa-user" />
        </span>
        <span className="user-pill-name">Sign in</span>
        <Icon icon="fa-solid fa-chevron-down" className="user-pill-caret" />
      </button>
    )
  }

  const initials = (syncUsername || '?')[0].toUpperCase()
  const isDiscord = syncProvider === 'discord'
  const statusColor = syncStatus === 'synced' ? '#22c55e' : syncStatus === 'error' ? '#ef4444' : '#94a3b8'

  return (
    <div className="user-pill-wrap" ref={ref}>
      <button className="user-pill" onClick={() => setOpen((v) => !v)} onContextMenu={(event) => { event.preventDefault(); setOpen(true) }} aria-expanded={open}>
        <span className="user-pill-avatar">
          {isDiscord
            ? <ProfileAvatar src={syncDiscordAvatar} name={syncUsername} className="user-pill-img" />
            : <span className="user-pill-initials">{initials}</span>
          }
          <span className="user-pill-dot" style={{ background: statusColor }} />
        </span>
        <span className="user-pill-name">{syncUsername}</span>
        {isDiscord && <span className="user-pill-discord" title="Discord account"><Icon icon="fa-brands fa-discord" /></span>}
        <Icon icon="fa-solid fa-chevron-down" className={`user-pill-caret${open ? ' open' : ''}`} />
      </button>

      {open && createPortal(
        <div ref={menuRef} className="user-pill-menu" style={{ top: menuPosition.top, right: menuPosition.right, width: menuPosition.width }}>
          <div className="user-pill-header">
            <div className="user-pill-header-avatar">
              {isDiscord
                ? <ProfileAvatar src={syncDiscordAvatar} name={syncUsername} className="user-pill-header-img" />
                : <span className="user-pill-header-initials">{initials}</span>
              }
            </div>
            <div>
              <div className="user-pill-header-name">{syncUsername}</div>
              <div className="user-pill-header-server">{syncServer?.replace(/https?:\/\//, '')}</div>
            </div>
          </div>
          <div className="user-pill-sep" />
          <button className="user-pill-item" onClick={() => { openSettings(); setOpen(false) }}>
            <Icon icon="fa-solid fa-gear" /> Settings
          </button>
          <button className="user-pill-item" onClick={sync}>
            <Icon icon="fa-solid fa-rotate" /> Sync now
          </button>
          {isDiscord && (
            <button className="user-pill-item" onClick={copyId}>
              <Icon icon="fa-regular fa-copy" /> Copy username
            </button>
          )}
          <div className="user-pill-sep" />
          <button className="user-pill-item user-pill-item-danger" onClick={signOut}>
            <Icon icon="fa-solid fa-right-from-bracket" /> Sign out
          </button>
        </div>,
        document.body,
      )}
    </div>
  )
}
