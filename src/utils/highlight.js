// Character name highlighting for the read/preview view. Names are wrapped in
// soft, coloured underlines — one colour per character — instead of harsh
// highlights. Only runs on text nodes so it never corrupts markup.

// Word-boundary-aware matcher for a single name. Shared with the mention
// scanner so both always agree on what counts as "the name appearing".
export function buildNameRegex(name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?<![\\p{L}\\p{N}])(${escaped})(?![\\p{L}\\p{N}])`, 'gu')
}

export function highlightNames(html, characters) {
  if (!html) return ''
  if (!characters || characters.length === 0) return html

  const names = characters
    .filter((c) => c.name && c.name.trim())
    .map((c) => ({ name: c.name.trim(), color: c.color || '#D4A5A5' }))
    .sort((a, b) => b.name.length - a.name.length)
  if (!names.length) return html

  const doc = new DOMParser().parseFromString(String(html), 'text/html')
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
  const textNodes = []
  while (walker.nextNode()) textNodes.push(walker.currentNode)

  const parts = []
  for (const node of textNodes) {
    let text = node.textContent
    for (const { name, color } of names) {
      if (!name || text.includes(name)) {
        const re = buildNameRegex(name)
        text = text.replace(re, (m) => `\u0000${color}\u0000${m}\u0000`)
      }
    }
    if (text.includes('\u0000')) {
      const span = doc.createElement('span')
      const chunks = text.split('\u0000')
      for (let i = 0; i < chunks.length; i += 3) {
        if (chunks[i]) span.appendChild(doc.createTextNode(chunks[i]))
        if (chunks[i + 2] !== undefined) {
          const mark = doc.createElement('span')
          mark.className = 'hl-name'
          mark.style.setProperty('--hl-color', chunks[i + 1])
          mark.textContent = chunks[i + 2]
          span.appendChild(mark)
        }
      }
      parts.push({ node, span })
    }
  }
  for (const { node, span } of parts) node.parentNode.replaceChild(span, node)
  return doc.body.innerHTML
}
