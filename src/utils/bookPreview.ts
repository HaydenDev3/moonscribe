import { pageMarginMm, pageSizeMm } from './pageSize'
import { sanitizeStoredHtml } from './formatHtml'

export type PreviewPage = { id: string; type: string; chapterId?: string; chapterTitle?: string; html?: string; pageNum?: number; blank?: boolean; parity?: 'left' | 'right' }

export function normalizeBookPreview(novel: any, chapters: any[] = [], layout: any = {}) {
  const size = pageSizeMm(layout.pageSize)
  const margin = pageMarginMm(layout.pageMargin)
  const bodyWidth = Math.max(20, size.w - margin * 2)
  const bodyHeight = Math.max(20, size.h - margin * 2)
  const bodySize = Number(layout.bodySize) || 11.5
  const lineSpacing = Number(layout.lineSpacing) || 1.2
  const charsPerLine = Math.max(18, Math.round(bodyWidth * 1.85 / (bodySize * 0.52)))
  const linesPerPage = Math.max(8, Math.floor(bodyHeight * 2.45 / (bodySize * lineSpacing)))
  return { size, margin, bodyWidth, bodyHeight, bodySize, lineSpacing, charsPerLine, linesPerPage, title: novel?.title || 'Untitled book', chapters }
}

function splitHtml(html: string, capacity: number) {
  const clean = sanitizeStoredHtml(html || '')
  if (!clean.trim()) return ['<p>…</p>']
  const blocks = clean.match(/<[^>]+>[\s\S]*?<\/[^>]+>/g) || [`<p>${clean}</p>`]
  const pages: string[] = []
  let current = ''
  let count = 0
  for (const block of blocks) {
    const words = (block.replace(/<[^>]+>/g, ' ').match(/\S+/g) || []).length
    const weight = Math.max(1, Math.ceil(words * 5.8))
    if (current && count + weight > capacity) { pages.push(current); current = ''; count = 0 }
    current += block
    count += weight
  }
  if (current) pages.push(current)
  return pages
}

export function buildBookPreview(novel: any, chapters: any[] = [], layout: any = {}) {
  const settings = normalizeBookPreview(novel, chapters, layout)
  const pages: PreviewPage[] = []
  const diagnostics: { severity: string; message: string }[] = []
  const add = (page: PreviewPage) => pages.push({ ...page, id: page.id || `page-${pages.length + 1}`, parity: pages.length % 2 ? 'left' : 'right' })
  if (layout.includeFrontMatter !== false) add({ id: 'title-page', type: 'title' })
  if (layout.dedication && layout.dedicationPos !== 'none') add({ id: 'dedication-page', type: 'dedication', html: `<p>${sanitizeStoredHtml(layout.dedication)}</p>` })
  let pageNum = 1
  chapters.forEach((chapter, index) => {
    if (chapter.kind && ['book', 'part', 'act'].includes(chapter.kind)) {
      add({ id: `container-${chapter.id}`, type: 'container', chapterId: chapter.id, chapterTitle: chapter.title || 'Untitled section', pageNum: pageNum++ })
      return
    }
    const chunks = splitHtml(chapter.content, settings.charsPerLine * settings.linesPerPage)
    if (chunks.length > 1) diagnostics.push({ severity: 'info', message: `${chapter.title || 'Untitled chapter'} flows across ${chunks.length} pages.` })
    chunks.forEach((html, chunkIndex) => add({ id: `${chapter.id}-${chunkIndex}`, type: chunkIndex === 0 ? 'chapter-open' : 'body', chapterId: chapter.id, chapterTitle: chapter.title || `Chapter ${index + 1}`, html, pageNum: pageNum++ }))
    if (chunks.length && chunks[chunks.length - 1].replace(/<[^>]+>/g, ' ').trim().split(/\s+/).length < 35) diagnostics.push({ severity: 'warning', message: `${chapter.title || 'Untitled chapter'} ends on a very short page.` })
  })
  if (!chapters.length) diagnostics.push({ severity: 'warning', message: 'No chapters yet.' })
  if (layout.includeFrontMatter === false) diagnostics.push({ severity: 'info', message: 'Front matter is disabled.' })
  return { settings, pages, diagnostics, pageCount: pages.filter((page) => page.pageNum != null).length }
}
