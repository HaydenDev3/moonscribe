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
  }
]

export function designById(id) {
  return DESIGNS.find((d) => d.id === id) || null
}

export const DESIGN_MIME = 'application/x-moonscribe-design'
