// Single source of truth for a novel's navigation, used by the Sidebar and
// the SubPageTopbar. Groups let the sidebar show quiet section headers.
export const NOVEL_NAV = [
  {
    group: 'World',
    items: [
      { to: 'characters', label: 'Characters', icon: 'fa-solid fa-user' },
      { to: 'relationships', label: 'Relationships', icon: 'fa-regular fa-heart' },
      { to: 'world', label: 'Worldbuilding', icon: 'fa-solid fa-globe' },
      { to: 'glossary', label: 'Glossary', icon: 'fa-solid fa-book-open' },
      { to: 'moodboard', label: 'Moodboard', icon: 'fa-regular fa-images' },
    ]
  },
  {
    group: 'Craft',
    items: [
      { to: 'design', label: 'Designer', icon: 'fa-solid fa-wand-magic-sparkles' },
      { to: 'media', label: 'Media Library', icon: 'fa-regular fa-images' },
      { to: 'analytics', label: 'Analytics', icon: 'fa-solid fa-chart-line' },
      { to: 'corkboard', label: 'Draft board', icon: 'fa-solid fa-border-all' },
      { to: 'continuity', label: 'Continuity', icon: 'fa-solid fa-circle-check' }
    ]
  },
  {
    group: 'Journal',
    items: [
      { to: 'timeline', label: 'Timeline', icon: 'fa-solid fa-clock-rotate-left' },
      { to: 'milestones', label: 'Milestones', icon: 'fa-solid fa-flag-checkered' },
      { to: 'writing-journal', label: 'Writing journal', icon: 'fa-solid fa-feather-pointed' }
    ]
  },
  {
    group: 'Archive',
    items: [
      { to: 'versions', label: 'Draft history', icon: 'fa-solid fa-clock-rotate-left' },
      { to: 'trash', label: 'Trash', icon: 'fa-solid fa-trash-can' }
    ]
  }
]

// Full path for a nav item within a novel. Every section is a mode of the
// writer workspace, so each lives at a plain segment under the novel.
export function itemPath(novelId, item) {
  return `/novel/${novelId}/${item.to}`
}

export function navItemFor(subPath) {
  const [segment] = String(subPath || '').split('/')
  for (const g of NOVEL_NAV) {
    for (const it of g.items) {
      if (it.to === segment) return it
    }
  }
  return null
}
