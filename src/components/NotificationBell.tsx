import { useEffect, useState } from 'react'
import Icon from './Icon'
import { getConfig } from '../sync/engine'
import { notifyDesktop } from '../platform/notifications'
import { useApp } from '../context/AppContext'

type Notice = { id: string; title: string; body: string; category?: string; readAt: number | null; createdAt: number; actionUrl?: string | null }

export default function NotificationBell() {
  const { settings } = useApp()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notice[]>([])
  const [unread, setUnread] = useState(0)
  const [filter, setFilter] = useState('All')
  const load = async () => {
    const config = await getConfig()
    if (!config.server || !config.token) return
    const response = await fetch(`${config.server.replace(/\/$/, '')}/api/notifications`, { headers: { Authorization: `Bearer ${config.token}` } })
    if (!response.ok) return
    const data = await response.json()
    setItems(data.notifications || [])
    setUnread(Number(data.unreadCount || 0))
  }
  useEffect(() => { void load() }, [])
  useEffect(() => {
    let socket: WebSocket | null = null
    let closed = false
    let retryTimer: number | null = null
    const connect = async () => {
      const config = await getConfig()
      if (closed || !config.server || !config.token || typeof WebSocket === 'undefined') return
      const url = `${config.server.replace(/^http/i, 'ws').replace(/\/$/, '')}/ws/notifications?token=${encodeURIComponent(config.token)}`
      socket = new WebSocket(url)
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data?.type !== 'notification:new' || !data.notification) return
          setItems((current) => [data.notification, ...current.filter((item) => item.id !== data.notification.id)].slice(0, 50))
          setUnread((current) => current + (data.notification.readAt ? 0 : 1))
          if (!data.notification.readAt && settings.desktopNotifications !== false) void notifyDesktop(data.notification.title || 'MoonScribe', data.notification.body || 'You have a new notification.')
        } catch { /* ignore malformed realtime events */ }
      }
      socket.onclose = () => { if (!closed) retryTimer = window.setTimeout(connect, 1500) }
      socket.onerror = () => { try { socket?.close() } catch { /* noop */ } }
    }
    void connect()
    return () => { closed = true; if (retryTimer) window.clearTimeout(retryTimer); try { socket?.close() } catch { /* noop */ } }
  }, [settings.desktopNotifications])
  const markRead = async (id: string) => {
    const config = await getConfig()
    if (!config.server || !config.token) return
    await fetch(`${config.server.replace(/\/$/, '')}/api/notifications/${id}/read`, { method: 'POST', headers: { Authorization: `Bearer ${config.token}` } })
    setItems((current) => current.map((item) => item.id === id ? { ...item, readAt: Date.now() } : item))
    setUnread((current) => Math.max(0, current - 1))
  }
  const markAll = async () => {
    const config = await getConfig()
    if (!config.server || !config.token) return
    await fetch(`${config.server.replace(/\/$/, '')}/api/notifications/read-all`, { method: 'POST', headers: { Authorization: `Bearer ${config.token}` } })
    setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt || Date.now() })))
    setUnread(0)
  }
  return <div className="notification-bell" style={{ position: 'relative' }}>
    <button className="button button-quiet" aria-label="Notifications" onClick={() => { setOpen((value) => !value); if (!open) void load() }}>
      <Icon icon="fa-regular fa-bell" />{unread > 0 && <span className="notification-badge">{unread > 99 ? '99+' : unread}</span>}
    </button>
    {open && <div className="notification-popover" role="dialog" aria-label="Notifications">
      <div className="notification-popover-header"><strong>Notifications</strong>{unread > 0 && <button className="button button-quiet" onClick={() => void markAll()}>Mark all read</button>}</div>
      <div className="notification-tabs" role="tablist">{['All', 'Writing', 'Collaboration', 'Account'].map((tab) => <button key={tab} className={filter === tab ? 'active' : ''} role="tab" aria-selected={filter === tab} onClick={() => setFilter(tab)}>{tab}</button>)}</div>
      {items.filter((item) => filter === 'All' || item.category?.toLowerCase() === filter.toLowerCase()).length === 0 ? <div className="notification-empty"><strong>You’re all caught up.</strong><p className="muted">No new notes from MoonScribe, collaborators or your writing goals.</p></div> : items.filter((item) => filter === 'All' || item.category?.toLowerCase() === filter.toLowerCase()).map((item) => <button key={item.id} className={`notification-item ${item.readAt ? '' : 'unread'}`} onClick={() => { if (!item.readAt) void markRead(item.id); if (item.actionUrl) window.location.assign(item.actionUrl) }}><strong>{item.title}</strong><span>{item.body}</span></button>)}
    </div>}
  </div>
}
