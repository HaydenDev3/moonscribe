// Premade "design packs" that can be dragged onto the cover designer or the
// chapter editor. Each pack maps to a CSS class (see app.css) that restyles
// the manuscript, plus a set of cover colours for the book cover.
export const DESIGNS = [
  {
    id: 'moonlight',
    name: 'Moonlight',
    blurb: 'Cool blues and a quiet sea',
    tags: ['editor', 'cover'],
    swatches: ['#8fb2d4', '#7ba3c9', '#4a6b8a'],
    editorClass: 'design-moonlight',
    cover: { coverStyle: 'moonstone', titleColor: '#ffffff', ornament: '✦' }
  },
  {
    id: 'ember',
    name: 'Ember',
    blurb: 'A warm dusk, rose and low fire',
    tags: ['editor', 'cover'],
    swatches: ['#d4897b', '#e0b9b9', '#6b4a3a'],
    editorClass: 'design-ember',
    cover: { coverStyle: 'rose', titleColor: '#ffffff', ornament: '❦' }
  },
  {
    id: 'moss',
    name: 'Moss',
    blurb: 'Sage greens, soft underfoot',
    tags: ['editor', 'cover'],
    swatches: ['#8aa97f', '#a8c5a8', '#43594a'],
    editorClass: 'design-moss',
    cover: { coverStyle: 'sage', titleColor: '#ffffff', ornament: '◆' }
  },
  {
    id: 'sand',
    name: 'Sandstone',
    blurb: 'Warm sand and old paper',
    tags: ['editor', 'cover'],
    swatches: ['#c9a86a', '#d8b48f', '#6f5b41'],
    editorClass: 'design-sand',
    cover: { coverStyle: 'sand', titleColor: '#ffffff', ornament: '✧' }
  },
  {
    id: 'midnight',
    name: 'Midnight',
    blurb: 'Dark paper for late pages',
    tags: ['editor', 'cover'],
    swatches: ['#9bb8d4', '#232a33', '#4a6b8a'],
    editorClass: 'design-midnight',
    cover: { coverStyle: 'twilight', titleColor: '#ffffff', ornament: '✦' }
  },
  {
    id: 'parchment',
    name: 'Parchment',
    blurb: 'Aged paper, warm and sepia-toned',
    tags: ['editor'],
    swatches: ['#f5ecd0', '#c9a86a', '#4a3d28'],
    editorClass: 'design-parchment',
    cover: { coverStyle: 'sand', titleColor: '#ffffff', ornament: '❧' }
  },
  {
    id: 'crimson',
    name: 'Crimson',
    blurb: 'Deep red ink, dark romanticism',
    tags: ['editor', 'cover'],
    swatches: ['#c0404a', '#fdf0ef', '#5a1e1e'],
    editorClass: 'design-crimson',
    cover: { coverStyle: 'rose', titleColor: '#ffffff', ornament: '✦' }
  },
  {
    id: 'forest',
    name: 'Forest',
    blurb: 'Hunter greens, deep and quiet',
    tags: ['editor', 'cover'],
    swatches: ['#5a8c60', '#f0f5ee', '#1f3a26'],
    editorClass: 'design-forest',
    cover: { coverStyle: 'sage', titleColor: '#ffffff', ornament: '◆' }
  },
  {
    id: 'slate',
    name: 'Slate',
    blurb: 'Cool blue-grey, clean focus',
    tags: ['editor'],
    swatches: ['#6a88a8', '#f2f4f6', '#38475a'],
    editorClass: 'design-slate',
    cover: { coverStyle: 'twilight', titleColor: '#ffffff', ornament: '✧' }
  },
  {
    id: 'lavender',
    name: 'Lavender',
    blurb: 'Soft purple, dreamy and still',
    tags: ['editor'],
    swatches: ['#8a74c0', '#f4f2f8', '#4a3a6a'],
    editorClass: 'design-lavender',
    cover: { coverStyle: 'moonstone', titleColor: '#ffffff', ornament: '✦' }
  },
  {
    id: 'noir',
    name: 'Noir',
    blurb: 'Black pages, silver ink',
    tags: ['editor'],
    swatches: ['#1a1a1a', '#333333', '#e8e8e0'],
    editorClass: 'design-noir',
    cover: { coverStyle: 'twilight', titleColor: '#e8e8e0', ornament: '◆' }
  },
  {
    id: 'ivory',
    name: 'Ivory',
    blurb: 'Clean cream, distraction-free',
    tags: ['editor'],
    swatches: ['#fafaf6', '#e8e8e0', '#2a2a28'],
    editorClass: 'design-ivory',
    cover: { coverStyle: 'moonstone', titleColor: '#ffffff', ornament: '✧' }
  },
  {
    id: 'copper',
    name: 'Copper',
    blurb: 'Warm bronze, old-world craft',
    tags: ['editor', 'cover'],
    swatches: ['#b06830', '#faf4ee', '#5a3820'],
    editorClass: 'design-copper',
    cover: { coverStyle: 'sand', titleColor: '#ffffff', ornament: '❦' }
  },
  {
    id: 'dusk',
    name: 'Dusk',
    blurb: 'Purple-pink twilight hour',
    tags: ['editor'],
    swatches: ['#9858b8', '#f8f0f8', '#4a2860'],
    editorClass: 'design-dusk',
    cover: { coverStyle: 'moonstone', titleColor: '#ffffff', ornament: '✦' }
  },
  { id: 'page-title', name: 'Title Page', blurb: 'Centered title with an ornamental opening', tags: ['editor'], swatches: ['#f5ecd0', '#c9a86a', '#4a3d28'], editorClass: 'design-parchment', pageTemplate: 'title-page' },
  { id: 'page-copyright', name: 'Copyright Page', blurb: 'Quiet publication details on warm paper', tags: ['editor'], swatches: ['#f2eee5', '#b7a482', '#584a38'], editorClass: 'design-ivory', pageTemplate: 'copyright-page' },
  { id: 'page-dedication', name: 'Dedication Page', blurb: 'A minimal dedication with a centered flourish', tags: ['editor'], swatches: ['#faf3e7', '#c9a86a', '#6f5b41'], editorClass: 'design-sand', pageTemplate: 'dedication-page' },
  { id: 'page-epigraph', name: 'Epigraph / Quote', blurb: 'A framed quotation layout', tags: ['editor'], swatches: ['#f5ecd0', '#a08040', '#4a3d28'], editorClass: 'design-parchment', pageTemplate: 'epigraph-page' },
  { id: 'page-chapter', name: 'Chapter Opening', blurb: 'A spacious decorative chapter opener', tags: ['editor'], swatches: ['#f2f7fc', '#7ba3c9', '#3a4f66'], editorClass: 'design-moonlight', pageTemplate: 'chapter-opening' },
  { id: 'page-scene', name: 'Scene Break', blurb: 'A centered divider for scene transitions', tags: ['editor'], swatches: ['#232a33', '#9bb8d4', '#e8e4dc'], editorClass: 'design-midnight', pageTemplate: 'scene-break' },
  { id: 'page-character', name: 'Character Profile', blurb: 'A structured page for character notes', tags: ['editor'], swatches: ['#f1f6ef', '#8aa97f', '#43594a'], editorClass: 'design-moss', pageTemplate: 'character-profile' },
  { id: 'page-map', name: 'Map / Notes Page', blurb: 'A grid-based reference page', tags: ['editor'], swatches: ['#f2eee5', '#8a7c68', '#3d3a35'], editorClass: 'design-slate', pageTemplate: 'map-notes' }
]

export function designById(id) {
  return DESIGNS.find((d) => d.id === id) || null
}

const PRINT_THEMES = {
  moonlight: { paper: '#f2f7fc', ink: '#3a4f66', accent: '#7ba3c9' },
  ember: { paper: '#fdf3ec', ink: '#6b4a3a', accent: '#d4897b' },
  moss: { paper: '#f1f6ef', ink: '#43594a', accent: '#8aa97f' },
  sand: { paper: '#faf3e7', ink: '#6f5b41', accent: '#c9a86a' },
  midnight: { paper: '#232a33', ink: '#e8e4dc', accent: '#9bb8d4' },
  parchment: { paper: '#f5ecd0', ink: '#4a3d28', accent: '#c9a86a' },
  crimson: { paper: '#fdf0ef', ink: '#5a1e1e', accent: '#c0404a' },
  forest: { paper: '#f0f5ee', ink: '#1f3a26', accent: '#5a8c60' },
  slate: { paper: '#f2f4f6', ink: '#38475a', accent: '#6a88a8' },
  lavender: { paper: '#f4f2f8', ink: '#4a3a6a', accent: '#8a74c0' },
  noir: { paper: '#1a1a1a', ink: '#e8e8e0', accent: '#999999' },
  ivory: { paper: '#fafaf6', ink: '#2a2a28', accent: '#9a8c72' },
  copper: { paper: '#faf4ee', ink: '#5a3820', accent: '#b06830' },
  dusk: { paper: '#f8f0f8', ink: '#4a2860', accent: '#9858b8' },
}

export function designPrintTheme(layout = {}) {
  if (layout.editorDesign === 'custom') {
    return {
      paper: layout.customPageBg || '#fffdf9',
      ink: layout.customPageText || '#211d19',
      accent: layout.customPageText || '#8a6a3d',
    }
  }
  return PRINT_THEMES[layout.editorDesign] || { paper: '#fffdf9', ink: '#211d19', accent: '#8a6a3d' }
}

export const DESIGN_MIME = 'application/x-moonscribe-design'
