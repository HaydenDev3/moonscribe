import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'

const root = join(process.cwd(), 'dist', 'assets')
const files = []

for (const name of await readdir(root)) {
  const info = await stat(join(root, name))
  if (info.isFile() && /\.(js|css)$/.test(name)) files.push({ name, bytes: info.size })
}

files.sort((a, b) => b.bytes - a.bytes)
console.log('MoonScribe bundle report')
console.log(`Assets: ${files.length}`)
for (const file of files.slice(0, 20)) console.log(`${(file.bytes / 1024).toFixed(1).padStart(8)} KB  ${file.name}`)
