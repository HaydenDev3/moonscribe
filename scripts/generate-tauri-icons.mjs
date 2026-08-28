import { readFileSync } from 'node:fs'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import sharp from 'sharp'

const src = resolve('public/moonscribelogo.png')
const outDir = resolve('src-tauri/icons')
mkdirSync(outDir, { recursive: true })
const source = readFileSync(src)

const targets = [
  { name: 'icon-32.png', size: 32 },
  { name: 'icon-128.png', size: 128 },
  { name: 'icon-256.png', size: 256 },
  { name: 'icon-512.png', size: 512 }
]

for (const target of targets) {
  await sharp(source)
    .resize(target.size, target.size)
    .png()
    .toFile(resolve(outDir, target.name))
  console.log(`generated ${target.name}`)
}
