// Built-in decorative cover backdrops, drawn inline as SVGs so they need no
// network request and cache cleanly with the PWA. Each matches the cover's
// 2:3 shape and the app's quiet palette.

const svg = (body) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice">${body}</svg>`
  )}`

export const GALLERY = [
  {
    id: 'sea-glass',
    name: 'Sea glass',
    dataUrl: svg(`
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#8fb2d4"/><stop offset=".55" stop-color="#7ba3c9"/><stop offset="1" stop-color="#a6c2dd"/>
        </linearGradient>
        <radialGradient id="h" cx=".5" cy=".3" r=".95">
          <stop offset="0" stop-color="#ffffff" stop-opacity=".38"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="400" height="600" fill="url(#g)"/>
      <rect width="400" height="600" fill="url(#h)"/>
      <path d="M0 510 Q110 470 210 505 T400 495" stroke="#ffffff" stroke-opacity=".28" stroke-width="3" fill="none"/>
      <path d="M0 540 Q150 500 270 532 T400 522" stroke="#ffffff" stroke-opacity=".2" stroke-width="2" fill="none"/>
      <path d="M0 570 Q130 535 240 562 T400 552" stroke="#ffffff" stroke-opacity=".14" stroke-width="2" fill="none"/>
    `)
  },
  {
    id: 'morning-fog',
    name: 'Morning fog',
    dataUrl: svg(`
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#dfe8f0"/><stop offset="1" stop-color="#b9c8d4"/>
        </linearGradient>
      </defs>
      <rect width="400" height="600" fill="url(#g)"/>
      <circle cx="318" cy="150" r="64" fill="#ffffff" opacity=".18"/>
      <ellipse cx="150" cy="430" rx="270" ry="70" fill="#ffffff" opacity=".35"/>
      <ellipse cx="290" cy="480" rx="240" ry="60" fill="#ffffff" opacity=".3"/>
      <ellipse cx="90" cy="535" rx="310" ry="80" fill="#ffffff" opacity=".28"/>
    `)
  },
  {
    id: 'constellation',
    name: 'Constellation',
    dataUrl: svg(`
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#3f5a77"/><stop offset="1" stop-color="#2b3d52"/>
        </linearGradient>
        <radialGradient id="h" cx=".5" cy=".35" r=".95">
          <stop offset="0" stop-color="#cfe0ee" stop-opacity=".16"/><stop offset="1" stop-color="#cfe0ee" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="400" height="600" fill="url(#g)"/>
      <rect width="400" height="600" fill="url(#h)"/>
      <g fill="#eef3f8">
        <circle cx="86" cy="120" r="2"/><circle cx="158" cy="180" r="1.5"/><circle cx="212" cy="96" r="2.2"/>
        <circle cx="302" cy="150" r="1.5"/><circle cx="262" cy="264" r="2"/><circle cx="330" cy="330" r="1.8"/>
        <circle cx="122" cy="320" r="2"/><circle cx="192" cy="402" r="1.5"/><circle cx="70" cy="470" r="2"/>
        <circle cx="248" cy="488" r="1.8"/><circle cx="320" cy="520" r="1.4"/><circle cx="140" cy="548" r="1.6"/>
      </g>
      <g stroke="#cfe0ee" stroke-opacity=".45" stroke-width="1" fill="none">
        <path d="M86 120 L158 180 212 96 302 150"/>
        <path d="M262 264 L330 330 248 488 320 520"/>
        <path d="M122 320 L192 402 140 548"/>
        <path d="M70 470 L140 548"/>
      </g>
    `)
  },
  {
    id: 'rose-sand',
    name: 'Rose sand',
    dataUrl: svg(`
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2=".9" y2="1">
          <stop offset="0" stop-color="#e0b9b9"/><stop offset=".55" stop-color="#d4a5a5"/><stop offset="1" stop-color="#e3c2c2"/>
        </linearGradient>
        <radialGradient id="h" cx=".5" cy=".32" r=".95">
          <stop offset="0" stop-color="#ffffff" stop-opacity=".32"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
        </radialGradient>
        <pattern id="p" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="5" cy="7" r="1" fill="#8a5a5a" opacity=".12"/>
          <circle cx="13" cy="14" r="1.2" fill="#8a5a5a" opacity=".1"/>
        </pattern>
      </defs>
      <rect width="400" height="600" fill="url(#g)"/>
      <rect width="400" height="600" fill="url(#p)"/>
      <rect width="400" height="600" fill="url(#h)"/>
    `)
  },
  {
    id: 'laurel',
    name: 'Laurel',
    dataUrl: svg(`
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#b8d0b8"/><stop offset=".55" stop-color="#a8c5a8"/><stop offset="1" stop-color="#c3d8c3"/>
        </linearGradient>
        <radialGradient id="h" cx=".5" cy=".4" r=".95">
          <stop offset="0" stop-color="#ffffff" stop-opacity=".25"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="400" height="600" fill="url(#g)"/>
      <rect width="400" height="600" fill="url(#h)"/>
      <path d="M -12 596 C 120 470 168 330 128 176 C 112 112 128 54 178 6" stroke="#4f6b4f" stroke-opacity=".4" stroke-width="3" fill="none"/>
      <g fill="#4f6b4f" fill-opacity=".5">
        <ellipse cx="98" cy="516" rx="16" ry="7" transform="rotate(-38 98 516)"/>
        <ellipse cx="128" cy="452" rx="16" ry="7" transform="rotate(28 128 452)"/>
        <ellipse cx="140" cy="386" rx="15" ry="7" transform="rotate(-32 140 386)"/>
        <ellipse cx="134" cy="318" rx="15" ry="7" transform="rotate(30 134 318)"/>
        <ellipse cx="120" cy="252" rx="14" ry="6" transform="rotate(-28 120 252)"/>
        <ellipse cx="108" cy="190" rx="14" ry="6" transform="rotate(34 108 190)"/>
        <ellipse cx="122" cy="130" rx="13" ry="6" transform="rotate(-30 122 130)"/>
      </g>
    `)
  },
  {
    id: 'paper-grain',
    name: 'Paper grain',
    dataUrl: svg(`
      <defs>
        <pattern id="p" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="6" cy="6" r="1" fill="#b9a888" opacity=".16"/>
          <circle cx="16" cy="15" r=".8" fill="#b9a888" opacity=".13"/>
        </pattern>
        <radialGradient id="h" cx=".5" cy=".42" r=".95">
          <stop offset=".55" stop-color="#3d3a36" stop-opacity="0"/><stop offset="1" stop-color="#3d3a36" stop-opacity=".12"/>
        </radialGradient>
      </defs>
      <rect width="400" height="600" fill="#f6f1e8"/>
      <rect width="400" height="600" fill="url(#p)"/>
      <rect width="400" height="600" fill="url(#h)"/>
    `)
  }
]

// The data URL for a `gallery:<id>` cover image source, or null.
export function galleryDataUrl(source) {
  if (!source || !source.startsWith('gallery:')) return null
  const g = GALLERY.find((x) => x.id === source.slice('gallery:'.length))
  return g ? g.dataUrl : null
}

// The active built-in backdrop for a cover (a data URL), or null when the
// cover uses the uploaded picture or no picture at all. `cover.showImage` is
// checked by callers; this only resolves the gallery source.
export function resolveCoverImageUrl(novel, cover = {}) {
  return galleryDataUrl(cover.imageSource)
}
