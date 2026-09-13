import * as Y from 'yjs'
import { openLiveDocument } from './liveDocument'

export type EditorController = {
  setHtml: (html: string) => void
}

export type EditorCollaborationSession = {
  doc: Y.Doc
  close: () => Promise<void>
  publish: (value: { title?: string; html?: string }) => void
}

/**
 * Keeps collaboration transport and document state behind the canonical
 * contenteditable editor. The adapter deliberately stores a small, versioned
 * envelope in Yjs rather than rendering a second editor implementation.
 */
export async function openEditorCollaboration({
  novelId,
  chapterId,
  readOnly,
  initialTitle,
  initialHtml,
  controller,
  onStatus,
  onRemoteTitle,
}: {
  novelId: string
  chapterId: string
  readOnly?: boolean
  initialTitle?: string
  initialHtml?: string
  controller?: EditorController | null
  onStatus?: (status: string) => void
  onRemoteTitle?: (title: string) => void
}): Promise<EditorCollaborationSession> {
  let applyingRemote = false
  const live = await openLiveDocument({ novelId, chapterId, readOnly, onStatus })
  const record = live.doc.getMap<any>('editor-envelope')

  const applyRemote = () => {
    const html = record.get('html')
    if (typeof html !== 'string' || !controller || applyingRemote) return
    applyingRemote = true
    try { controller.setHtml(html) } finally { applyingRemote = false }
  }
  const applyRemoteTitle = () => {
    const title = record.get('title')
    if (typeof title === 'string') onRemoteTitle?.(title)
  }

  const onRecordChange = (event: Y.YMapEvent<any>) => {
    if (event.keysChanged.has('html')) applyRemote()
    if (event.keysChanged.has('title')) applyRemoteTitle()
  }
  record.observe(onRecordChange)

  if (!record.has('schema')) {
    live.doc.transact(() => {
      record.set('schema', 1)
      record.set('title', initialTitle || '')
      record.set('html', initialHtml || '')
      record.set('updatedAt', Date.now())
    }, 'local')
  } else {
    applyRemote()
    applyRemoteTitle()
  }

  return {
    doc: live.doc,
    close: async () => {
      record.unobserve(onRecordChange)
      await live.close()
    },
    publish: (value) => {
      if (readOnly || applyingRemote) return
      live.doc.transact(() => {
        if (typeof value.title === 'string') record.set('title', value.title)
        if (typeof value.html === 'string') record.set('html', value.html)
        record.set('updatedAt', Date.now())
      }, 'local')
    },
  }
}

export const collaborativeWriteEnabled =
  String(import.meta.env?.VITE_ENABLE_COLLABORATIVE_WRITE || '').toLowerCase() === 'true'
