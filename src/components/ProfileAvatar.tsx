import { useEffect, useState } from 'react'

export default function ProfileAvatar({ src, name, className = '' }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])

  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?'
  if (!src || failed) return <span className={`profile-avatar-fallback ${className}`} aria-hidden="true">{initial}</span>

  return <img src={src} alt="" className={`profile-avatar-media ${className}`.trim()} onError={() => setFailed(true)} referrerPolicy="no-referrer" />
}
