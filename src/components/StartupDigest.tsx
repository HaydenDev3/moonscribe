import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'

const todayKey = () => `moonscribe:startup-digest:${new Date().toISOString().slice(0, 10)}`

export default function StartupDigest() {
  const { settings, syncUsername } = useApp() as any
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (settings?.startupDigest === false || !settings || !localStorage || localStorage.getItem(todayKey())) return
    localStorage.setItem(todayKey(), 'shown')
    setOpen(true)
    if (settings.startupSound !== false) import('../utils/sounds').then(({ playStartupSound }) => playStartupSound({ masterEnabled: settings.soundEnabled, channelEnabled: settings.startupSound, masterVolume: settings.soundVolume, channelVolume: settings.startupSoundVolume }))
  }, [settings])
  if (!open) return null
  const close = () => setOpen(false)
  return <div className="startup-digest" role="dialog" aria-modal="true" aria-labelledby="startup-digest-title">
    <div className="startup-digest-card">
      <div className="startup-digest-moon" aria-hidden="true">☾</div>
      <span className="startup-digest-kicker">MOONSCRIBE · DAILY BRIEFING</span>
      <h1 id="startup-digest-title">Good to see you{syncUsername ? `, ${syncUsername}` : ''}.</h1>
      <p className="startup-digest-date">{new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}</p>
      <div className="startup-digest-grid"><div><strong>One quiet page</strong><span>Your library is ready for the next scene.</span></div><div><strong>Local-first</strong><span>Your work remains available offline.</span></div><div><strong>Make today yours</strong><span>Even a few words keep the story moving.</span></div></div>
      <button className="button button-primary" onClick={close} autoFocus>Open my studio</button>
      <button className="startup-digest-dismiss" onClick={close}>Skip today’s briefing</button>
    </div>
  </div>
}
