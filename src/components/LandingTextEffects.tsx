import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'

export function MorphingText({ words }: { words: string[] }) {
  const reducedMotion = useReducedMotion()
  const [index, setIndex] = useState(0)
  useEffect(() => {
    if (reducedMotion || words.length < 2) return
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % words.length), 3000)
    return () => window.clearInterval(timer)
  }, [reducedMotion, words.length])
  return <motion.span key={words[index]} initial={reducedMotion ? undefined : { opacity: 0, filter: 'blur(8px)', y: 6 }} animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }} transition={{ duration: .55 }} aria-live="polite">{words[index]}</motion.span>
}

export function HighlightText({ children }: { children: string }) {
  const reducedMotion = useReducedMotion()
  return <span className="landing-highlight-text"><motion.i initial={reducedMotion ? undefined : { scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true, amount: .8 }} transition={{ duration: .8, delay: .2 }} aria-hidden="true" />{children}</span>
}

export function TypingText({ text }: { text: string }) {
  const reducedMotion = useReducedMotion()
  const [visible, setVisible] = useState(reducedMotion ? text : '')
  useEffect(() => {
    if (reducedMotion) { setVisible(text); return }
    let cursor = 0
    setVisible('')
    const timer = window.setInterval(() => {
      cursor += 1
      setVisible(text.slice(0, cursor))
      if (cursor >= text.length) window.clearInterval(timer)
    }, 34)
    return () => window.clearInterval(timer)
  }, [reducedMotion, text])
  return <span className="landing-typing-text" aria-label={text}>{visible}<i aria-hidden="true" /></span>
}
