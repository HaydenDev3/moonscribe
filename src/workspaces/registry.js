export const WORKSPACE_REGISTRY = [
  { key: 'write', label: 'Manuscript', icon: 'fa-solid fa-pen-nib', group: 'Manuscript', required: true, defaultVisible: true },
  { key: 'planning', label: 'Planning cockpit', icon: 'fa-solid fa-compass-drafting', group: 'Plan', defaultVisible: true, panels: ['characters', 'relationships', 'chapters', 'notes'] },
  { key: 'characters', label: 'Characters', icon: 'fa-solid fa-user', group: 'Plan', defaultVisible: true },
  { key: 'relationships', label: 'Relationships', icon: 'fa-regular fa-heart', group: 'Plan', defaultVisible: true },
  { key: 'family-tree', label: 'Family tree', icon: 'fa-solid fa-people-roof', group: 'Plan', defaultVisible: true },
  { key: 'world', label: 'Worldbuilding', icon: 'fa-solid fa-globe', group: 'Plan', defaultVisible: true },
  { key: 'glossary', label: 'Glossary', icon: 'fa-solid fa-book-open', group: 'Plan', defaultVisible: true },
  { key: 'timeline', label: 'Timeline', icon: 'fa-solid fa-clock-rotate-left', group: 'Plan', defaultVisible: true },
  { key: 'milestones', label: 'Milestones', icon: 'fa-solid fa-flag-checkered', group: 'Plan', defaultVisible: true },
  { key: 'moodboard', label: 'Moodboard', icon: 'fa-regular fa-images', group: 'Collect', defaultVisible: true },
  { key: 'media', label: 'Media Library', icon: 'fa-regular fa-images', group: 'Collect', defaultVisible: true, panels: ['media', 'templates'] },
  { key: 'files', label: 'Project files', icon: 'fa-solid fa-folder-tree', group: 'Collect', defaultVisible: true },
  { key: 'writing-journal', label: 'Writing journal', icon: 'fa-solid fa-feather-pointed', group: 'Collect', defaultVisible: true },
  { key: 'design', label: 'Designer', icon: 'fa-solid fa-wand-magic-sparkles', group: 'Design', defaultVisible: true },
  { key: 'interior-layout', label: 'Interior Layout', icon: 'fa-solid fa-file-lines', group: 'Design', defaultVisible: true },
  { key: 'analytics', label: 'Analytics', icon: 'fa-solid fa-chart-line', group: 'Review', defaultVisible: true },
  { key: 'story-memory', label: 'Story Memory', icon: 'fa-solid fa-brain', group: 'Review', defaultVisible: true },
  { key: 'prose-tools', label: 'Prose tools', icon: 'fa-solid fa-spell-check', group: 'Review', defaultVisible: true },
  { key: 'corkboard', label: 'Draft board', icon: 'fa-solid fa-border-all', group: 'Review', defaultVisible: true },
  { key: 'continuity', label: 'Continuity', icon: 'fa-solid fa-circle-check', group: 'Review', defaultVisible: true },
  { key: 'versions', label: 'Draft history', icon: 'fa-solid fa-clock-rotate-left', group: 'Archive', defaultVisible: true },
  { key: 'trash', label: 'Trash', icon: 'fa-solid fa-trash-can', group: 'Archive', defaultVisible: true },
]

export function workspaceFor(key) { return WORKSPACE_REGISTRY.find((item) => item.key === key) || WORKSPACE_REGISTRY[0] }
export function defaultWorkspacePreferences() {
  return { enabled: WORKSPACE_REGISTRY.filter((item) => item.defaultVisible).map((item) => item.key), order: WORKSPACE_REGISTRY.map((item) => item.key), pinned: 'write', names: {}, layout: 'comfortable', panels: {} }
}
