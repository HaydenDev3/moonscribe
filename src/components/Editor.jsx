import { useEffect, useRef, useCallback } from 'react'
import { countWords } from '../utils/words'
import { sanitizePaste } from '../utils/formatHtml'

// A deliberately simple contentEditable editor. Formatting is applied with
// execCommand, which keeps the toolbar tiny and the code maintainable.
export default function Editor({ initialHtml, onReport, placeholder, title, onTitleChange, onTitleBlur }) {
  const ref = useRef(null)
  const onReportRef = useRef(onReport)

  useEffect(() => {
    onReportRef.current = onReport
  }, [onReport])

  // Only touches the DOM on mount (the parent remounts us via `key` when the
  // chapter changes), so the caret is never disturbed while typing.
  useEffect(() => {
    const el = ref.current
    if (el && el.innerHTML !== (initialHtml || '')) el.innerHTML = initialHtml || ''
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const report = useCallback(() => {
    const el = ref.current
    if (!el) return
    const html = el.innerHTML
    onReportRef.current?.(html, countWords(html))
  }, [])

  const exec = useCallback(
    (cmd, val = null) => {
      const el = ref.current
      if (!el) return
      el.focus()
      document.execCommand(cmd, false, val)
      report()
    },
    [report]
  )

  const formatBlock = useCallback(
    (tag) => {
      const el = ref.current
      if (!el) return
      el.focus()
      try {
        document.execCommand('formatBlock', false, tag)
      } catch {
        document.execCommand('formatBlock', false, `<${tag}>`)
      }
      report()
    },
    [report]
  )

  const toggleHeading = useCallback(
    (tag) => {
      const el = ref.current
      if (!el) return
      const sel = window.getSelection()
      const node = sel?.anchorNode
      const block = node?.nodeType === 3 ? node.parentElement?.closest('h1,h2,h3,h4,p') : node?.closest?.('h1,h2,h3,h4,p')
      if (block && block.tagName.toLowerCase() === tag) {
        formatBlock('p')
      } else {
        formatBlock(tag)
      }
    },
    [formatBlock]
  )

  const insertSceneBreak = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    document.execCommand(
      'insertHTML',
      false,
      '<div class="scene-break" contenteditable="false" data-scene-break="true">❦</div><p><br></p>'
    )
    report()
  }, [report])

  const insertLink = useCallback(() => {
    const url = window.prompt('Link URL (https://…)')
    if (url && url.trim()) exec('createLink', url.trim())
  }, [exec])

  const handlePaste = useCallback(
    (e) => {
      e.preventDefault()
      const html = e.clipboardData?.getData('text/html')
      const text = e.clipboardData?.getData('text/plain')
      const cleaned = sanitizePaste(html && html.trim() ? html : text)
      if (!cleaned) return
      document.execCommand('insertHTML', false, cleaned)
      report()
    },
    [report]
  )

  const handleKeyDown = useCallback(
    (e) => {
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return
      const k = e.key.toLowerCase()
      if (e.shiftKey && k === 'e') {
        e.preventDefault()
        insertSceneBreak()
        return
      }
      switch (k) {
        case 'b':
          e.preventDefault()
          exec('bold')
          break
        case 'i':
          e.preventDefault()
          exec('italic')
          break
        case 'u':
          e.preventDefault()
          exec('underline')
          break
        case 'e':
          e.preventDefault()
          toggleHeading('h2')
          break
        case '1':
          e.preventDefault()
          toggleHeading('h2')
          break
        case '2':
          e.preventDefault()
          toggleHeading('h3')
          break
        case 'k':
          e.preventDefault()
          insertLink()
          break
        default:
          break
      }
    },
    [exec, toggleHeading, insertSceneBreak, insertLink]
  )

  const Btn = ({ action, children, title, ariaLabel }) => (
    <button
      className="tb-btn"
      title={title}
      aria-label={ariaLabel || title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={action}
    >
      {children}
    </button>
  )

  return (
    <div className="editor-shell">
      <div className="editor-toolbar" onMouseDown={(e) => e.preventDefault()}>
        <span className="tb-btn tb-label">Format</span>
        <Btn action={() => exec('bold')} title="Bold (Ctrl+B)" ariaLabel="Bold">
          <b>B</b>
        </Btn>
        <Btn action={() => exec('italic')} title="Italic (Ctrl+I)" ariaLabel="Italic">
          <i>I</i>
        </Btn>
        <Btn action={() => exec('underline')} title="Underline (Ctrl+U)" ariaLabel="Underline">
          <u>U</u>
        </Btn>
        <span className="tb-sep" />
        <Btn action={() => toggleHeading('h2')} title="Heading (Ctrl+1)" ariaLabel="Heading">
          H1
        </Btn>
        <Btn action={() => toggleHeading('h3')} title="Subheading (Ctrl+2)" ariaLabel="Subheading">
          H2
        </Btn>
        <Btn action={() => exec('insertUnorderedList')} title="Bullet list" ariaLabel="Bullet list">
          •≡
        </Btn>
        <Btn action={() => exec('insertOrderedList')} title="Numbered list" ariaLabel="Numbered list">
          1≡
        </Btn>
        <Btn action={() => formatBlock('blockquote')} title="Quote" ariaLabel="Quote">
          ❝
        </Btn>
        <span className="tb-sep" />
        <Btn action={() => exec('justifyLeft')} title="Align left" ariaLabel="Align left">
          ⬅
        </Btn>
        <Btn action={() => exec('justifyCenter')} title="Align center" ariaLabel="Align center">
          ⮕
        </Btn>
        <Btn action={() => exec('justifyRight')} title="Align right" ariaLabel="Align right">
          ➡
        </Btn>
        <span className="tb-sep" />
        <Btn action={insertLink} title="Link (Ctrl+K)" ariaLabel="Insert link">
          🔗
        </Btn>
        <Btn action={() => formatBlock('p')} title="Clear formatting" ariaLabel="Clear formatting">
          ¶
        </Btn>
        <span className="tb-sep" />
        <Btn action={insertSceneBreak} title="Scene break (Ctrl+Shift+E)" ariaLabel="Insert scene break">
          ❦
        </Btn>
        <span className="tb-sep" />
        <Btn action={() => exec('undo')} title="Undo" ariaLabel="Undo">
          ↶
        </Btn>
        <Btn action={() => exec('redo')} title="Redo" ariaLabel="Redo">
          ↷
        </Btn>
      </div>

      <div className="editor-wrap">
        <div className="editor-canvas">
          {title !== undefined && (
            <div className="editor-head">
              <input
                className="chapter-edit-title"
                value={title}
                onChange={(e) => onTitleChange?.(e.target.value)}
                onBlur={() => onTitleBlur?.()}
                placeholder="Chapter title…"
              />
            </div>
          )}
          <div
            ref={ref}
            className="prose"
            contentEditable
            suppressContentEditableWarning
            data-placeholder={placeholder || 'The first sentence is the hardest. Start anywhere.'}
            onInput={report}
            onBlur={report}
            onPaste={handlePaste}
            onKeyDown={handleKeyDown}
          />
        </div>
      </div>
    </div>
  )
}
