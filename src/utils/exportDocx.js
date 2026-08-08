// DOCX export built on the `docx` package. Runs entirely in the browser —
// nothing leaves the machine.
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun
} from 'docx'
import { downloadBlob, safeName } from './download'
import { pageSizeTwips, pageMarginMm, mmToTwips } from './pageSize'

function inlineRuns(node) {
  const runs = []
  const walk = (n) => {
    for (const child of n.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        runs.push({ text: child.textContent })
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = child.tagName
        if (tag === 'BR') runs.push({ text: '\n' })
        else if (tag === 'STRONG' || tag === 'B') {
          inlineRuns(child).forEach((r) => runs.push({ ...r, bold: true }))
        } else if (tag === 'EM' || tag === 'I') {
          inlineRuns(child).forEach((r) => runs.push({ ...r, italics: true }))
        } else walk(child)
      }
    }
  }
  walk(node)
  return runs
}

function toRuns(node) {
  return inlineRuns(node).map((r) => new TextRun({ ...r }))
}

export function buildDocxDocument(novel, chapters, layout) {
  const paragraphs = []
  const symbol = layout?.sceneBreak || '❦'

  // Title page
  paragraphs.push(new Paragraph({ text: '', spacing: { after: 3200 } }))
  paragraphs.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: novel.title, size: 56, bold: true, font: 'Cormorant Garamond' })]
    })
  )
  paragraphs.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [new TextRun({ text: 'for Storm', italics: true, size: 28, color: '777777' })]
    })
  )
  paragraphs.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [new TextRun({ text: symbol, size: 26, color: 'D4A5A5' })]
    })
  )
  paragraphs.push(new Paragraph({ pageBreakBefore: true, children: [] }))

  for (const chapter of chapters) {
    const title = chapter.title || 'Untitled'
    paragraphs.push(
      new Paragraph({
        alignment: layout?.chapterStyle === 'left' ? AlignmentType.LEFT : AlignmentType.CENTER,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 200, after: 400 },
        children: [new TextRun({ text: title, font: 'Cormorant Garamond', bold: true, size: 36 })]
      })
    )

    const doc = new DOMParser().parseFromString(chapter.content || '', 'text/html')
    for (const child of doc.body.childNodes) {
      if (child.nodeType !== Node.ELEMENT_NODE) continue
      const tag = child.tagName
      if (child.classList && child.classList.contains('scene-break')) {
        paragraphs.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 200 },
            children: [new TextRun({ text: symbol, color: 'D4A5A5', size: 26 })]
          })
        )
      } else if (tag === 'H2' || tag === 'H3') {
        paragraphs.push(
          new Paragraph({
            heading: tag === 'H2' ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
            spacing: { before: 300, after: 150 },
            children: toRuns(child)
          })
        )
      } else if (tag === 'BLOCKQUOTE') {
        paragraphs.push(
          new Paragraph({
            indent: { left: 720 },
            spacing: { after: 200 },
            children: toRuns(child).map((r) => {
              r.options.italics = true
              return r
            })
          })
        )
      } else if (tag === 'P' || tag === 'DIV') {
        paragraphs.push(new Paragraph({ spacing: { after: 220, line: 360 }, children: toRuns(child) }))
      } else if (tag === 'UL') {
        child.querySelectorAll(':scope > li').forEach((li) => {
          paragraphs.push(new Paragraph({ text: `• ${(li.textContent || '').trim()}`, spacing: { after: 120 } }))
        })
      } else if (tag === 'OL') {
        child.querySelectorAll(':scope > li').forEach((li, i) => {
          paragraphs.push(new Paragraph({ text: `${i + 1}. ${(li.textContent || '').trim()}`, spacing: { after: 120 } }))
        })
      }
    }
    paragraphs.push(new Paragraph({ pageBreakBefore: true, children: [] }))
  }

  const { width, height } = pageSizeTwips(layout?.pageSize)
  const margin = mmToTwips(pageMarginMm(layout?.pageMargin))

  return new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Literata', size: 24, color: '1F1C18' }
        }
      },
      paragraphStyles: [
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { font: 'Cormorant Garamond', bold: true, size: 36, color: '1F1C18' }
        }
      ]
    },
    sections: [
      {
        properties: {
          page: {
            size: { width, height },
            margin: { top: margin, bottom: margin, left: margin, right: margin }
          }
        },
        children: paragraphs
      }
    ]
  })
}

export async function exportNovelDocx(novel, chapters, layout) {
  const doc = buildDocxDocument(novel, chapters, layout)
  const blob = await Packer.toBlob(doc)
  downloadBlob(blob, `${safeName(novel.title)}.docx`)
}

export { downloadBlob, safeName } from './download'
