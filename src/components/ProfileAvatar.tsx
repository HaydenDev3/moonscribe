import { useEffect, useState } from 'react'

export default function ProfileAvatar({ src, name, className = '' }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])

  const initials = (name || '?').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase() || '?'
  const label = name ? `${name} profile picture` : 'Profile picture'
  if (!src || failed) return <span className={`profile-avatar-fallback ${className}`.trim()} aria-label={label}>{initials}</span>

  return <img src={src} alt={label} className={`profile-avatar-media ${className}`.trim()} onError={() => setFailed(true)} referrerPolicy="no-referrer" loading="lazy" decoding="async" />
}
