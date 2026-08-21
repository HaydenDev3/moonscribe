// Manuscript annotation for the read/preview view. Character names and
// glossary terms are wrapped in soft, coloured underlines and tagged with the
// id of the entity they point to, so the reader can hover for a card. Only
// text nodes are touched, so markup is never corrupted.

// Private-use sentinel used to slice matched runs out of a text node without
// ever colliding with real prose.
const SEP = String.fromCharCode(0xe000)

// Word-boundary-aware matcher for a single name/term. Shared with the mention
// scanner so both always agree on what counts as "the name appearing".
export function buildNameRegex(name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?<![\\p{L}\\p{N}])(${escaped})(?![\\p{L}\\p{N}])`, 'giu')
}

// Annotate prose with character-name and glossary-term marks. Returns the html
// unchanged when there is nothing to match.
//   characters: [{ id, name, color }]
//   terms:      [{ id, term, aliases?, color? }]
//   entities:   [{ id, name, kind: 'faction'|'artefact'|'place', color? }]
export function annotateProse(html, { characters = [], terms = [], entities = [] } = {}) {
  if (!html) return ''

  const matchers = []
  for (const c of characters) {
    const name = (c.name || '').trim()
    if (name) matchers.push({ text: name, kind: 'name', id: c.id, color: c.color || '#D4A5A5' })
  }
  for (const t of terms) {
    const spellings = [t.term, ...(t.aliases || [])]
    for (const raw of spellings) {
      const s = (raw || '').trim()
      if (s) matchers.push({ text: s, kind: 'term', id: t.id, color: t.color || null })
    }
  }
  for (const e of entities) {
    const name = (e.name || '').trim()
    if (name) matchers.push({ text: name, kind: 'entity', entityKind: e.kind, id: e.id, color: e.color || null })
  }
  if (!matchers.length) return html

  // Longest first so "Anabelle" wins over "Ana"; de-dupe by spelling, letting
  // the earlier (longer, character-over-term) matcher win.
  matchers.sort((a, b) => b.text.length - a.text.length)
  const seen = new Set()
  const uniq = []
  for (const m of matchers) {
    const key = m.text.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      uniq.push(m)
    }
  }
  // Also build a case-insensitive check so matching in text.includes works
  // — we do a lowercased quick-scan then rely on the regex for actual replacement.

  const doc = new DOMParser().parseFromString(String(html), 'text/html')
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
  const textNodes = []
  while (walker.nextNode()) textNodes.push(walker.currentNode)

  const parts = []
  for (const node of textNodes) {
    const text = node.textContent
    const hits = []
    for (let i = 0; i < uniq.length; i++) {
      const matcher = uniq[i]
      const re = buildNameRegex(matcher.text)
      let match
      while ((match = re.exec(text)) !== null) {
        hits.push({
          start: match.index,
          end: match.index + match[0].length,
          value: match[0],
          desc: matcher,
        })
        if (match[0].length === 0) re.lastIndex += 1
      }
    }

    if (!hits.length) continue

    hits.sort((a, b) => a.start - b.start || b.end - a.end)

    const span = doc.createElement('span')
    let cursor = 0
    for (const hit of hits) {
      if (hit.start < cursor) continue
      if (hit.start > cursor) span.appendChild(doc.createTextNode(text.slice(cursor, hit.start)))

      const desc = hit.desc
      const mark = doc.createElement('span')
      if (desc.kind === 'name') {
        mark.className = 'hl-name'
        mark.style.setProperty('--hl-color', desc.color)
        mark.dataset.charId = desc.id
      } else if (desc.kind === 'entity') {
        mark.className = `hl-entity hl-entity-${desc.entityKind}`
        if (desc.color) mark.style.setProperty('--hl-color', desc.color)
        mark.dataset.entityId = desc.id
        mark.dataset.entityKind = desc.entityKind
      } else {
        mark.className = 'hl-term'
        if (desc.color) mark.style.setProperty('--hl-color', desc.color)
        mark.dataset.termId = desc.id
      }
      mark.textContent = hit.value
      span.appendChild(mark)
      cursor = hit.end
    }

    if (cursor < text.length) span.appendChild(doc.createTextNode(text.slice(cursor)))
    parts.push({ node, span })
  }
  for (const { node, span } of parts) node.parentNode.replaceChild(span, node)
  return doc.body.innerHTML
}

// Back-compat: character-name highlighting only.
export function highlightNames(html, characters) {
  return annotateProse(html, { characters })
}

// Strip annotation spans (.hl-name, .hl-term, .hl-entity) from HTML before saving,
// so the stored content never contains highlight markup.
export function stripAnnotations(html) {
  if (!html || (!html.includes('hl-name') && !html.includes('hl-term') && !html.includes('hl-entity'))) return html
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('.hl-name, .hl-term, .hl-entity').forEach((el) => {
    el.replaceWith(el.textContent)
  })
  return doc.body.innerHTML
}
