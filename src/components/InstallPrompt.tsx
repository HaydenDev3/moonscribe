import { useEffect, useState } from 'react'
import Icon from './Icon'

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

export default function InstallPrompt() {
  const [event, setEvent] = useState<InstallEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as typeof navigator & { standalone?: boolean }).standalone) return
    if (sessionStorage.getItem('moonscribe:install-dismissed') === '1') return
    const onBeforeInstall = (value: Event) => {
      value.preventDefault()
      setEvent(value as InstallEvent)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [])

  if (!visible || !event) return null
  const install = async () => {
    await event.prompt()
    const choice = await event.userChoice
    if (choice.outcome === 'accepted') setVisible(false)
  }
  const dismiss = () => {
    sessionStorage.setItem('moonscribe:install-dismissed', '1')
    setVisible(false)
  }
  return <aside className="install-prompt" role="dialog" aria-label="Install MoonScribe">
    <span className="install-prompt-icon" aria-hidden="true"><Icon icon="fa-solid fa-feather-pointed" /></span>
    <div><strong>Keep MoonScribe close</strong><p>Install the writing room for quicker, offline-friendly access.</p></div>
    <button type="button" className="button button-primary" onClick={() => void install()}>Install</button>
    <button type="button" className="button button-quiet" onClick={dismiss} aria-label="Dismiss install prompt"><Icon icon="fa-solid fa-xmark" /></button>
  </aside>
}
