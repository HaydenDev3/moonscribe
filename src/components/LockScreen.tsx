import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'

// The gate shown before the library when an app lock is set. Accepts a PIN or a
// passphrase (the lock doesn't care which — it's the same verifier). Purely a
// convenience barrier against casual access; it is not a claim of at-rest
// encryption on its own.
export default function LockScreen({ kind = 'passphrase', onUnlock, title = 'Welcome back', lead }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef(null)
  const isPin = kind === 'pin'

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 60)
    return () => clearTimeout(t)
  }, [])

  const submit = async (e) => {
    e?.preventDefault()
    if (!value || busy) return
    setBusy(true)
    const ok = await onUnlock(value)
    setBusy(false)
    if (!ok) {
      setError(true)
      setValue('')
      inputRef.current?.focus()
    }
  }

  return (
    <div className="lockscreen">
      <form className="lockscreen-card" onSubmit={submit}>
        <div className="lockscreen-mark">
          <Icon icon="fa-solid fa-moon" />
        </div>
        <h1>{title}</h1>
        <p className="lockscreen-lead">
          {lead || (isPin ? 'Enter your PIN to open your library.' : 'Enter your passphrase to open your library.')}
        </p>
        <input
          ref={inputRef}
          className={`lockscreen-input ${error ? 'error' : ''}`}
          type="password"
          inputMode={isPin ? 'numeric' : 'text'}
          autoComplete="off"
          value={value}
          onChange={(e) => { setValue(isPin ? e.target.value.replace(/\D/g, '').slice(0, 6) : e.target.value); setError(false) }}
          placeholder={isPin ? '••••' : 'Passphrase'}
          aria-label={isPin ? 'PIN' : 'Passphrase'}
          aria-invalid={error}
        />
        {error && <div className="lockscreen-error">That didn’t match. Try again.</div>}
        <button type="submit" className="button button-primary" disabled={!value || busy} style={{ width: '100%', justifyContent: 'center' }}>
          {busy ? 'Unlocking…' : 'Unlock'}
        </button>
        <p className="lockscreen-hint">Your passphrase never leaves this device and can’t be recovered.</p>
      </form>
    </div>
  )
}
