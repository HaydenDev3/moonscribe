// Plain-text conversion for TXT export. Strips all formatting but keeps
// structure: headings as title lines, scene breaks as "❦".

export function htmlToText(html) {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(String(html), 'text/html')
  const walk = (el) => {
    let out = ''
    for (const child of el.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        out += child.textContent
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = child.tagName
        if (child.classList && child.classList.contains('scene-break')) {
          out += '\n❦\n\n'
        } else if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(tag)) {
          out += `\n${walk(child).trim()}\n\n`
        } else if (tag === 'P') {
          out += `${walk(child).trim()}\n\n`
        } else if (tag === 'BLOCKQUOTE') {
          out += `“${walk(child).trim()}”\n\n`
        } else if (tag === 'BR') {
          out += '\n'
        } else if (tag === 'LI') {
          out += `• ${walk(child).trim()}\n`
        } else {
          out += walk(child)
        }
      }
    }
    return out
  }
  return walk(doc.body).replace(/\n{3,}/g, '\n\n').trim() + '\n'
}
