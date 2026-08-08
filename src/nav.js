// Single source of truth for a novel's navigation, used by the Sidebar and
// the SubPageTopbar. Groups let the sidebar show quiet section headers.
export const NOVEL_NAV = [
  {
    group: 'Write',
    items: [{ to: '', label: 'Write', icon: 'fa-solid fa-pen-nib', end: true }]
  },
  {
    group: 'Binder',
    items: [
      { to: 'characters', label: 'Characters', icon: 'fa-solid fa-user' },
      { to: 'notes', label: 'Notes', icon: 'fa-regular fa-note-sticky' },
      { to: 'relationships', label: 'Relationships', icon: 'fa-regular fa-heart' },
      { to: 'world', label: 'Worldbuilding', icon: 'fa-solid fa-globe' },
      { to: 'moodboard', label: 'Moodboard', icon: 'fa-regular fa-images' }
    ]
  },
  {
    group: 'Designer',
    items: [
      { to: 'design', label: 'Designer', icon: 'fa-solid fa-wand-magic-sparkles' },
      { to: 'analytics', label: 'Analytics', icon: 'fa-solid fa-chart-line' }
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
