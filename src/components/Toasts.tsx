import { useApp } from '../context/AppContext'

export default function Toasts() {
  const { toasts } = useApp()
  if (!toasts.length) return null
  return (
    <div className="toast-wrap" role="status" aria-live="polite" aria-atomic="true">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          <span>{t.msg}</span>{t.action && <button type="button" className="toast-undo" onClick={() => { void t.action.run(); }}>{t.action.label || 'Undo'}</button>}
        </div>
      ))}
    </div>
  )
}
