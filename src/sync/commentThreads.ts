import * as Y from 'yjs'

export type CommentReply = { id: string; authorId: string; authorName: string; text: string; createdAt: number }
export type CommentThread = { id: string; chapterId: string; createdAt: number; authorId: string; authorName: string; quote?: string; resolved: boolean; resolvedBy?: string | null; comments: CommentReply[] }

export function getCommentThreadsMap(doc: Y.Doc) {
  return doc.getMap<Y.Map<any>>('comment-threads')
}

export function readCommentThreads(doc: Y.Doc): CommentThread[] {
  const result: CommentThread[] = []
  getCommentThreadsMap(doc).forEach((threadMap) => {
    if (!(threadMap instanceof Y.Map)) return
    result.push({
      id: String(threadMap.get('id') || ''),
      chapterId: String(threadMap.get('chapterId') || ''),
      createdAt: Number(threadMap.get('createdAt') || 0),
      authorId: String(threadMap.get('authorId') || ''),
      authorName: String(threadMap.get('authorName') || 'Collaborator'),
      quote: String(threadMap.get('quote') || ''),
      resolved: Boolean(threadMap.get('resolved')),
      resolvedBy: threadMap.get('resolvedBy') || null,
      comments: (threadMap.get('comments') instanceof Y.Array ? threadMap.get('comments').toArray() : []) as CommentReply[],
    })
  })
  return result.filter((thread) => thread.id)
}

export function upsertYjsThread(doc: Y.Doc, thread: CommentThread) {
  const threads = getCommentThreadsMap(doc)
  doc.transact(() => {
    let threadMap = threads.get(thread.id)
    if (!threadMap) { threadMap = new Y.Map(); threads.set(thread.id, threadMap) }
    threadMap.set('id', thread.id)
    threadMap.set('chapterId', thread.chapterId)
    threadMap.set('createdAt', thread.createdAt)
    threadMap.set('authorId', thread.authorId)
    threadMap.set('authorName', thread.authorName)
    threadMap.set('quote', thread.quote || '')
    threadMap.set('resolved', thread.resolved)
    threadMap.set('resolvedBy', thread.resolvedBy || null)
    let comments = threadMap.get('comments')
    if (!(comments instanceof Y.Array)) { comments = new Y.Array(); threadMap.set('comments', comments) }
    comments.delete(0, comments.length)
    comments.insert(0, thread.comments)
  })
}

export function toggleYjsThreadResolved(doc: Y.Doc, threadId: string, resolved: boolean, userId: string) {
  const thread = getCommentThreadsMap(doc).get(threadId)
  if (!thread) return
  doc.transact(() => { thread.set('resolved', resolved); thread.set('resolvedBy', resolved ? userId : null) })
}

export function deleteYjsThread(doc: Y.Doc, editor: any, threadId: string) {
  getCommentThreadsMap(doc).delete(threadId)
  if (!editor) return
  const { tr } = editor.state
  let found = false
  editor.state.doc.descendants((node: any, pos: number) => {
    const mark = node.marks.find((item: any) => item.type.name === 'comment' && item.attrs.annotationId === threadId)
    if (mark) { tr.removeMark(pos, pos + node.nodeSize, mark.type); found = true }
  })
  if (found) editor.view.dispatch(tr)
}
