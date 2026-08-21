// Parses a Markdown manuscript into chapters for import. Round-trips the
// exporter's format: `#` / `##` headings become chapter titles, `###` and
// deeper stay inside the chapter, `***` becomes a scene break. Inline
// emphasis, links and lists are preserved.
import { countWordsFromText } from './words'

function inline(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\[([^\]]*)\]\(([^)]*)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}

export function markdownToChapters(md) {
  const lines = String(md || '').split(/\r?\n/)
  const chapters = []
  let current = null

  const ensure = () => {
    if (!current) {
      current = { title: 'Untitled', blocks: [] }
      chapters.push(current)
    }
    return current
  }
  const push = (block) => current && current.blocks.push(block)

  let para = []
  let list = null
  let quote = []

  const flushPara = () => {
    if (para.length) {
      push({ type: 'para', text: para.join(' ') })
      para = []
    }
  }
  const flushList = () => {
    if (list) {
      push({ type: 'list', ordered: list.ordered, items: list.items })
      list = null
    }
  }
  const flushQuote = () => {
    if (quote.length) {
      push({ type: 'quote', text: quote.join(' ') })
      quote = []
    }
  }
  const flushAll = () => { flushPara(); flushList(); flushQuote() }

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) {
      flushAll()
      continue
    }

    const h1 = line.match(/^(#{1,2})\s+(.*)$/)
    if (h1) {
      flushAll()
      current = { title: h1[2].trim() || 'Untitled', blocks: [] }
      chapters.push(current)
      continue
    }

    const hN = line.match(/^(#{3,4})\s+(.*)$/)
    if (hN) {
      flushAll()
      ensure()
      push({ type: 'heading', level: hN[1].length, text: hN[2].trim() })
      continue
    }

    if (/^\s*(\*\*\*|---|___)\s*$/.test(line)) {
      flushAll()
      ensure()
      push({ type: 'break' })
      continue
    }

    const q = line.match(/^>\s?(.*)$/)
    if (q) {
      flushPara(); flushList()
      quote.push(q[1])
      continue
    }

    const ol = line.match(/^\d+\.\s+(.*)$/)
    const ul = line.match(/^[-*]\s+(.*)$/)
    if (ol || ul) {
      flushPara(); flushQuote()
      const ordered = !!ol
      if (!list || list.ordered !== ordered) {
        flushList()
        list = { ordered, items: [] }
      }
      list.items.push((ol ? ol[1] : ul[1]).trim())
      continue
    }

    flushList(); flushQuote()
    para.push(line)
  }
  flushAll()

  return chapters.map((ch) => ({
    title: ch.title,
    content: blocksToHtml(ch.blocks)
  }))
}

function blocksToHtml(blocks) {
  let out = ''
  for (const b of blocks) {
    if (b.type === 'para') out += `<p>${inline(b.text)}</p>`
    else if (b.type === 'heading') {
      const tag = b.level === 4 ? 'h4' : 'h3'
      out += `<${tag}>${inline(b.text)}</${tag}>`
    } else if (b.type === 'break') out += `<p class="scene-break">❦</p>`
    else if (b.type === 'quote') out += `<blockquote>${inline(b.text)}</blockquote>`
    else if (b.type === 'list') {
      const tag = b.ordered ? 'ol' : 'ul'
      out += `<${tag}>${b.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${tag}>`
    }
  }
  return out
}

export function markdownWordCount(md) {
  const chapters = markdownToChapters(md)
  return chapters.reduce((s, c) => s + countWordsFromText(c.content.replace(/<[^>]*>/g, ' ')), 0)
}
