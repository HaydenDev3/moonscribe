// Word counting over stored HTML content.

export function toText(html) {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(String(html), 'text/html')
  // Walk text nodes and join with spaces — textContent() concatenates block
  // boundaries without separators ("onestory"), which breaks word counts.
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
  const chunks = []
  while (walker.nextNode()) chunks.push(walker.currentNode.textContent)
  return chunks.join(' ').replace(/\u00a0/g, ' ')
}

export function countWords(html) {
  const text = toText(html).trim()
  if (!text) return 0
  return text.split(/\s+/).filter((w) => /\p{L}/u.test(w)).length
}

export function countWordsFromText(text) {
  const t = (text || '').replace(/\u00a0/g, ' ').trim()
  if (!t) return 0
  return t.split(/\s+/).filter((w) => /\p{L}/u.test(w)).length
}

export function formatWords(n) {
  return Number(n || 0).toLocaleString('en-US')
}
