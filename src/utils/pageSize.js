// Trim sizes and print geometry shared by the Book Designer, print view and
// DOCX export. All sizes in millimetres; DOCX wants twips (1 mm ≈ 56.69 twips).

export const PAGE_PRESETS = [
  { key: 'us-trade', label: 'US Trade (6×9″)', w: 152.4, h: 228.6 },
  { key: 'trade-paperback', label: 'Trade paperback (5.5×8.5″)', w: 139.7, h: 215.9 },
  { key: 'us-5x8', label: 'US 5×8″', w: 127, h: 203.2 },
  { key: 'a5', label: 'A5 (148×210mm)', w: 148, h: 210 },
  { key: 'pocket', label: 'Pocket (4.25×6.87″)', w: 107.95, h: 174.6 }
]

export const MM_TO_TWIPS = 56.6929

export function mmToTwips(mm) {
  return Math.round((Number(mm) || 0) * MM_TO_TWIPS)
}

export function pageSizeMm(pageSize) {
  if (typeof pageSize === 'string') {
    const preset = PAGE_PRESETS.find((p) => p.key === pageSize)
    if (preset) return { w: preset.w, h: preset.h }
  }
  if (pageSize && typeof pageSize === 'object' && Number(pageSize.w) > 0 && Number(pageSize.h) > 0) {
    return { w: Number(pageSize.w), h: Number(pageSize.h) }
  }
  const fallback = PAGE_PRESETS[1] // trade paperback
  return { w: fallback.w, h: fallback.h }
}

export function pageSizeTwips(pageSize) {
  const { w, h } = pageSizeMm(pageSize)
  return { width: mmToTwips(w), height: mmToTwips(h) }
}

export function pageMarginMm(margin) {
  const m = Number(margin)
  return Number.isFinite(m) && m > 0 ? m : 20
}
