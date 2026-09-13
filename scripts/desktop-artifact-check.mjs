import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const root = process.cwd()
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const version = packageJson.version
const requested = String(process.env.DESKTOP_BUNDLES || 'nsis,dmg,appimage,deb')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)
const targetRoot = path.join(root, 'src-tauri', 'target')
const files = []

function visit(directory) {
  if (!fs.existsSync(directory)) return
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) visit(fullPath)
    else if (entry.isFile()) files.push(fullPath)
  }
}

visit(targetRoot)
const extensionByBundle = {
  nsis: /\.exe$/i,
  dmg: /\.dmg$/i,
  appimage: /\.AppImage$/i,
  deb: /\.deb$/i,
}
const failures = []
const artifacts = []

for (const bundle of requested) {
  const matcher = extensionByBundle[bundle]
  if (!matcher) {
    failures.push(`Unknown desktop bundle type: ${bundle}`)
    continue
  }
  const matches = files.filter(
    (file) => matcher.test(file) && path.basename(file).includes(version)
  )
  if (!matches.length) failures.push(`No ${bundle} artifact for version ${version} was found.`)
  artifacts.push(...matches)
}

if (failures.length) {
  console.error('Desktop artifact check failed:')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exitCode = 1
} else {
  const lines = artifacts.map((file) => {
    const digest = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
    return `${digest}  ${path.basename(file)}`
  })
  console.log(lines.join('\n'))
}
