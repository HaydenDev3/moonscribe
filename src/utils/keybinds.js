export const DEFAULT_KEYBINDS = {
  commandPalette: 'Mod+K',
  settings: 'Mod+P',
  save: 'Mod+S',
  bold: 'Mod+B',
  italic: 'Mod+I',
  underline: 'Mod+U',
  sceneBreak: 'Mod+Shift+E',
  pageBreak: 'Mod+Enter',
  removeHighlight: 'Mod+Shift+H',
  headingOne: 'Mod+1',
  headingTwo: 'Mod+2',
  closePanel: 'Escape'
}

export const KEYBIND_LABELS = {
  commandPalette: 'Search and jump anywhere', settings: 'Open Settings', save: 'Save now',
  bold: 'Bold', italic: 'Italic', underline: 'Underline', sceneBreak: 'Insert scene break',
  pageBreak: 'Insert page break', removeHighlight: 'Remove highlighting', headingOne: 'Heading 1',
  headingTwo: 'Heading 2', closePanel: 'Close the active panel or modal'
}

export function formatKeybind(value) {
  return String(value || '').replaceAll('Mod', 'Ctrl').replaceAll('+', ' ')
}

export function keybindFromEvent(event) {
  const parts = []
  if (event.ctrlKey || event.metaKey) parts.push('Mod')
  if (event.altKey) parts.push('Alt')
  if (event.shiftKey) parts.push('Shift')
  const key = event.key === ' ' ? 'Space' : event.key.length === 1 ? event.key.toUpperCase() : event.key
  if (!['Control', 'Meta', 'Alt', 'Shift'].includes(event.key)) parts.push(key)
  return parts.join('+')
}

export function keybindsWithDefaults(value) {
  return { ...DEFAULT_KEYBINDS, ...(value || {}) }
}

export function keybindConflicts(bindings) {
  const seen = new Map()
  const conflicts = new Set()
  for (const [id, value] of Object.entries(bindings)) {
    if (!value) continue
    if (seen.has(value)) { conflicts.add(id); conflicts.add(seen.get(value)) }
    else seen.set(value, id)
  }
  return conflicts
}
