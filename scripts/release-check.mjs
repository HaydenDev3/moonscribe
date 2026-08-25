import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const configPath = path.join(root, 'src-tauri', 'tauri.conf.json')
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
const updater = config.plugins?.updater
const failures = []

if (!config.identifier || config.identifier.includes('example')) failures.push('Tauri application identifier is not production-safe.')
if (!config.app?.security?.csp || !String(config.app.security.csp).includes("default-src 'self'")) failures.push('Tauri CSP is missing a self-restricted default source.')
if (!Array.isArray(config.bundle?.fileAssociations) || config.bundle.fileAssociations.length < 4) failures.push('Desktop file associations are incomplete.')
if (!Array.isArray(updater?.endpoints) || updater.endpoints.length === 0) failures.push('Updater endpoints are not configured.')
if (updater?.endpoints?.some((endpoint) => !String(endpoint).startsWith('https://'))) failures.push('All updater endpoints must use HTTPS.')
if (!updater?.pubkey || String(updater.pubkey).includes('REPLACE_WITH')) failures.push('Updater public signing key is still a placeholder.')

if (failures.length) {
  console.error('Desktop release check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log('Desktop release configuration is ready for signed packaging.')
}
