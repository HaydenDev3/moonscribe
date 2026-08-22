import { useEffect, useRef, useCallback } from 'react'

// Debounce delay for draft writes (ms).
const WRITE_DELAY = 400

/**
 * Persists `value` to localStorage under `key` whenever it changes,
 * debounced so rapid keystrokes don't hammer the storage layer.
 *
 * Returns:
 *   clearDraft()  — call this after a successful save so the recovered
 *                   draft doesn't re-appear the next time the form opens.
 *   hasDraft      — true if a previously saved draft exists for this key
 *                   at the time the hook first mounted.
 */
export function useDraftRecovery(key, value, enabled = true) {
  const timer = useRef(null)
  const initialValue = useRef(value)

  // Track whether a draft existed when the form opened.
  const hasDraft = useRef(false)
  useEffect(() => {
    hasDraft.current = !!localStorage.getItem(key)
  }, [])

  useEffect(() => {
    if (!enabled || !key) return
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(value))
      } catch {
        // storage quota exceeded — silent fail, worst case they lose the draft
      }
    }, WRITE_DELAY)
    return () => clearTimeout(timer.current)
  }, [key, value, enabled])

  const clearDraft = useCallback(() => {
    clearTimeout(timer.current)
    if (key) localStorage.removeItem(key)
  }, [key])

  return { clearDraft, hasDraft: hasDraft.current }
}

/**
 * Read back a saved draft. Returns `null` if nothing was stored.
 * Pass `fallback` to get that value instead of null when there's no draft.
 */
export function readDraft(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

/** Build a stable localStorage key for a binder draft. */
export function draftKey(novelId, kind, entityId = 'new') {
  return `moonscribe_draft_${kind}_${novelId}_${entityId}`
}
