// Formatting rescue for manuscript HTML: tidy (auto-format), paste
// sanitizing, and merge seam composition. All pure and DOM-parser based so
// they work in the browser and in tests.

const KEEP_INLINE = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'A', 'CODE'])
const KEEP_BLOCK = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'UL', 'OL', 'LI', 'DIV'])
const SCENE_PATTERN = /^[❦*•\-\–—_·\s]{2,}$/

function parse(html) {
  return new DOMParser().parseFromString(String(html || ''), 'text/html')
}

function canonicalSceneBreak(doc) {
  const d = doc.createElement('div')
  d.className = 'scene-break'
  d.setAttribute('contenteditable', 'false')
  d.setAttribute('data-scene-break', 'true')
  d.textContent = '❦'
  return d
}

function isSceneBreakEl(el) {
  return el.classList && (el.classList.contains('scene-break') || el.dataset?.sceneBreak === 'true')
}

// Strip attributes we never want to keep in a manuscript.
function stripAttrs(el) {
  const attrs = Array.from(el.attributes || [])
  for (const a of attrs) {
    const n = a.name.toLowerCase()
    const keep = (n === 'href' && el.tagName === 'A') || n === 'data-scene-break'
    if (!keep) el.removeAttribute(a.name)
  }
}

function countWords(str) {
  const text = str.replace(/<[^>]*>/g, ' ').replace(/\u00a0/g, ' ')
  return (text.match(/[\p{L}\p{N}]+(?:['’\-]\p{L}+)?/gu) || []).length
}

function looksLikeHeading(text) {
  const t = text.trim()
  if (!t || t.length > 64) return false
  if (/^(chapter|ch)\b[\s.]*\d+/i.test(t)) return true
  if (/^part\s+\w+/i.test(t)) return true
  if (/^(prologue|epilogue|preface|afterword|interlude)\b/i.test(t)) return true
  // short, all-caps, no punctuation → a heading someone typed
  if (t.length >= 2 && t.length <= 48 && t === t.toUpperCase() && /[A-Z]/.test(t) && !/[.!?]$/.test(t)) return true
  return false
}

// ---- tidy: normalize a whole chapter ----
export function tidyHtml(html, { detectHeadings = true } = {}) {
  const doc = parse(html)
  const stats = { blankLines: 0, sceneBreaks: 0, headings: 0, unwrapped: 0 }

  const cleanNode = (el) => {
    if (!el) return
    if (el.nodeType === Node.COMMENT_NODE) {
      el.remove()
      return
    }
    if (el.nodeType === Node.ELEMENT_NODE) {
      const tag = el.tagName
      if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'META', 'TITLE', 'LINK'].includes(tag)) {
        el.remove()
        return
      }
      // real scene breaks are kept as-is
      if (isSceneBreakEl(el)) {
        stats.sceneBreaks += 1
        stripAttrs(el)
        el.setAttribute('data-scene-break', 'true')
        return
      }
      // convert a line of ❦ / *** / --- into a proper scene break
      const ownText = (el.textContent || '').trim()
      const direct = Array.from(el.childNodes).every((n) => n.nodeType === Node.TEXT_NODE)
      if (direct && ownText && SCENE_PATTERN.test(ownText) && tag !== 'PRE') {
        stats.sceneBreaks += 1
        const sb = canonicalSceneBreak(doc)
        el.parentNode.replaceChild(sb, el)
        return
      }
      stripAttrs(el)
    }
    // recurse into children
    for (const child of Array.from(el.childNodes)) cleanNode(child)
  }

  const fixup = (el) => {
    // normalize text nodes (nbsp → space, collapse double spaces)
    const walkText = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        let t = node.textContent.replace(/\u00a0/g, ' ')
        t = t.replace(/ {2,}/g, ' ')
        if (t !== node.textContent) node.textContent = t
        return
      }
      if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.tagName === 'PRE') return
        for (const c of Array.from(node.childNodes)) walkText(c)
      }
    }
    walkText(el)

    for (const child of Array.from(el.children)) {
      const tag = child.tagName
      if (isSceneBreakEl(child)) continue
      if (tag === 'FONT' || tag === 'SPAN') {
        // unwrap formatting-only spans when they wrap blocks, else keep inline
        const wrapsBlock = Array.from(child.children).some((c) => KEEP_BLOCK.has(c.tagName))
        if (wrapsBlock || tag === 'FONT') {
          stats.unwrapped += 1
          child.replaceWith(...Array.from(child.childNodes))
          fixup(el)
          return
        }
        continue
      }
      if (!KEEP_INLINE.has(tag) && !KEEP_BLOCK.has(tag) && !['BR', 'HR'].includes(tag)) {
        // unknown element — unwrap, keep children
        stats.unwrapped += 1
        const frag = doc.createDocumentFragment()
        while (child.firstChild) frag.appendChild(child.firstChild)
        child.replaceWith(frag)
        fixup(el)
        return
      }
      if (child.childNodes.length) fixup(child)
    }
  }

  const body = doc.body
  cleanNode(body)
  fixup(body)

  // ---- block pass: flatten nested blocks, unwrap strays, collapse blanks ----
  const flatten = (el) => {
    for (const child of Array.from(el.children)) {
      if (isSceneBreakEl(child)) continue
      const tag = child.tagName
      if ((tag === 'P' || tag === 'DIV') && Array.from(child.children).some((c) => KEEP_BLOCK.has(c.tagName) && !['LI'].includes(c.tagName))) {
        stats.unwrapped += 1
        const frag = doc.createDocumentFragment()
        while (child.firstChild) frag.appendChild(child.firstChild)
        child.replaceWith(frag)
        flatten(el)
        return
      }
      if (child.childNodes.length) flatten(child)
    }
  }
  flatten(body)

  // normalize div → p
  for (const div of Array.from(body.querySelectorAll('div'))) {
    if (isSceneBreakEl(div)) continue
    const p = doc.createElement('p')
    while (div.firstChild) p.appendChild(div.firstChild)
    div.replaceWith(p)
  }

  // gather top-level blocks
  const blocks = []
  let textAcc = null
  for (const node of Array.from(body.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent.trim()) {
        if (!textAcc) {
          textAcc = doc.createElement('p')
          blocks.push(textAcc)
        }
        textAcc.appendChild(doc.createTextNode(node.textContent.trim()))
      }
      continue
    }
    textAcc = null
    if (node.nodeType === Node.ELEMENT_NODE && node.tagName !== 'BR') blocks.push(node)
  }

  const isBlank = (el) => {
    const text = (el.textContent || '').trim()
    return text === '' && !el.querySelector('img') && !isSceneBreakEl(el)
  }

  const clean = []
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]
    if (isBlank(b)) {
      // collapse runs of blanks to one
      if (clean.length && !isBlank(clean[clean.length - 1])) {
        if (b.tagName === 'P') {
          b.innerHTML = '<br>'
          clean.push(b)
        }
      }
      continue
    }
    clean.push(b)
  }
  // drop leading/trailing blanks
  while (clean.length && isBlank(clean[0])) clean.shift()
  while (clean.length && isBlank(clean[clean.length - 1])) clean.pop()
  stats.blankLines = blocks.length - clean.length

  // detect headings
  if (detectHeadings) {
    for (let i = 0; i < clean.length; i++) {
      const b = clean[i]
      if (b.tagName !== 'P') continue
      const t = (b.textContent || '').trim()
      if (looksLikeHeading(t) && !b.querySelector('img')) {
        const h = doc.createElement('h2')
        h.textContent = t
        b.replaceWith(h)
        clean[i] = h
        stats.headings += 1
      }
    }
  }

  body.innerHTML = ''
  for (const b of clean) body.appendChild(b)

  return { html: body.innerHTML, stats }
}

// ---- paste sanitizer: whitelist-only, used on clipboard content ----
export function sanitizePaste(input) {
  if (!input || !input.trim()) return ''
  let doc
  if (/<\/?[a-z][\s\S]*>/i.test(input)) {
    doc = parse(input)
  } else {
    doc = parse('<body></body>')
    const paras = input.split(/\n\s*\n/)
    for (const para of paras) {
      const p = doc.createElement('p')
      const lines = para.split('\n')
      lines.forEach((line, i) => {
        if (i > 0) p.appendChild(doc.createElement('br'))
        p.appendChild(doc.createTextNode(line))
      })
      doc.body.appendChild(p)
    }
  }

  const strip = (el) => {
    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === Node.COMMENT_NODE) {
        child.remove()
        continue
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue
      const tag = child.tagName
      if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'META', 'TITLE', 'LINK', 'HEAD'].includes(tag)) {
        child.remove()
        continue
      }
      if (isSceneBreakEl(child)) {
        const sb = canonicalSceneBreak(doc)
        child.replaceWith(sb)
        continue
      }
      const keep = KEEP_INLINE.has(tag) || KEEP_BLOCK.has(tag) || tag === 'BR'
      if (!keep) {
        child.replaceWith(...Array.from(child.childNodes))
        strip(el)
        return
      }
      if (tag === 'DIV') {
        const p = doc.createElement('p')
        while (child.firstChild) p.appendChild(child.firstChild)
        child.replaceWith(p)
        strip(el)
        return
      }
      if (tag === 'A') child.setAttribute('href', child.getAttribute('href') || '#')
      stripAttrs(child)
      strip(child)
    }
  }
  strip(doc.body)

  // collapse blank paragraphs
  const pels = Array.from(doc.body.querySelectorAll('p, div'))
  for (const p of pels) {
    const t = (p.textContent || '').trim()
    if (!t && !p.querySelector('img') && !p.querySelector('.scene-break')) p.remove()
  }

  return doc.body.innerHTML
}

// ---- merge: join two chapters at a clean seam ----
export function composeMergedContent(aHtml, bHtml, separator = 'scene-break') {
  const a = tidyHtml(aHtml, { detectHeadings: false })
  const b = tidyHtml(bHtml, { detectHeadings: false })

  const doc = parse(a.html)
  // trim trailing blank in a
  let aBlocks = Array.from(doc.body.childNodes)
  while (aBlocks.length && isBlankEl(aBlocks[aBlocks.length - 1])) aBlocks.pop()

  const bDoc = parse(b.html)
  let bBlocks = Array.from(bDoc.body.childNodes)
  while (bBlocks.length && isBlankEl(bBlocks[0])) bBlocks.shift()

  const parts = []
  for (const n of aBlocks) parts.push(n.cloneNode(true))

  if (separator === 'scene-break') {
    parts.push(canonicalSceneBreak(doc))
  } else {
    const p = doc.createElement('p')
    p.innerHTML = '<br>'
    parts.push(p)
  }
  for (const n of bBlocks) parts.push(n.cloneNode(true))

  doc.body.innerHTML = ''
  for (const n of parts) doc.body.appendChild(n)

  const html = doc.body.innerHTML
  return { html, words: countWords(html), stats: { ...a.stats, ...b.stats } }
}

function isBlankEl(el) {
  return el.nodeType === Node.ELEMENT_NODE && (el.textContent || '').trim() === '' && !el.querySelector('img')
}
