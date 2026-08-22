import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'

const root = resolve(import.meta.dirname, '..')
const sourceDir = resolve(root, 'src-tauri', 'target', 'release', 'bundle', 'nsis')
const publicDir = resolve(root, 'public', 'downloads')
const publicName = 'MoonScribe_0.1.0_x64-setup.exe'

await mkdir(publicDir, { recursive: true })
const candidates = (await readdir(sourceDir)).filter((name) => name.toLowerCase().endsWith('-setup.exe'))
if (candidates.length !== 1) {
  throw new Error(`Expected one NSIS installer in ${sourceDir}; found ${candidates.length}. Run npm run tauri:build first.`)
}

const source = resolve(sourceDir, candidates[0])
const destination = resolve(publicDir, publicName)
await copyFile(source, destination)
const checksum = createHash('sha256').update(await readFile(destination)).digest('hex')
await writeFile(`${destination}.sha256`, `${checksum}  ${publicName}\n`, 'utf8')
const details = await stat(destination)
console.log(`Published ${publicName} (${(details.size / 1024 / 1024).toFixed(1)} MB) and SHA-256 checksum to public/downloads.`)
