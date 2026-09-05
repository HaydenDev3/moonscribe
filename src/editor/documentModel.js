import { sanitizeStoredHtml } from '../utils/formatHtml'

export const DOCUMENT_SCHEMA_VERSION = 1

const BLOCK_TAGS = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'BLOCKQUOTE', 'IMG'])

function marksFor(node) {
  const marks = []
  let current = node
  while (current?.parentElement) {
    const tag = current.parentElement.tagName
    if (tag === 'STRONG' || tag === 'B') marks.push({ type: 'bold' })
    if (tag === 'EM' || tag === 'I') marks.push({ type: 'italic' })
    if (tag === 'U') marks.push({ type: 'underline' })
    if (tag === 'S' || tag === 'DEL') marks.push({ type: 'strike' })
    current = current.parentElement
  }
  return marks.reverse()
}

function inlineNodes(element) {
  const result = []
  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType === 3 && node.textContent) result.push({ type: 'text', text: node.textContent, marks: marksFor(node) })
    else if (node.nodeType === 1) {
      const el = node
      if (el.tagName === 'BR') result.push({ type: 'hardBreak' })
      else if (el.tagName === 'A') result.push({ type: 'text', text: el.textContent || '', marks: [...marksFor(node), { type: 'link', attrs: { href: el.getAttribute('href') || '' } }] })
      else if (el.tagName === 'IMG') result.push({ type: 'image', attrs: { src: el.getAttribute('src') || '', alt: el.getAttribute('alt') || '' } })
      else result.push(...inlineNodes(el))
    }
  }
  return result
}

export function htmlToDocument(input) {
  const doc = parse(normalizeDocumentHtml(input))
  const content = []
  for (const element of Array.from(doc.body.children)) {
    if (!BLOCK_TAGS.has(element.tagName) && !element.dataset.pageBreak && !element.dataset.sceneBreak) continue
    if (element.dataset.pageBreak) content.push({ type: 'pageBreak' })
    else if (element.dataset.sceneBreak) content.push({ type: 'sceneBreak', attrs: { symbol: element.textContent?.trim() || '❦' } })
    else if (element.tagName === 'IMG') content.push({ type: 'image', attrs: { src: element.getAttribute('src') || '', alt: element.getAttribute('alt') || '' } })
    else if (element.tagName === 'UL' || element.tagName === 'OL') content.push({ type: element.tagName === 'UL' ? 'bulletList' : 'orderedList', content: Array.from(element.children).map((li) => ({ type: 'listItem', content: [{ type: 'paragraph', content: inlineNodes(li) }] })) })
    else if (element.tagName === 'BLOCKQUOTE') content.push({ type: 'blockquote', content: [{ type: 'paragraph', content: inlineNodes(element) }] })
    else content.push({ type: element.tagName.startsWith('H') ? 'heading' : 'paragraph', attrs: element.tagName.startsWith('H') ? { level: Number(element.tagName.slice(1)) } : undefined, content: inlineNodes(element) })
  }
  return { type: 'doc', version: DOCUMENT_SCHEMA_VERSION, content }
}

export function documentToPlainText(document) {
  const walk = (node) => node?.type === 'text' ? node.text : (node?.content || []).map(walk).join(node?.type === 'paragraph' || node?.type === 'heading' ? '\n' : '')
  return walk(document).trim()
}

function parse(html) {
  return new DOMParser().parseFromString(String(html || ''), 'text/html')
}

function pageBreak(doc) {
  const node = doc.createElement('div')
  node.className = 'page-break'
  node.dataset.pageBreak = 'true'
  return node
}

// Converts every historical MoonScribe page-break representation into one
// semantic node while leaving the user's prose and inline formatting intact.
export function normalizeDocumentHtml(input) {
  const doc = parse(sanitizeStoredHtml(input))

  for (const node of Array.from(doc.body.querySelectorAll('.pg-break, .page-break, [data-page-break="true"]'))) {
    node.replaceWith(pageBreak(doc))
  }

  for (const node of Array.from(doc.body.querySelectorAll('[data-auto-page-break="true"]'))) {
    node.className = 'pg-auto-break'
    node.setAttribute('contenteditable', 'false')
    node.setAttribute('aria-hidden', 'true')
  }

  for (const node of Array.from(doc.body.querySelectorAll('.scene-break, [data-scene-break="true"]'))) {
    node.className = 'scene-break'
    node.dataset.sceneBreak = 'true'
    node.textContent = node.textContent?.trim() || '❦'
  }

  // A trailing atom needs a paragraph after it so the caret has a valid place
  // to land when the document is opened in ProseMirror.
  const last = doc.body.lastElementChild
  if (last?.dataset?.pageBreak === 'true') {
    const paragraph = doc.createElement('p')
    paragraph.appendChild(doc.createElement('br'))
    doc.body.appendChild(paragraph)
  }

  return doc.body.innerHTML
}

export function documentEnvelope(html) {
  return {
    version: DOCUMENT_SCHEMA_VERSION,
    html: normalizeDocumentHtml(html),
    document: htmlToDocument(html),
  }
}
