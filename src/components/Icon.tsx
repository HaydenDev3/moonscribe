import type { CSSProperties, ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'

// Icon: renders a FontAwesome icon when given a class string like
// "fa-solid fa-pen-nib", otherwise falls back to plain text glyphs.
type IconProps = {
  icon: ReactNode
  className?: string
  style?: CSSProperties
  animated?: boolean
}

export default function Icon({ icon, className = '', style, animated = false }: IconProps) {
  const reduceMotion = useReducedMotion()
  if (typeof icon === 'string' && icon.startsWith('fa-')) {
    if (animated) {
      return (
        <motion.i
          className={`${icon} ${className}`.trim()}
          style={style}
          aria-hidden="true"
          whileHover={reduceMotion ? undefined : { rotate: 8, scale: 1.08 }}
          whileTap={reduceMotion ? undefined : { scale: 0.88 }}
          transition={{ type: 'spring', stiffness: 420, damping: 18 }}
        />
      )
    }
    return <i className={`${icon} ${className}`.trim()} style={style} aria-hidden="true" />
  }

  if (animated) {
    return (
      <motion.span
        className={className}
        style={style}
        aria-hidden="true"
        whileHover={reduceMotion ? undefined : { rotate: 8, scale: 1.08 }}
        whileTap={reduceMotion ? undefined : { scale: 0.88 }}
        transition={{ type: 'spring', stiffness: 420, damping: 18 }}
      >
        {icon}
      </motion.span>
    )
  }

  return (
    <span className={className} style={style}>
      {icon}
    </span>
  )
}
