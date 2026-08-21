import { pageSizeMm } from './pageSize'

export function estimatePageCount(chapters = [], layout = {}) {
  const words = chapters.reduce((sum, chapter) => sum + (Number(chapter.wordCount) || 0), 0)
  const bodySize = Number(layout.bodySize) || 11.5
  const spacing = Number(layout.bodyLineSpacing) || 1.5
  const wordsPerPage = Math.max(140, Math.round(310 * (11.5 / bodySize) * (1.5 / spacing)))
  return Math.max(24, Math.ceil(words / wordsPerPage) + chapters.length * 2 + 4)
}

export function coverGeometry(chapters = [], layout = {}) {
  const trim = pageSizeMm(layout.pageSize)
  const pages = estimatePageCount(chapters, layout)
  const paperThickness = Number(layout.paperThicknessMm) || 0.0572
  const spineMm = Math.max(2, Math.round(pages * paperThickness * 10) / 10)
  const bleedMm = Math.max(0, Number(layout.bleed) || 3)

  return {
    trimWidthMm: trim.w,
    trimHeightMm: trim.h,
    spineMm,
    pages,
    bleedMm,
    wrapWidthMm: Math.round((trim.w * 2 + spineMm + bleedMm * 2) * 10) / 10,
    wrapHeightMm: Math.round((trim.h + bleedMm * 2) * 10) / 10,
  }
}
