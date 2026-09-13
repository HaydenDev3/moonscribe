import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'

function ReferenceCard({ node }: any) {
  return <NodeViewWrapper className="collaborative-reference-card" contentEditable={false}>
    <strong>{node.attrs.name || 'Reference'}</strong>
    {node.attrs.kind && <small>{node.attrs.kind}</small>}
  </NodeViewWrapper>
}

export const ReferenceCardNode = Node.create({
  name: 'referenceCard',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      cardId: { default: null },
      name: { default: '' },
      kind: { default: 'reference' },
    }
  },
  parseHTML() { return [{ tag: 'div[data-type="reference-card"]' }] },
  renderHTML({ HTMLAttributes }) { return ['div', mergeAttributes({ 'data-type': 'reference-card' }, HTMLAttributes)] },
  addNodeView() { return ReactNodeViewRenderer(ReferenceCard) },
})

export const CustomImageNode = Node.create({
  name: 'customImage',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return { src: { default: null }, alt: { default: '' }, caption: { default: '' }, align: { default: 'center' } }
  },
  parseHTML() { return [{ tag: 'img[data-moonscribe-image]' }] },
  renderHTML({ HTMLAttributes }) { return ['img', mergeAttributes({ 'data-moonscribe-image': '', ...HTMLAttributes })] },
})
