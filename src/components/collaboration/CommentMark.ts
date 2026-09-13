import { Mark, mergeAttributes } from '@tiptap/core'

export const CommentMark = Mark.create({
  name: 'comment',
  inclusive: false,
  addAttributes() {
    return { annotationId: { default: null } }
  },
  parseHTML() {
    return [{ tag: 'span[data-comment-id]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes({ class: 'comment-anchor', 'data-comment-id': HTMLAttributes.annotationId }, HTMLAttributes), 0]
  },
})
