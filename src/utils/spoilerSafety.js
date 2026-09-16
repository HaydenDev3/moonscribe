// Keep the beta-reader reveal deterministic and local to the current chapter.
// The anchor is paragraph/scene based so prose edits do not expose later
// chapters and can be reported as moved when the original anchor disappears.
export function revealHtmlThroughAnchor(html, marker = null, buffer = 1) {
  const source = String(html || '')
  const blocks = source.match(/<(?:p|h[1-6]|blockquote|li)\b[^>]*>[\s\S]*?<\/(?:p|h[1-6]|blockquote|li)>/gi) || []
  if (!blocks.length) return source
  const position = Number(marker?.furthestPosition)
  const end = Number.isFinite(position) ? Math.max(0, Math.min(blocks.length - 1, position + Math.max(0, buffer))) : Math.min(1, blocks.length - 1)
  return blocks.slice(0, end + 1).join('\n')
}

export function paragraphAnchor(index, block = '') {
  const text = String(block).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
  let hash = 0
  for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0
  return `p-${index}-${Math.abs(hash)}`
}

export function isAnchorVisible(marker, index) {
  return !marker || Number(index) <= Number(marker.furthestPosition || 0) + 1
}
