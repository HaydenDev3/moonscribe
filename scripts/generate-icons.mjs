// Generates the PWA icons from public/icons/icon.svg.
// Run with: npm run icons
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import sharp from 'sharp'

const src = resolve('public/icons/icon.svg')
const svg = readFileSync(src)

const targets = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 }
]

for (const t of targets) {
  await sharp(svg)
    .resize(t.size, t.size)
    .png()
    .toFile(resolve(`public/icons/${t.name}`))
  console.log(`generated public/icons/${t.name}`)
}
