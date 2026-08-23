import { useEffect, useState } from 'react'
import { getConfig } from '../sync/engine'
import Icon from './Icon'
import { sanitizeAnnouncementHtml } from '../utils/announcementMarkup'

type Announcement = { id: string; title: string; body: string; severity: 'info' | 'success' | 'warning' | 'critical' }

export default function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null)
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const config = await getConfig()
      if (!config.server || !config.token) return
      const response = await fetch(`${config.server.replace(/\/$/, '')}/api/announcements`, { headers: { Authorization: `Bearer ${config.token}` } })
      if (!response.ok) return
      const payload = await response.json()
      const next = (payload.announcements || []).find((item: Announcement) => localStorage.getItem(`moonscribe:announcement:${item.id}`) !== 'dismissed')
      if (!cancelled) setAnnouncement(next || null)
    }
    void load()
    return () => { cancelled = true }
  }, [])
  if (!announcement) return null
  return <aside className={`announcement-banner severity-${announcement.severity}`} role="status"><Icon icon={announcement.severity === 'critical' ? 'fa-solid fa-triangle-exclamation' : 'fa-solid fa-sparkles'} /><div><strong>{announcement.title}</strong><div className="announcement-rich-body" dangerouslySetInnerHTML={{ __html: sanitizeAnnouncementHtml(announcement.body) }} /></div><button aria-label="Dismiss announcement" onClick={() => { localStorage.setItem(`moonscribe:announcement:${announcement.id}`, 'dismissed'); setAnnouncement(null) }}><Icon icon="fa-solid fa-xmark" /></button></aside>
}
