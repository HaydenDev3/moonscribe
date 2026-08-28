const KEY = 'moonscribe:recent-writing'

export function readRecentWriting() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || 'null')
    return value && typeof value === 'object' ? value : null
  } catch { return null }
}

export function saveRecentWriting(context) {
  if (!context?.novelId || !context?.chapterId) return
  try {
    localStorage.setItem(KEY, JSON.stringify({
      novelId: context.novelId,
      chapterId: context.chapterId,
      mode: context.mode || 'write',
      scrollTop: Math.max(0, Number(context.scrollTop) || 0),
      updatedAt: Date.now()
    }))
  } catch { /* best effort */ }
}

export function clearRecentWriting() {
  try { localStorage.removeItem(KEY) } catch { /* best effort */ }
}
