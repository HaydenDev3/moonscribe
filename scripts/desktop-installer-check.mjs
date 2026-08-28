import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const config = JSON.parse(fs.readFileSync(path.join(root, 'src-tauri', 'tauri.conf.json'), 'utf8'))
const bundleDir = path.join(root, 'src-tauri', 'target', 'release', 'bundle')
const nsisDir = path.join(bundleDir, 'nsis')
const installers = fs.existsSync(nsisDir)
  ? fs.readdirSync(nsisDir).filter((name) => /\.exe$/i.test(name))
  : []

const failures = []
if (!config.bundle?.active) failures.push('Desktop bundling is disabled.')
if (!config.bundle?.targets?.includes('nsis')) failures.push('The NSIS Windows target is not configured.')
if (!config.bundle?.targets?.includes('msi')) failures.push('The MSI Windows target is not configured.')
if (!installers.length) failures.push('No NSIS installer found. Run npm run tauri:build first.')
if (installers.length && !installers.some((name) => name.includes(String(config.version)))) {
  failures.push(`Installer version does not match Tauri version ${config.version}. Rebuild the installer before release.`)
}

if (failures.length) {
  console.error('Windows installer check failed:')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exitCode = 1
} else {
  console.log(`Windows installer found: ${installers.join(', ')}`)
  console.log('Manual QA still required: clean install, upgrade over the previous version, uninstall, and reinstall with existing user data.')
}
