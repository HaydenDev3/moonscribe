import { memo, useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode, MouseEvent } from 'react'
import * as Y from 'yjs'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import Image from '@tiptap/extension-image'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import FontFamily from '@tiptap/extension-font-family'
import { Mark, mergeAttributes } from '@tiptap/core'
import { BubbleMenu } from '@tiptap/react/menus'
import Select from './Select'
import { openLiveDocument } from '../sync/liveDocument'
import { countWords } from '../utils/words'
import { CommentMark } from './collaboration/CommentMark'
import { ReferenceCardNode, CustomImageNode } from './collaboration/ReferenceNodes'
import { getCommentThreadsMap, readCommentThreads } from '../sync/commentThreads'
import Icon from './Icon'
import { PageBreak, SceneBreak } from '../editor/extensions'
import { listMoodboard } from '../db/moodboard'
import { buildEditorFontOptions } from '../utils/fonts'
import { useApp } from '../context/AppContext'
import { editorPageGeometry, PAGE_PRESETS } from '../utils/pageSize'
import { annotateProse, stripAnnotations } from '../utils/highlight'

type Props = {
  novelId: string
  chapterId: string
  initialHtml: string
  title?: string
  onTitleChange?: (value: string) => void
  onTitleBlur?: (value?: string) => void
  onReport?: (html: string, words: number) => void
  readOnly?: boolean
  username?: string
  color?: string
  onComment?: (quote: string, annotationId?: string) => void
  onReady?: (value: { doc: any; editor: any }) => void
  onThreadsChange?: (threads: any[]) => void
  onDesigns?: () => void
  pageLayout?: { pageSize?: string; pageMargin?: string }
  onPageLayoutChange?: (patch: { pageSize?: string; pageMargin?: number }) => void
  characters?: any[]
  terms?: any[]
  entities?: any[]
  enableCollaboration?: boolean
  typography?: {
    bodyStyle?: { fontFamily?: string; fontSize?: string | number; lineHeight?: string | number; color?: string }
    chapterTitleStyle?: { fontFamily?: string; fontSize?: string | number; lineHeight?: string | number; color?: string }
  }
  onTypographyChange?: (patch: any) => void
}

const FONT_OPTIONS = buildEditorFontOptions()

const FONT_SIZES = ['12', '14', '16', '18', '20', '24', '28', '32']
const LINE_HEIGHTS = [
  { value: '1.15', label: '1.15' },
  { value: '1.4', label: '1.4' },
  { value: '1.6', label: '1.6' },
  { value: '2', label: '2.0' },
]

const EntityHighlight = Mark.create({
  name: 'entityHighlight',
  inclusive: false,
  addAttributes() {
    return {
      entityKind: { default: 'character' },
      entityId: { default: null },
      color: { default: null },
    }
  },
  parseHTML() {
    return [
      { tag: 'span.hl-name' },
      { tag: 'span.hl-entity' },
      { tag: 'span.hl-term' },
    ]
  },
  renderHTML({ HTMLAttributes }) {
    const kind = HTMLAttributes.entityKind || 'character'
    const className = kind === 'character' ? 'hl-name' : kind === 'term' ? 'hl-term' : `hl-entity hl-entity-${kind}`
    return ['span', mergeAttributes(HTMLAttributes, { class: className, style: HTMLAttributes.color ? `--hl-color:${HTMLAttributes.color}` : undefined })]
  },
})

function ToolbarSeparator() {
  return <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-white/10" />
}

function ToolbarButton({
  children,
  title,
  active = false,
  disabled = false,
  onClick,
}: {
  children: ReactNode
  title: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-sm px-1.5 text-xs transition-colors disabled:pointer-events-none disabled:opacity-40 ${active ? 'bg-[#b68b47]/15 text-[#c8a66b]' : 'text-[#aaa49a] hover:bg-white/[0.06] hover:text-[#eee7db]'}`}
    >
      {children}
    </button>
  )
}

function CollaborativeEditor({ novelId, chapterId, initialHtml, title = '', onTitleChange, onTitleBlur, onReport, readOnly = false, username = 'Collaborator', color = '#7db6f4', onComment, onReady, onThreadsChange, onDesigns, pageLayout, onPageLayoutChange, characters = [], terms = [], entities = [], typography = {}, onTypographyChange, enableCollaboration = true }: Props) {
  const { customFonts, systemFonts } = useApp()
  const fontOptions = buildEditorFontOptions({ customFonts, systemFonts })
  const [session, setSession] = useState<any>(null)
  const [status, setStatus] = useState('connecting')
  const [titleDraft, setTitleDraft] = useState(title)
  const [fontFamily, setFontFamily] = useState(FONT_OPTIONS[0].value)
  const [fontSize, setFontSize] = useState('16')
  const [lineHeight, setLineHeight] = useState('1.4')
  const [moreOpen, setMoreOpen] = useState(false)
  const [editorDensity, setEditorDensity] = useState<'focused' | 'balanced' | 'expanded'>('balanced')
  const [pageSize, setPageSize] = useState(pageLayout?.pageSize || 'a5')
  const [mediaOpen, setMediaOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkDraft, setLinkDraft] = useState('https://')
  const [entityTip, setEntityTip] = useState<any>(null)
  const [libraryImages, setLibraryImages] = useState<any[]>([])
  const mediaSelection = useRef<{ from: number; to: number } | null>(null)
  const linkSelection = useRef<{ from: number; to: number } | null>(null)
  const activeParagraphRef = useRef<Element | null>(null)
  const onReadyRef = useRef(onReady)
  const onThreadsChangeRef = useRef(onThreadsChange)
  const onReportRef = useRef(onReport)
  onReadyRef.current = onReady
  onThreadsChangeRef.current = onThreadsChange
  onReportRef.current = onReport
  useEffect(() => setTitleDraft(title), [title])
  useEffect(() => { if (pageLayout?.pageSize) setPageSize(pageLayout.pageSize) }, [pageLayout?.pageSize])
  useEffect(() => {
    let active = true
    listMoodboard(novelId)
      .then((tiles) => {
        if (active) setLibraryImages(tiles.filter((tile) => tile.kind === 'image' && tile.image))
      })
      .catch(() => {})
    return () => { active = false }
  }, [novelId])
  const editor = useEditor(session ? {
    immediatelyRender: false,
    extensions: [
       StarterKit.configure({ undoRedo: false, link: false, underline: false }),
      Underline,
      Link.configure({ openOnClick: false }),
      TextStyle.extend({
        addGlobalAttributes() {
          return [{ types: ['textStyle'], attributes: {
            fontSize: { default: null, parseHTML: (element: HTMLElement) => element.style.fontSize || null, renderHTML: (attributes: any) => attributes.fontSize ? { style: `font-size: ${attributes.fontSize}` } : {} },
            lineHeight: { default: null, parseHTML: (element: HTMLElement) => element.style.lineHeight || null, renderHTML: (attributes: any) => attributes.lineHeight ? { style: `line-height: ${attributes.lineHeight}` } : {} },
          } }]
        },
      }),
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Image,
      Subscript,
      Superscript,
      FontFamily,
      CommentMark,
      ReferenceCardNode,
      CustomImageNode,
      EntityHighlight,
       PageBreak,
       SceneBreak,
       Collaboration.configure({ document: session.doc, field: 'prosemirror' }),
    ],
    editable: !readOnly,
      onUpdate: ({ editor: current }) => {
        const html = stripAnnotations(current.getHTML())
        onReportRef.current?.(html, countWords(current.getText()))
      },
  } : { immediatelyRender: false, extensions: [StarterKit.configure({ undoRedo: false })], editable: false }, [session, username, color])

  useEffect(() => {
    let active = true
    let opened: any
    if (!enableCollaboration) {
      const doc = new Y.Doc()
      setStatus('local')
      setSession({ doc, close: async () => doc.destroy() })
      return () => {
        active = false
        doc.destroy()
      }
    }
    openLiveDocument({ novelId, chapterId, readOnly, onStatus: setStatus }).then((next) => {
      if (!active) return next.close()
      opened = next
      setSession(next)
    }).catch(() => setStatus('error'))
    return () => { active = false; void opened?.close() }
  }, [novelId, chapterId, readOnly, enableCollaboration])

  useEffect(() => {
    // Tiptap can tear down an instance while React is replacing the session.
    // Do not call commands on that transient instance.
    if (!editor || editor.isDestroyed || !editor.view || !session?.doc) return
    editor.setEditable(!readOnly)
    const fragment = session.doc.getXmlFragment('prosemirror')
    if (fragment.length === 0 && initialHtml && !editor.isDestroyed && editor.view) {
      const annotated = annotateProse(initialHtml, { characters, terms, entities })
      editor.commands.setContent(annotated)
    }
    if ((characters.length || terms.length || entities.length) && editor.getHTML().indexOf('hl-') === -1) {
      const annotated = annotateProse(editor.getHTML(), { characters, terms, entities })
      if (annotated !== editor.getHTML()) editor.commands.setContent(annotated, { emitUpdate: false })
    }
    if (editor.isDestroyed) return
    onReadyRef.current?.({ doc: session.doc, editor })
    const threads = getCommentThreadsMap(session.doc)
    const syncThreads = () => onThreadsChangeRef.current?.(readCommentThreads(session.doc))
    syncThreads()
    threads.observeDeep(syncThreads)
    return () => threads.unobserveDeep(syncThreads)
  }, [editor, initialHtml, readOnly, session, characters, terms, entities])

  useEffect(() => {
    if (!editor || editor.isDestroyed || !editor.view) return
    const updateActiveParagraph = () => {
      if (editor.isDestroyed || !editor.view) return
      const selected = editor.view.domAtPos(editor.state.selection.from).node
      const paragraph = (selected.nodeType === Node.ELEMENT_NODE ? selected : selected.parentElement) as Element | null
      const activeParagraph = paragraph?.closest('p')
      activeParagraphRef.current?.classList.remove('collab-active-paragraph')
      activeParagraph?.classList.add('collab-active-paragraph')
      activeParagraphRef.current = activeParagraph
      if (activeParagraph && document.documentElement.classList.contains('typewriter-mode')) activeParagraph.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
    updateActiveParagraph()
    editor.on('selectionUpdate', updateActiveParagraph)
    return () => { editor.off('selectionUpdate', updateActiveParagraph) }
  }, [editor])

  if (!editor || !session) return <div className="prose collaborative-editor-loading">{enableCollaboration ? 'Connecting to live chapter…' : 'Opening chapter…'}</div>
  const run = (command: () => boolean) => {
    if (!readOnly && !editor.isDestroyed) command()
  }
  const setBlock = (value: string) => run(() => value === 'paragraph'
    ? editor.chain().focus().setParagraph().run()
    : editor.chain().focus().toggleHeading({ level: Number(value.slice(1)) as 1 | 2 | 3 }).run())
  const setParagraphStyle = (value: string) => run(() => value === 'quote'
    ? editor.chain().focus().toggleBlockquote().run()
    : editor.chain().focus().setParagraph().run())
  const setSpacing = (value: string) => {
    setLineHeight(value)
    run(() => editor.chain().focus().setMark('textStyle', { lineHeight: value }).run())
  }
  const setSize = (value: string) => {
    setFontSize(value)
    onTypographyChange?.({ bodyStyle: { ...(typography.bodyStyle || {}), fontSize: `${value}pt` } })
    run(() => editor.chain().focus().setMark('textStyle', { fontSize: `${value}pt` }).run())
  }
  const setLink = () => {
    if (editor.isActive('link')) run(() => editor.chain().focus().unsetLink().run())
    else {
      linkSelection.current = { from: editor.state.selection.from, to: editor.state.selection.to }
      setLinkDraft(String(editor.getAttributes('link').href || 'https://'))
      setLinkOpen(true)
    }
  }
  const applyLink = () => {
    const href = linkDraft.trim()
    if (!href) return
    const selection = linkSelection.current
    run(() => {
      const chain = editor.chain()
      if (selection) chain.setTextSelection(selection)
      return chain.focus().setLink({ href }).run()
    })
    linkSelection.current = null
    setLinkOpen(false)
  }
  const toggleMedia = () => {
    if (mediaOpen) {
      setMediaOpen(false)
      return
    }
    mediaSelection.current = { from: editor.state.selection.from, to: editor.state.selection.to }
    setMediaOpen(true)
  }
  const insertLibraryImage = (item: any) => {
    const selection = mediaSelection.current
    if (!item?.image) return
    run(() => {
      const chain = editor.chain().focus()
      if (selection) chain.setTextSelection(selection)
      return (chain as any).insertContent({
        type: 'customImage',
        attrs: { src: item.image, alt: item.text || 'Media Library image', caption: item.text || '', align: 'center' },
      }).run()
    })
    mediaSelection.current = null
    setMediaOpen(false)
  }
  const editorCapabilities = editor.can() as any
  const canUndo = typeof editorCapabilities.undo === 'function' && editorCapabilities.undo()
  const canRedo = typeof editorCapabilities.redo === 'function' && editorCapabilities.redo()
  const showEntityTip = (event: MouseEvent) => {
    const target = event.target instanceof Element ? event.target.closest('.hl-name,.hl-entity,.hl-term') as HTMLElement | null : null
    if (!target) return
    const id = target.dataset.charId || target.dataset.entityId || target.dataset.termId
    const entity = target.classList.contains('hl-name')
      ? characters.find((item) => String(item.id) === String(id))
      : target.classList.contains('hl-term')
        ? terms.find((item) => String(item.id) === String(id))
        : entities.find((item) => String(item.id) === String(id))
    if (!entity) return
    const rect = target.getBoundingClientRect()
    setEntityTip({ entity, kind: target.classList.contains('hl-name') ? 'Character' : target.classList.contains('hl-term') ? 'Term' : String(entity.kind || 'Entity'), x: rect.left + rect.width / 2, y: rect.top })
  }
  return <div className={`collaborative-editor editor-shell editor-wrap-outer editor-density-${editorDensity} !flex-col w-full min-w-0`}>
    <div className="editor-wrap flex w-full min-w-0 flex-1 flex-col items-center !overflow-hidden">
      <div className="editor-desk flex w-full max-w-[1280px] min-h-0 flex-1 flex-col items-center !gap-0 !px-6 !pt-0 pb-24">
        <div className="editor-command-surface" aria-label="Editor view controls">
          <span className="editor-command-label"><Icon icon="fa-solid fa-feather-pointed" /> Writing surface</span>
          <div className="editor-density-controls" role="group" aria-label="Editor density">
            {(['focused', 'balanced', 'expanded'] as const).map((density) => <button key={density} type="button" className={editorDensity === density ? 'is-active' : ''} onClick={() => setEditorDensity(density)}>{density}</button>)}
          </div>
          <span className="editor-hud-toggle is-active"><Icon icon="fa-solid fa-chart-line" /> HUD</span>
        </div>
        <div className="editor-toolbar w-full overflow-visible border-y border-white/10 bg-[#111113] text-[#d8d1c5]" aria-label="Live editor formatting">
          <div className="flex min-w-max min-h-9 items-center justify-center gap-1 overflow-x-auto px-3 py-1">
            <Select className="shrink-0" ariaLabel="Font family" value={fontFamily} onChange={(value) => { const next = String(value); setFontFamily(next); onTypographyChange?.({ bodyStyle: { ...(typography.bodyStyle || {}), fontFamily: next } }); run(() => editor.chain().focus().setFontFamily(next).run()) }} options={fontOptions} width={140} disabled={readOnly} />
            <Select className="shrink-0" ariaLabel="Font size" value={fontSize} onChange={setSize} options={FONT_SIZES.map((value) => ({ value, label: value }))} width={60} disabled={readOnly} />
            <Select className="shrink-0" ariaLabel="Page size" value={pageSize} onChange={(value) => { const next = String(value); setPageSize(next); onPageLayoutChange?.({ pageSize: next }) }} options={[{ value: 'continuous', label: 'Continuous' }, ...PAGE_PRESETS.map((preset) => ({ value: preset.key, label: preset.label }))]} width={82} disabled={readOnly} />
            {pageSize !== 'continuous' && <Select className="shrink-0" ariaLabel="Page margins" value={String(pageLayout?.pageMargin || 20)} onChange={(value) => onPageLayoutChange?.({ pageMargin: Number(value) })} options={[{ value: '12', label: '12 mm' }, { value: '16', label: '16 mm' }, { value: '20', label: '20 mm' }, { value: '25', label: '25 mm' }, { value: '32', label: '32 mm' }]} width={82} disabled={readOnly} />}
            <Select className="shrink-0" ariaLabel="Text type" value={editor.isActive('heading') ? `h${editor.getAttributes('heading').level}` : 'paragraph'} onChange={setBlock} options={[{ value: 'paragraph', label: 'Text' }, { value: 'h1', label: 'Heading 1' }, { value: 'h2', label: 'Heading 2' }, { value: 'h3', label: 'Heading 3' }]} width={86} disabled={readOnly} />
            <Select className="shrink-0" ariaLabel="Paragraph style" value={editor.isActive('blockquote') ? 'quote' : 'normal'} onChange={setParagraphStyle} options={[{ value: 'normal', label: 'Normal' }, { value: 'body', label: 'Body' }, { value: 'quote', label: 'Quote' }]} width={90} disabled={readOnly} />
            <Select className="shrink-0" ariaLabel="Line height" value={lineHeight} onChange={setSpacing} options={LINE_HEIGHTS} width={62} disabled={readOnly} />
            <ToolbarSeparator />
            <ToolbarButton title="Bold" active={editor.isActive('bold')} disabled={readOnly} onClick={() => run(() => editor.chain().focus().toggleBold().run())}><Icon icon="fa-solid fa-bold" /></ToolbarButton>
            <ToolbarButton title="Italic" active={editor.isActive('italic')} disabled={readOnly} onClick={() => run(() => editor.chain().focus().toggleItalic().run())}><Icon icon="fa-solid fa-italic" /></ToolbarButton>
            <ToolbarButton title="Underline" active={editor.isActive('underline')} disabled={readOnly} onClick={() => run(() => editor.chain().focus().toggleUnderline().run())}><Icon icon="fa-solid fa-underline" /></ToolbarButton>
            <ToolbarButton title="Strikethrough" active={editor.isActive('strike')} disabled={readOnly} onClick={() => run(() => editor.chain().focus().toggleStrike().run())}><Icon icon="fa-solid fa-strikethrough" /></ToolbarButton>
            <ToolbarButton title="Superscript" active={editor.isActive('superscript')} disabled={readOnly} onClick={() => run(() => editor.chain().focus().toggleSuperscript().run())}><span className="text-[10px]">x²</span></ToolbarButton>
            <ToolbarButton title="Subscript" active={editor.isActive('subscript')} disabled={readOnly} onClick={() => run(() => editor.chain().focus().toggleSubscript().run())}><span className="text-[10px]">x₂</span></ToolbarButton>
            <ToolbarSeparator />
            <label className="relative inline-flex h-7 min-w-7 shrink-0 cursor-pointer items-center justify-center rounded-sm px-1.5 text-xs text-[#aaa49a] hover:bg-white/[0.06] hover:text-[#eee7db]" title="Text colour" aria-label="Text colour">
              <Icon icon="fa-solid fa-font" /><input className="absolute inset-0 cursor-pointer opacity-0" type="color" defaultValue="#d8d1c5" disabled={readOnly} onChange={(event) => run(() => editor.chain().focus().setColor(event.target.value).run())} />
            </label>
            <label className={`relative inline-flex h-7 min-w-7 shrink-0 cursor-pointer items-center justify-center rounded-sm px-1.5 text-xs ${editor.isActive('highlight') ? 'bg-[#b68b47]/15 text-[#c8a66b]' : 'text-[#aaa49a] hover:bg-white/[0.06] hover:text-[#eee7db]'}`} title="Highlight" aria-label="Highlight">
              <Icon icon="fa-solid fa-highlighter" /><input className="absolute inset-0 cursor-pointer opacity-0" type="color" defaultValue="#fff2a8" disabled={readOnly} onChange={(event) => run(() => editor.chain().focus().toggleHighlight({ color: event.target.value }).run())} />
            </label>
            <ToolbarButton title="Clear formatting" disabled={readOnly} onClick={() => run(() => editor.chain().focus().unsetAllMarks().clearNodes().run())}><Icon icon="fa-solid fa-text-slash" /></ToolbarButton>
            {onDesigns && <button type="button" className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded border border-[#b68b47]/55 bg-[#b68b47]/18 px-2.5 text-xs text-[#e4c98f] shadow-[0_0_12px_rgba(182,139,71,.08)] hover:bg-[#b68b47]/28" onMouseDown={(event) => event.preventDefault()} onClick={onDesigns} title="Designs"><Icon icon="fa-solid fa-palette" /> Designs</button>}
          </div>
          <div className="flex min-w-max min-h-8 items-center justify-center gap-0.5 overflow-x-auto border-t border-white/[0.05] px-3">
            {(['h1', 'h2', 'h3'] as const).map((heading) => <ToolbarButton key={heading} title={`Heading ${heading.slice(1)}`} active={editor.isActive('heading', { level: Number(heading.slice(1)) })} disabled={readOnly} onClick={() => setBlock(heading)}><strong>{heading.toUpperCase()}</strong></ToolbarButton>)}
            <ToolbarSeparator />
            <ToolbarButton title="Paragraph" active={editor.isActive('paragraph')} disabled={readOnly} onClick={() => setBlock('paragraph')}><Icon icon="fa-solid fa-paragraph" /></ToolbarButton>
            <ToolbarButton title="Blockquote" active={editor.isActive('blockquote')} disabled={readOnly} onClick={() => run(() => editor.chain().focus().toggleBlockquote().run())}><Icon icon="fa-solid fa-quote-left" /></ToolbarButton>
            <ToolbarButton title="Bullet list" active={editor.isActive('bulletList')} disabled={readOnly} onClick={() => run(() => editor.chain().focus().toggleBulletList().run())}><Icon icon="fa-solid fa-list-ul" /></ToolbarButton>
            <ToolbarButton title="Numbered list" active={editor.isActive('orderedList')} disabled={readOnly} onClick={() => run(() => editor.chain().focus().toggleOrderedList().run())}><Icon icon="fa-solid fa-list-ol" /></ToolbarButton>
            <ToolbarButton title="Outdent" disabled={readOnly} onClick={() => run(() => editor.chain().focus().liftListItem('listItem').run())}><Icon icon="fa-solid fa-outdent" /></ToolbarButton>
            <ToolbarButton title="Indent" disabled={readOnly} onClick={() => run(() => editor.chain().focus().sinkListItem('listItem').run())}><Icon icon="fa-solid fa-indent" /></ToolbarButton>
            <ToolbarSeparator />
            {(['left', 'center', 'right', 'justify'] as const).map((alignment) => <ToolbarButton key={alignment} title={`Align ${alignment}`} active={editor.isActive({ textAlign: alignment })} disabled={readOnly} onClick={() => run(() => editor.chain().focus().setTextAlign(alignment).run())}><Icon icon={`fa-solid fa-align-${alignment}`} /></ToolbarButton>)}
            <ToolbarSeparator />
            <div className="relative shrink-0">
              <ToolbarButton title="Link" active={editor.isActive('link')} disabled={readOnly} onClick={setLink}><Icon icon="fa-solid fa-link" /></ToolbarButton>
              {linkOpen && <div className="editor-link-popover absolute bottom-[calc(100%+8px)] left-1/2 z-40 w-72 -translate-x-1/2 rounded-lg border border-white/10 bg-[#18181a] p-3 text-[#d8d1c5] shadow-2xl" role="dialog" aria-label="Insert link" onMouseDown={(event) => event.preventDefault()}>
                <label className="mb-1 block text-[11px] text-[#aaa49a]" htmlFor="editor-link-url">Link URL</label>
                <input id="editor-link-url" autoFocus value={linkDraft} onChange={(event) => setLinkDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); applyLink() } if (event.key === 'Escape') setLinkOpen(false) }} className="w-full rounded border border-white/10 bg-black/20 px-2 py-1.5 text-xs outline-none focus:border-[#b68b47]/70" />
                <div className="mt-2 flex justify-end gap-2"><button type="button" className="rounded px-2 py-1 text-xs text-[#aaa49a] hover:bg-white/[0.06]" onClick={() => setLinkOpen(false)}>Cancel</button><button type="button" className="rounded bg-[#b68b47]/20 px-2 py-1 text-xs text-[#e4c98f] hover:bg-[#b68b47]/30" onClick={applyLink}>Apply</button></div>
              </div>}
            </div>
            <div className="relative shrink-0">
              <ToolbarButton title="Insert media" disabled={readOnly} onClick={toggleMedia}><Icon icon="fa-regular fa-image" /></ToolbarButton>
              {mediaOpen && <div className="editor-media-popover absolute right-0 top-8 z-30 w-64 rounded border border-white/10 bg-[#18181a] p-2 text-[#d8d1c5] shadow-xl" role="dialog" aria-label="Insert media">
                <strong className="block px-1 pb-2 text-xs font-medium">Insert media</strong>
                {libraryImages.length ? <div className="grid grid-cols-2 gap-1.5">
                  {libraryImages.map((item) => <button key={item.id} type="button" className="group overflow-hidden rounded border border-white/10 text-left hover:border-[#b68b47]/60" onMouseDown={(event) => event.preventDefault()} onClick={() => insertLibraryImage(item)}>
                    <img src={item.image} alt={item.text || 'Media Library image'} className="h-20 w-full object-cover transition group-hover:opacity-90" />
                    <span className="block truncate px-1.5 py-1 text-[10px] text-[#aaa49a]">{item.text || 'Untitled image'}</span>
                  </button>)}
                </div> : <p className="px-1 py-2 text-xs text-[#aaa49a]">No media has been added yet.</p>}
                <a href={`/novel/${novelId}/media`} className="mt-2 block border-t border-white/[0.06] px-1 pt-2 text-xs text-[#c8a66b] hover:text-[#eee7db]">Open Media Library</a>
              </div>}
            </div>
            <ToolbarButton title="Insert page break" disabled={readOnly} onClick={() => run(() => (editor.chain() as any).focus().insertPageBreak().run())}><Icon icon="fa-regular fa-file-lines" /></ToolbarButton>
            <ToolbarButton title="Insert scene break" disabled={readOnly} onClick={() => run(() => (editor.chain() as any).focus().insertSceneBreak().run())}><Icon icon="fa-solid fa-feather-pointed" /></ToolbarButton>
            <div className="relative shrink-0">
              <ToolbarButton title="More editor actions" disabled={readOnly} onClick={() => setMoreOpen((open) => !open)}><Icon icon="fa-solid fa-ellipsis" /></ToolbarButton>
              {moreOpen && <div className="absolute right-0 top-8 z-30 min-w-40 rounded border border-white/10 bg-[#18181a] p-1 shadow-xl">
                <button type="button" className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-[#d8d1c5] hover:bg-white/[0.06]" onClick={() => { setMoreOpen(false); run(() => editor.chain().focus().toggleCode().run()) }}><Icon icon="fa-solid fa-code" /> Inline code</button>
                <button type="button" className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-[#d8d1c5] hover:bg-white/[0.06]" onClick={() => { setMoreOpen(false); run(() => editor.chain().focus().setHorizontalRule().run()) }}><Icon icon="fa-solid fa-minus" /> Horizontal rule</button>
              </div>}
            </div>
            <span className="mx-1 flex-1" />
            <ToolbarButton title="Undo" disabled={readOnly || !canUndo} onClick={() => run(() => (editor.chain() as any).focus().undo().run())}><Icon icon="fa-solid fa-rotate-left" /></ToolbarButton>
            <ToolbarButton title="Redo" disabled={readOnly || !canRedo} onClick={() => run(() => (editor.chain() as any).focus().redo().run())}><Icon icon="fa-solid fa-rotate-right" /></ToolbarButton>
          </div>
        </div>
        <div className="flex min-h-0 w-full flex-1 justify-center overflow-y-auto overflow-x-hidden py-2" onMouseOver={showEntityTip} onMouseLeave={() => setEntityTip(null)}>
        <div className={`editor-canvas relative shrink-0 rounded-[3px] border border-black/[0.08] bg-[var(--design-page-bg,#f3efe6)] shadow-[0_12px_40px_rgba(0,0,0,0.22)]${pageSize !== 'continuous' ? ' editor-canvas-paged' : ''}`} style={pageSize !== 'continuous' ? (() => { const geometry = editorPageGeometry(pageSize, Number(pageLayout?.pageMargin) || undefined); return { width: geometry.widthPx, minHeight: geometry.heightPx, '--pg-width': `${geometry.widthPx}px`, '--pg-height': `${geometry.heightPx}px`, '--page-margin-top': `${geometry.marginTopPx}px`, '--page-margin-right': `${geometry.marginRightPx}px`, '--page-margin-bottom': `${geometry.marginBottomPx}px`, '--page-margin-left': `${geometry.marginLeftPx}px` } as React.CSSProperties })() : undefined}>
          <div className="editor-head">
            <input
              className="collaborative-editor-title chapter-edit-title"
              style={{
                fontFamily: typography.chapterTitleStyle?.fontFamily,
                fontSize: typography.chapterTitleStyle?.fontSize,
                lineHeight: typography.chapterTitleStyle?.lineHeight,
                color: typography.chapterTitleStyle?.color,
              }}
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
              onBlur={() => { onTitleChange?.(titleDraft); onTitleBlur?.(titleDraft) }}
              placeholder="Chapter One"
              aria-label="Chapter title"
            />
          </div>
          <EditorContent
            editor={editor}
            className="prose collaborative-editor-content editor-content"
            style={{
              fontFamily: typography.bodyStyle?.fontFamily,
              fontSize: typography.bodyStyle?.fontSize,
              lineHeight: typography.bodyStyle?.lineHeight,
              color: typography.bodyStyle?.color,
            }}
          />
          {!readOnly && <BubbleMenu editor={editor}>
            <div className="collaborative-bubble-menu">
              <button type="button" onClick={() => editor.chain().focus().toggleBold().run()}>Bold</button>
              <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()}>Italic</button>
              <button type="button" onClick={() => {
                const annotationId = `comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
                editor.chain().focus().setMark('comment', { annotationId }).run()
                onComment?.(editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, ' '), annotationId)
              }}>Comment</button>
            </div>
          </BubbleMenu>}
        </div>
        {entityTip && <div className="entity-tip collaborative-entity-tip" style={{ left: entityTip.x, top: entityTip.y }} role="dialog" aria-label={`${entityTip.kind} information`} onMouseEnter={() => {}}>
          <div className="entity-tip-banner"><div className="entity-tip-icon"><Icon icon={entityTip.kind === 'Character' ? 'fa-solid fa-user' : entityTip.kind === 'Place' ? 'fa-solid fa-location-dot' : entityTip.kind === 'Artefact' ? 'fa-solid fa-gem' : 'fa-solid fa-shield-halved'} /></div><div className="entity-tip-header-text"><div className="entity-tip-name">{entityTip.entity.name || entityTip.entity.term}</div><div className="entity-tip-kind">{entityTip.kind}</div></div></div>
          {(entityTip.entity.notes || entityTip.entity.description || entityTip.entity.bio) && <div className="entity-tip-excerpt">{String(entityTip.entity.notes || entityTip.entity.description || entityTip.entity.bio).slice(0, 180)}</div>}
        </div>}
        </div>
      </div>
    </div>
  </div>
}

export default memo(CollaborativeEditor, (previous, next) => (
  previous.novelId === next.novelId &&
  previous.chapterId === next.chapterId &&
  previous.initialHtml === next.initialHtml &&
  previous.title === next.title &&
  previous.readOnly === next.readOnly &&
  previous.username === next.username &&
  previous.color === next.color &&
  previous.enableCollaboration === next.enableCollaboration &&
  previous.characters === next.characters &&
  previous.terms === next.terms &&
  previous.entities === next.entities &&
  previous.pageLayout?.pageSize === next.pageLayout?.pageSize &&
  previous.pageLayout?.pageMargin === next.pageLayout?.pageMargin &&
  previous.typography === next.typography
))
