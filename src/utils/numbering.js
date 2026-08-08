// Derived chapter numbering and outline. Pure functions over the flat chapter
// list; nothing here touches storage.

export const KINDS = ['book', 'part', 'act', 'chapter', 'subchapter']
export const CONTAINER_KINDS = ['book', 'part', 'act']

export function isContainer(ch) {
  return CONTAINER_KINDS.includes(ch.kind)
}

const ROMAN = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'],
  [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'],
  [5, 'V'], [4, 'IV'], [1, 'I']
]

export function toRoman(n) {
  if (!Number.isInteger(n) || n < 1) return ''
  let out = ''
  let v = n
  for (const [value, glyph] of ROMAN) {
    while (v >= value) {
      out += glyph
      v -= value
    }
  }
  return out
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine']
const TEENS = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

export function toWords(n) {
  if (!Number.isInteger(n) || n < 1) return ''
  if (n < 10) return ONES[n]
  if (n < 20) return TEENS[n - 10]
  if (n < 100) {
    const t = Math.floor(n / 10)
    const o = n % 10
    return TENS[t] + (o ? `-${ONES[o]}` : '')
  }
  if (n < 1000) {
    const h = Math.floor(n / 100)
    const r = n % 100
    return `${ONES[h]} Hundred` + (r ? ` ${toWords(r)}` : '')
  }
  return String(n)
}

// Build the parent/child forest from the flat list (which is already sorted by
// order). Returns roots; every node is { ch, children }.
export function buildTree(chapters) {
  const byId = new Map(chapters.map((c) => [c.id, { ch: c, children: [] }]))
  const roots = []
  for (const node of byId.values()) {
    const parent = node.ch.parentId && byId.get(node.ch.parentId)
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  const sortRec = (nodes) => {
    nodes.sort((a, b) => (a.ch.order || 0) - (b.ch.order || 0))
    nodes.forEach((n) => sortRec(n.children))
  }
  sortRec(roots)
  return roots
}

// All ids in outline (display) order.
export function flatOrder(chapters) {
  const out = []
  const walk = (nodes) => {
    for (const node of nodes) {
      out.push(node.ch.id)
      if (node.children.length) walk(node.children)
    }
  }
  walk(buildTree(chapters))
  return out
}

// Compute derived labels. Returns Map<id, { kind, number, label }>.
//  - book/act are Roman, part is spelled out, chapters run continuously across
//    the whole outline, subchapters are parent.chapter.index.
export function computeNumbers(chapters) {
  const numbers = new Map()
  let chapterCount = 0

  const walk = (nodes, parentChapterNum, siblingCounts) => {
    const counts = { ...siblingCounts }
    for (const node of nodes) {
      const ch = node.ch
      const kind = KINDS.includes(ch.kind) ? ch.kind : 'chapter'
      counts[kind] = (counts[kind] || 0) + 1
      const idx = counts[kind]

      let number = null
      let label = ''
      let childChapterNum = parentChapterNum

      if (kind === 'book' || kind === 'act') {
        number = idx
        label = `${kind === 'book' ? 'Book' : 'Act'} ${toRoman(idx)}`
      } else if (kind === 'part') {
        number = idx
        label = `Part ${toWords(idx)}`
      } else if (kind === 'chapter') {
        chapterCount += 1
        number = chapterCount
        label = `Chapter ${chapterCount}`
        childChapterNum = chapterCount
      } else {
        const base = parentChapterNum ? `${parentChapterNum}.` : ''
        number = base + idx
        label = `Section ${number}`
      }

      numbers.set(ch.id, { kind, number, label })
      if (node.children.length) walk(node.children, childChapterNum, counts)
    }
  }

  walk(buildTree(chapters), null, {})
  return numbers
}

// The display title for a chapter: if the author already named it "Chapter 3…"
// the derived label is skipped rather than duplicated.
export function titleFor(ch, numbers) {
  const info = numbers.get(ch.id)
  const label = info?.label
  const title = (ch.title || '').trim()
  if (!title) return label || 'Untitled'
  if (!label) return title
  const firstWord = label.split(' ')[0]
  if (new RegExp(`^${firstWord}\\b`, 'i').test(title)) return title
  return `${label} — ${title}`
}
