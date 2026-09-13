export const DESIGN_SCHEMA_VERSION = 1

export const DESIGN_THEME_PRESETS = [
  { id: 'literary', label: 'Literary', genre: 'Literary', tone: 'Quiet and considered', audience: 'General readers', mood: 'Editorial', palette: 'parchment', bodyFont: 'literata', chapterStyle: 'left', sceneBreak: '—', pageNumStyle: 'plain', coverDesign: 'minimal' },
  { id: 'dark-fantasy', label: 'Dark Fantasy', genre: 'Fantasy', tone: 'Atmospheric and intense', audience: 'Adult readers', mood: 'Moonlit', palette: 'midnight', bodyFont: 'literata', chapterStyle: 'centered', sceneBreak: '◆', pageNumStyle: 'ornament', coverDesign: 'dark-fantasy' },
  { id: 'romance', label: 'Romance', genre: 'Romance', tone: 'Warm and intimate', audience: 'Romance readers', mood: 'Soft glow', palette: 'blush', bodyFont: 'cormorant', chapterStyle: 'centered', sceneBreak: '❧', pageNumStyle: 'ornament', coverDesign: 'romance' },
  { id: 'minimal', label: 'Minimal', genre: 'Any genre', tone: 'Clean and direct', audience: 'General readers', mood: 'Restrained', palette: 'slate', bodyFont: 'literata', chapterStyle: 'title-only', sceneBreak: '*', pageNumStyle: 'plain', coverDesign: 'minimal' },
  { id: 'classic', label: 'Classic', genre: 'Historical / literary', tone: 'Timeless and formal', audience: 'General readers', mood: 'Parchment', palette: 'bronze', bodyFont: 'cormorant', chapterStyle: 'ornament', sceneBreak: '❦', pageNumStyle: 'ornament', coverDesign: 'classic' },
  { id: 'contemporary', label: 'Contemporary', genre: 'Contemporary', tone: 'Bright and modern', audience: 'General readers', mood: 'Clear', palette: 'ocean', bodyFont: 'literata', chapterStyle: 'centered', sceneBreak: '•', pageNumStyle: 'plain', coverDesign: 'contemporary' },
]

export function normalizeDesignTheme(input: any = {}) {
  return { version: DESIGN_SCHEMA_VERSION, genre: '', tone: '', audience: '', mood: '', preset: '', ...(input || {}) }
}

export function makeDesignSnapshot(novel: any, label = 'Design snapshot') {
  return {
    id: `design-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label,
    createdAt: Date.now(),
    version: DESIGN_SCHEMA_VERSION,
    layout: JSON.parse(JSON.stringify(novel?.layout || {})),
    designTheme: JSON.parse(JSON.stringify(novel?.designTheme || {})),
    designProfile: JSON.parse(JSON.stringify(novel?.designProfile || {})),
  }
}

export function normalizeDesignProfile(input: any = {}) {
  return { version: DESIGN_SCHEMA_VERSION, name: '', target: 'print-pdf', printer: '', ...(input || {}) }
}
