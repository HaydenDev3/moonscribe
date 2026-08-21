import { mergeAttributes, Node } from '@tiptap/core'

export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,
  isolating: true,

  parseHTML() {
    return [
      { tag: 'div[data-page-break="true"]' },
      { tag: 'div.page-break' },
      { tag: 'div.pg-break' },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      class: 'page-break',
      'data-page-break': 'true',
      role: 'separator',
      'aria-label': 'Page break',
    })]
  },

  addCommands() {
    return {
      insertPageBreak: () => ({ chain }) => chain()
        .insertContent({ type: this.name })
        .insertContent({ type: 'paragraph' })
        .run(),
    }
  },

  addKeyboardShortcuts() {
    return { 'Mod-Shift-Enter': () => this.editor.commands.insertPageBreak() }
  },
})

export const SceneBreak = Node.create({
  name: 'sceneBreak',
  group: 'block',
  atom: true,
  selectable: true,

  parseHTML() {
    return [{ tag: 'div[data-scene-break="true"]' }, { tag: 'div.scene-break' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      class: 'scene-break',
      'data-scene-break': 'true',
      role: 'separator',
      'aria-label': 'Scene break',
    }), '❦']
  },

  addCommands() {
    return {
      insertSceneBreak: () => ({ chain }) => chain()
        .insertContent({ type: this.name })
        .insertContent({ type: 'paragraph' })
        .run(),
    }
  },
})
