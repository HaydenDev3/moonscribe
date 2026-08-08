// Converts editor HTML into clean Markdown. Handles the limited set of
// formatting the editor produces: headings, bold/italic, blockquotes,
// paragraphs, lists and scene breaks.

const BLOCK_TAGS = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'UL', 'OL', 'LI', 'DIV']

function isSceneBreak(el) {
  return el.classList && (el.classList.contains('scene-break') || el.dataset?.sceneBreak)
}

function inline(node) {
  if (!node) return ''
  if (node.nodeType === Node.TEXT_NODE) return node.textContent
  if (node.nodeType !== Node.ELEMENT_NODE) return ''
  const tag = node.tagName
  let text = ''
  for (const child of node.childNodes) text += inline(child)
  if (tag === 'STRONG' || tag === 'B') return `**${text}**`
  if (tag === 'EM' || tag === 'I') return `*${text}*`
  if (tag === 'BR') return '  \n'
  if (tag === 'A') return `[${text}](${node.getAttribute('href') || ''})`
  return text
}

function block(el, depth = 0) {
  if (el.nodeType !== Node.ELEMENT_NODE) {
    const text = (el.textContent || '').trim()
    return text ? `${text}\n\n` : ''
  }
  const tag = el.tagName
  if (isSceneBreak(el)) return '\n***\n\n'
  if (tag === 'H1') return `# ${inline(el).trim()}\n\n`
  if (tag === 'H2') return `## ${inline(el).trim()}\n\n`
  if (tag === 'H3') return `### ${inline(el).trim()}\n\n`
  if (tag === 'H4' || tag === 'H5' || tag === 'H6') return `#### ${inline(el).trim()}\n\n`
  if (tag === 'BLOCKQUOTE') {
    const inner = Array.from(el.childNodes)
    return inner
      .map((c) => block(c, depth + 1).trim())
      .filter(Boolean)
      .map((l) => `> ${l}`)
      .join('\n') + '\n\n'
  }
  if (tag === 'UL' || tag === 'OL') {
    const prefix = tag === 'UL' ? '- ' : '1. '
    let out = ''
    el.querySelectorAll(':scope > li').forEach((li, i) => {
      const mark = tag === 'OL' ? `${i + 1}. ` : '- '
      out += `${'  '.repeat(depth)}${mark}${inline(li).trim()}\n`
    })
    return out + '\n'
  }
  // paragraphs and generic blocks
  let out = ''
  for (const child of el.childNodes) {
    if (child.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.includes(child.tagName)) {
      out += block(child, depth)
    } else {
      const text = inline(child).trim()
      if (text) out += `${text} `
    }
  }
  const trimmed = out.trim()
  return trimmed ? `${trimmed}\n\n` : ''
}

export function htmlToMarkdown(html) {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(String(html), 'text/html')
  let out = ''
  for (const child of doc.body.childNodes) out += block(child)
  return out.trim() + '\n'
}
