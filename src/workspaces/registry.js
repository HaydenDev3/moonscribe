export const WORKSPACE_REGISTRY = [
  { key: 'write', label: 'Manuscript', icon: 'fa-solid fa-pen-nib', group: 'Manuscript', required: true, defaultVisible: true },
  { key: 'planning', label: 'Planning cockpit', icon: 'fa-solid fa-compass-drafting', group: 'World', defaultVisible: true, panels: ['characters', 'relationships', 'chapters', 'notes'] },
  { key: 'characters', label: 'Characters', icon: 'fa-solid fa-user', group: 'World', defaultVisible: true },
  { key: 'relationships', label: 'Relationships', icon: 'fa-regular fa-heart', group: 'World', defaultVisible: true },
  { key: 'world', label: 'Worldbuilding', icon: 'fa-solid fa-globe', group: 'World', defaultVisible: true },
  { key: 'glossary', label: 'Glossary', icon: 'fa-solid fa-book-open', group: 'World', defaultVisible: true },
  { key: 'moodboard', label: 'Moodboard', icon: 'fa-regular fa-images', group: 'World', defaultVisible: true },
  { key: 'design', label: 'Designer', icon: 'fa-solid fa-wand-magic-sparkles', group: 'Craft', defaultVisible: true },
  { key: 'media', label: 'Media Library', icon: 'fa-regular fa-images', group: 'Craft', defaultVisible: true, panels: ['media', 'templates'] },
  { key: 'files', label: 'Project files', icon: 'fa-solid fa-folder-tree', group: 'Craft', defaultVisible: true },
  { key: 'analytics', label: 'Analytics', icon: 'fa-solid fa-chart-line', group: 'Craft', defaultVisible: true },
  { key: 'corkboard', label: 'Draft board', icon: 'fa-solid fa-border-all', group: 'Craft', defaultVisible: true },
  { key: 'continuity', label: 'Continuity', icon: 'fa-solid fa-circle-check', group: 'Craft', defaultVisible: true },
  { key: 'timeline', label: 'Timeline', icon: 'fa-solid fa-clock-rotate-left', group: 'Journal', defaultVisible: true },
  { key: 'milestones', label: 'Milestones', icon: 'fa-solid fa-flag-checkered', group: 'Journal', defaultVisible: true },
  { key: 'writing-journal', label: 'Writing journal', icon: 'fa-solid fa-feather-pointed', group: 'Journal', defaultVisible: true },
  { key: 'versions', label: 'Draft history', icon: 'fa-solid fa-clock-rotate-left', group: 'Archive', defaultVisible: true },
  { key: 'trash', label: 'Trash', icon: 'fa-solid fa-trash-can', group: 'Archive', defaultVisible: true },
]

export function workspaceFor(key) { return WORKSPACE_REGISTRY.find((item) => item.key === key) || WORKSPACE_REGISTRY[0] }
export function defaultWorkspacePreferences() {
  return { enabled: WORKSPACE_REGISTRY.filter((item) => item.defaultVisible).map((item) => item.key), order: WORKSPACE_REGISTRY.map((item) => item.key), pinned: 'write', names: {}, layout: 'comfortable', panels: {} }
}
