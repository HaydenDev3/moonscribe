import { sanitizeStoredHtml } from '../utils/formatHtml'

export const DOCUMENT_SCHEMA_VERSION = 1

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
  }
}
