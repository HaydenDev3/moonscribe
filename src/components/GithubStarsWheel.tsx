import { motion, useReducedMotion } from 'motion/react'

type GithubStarsWheelProps = {
  stars: number | null
  href: string
}

export default function GithubStarsWheel({ stars, href }: GithubStarsWheelProps) {
  const reducedMotion = useReducedMotion()
  const label = stars === null ? 'GitHub stars unavailable' : `${stars.toLocaleString()} GitHub stars`

  return (
    <a className="landing-github-wheel" href={href} target="_blank" rel="noreferrer" aria-label={label}>
      <motion.span
        className="landing-github-wheel-ring"
        animate={reducedMotion ? undefined : { rotate: 360 }}
        transition={reducedMotion ? undefined : { duration: 22, repeat: Infinity, ease: 'linear' }}
        aria-hidden="true"
      >
        {Array.from({ length: 12 }, (_, index) => <i key={index} style={{ transform: `rotate(${index * 30}deg) translateY(-44px)` }}>✦</i>)}
      </motion.span>
      <span className="landing-github-wheel-core"><span>{stars === null ? '—' : stars.toLocaleString()}</span><small>stars</small></span>
    </a>
  )
}
