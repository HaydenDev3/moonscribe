import { readFile, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

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

const entry = files.find((file) => /^index-.*\.js$/.test(file.name))
const entryBytes = entry ? Buffer.from(await readFile(join(root, entry.name))) : null
const rawLimit = 500 * 1024
const gzipLimit = 165 * 1024
const failures = []
if (!entryBytes) failures.push('No main entry JavaScript bundle was found.')
else {
  const gzipBytes = gzipSync(entryBytes, { level: 9 }).length
  console.log(`Main entry gate: ${(entryBytes.length / 1024).toFixed(1)} KB raw / ${(gzipBytes / 1024).toFixed(1)} KB gzip (limits ${(rawLimit / 1024).toFixed(0)} / ${(gzipLimit / 1024).toFixed(0)} KB)`)
  if (entryBytes.length > rawLimit) failures.push(`Main entry exceeds ${rawLimit / 1024} KB raw.`)
  if (gzipBytes > gzipLimit) failures.push(`Main entry exceeds ${gzipLimit / 1024} KB gzip.`)
}
if (failures.length) {
  console.error('Bundle gate failed:')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exitCode = 1
} else console.log('Bundle gate passed.')
