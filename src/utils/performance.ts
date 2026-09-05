const marks = new Map<string, number>()

export function markPerformance(name: string) {
  if (!import.meta.env.DEV || typeof performance === 'undefined') return
  const now = performance.now()
  marks.set(name, now)
  performance.mark(`moonscribe:${name}`)
  if (name !== 'app-shell-start') {
    const start = marks.get('app-shell-start')
    if (start !== undefined) console.debug(`[MoonScribe performance] ${name}: ${(now - start).toFixed(1)}ms`)
  }
}

export function getPerformanceMark(name: string) {
  return marks.get(name) ?? null
}
