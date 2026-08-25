export const BOOK_SURFACES = ['front', 'spine', 'back']

export function normalizeBookGeometry(measurements = {}) {
  const trimWidthMm = Number(measurements.trimWidthMm) || 152.4
  const trimHeightMm = Number(measurements.trimHeightMm) || 228.6
  const spineMm = Math.max(2, Number(measurements.spineMm) || 2)
  const bleedMm = Math.max(0, Number(measurements.bleedMm) || 0)
  const pages = Math.max(1, Number(measurements.pages) || 1)
  return {
    trimWidthMm,
    trimHeightMm,
    spineMm,
    bleedMm,
    pages,
    aspect: trimHeightMm / trimWidthMm,
    spineRatio: spineMm / trimWidthMm,
  }
}

export function geometryChanged(previous, next, tolerance = 0.01) {
  if (!previous || !next) return true
  return ['trimWidthMm', 'trimHeightMm', 'spineMm', 'bleedMm', 'pages'].some((key) => Math.abs(Number(previous[key] || 0) - Number(next[key] || 0)) > tolerance)
}

export function canUseWebGL() {
  if (typeof document === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
  } catch {
    return false
  }
}

export function rendererDiagnostics({ webgl = false, quality = 'balanced', contextLosses = 0, textureFailures = 0, lastError = null } = {}) {
  return {
    webgl,
    quality,
    contextLosses,
    textureFailures,
    lastError,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
  }
}
