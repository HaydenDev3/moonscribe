import { useEffect, useRef, useState, type ComponentType, type FormEvent } from 'react'
import Icon from './Icon'

export default function LockScreen({ kind = 'passphrase', onUnlock, title = 'Your library is locked', lead }: any) {
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [visible, setVisible] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [success, setSuccess] = useState(false)
  const [BookRenderer, setBookRenderer] = useState<ComponentType<any> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const isPin = kind === 'pin'

  useEffect(() => {
    const timer = window.setTimeout(() => inputRef.current?.focus(), 120)
    import('../pages/CoverMockup3D').then((module) => setBookRenderer(() => module.default)).catch(() => {})
    return () => window.clearTimeout(timer)
  }, [])

  const submit = async (event?: FormEvent) => {
    event?.preventDefault()
    if (!value || busy) return
    setBusy(true); setError(false); setSuccess(true)
    await new Promise((resolve) => window.setTimeout(resolve, 650))
    const ok = await onUnlock(value)
    if (!ok) { setSuccess(false); setBusy(false); setError(true); setValue(''); inputRef.current?.focus(); return }
    await new Promise((resolve) => window.setTimeout(resolve, 280))
  }

  const neutralBook = { title: 'Your Library', byline: 'MoonScribe', coverStyle: 'moonstone', gradient: 'linear-gradient(145deg,#17161a,#29231a)', titleColor: '#d6a64b', showText: true, showBackText: false, showSpineText: false, autoSpin: false, immersive: false, centered: true, lockScreen: true, trimWidthMm: 152.4, trimHeightMm: 228.6, spineMm: 22, environment: 'studio', quality: 'balanced', reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches }

  return <main className={`lockscreen lockscreen-cinematic ${success ? 'is-unlocking' : ''}`}>
    <header className="lockscreen-brand"><span className="lockscreen-brand-mark">M</span><div><strong>MoonScribe</strong><small>Stories, quietly written.</small></div></header>
    <section className="lockscreen-layout" aria-label="Unlock MoonScribe library">
      <div className="lockscreen-book" aria-hidden="true">{BookRenderer ? <BookRenderer {...neutralBook} /> : <div className="lockscreen-book-fallback"><span>☾</span><b>MOONSCRIBE</b><small>YOUR LIBRARY</small></div>}</div>
      <div className="lockscreen-content">
        <span className="lockscreen-kicker"><Icon icon="fa-solid fa-lock" /> Private library</span>
        <h1>{title === 'Welcome back' ? 'Your library is locked' : title}</h1>
        <p className="lockscreen-lead">{lead || (isPin ? 'Enter your PIN to return to your stories.' : 'Enter your passphrase to return to your stories.')}</p>
        <form onSubmit={submit} className="lockscreen-form">
          <label className="lockscreen-field"><span className="sr-only">{isPin ? 'PIN' : 'Passphrase'}</span><Icon icon="fa-solid fa-lock" /><input ref={inputRef} className={error ? 'error' : ''} type={visible ? 'text' : 'password'} inputMode={isPin ? 'numeric' : 'text'} autoComplete="current-password" value={value} onChange={(event) => { setValue(isPin ? event.target.value.replace(/\D/g, '').slice(0, 6) : event.target.value); setError(false) }} onKeyUp={(event) => setCapsLock(event.getModifierState?.('CapsLock') || false)} placeholder={isPin ? 'Enter PIN' : 'Enter passphrase'} aria-invalid={error} /><button type="button" onClick={() => setVisible((current) => !current)} aria-label={visible ? 'Hide passphrase' : 'Show passphrase'}><Icon icon={visible ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'} /></button></label>
          {capsLock && <p className="lockscreen-caps" role="status">Caps Lock is on</p>}
          {error && <p className="lockscreen-error" role="alert">{isPin ? 'That PIN didn’t work.' : 'That passphrase didn’t work.'}</p>}
          <button type="submit" className="lockscreen-unlock button button-primary" disabled={!value || busy}>{busy ? 'Opening library…' : 'Unlock Library →'}</button>
        </form>
        <button type="button" className="lockscreen-help" onClick={() => setHelpOpen(true)}>Having trouble?</button>
        <p className="lockscreen-security"><Icon icon="fa-solid fa-shield-halved" /><span><strong>Protected on this device</strong><small>Your passphrase never leaves this device.</small></span></p>
      </div>
    </section>
    {helpOpen && <div className="lockscreen-help-dialog" role="dialog" aria-modal="true" aria-labelledby="lockscreen-help-title"><div><button type="button" className="lockscreen-help-close" onClick={() => setHelpOpen(false)} aria-label="Close help"><Icon icon="fa-solid fa-xmark" /></button><h2 id="lockscreen-help-title">Having trouble?</h2><p>MoonScribe does not store your passphrase. If it is lost, the locked library cannot be recovered through MoonScribe.</p><button type="button" className="button button-primary" onClick={() => setHelpOpen(false)}>Understood</button></div></div>}
  </main>
}
