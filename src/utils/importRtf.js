// Import an RTF manuscript — the format Scrivener's Compile produces (and a
// common "Save As" from Word). We strip RTF's control layer to plain
// paragraphs, then split into chapters on page/section breaks and on explicit
// "Chapter / Part / Prologue…" headings. Output matches markdownToChapters:
// an ordered list of { title, content (HTML) }.

// Destinations whose contents are metadata, not prose — skipped wholesale.
const SKIP_DEST = new Set([
  'fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'header', 'footer',
  'headerl', 'headerr', 'headerf', 'footerl', 'footerr', 'footerf',
  'footnote', 'annotation', 'xmlnstbl', 'datastore', 'themedata', 'object',
  'colorschememapping', 'latentstyles', 'listtable', 'listoverridetable',
  'revtbl', 'rsidtbl', 'generator', 'operator', 'company', 'title', 'author',
  'creatim', 'revtim', 'printim', 'buptim', 'nesttableprops', 'formfield'
])

// Windows-1252 high bytes that differ from Latin-1 (smart quotes, dashes…).
const CP1252 = {
  0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…', 0x86: '†', 0x87: '‡',
  0x88: 'ˆ', 0x89: '‰', 0x8a: 'Š', 0x8b: '‹', 0x8c: 'Œ', 0x8e: 'Ž', 0x91: '‘',
  0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—',
  0x98: '˜', 0x99: '™', 0x9a: 'š', 0x9b: '›', 0x9c: 'œ', 0x9e: 'ž', 0x9f: 'Ÿ'
}

function decodeByte(code) {
  if (code >= 0x80 && code <= 0x9f && CP1252[code]) return CP1252[code]
  return String.fromCharCode(code)
}

// A page/section break — becomes a hard chapter boundary.
const PAGE = '\f'

const SIMPLE = {
  par: '\n', line: '\n', tab: '\t', emdash: '—', endash: '–',
  lquote: '‘', rquote: '’', ldblquote: '“', rdblquote: '”',
  bullet: '•', page: PAGE, sect: PAGE, pagebb: PAGE
}

// Convert RTF source into plain text with '\n' paragraph breaks and '\f' where
// a page/section break falls. Returns null if the input is not RTF.
export function rtfToText(rtf) {
  if (typeof rtf !== 'string' || !rtf.startsWith('{\\rtf')) return null

  const stack = [{ ignorable: false }]
  const top = () => stack[stack.length - 1]
  let out = ''
  const emit = (s) => { if (!top().ignorable) out += s }

  let i = 0
  const len = rtf.length
  while (i < len) {
    const c = rtf[i]

    if (c === '{') {
      stack.push({ ignorable: top().ignorable })
      i++
    } else if (c === '}') {
      if (stack.length > 1) stack.pop()
      i++
    } else if (c === '\\') {
      const next = rtf[i + 1]
      if (next === '\\' || next === '{' || next === '}') {
        emit(next)
        i += 2
      } else if (next === "'") {
        const code = parseInt(rtf.substr(i + 2, 2), 16)
        if (!Number.isNaN(code)) emit(decodeByte(code))
        i += 4
      } else if (next === '*') {
        top().ignorable = true // unknown destination — skip its contents
        i += 2
      } else if (next === '~') {
        emit(' '); i += 2
      } else if (next === '-') {
        i += 2 // optional hyphen — render nothing
      } else if (next === '\n' || next === '\r') {
        emit('\n'); i += 2
      } else if (/[a-zA-Z]/.test(next)) {
        let j = i + 1
        while (j < len && /[a-zA-Z]/.test(rtf[j])) j++
        const word = rtf.slice(i + 1, j)
        let param = ''
        if (rtf[j] === '-' || /[0-9]/.test(rtf[j])) {
          let k = j + (rtf[j] === '-' ? 1 : 0)
          while (k < len && /[0-9]/.test(rtf[k])) k++
          param = rtf.slice(j, k)
          j = k
        }
        if (rtf[j] === ' ') j++ // a single trailing space is a delimiter
        i = j

        if (SKIP_DEST.has(word)) {
          top().ignorable = true
        } else if (word === 'u') {
          const cp = parseInt(param, 10)
          if (!Number.isNaN(cp)) emit(String.fromCodePoint(cp < 0 ? cp + 65536 : cp))
          if (rtf[i] && rtf[i] !== ' ' && rtf[i] !== '\\') i++ // skip the ANSI fallback char
        } else if (Object.prototype.hasOwnProperty.call(SIMPLE, word)) {
          emit(SIMPLE[word])
        }
        // any other control word: formatting we don't render — ignored
      } else {
        i += 2 // other control symbol
      }
    } else if (c === '\r' || c === '\n') {
      i++ // raw line breaks in RTF source are not content
    } else {
      emit(c)
      i++
    }
  }
  return out
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const HEADING_RE = /^(chapter|part|prologue|epilogue|act|book|scene)\b/i

function looksLikeTitle(p) {
  return p.length > 0 && p.length <= 48 && p.split(/\s+/).length <= 8 && !/[.?!,;:]$/.test(p)
}

// Split an RTF manuscript into chapters.
export function rtfToChapters(rtf) {
  const text = rtfToText(rtf)
  if (text == null) return null

  const paras = text
    .replace(/\f/g, '\n\f\n')
    .split('\n')
    .map((s) => (s === PAGE ? s : s.replace(/[ \t]+/g, ' ').trim()))

  const chapters = []
  let cur = null
  let pendingBreak = false
  const start = (title) => {
    cur = { title: title || 'Untitled', blocks: [] }
    chapters.push(cur)
  }

  for (const p of paras) {
    if (p === PAGE) { pendingBreak = true; continue }
    if (!p) continue

    if (HEADING_RE.test(p) && p.length <= 60) {
      start(p)
      pendingBreak = false
      continue
    }
    if (pendingBreak || !cur) {
      pendingBreak = false
      if (looksLikeTitle(p)) { start(p); continue }
      start(chapters.length ? 'Untitled' : 'Imported')
      cur.blocks.push(p)
      continue
    }
    cur.blocks.push(p)
  }

  return chapters
    .filter((ch) => ch.blocks.length || ch.title !== 'Imported')
    .map((ch) => ({
      title: ch.title,
      content: ch.blocks.map((b) => `<p>${escapeHtml(b)}</p>`).join('')
    }))
}
