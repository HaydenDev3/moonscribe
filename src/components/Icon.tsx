import type { CSSProperties, ReactNode } from 'react'

// Icon: renders a FontAwesome icon when given a class string like
// "fa-solid fa-pen-nib", otherwise falls back to plain text glyphs.
type IconProps = {
  icon: ReactNode
  className?: string
  style?: CSSProperties
}

export default function Icon({ icon, className = '', style }: IconProps) {
  if (typeof icon === 'string' && icon.startsWith('fa-')) {
    return <i className={`${icon} ${className}`.trim()} style={style} aria-hidden="true" />
  }

  return <span className={className} style={style}>{icon}</span>
}
