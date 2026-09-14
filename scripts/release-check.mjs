import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const configPath = path.join(root, 'src-tauri', 'tauri.conf.json')
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
const vercelConfig = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'))
const updater = config.plugins?.updater
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const cargoToml = fs.readFileSync(path.join(root, 'src-tauri', 'Cargo.toml'), 'utf8')
const failures = []

if (!config.identifier || config.identifier.includes('example'))
  failures.push('Tauri application identifier is not production-safe.')
if (!config.app?.security?.csp || !String(config.app.security.csp).includes("default-src 'self'"))
  failures.push('Tauri CSP is missing a self-restricted default source.')
if (!Array.isArray(config.bundle?.fileAssociations) || config.bundle.fileAssociations.length < 4)
  failures.push('Desktop file associations are incomplete.')
for (const target of ['nsis', 'dmg', 'appimage', 'deb']) {
  if (!config.bundle?.targets?.includes(target))
    failures.push(`Desktop bundle target is missing: ${target}.`)
}
if (config.bundle?.targets?.includes('msi'))
  failures.push('MSI is not part of the supported 1.1.7 desktop release targets.')
if (config.version !== packageJson.version)
  failures.push(
    `Tauri version ${config.version} does not match package version ${packageJson.version}.`
  )
if (!cargoToml.includes(`version = "${config.version}"`))
  failures.push(`Cargo package version does not match Tauri version ${config.version}.`)
if (!Array.isArray(updater?.endpoints) || updater.endpoints.length === 0)
  failures.push('Updater endpoints are not configured.')
if (updater?.endpoints?.some((endpoint) => !String(endpoint).startsWith('https://')))
  failures.push('All updater endpoints must use HTTPS.')
if (
  updater?.endpoints?.some(
    (endpoint) => !String(endpoint).startsWith('https://www.moonscribe.cc/updates')
  )
)
  failures.push('Updater endpoints must use the canonical https://www.moonscribe.cc/updates path.')
const updateRewrites = Array.isArray(vercelConfig.rewrites) ? vercelConfig.rewrites : []
if (
  !updateRewrites.some(
    (rewrite) =>
      rewrite.source === '/updates' &&
      String(rewrite.destination).includes('/releases/latest/download/latest.json')
  )
)
  failures.push('Vercel is missing the canonical /updates rewrite to the stable updater manifest.')
const publicKey = process.env.TAURI_PUBLIC_KEY || updater?.pubkey
if (!publicKey || String(publicKey).includes('REPLACE_WITH'))
  failures.push(
    'Updater public signing key is still a placeholder. Set TAURI_PUBLIC_KEY for a release build or commit the verified public key.'
  )

if (failures.length) {
  console.error('Desktop release check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log('Desktop release configuration is ready for signed packaging.')
}
