import { getMeta, setMeta } from '../db/meta'

export const GREAT_VIBES_FONT = {
  id: 'great-vibes',
  label: 'Great Vibes',
  family: '"Great Vibes", cursive',
  group: 'MoonScribe',
}

export const EDITOR_FONT_BASE = [
  { id: 'literata', label: 'Literata', family: "'Literata', Georgia, serif", group: 'MoonScribe' },
  { id: 'cormorant', label: 'Cormorant Garamond', family: "'Cormorant Garamond', Georgia, serif", group: 'MoonScribe' },
  { id: 'lora', label: 'Lora', family: "'Lora', Georgia, serif", group: 'MoonScribe' },
  { id: GREAT_VIBES_FONT.id, label: GREAT_VIBES_FONT.label, family: GREAT_VIBES_FONT.family, group: 'MoonScribe' },
  { id: 'georgia', label: 'Georgia', family: 'Georgia, serif', group: 'Book serif' },
  { id: 'palatino', label: 'Palatino', family: "Palatino, 'Palatino Linotype', serif", group: 'Book serif' },
  { id: 'book-antiqua', label: 'Book Antiqua', family: "'Book Antiqua', Palatino, serif", group: 'Book serif' },
  { id: 'baskerville', label: 'Baskerville', family: "Baskerville, 'Libre Baskerville', Georgia, serif", group: 'Book serif' },
  { id: 'charter', label: 'Charter', family: "Charter, 'Bitstream Charter', Georgia, serif", group: 'Book serif' },
  { id: 'cambria', label: 'Cambria', family: 'Cambria, Georgia, serif', group: 'Book serif' },
  { id: 'times-new-roman', label: 'Times New Roman', family: "'Times New Roman', serif", group: 'Book serif' },
  { id: 'inter', label: 'Inter', family: 'Inter, Arial, sans-serif', group: 'Clean' },
  { id: 'segoe-ui', label: 'Segoe UI', family: "'Segoe UI', Arial, sans-serif", group: 'Clean' },
  { id: 'arial', label: 'Arial', family: 'Arial, sans-serif', group: 'Clean' },
  { id: 'verdana', label: 'Verdana', family: 'Verdana, sans-serif', group: 'Clean' },
]

export const COVER_FONT_BASE = [
  { id: 'cormorant', label: 'Cormorant', family: "'Cormorant Garamond', Georgia, serif", group: 'MoonScribe' },
  { id: 'playfair', label: 'Playfair', family: "'Playfair Display', Georgia, serif", group: 'MoonScribe' },
  { id: 'cinzel', label: 'Cinzel', family: "'Cinzel', Georgia, serif", group: 'MoonScribe' },
  { id: GREAT_VIBES_FONT.id, label: GREAT_VIBES_FONT.label, family: GREAT_VIBES_FONT.family, group: 'MoonScribe' },
  { id: 'lora', label: 'Lora', family: "'Lora', Georgia, serif", group: 'MoonScribe' },
  { id: 'spectral', label: 'Spectral', family: "'Spectral', Georgia, serif", group: 'MoonScribe' },
  { id: 'garamond', label: 'EB Garamond', family: "'EB Garamond', Georgia, serif", group: 'MoonScribe' },
  { id: 'crimson', label: 'Crimson Pro', family: "'Crimson Pro', Georgia, serif", group: 'MoonScribe' },
  { id: 'libre', label: 'Libre Baskerville', family: "'Libre Baskerville', Georgia, serif", group: 'MoonScribe' },
  { id: 'great-vibes-fallback', label: 'Great Vibes fallback', family: '"Great Vibes", cursive', group: 'Scripts' },
]

export const PRINT_FONT_BASE = [
  { id: 'garamond', label: 'Garamond', family: 'Garamond, Georgia, serif', group: 'Classic' },
  { id: 'georgia', label: 'Georgia', family: 'Georgia, serif', group: 'Classic' },
  { id: 'times-new-roman', label: 'Times New Roman', family: "'Times New Roman', serif", group: 'Classic' },
  { id: 'helvetica', label: 'Helvetica', family: "Helvetica, Arial, sans-serif", group: 'Clean' },
  { id: GREAT_VIBES_FONT.id, label: GREAT_VIBES_FONT.label, family: GREAT_VIBES_FONT.family, group: 'Scripts' },
]

export const SYSTEM_FONT_CANDIDATES = [
  'Arial', 'Arial Black', 'Aptos', 'Baskerville', 'Book Antiqua', 'Calibri', 'Cambria',
  'Candara', 'Charter', 'Consolas', 'Courier New', 'Georgia', 'Garamond', 'Helvetica',
  'Inter', 'Lucida Grande', 'Menlo', 'Monaco', 'Noto Sans', 'Noto Serif', 'Optima',
  'Palatino', 'Segoe UI', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana',
  'Liberation Sans', 'Liberation Serif', 'Source Sans Pro', 'Source Serif Pro',
]

const CUSTOM_FONT_META_KEY = 'customFonts'
const SYSTEM_FONT_META_KEY = 'systemFonts'
const FONT_FACE_REGISTRY = new Map()

function familyLabel(name) {
  return String(name || '').replace(/["']/g, '').trim()
}

function toId(value) {
  return familyLabel(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function uniqueFonts(list = []) {
  const seen = new Set()
  const out = []
  for (const item of list) {
    const key = `${item.group || ''}|${item.label || item.family}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

export function optionFromFont(font) {
  return {
    value: font.family,
    label: font.label,
    group: font.group,
    style: { fontFamily: font.family },
    hint: font.kind ? font.kind : undefined,
  }
}

export function buildFontOptions(baseFonts, { systemFonts = [], customFonts = [] } = {}) {
  const system = (systemFonts || []).map((font) => ({
    id: font.id || `system-${toId(font.family)}`,
    label: font.label || familyLabel(font.family),
    family: font.family,
    group: 'System',
    kind: 'Detected',
  }))
  const custom = (customFonts || []).map((font) => ({
    id: font.id || `custom-${toId(font.family)}`,
    label: font.label || familyLabel(font.family),
    family: font.family,
    group: 'Custom',
    kind: font.fileName ? `Installed · ${font.fileName}` : 'Installed',
  }))
  return uniqueFonts([
    ...baseFonts,
    ...system,
    ...custom,
  ]).map(optionFromFont)
}

export function buildCoverFontOptions({ systemFonts = [], customFonts = [] } = {}) {
  return buildFontOptions(COVER_FONT_BASE, { systemFonts, customFonts }).map((font) => ({
    ...font,
    value: font.value,
  }))
}

export function buildDesignerFontOptions({ systemFonts = [], customFonts = [] } = {}) {
  const system = (systemFonts || []).map((font) => ({
    id: font.id || `system-${toId(font.family)}`,
    label: font.label || familyLabel(font.family),
    family: font.family,
    group: 'System',
    kind: 'Detected',
  }))
  const custom = (customFonts || []).map((font) => ({
    id: font.id || `custom-${toId(font.family)}`,
    label: font.label || familyLabel(font.family),
    family: font.family,
    group: 'Custom',
    kind: font.fileName ? `Installed · ${font.fileName}` : 'Installed',
  }))
  return uniqueFonts([
    ...COVER_FONT_BASE,
    ...system,
    ...custom,
  ]).map((font) => ({
    value: font.id,
    label: font.label,
    group: font.group,
    style: { fontFamily: font.family },
    hint: font.kind,
  }))
}

export function buildEditorFontOptions({ systemFonts = [], customFonts = [] } = {}) {
  return buildFontOptions(EDITOR_FONT_BASE, { systemFonts, customFonts })
}

export function buildPrintFontOptions({ systemFonts = [], customFonts = [] } = {}) {
  return buildFontOptions(PRINT_FONT_BASE, { systemFonts, customFonts })
}

function inferFontFormat(file) {
  const type = String(file?.type || '').toLowerCase()
  if (type.includes('woff2')) return 'woff2'
  if (type.includes('woff')) return 'woff'
  if (type.includes('opentype') || file?.name?.toLowerCase().endsWith('.otf')) return 'opentype'
  if (type.includes('truetype') || file?.name?.toLowerCase().endsWith('.ttf')) return 'truetype'
  return 'truetype'
}

function ensureFamilyName(name, fallbackFileName = '') {
  const clean = String(name || '').trim()
  if (clean) return clean
  const file = String(fallbackFileName || '').replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim()
  return file ? file.replace(/\b\w/g, (ch) => ch.toUpperCase()) : `Custom Font ${Date.now().toString(36)}`
}

export async function loadPersistedCustomFonts() {
  const fonts = await getMeta(CUSTOM_FONT_META_KEY, [])
  return Array.isArray(fonts) ? fonts : []
}

export async function loadPersistedSystemFonts() {
  const fonts = await getMeta(SYSTEM_FONT_META_KEY, [])
  return Array.isArray(fonts) ? fonts : []
}

export async function saveCustomFonts(fonts) {
  await setMeta(CUSTOM_FONT_META_KEY, fonts)
}

export async function saveSystemFonts(fonts) {
  await setMeta(SYSTEM_FONT_META_KEY, fonts)
}

export async function registerFontEntry(entry) {
  if (!entry?.family || !entry?.dataUrl) return false
  try {
    const face = new FontFace(entry.family, `url(${entry.dataUrl})`, {
      style: entry.style || 'normal',
      weight: entry.weight || '400',
      display: 'swap',
    })
    await face.load()
    FONT_FACE_REGISTRY.set(entry.id || entry.family, face)
    document.fonts.add(face)
    return true
  } catch (error) {
    console.error('[Font registration]', error)
    return false
  }
}

export async function unregisterFontEntry(entry) {
  const key = entry?.id || entry?.family
  const face = FONT_FACE_REGISTRY.get(key)
  if (!face) return false
  try {
    document.fonts.delete(face)
  } catch {
    // Some browser font sets do not permit explicit deletion.
  }
  FONT_FACE_REGISTRY.delete(key)
  return true
}

export async function installCustomFontFromFile(file, familyName) {
  if (!file) throw new Error('Choose a font file first.')
  const family = ensureFamilyName(familyName, file.name)
  const dataUrl = await readFileAsDataUrl(file)
  const entry = {
    id: `custom-${cryptoSafeId(family, file.name, dataUrl)}`,
    family,
    label: family,
    fileName: file.name,
    dataUrl,
    format: inferFontFormat(file),
    weight: '400',
    style: 'normal',
    addedAt: Date.now(),
  }
  const ok = await registerFontEntry(entry)
  if (!ok) throw new Error('MoonScribe could not load that font file.')
  const fonts = await loadPersistedCustomFonts()
  const next = [...fonts.filter((item) => item.family !== entry.family && item.id !== entry.id), entry]
  await saveCustomFonts(next)
  return entry
}

export async function removeCustomFont(entry) {
  await unregisterFontEntry(entry)
  const fonts = await loadPersistedCustomFonts()
  const next = fonts.filter((item) => item.id !== entry.id && item.family !== entry.family)
  await saveCustomFonts(next)
  return next
}

export async function registerPersistedCustomFonts(entries = []) {
  const list = Array.isArray(entries) ? entries : []
  for (const entry of list) {
    await registerFontEntry(entry)
  }
}

export async function detectSystemFonts() {
  const found = new Map()
  const add = (name) => {
    const clean = familyLabel(name)
    if (!clean) return
    const key = clean.toLowerCase()
    if (!found.has(key)) found.set(key, { id: `system-${toId(clean)}`, label: clean, family: clean, addedAt: Date.now() })
  }

  try {
    if (typeof window !== 'undefined' && 'queryLocalFonts' in window) {
      const localFonts = await window.queryLocalFonts()
      for (const font of localFonts || []) add(font.family || font.fullName || font.postscriptName)
    }
  } catch (error) {
    console.warn('[System font detection]', error)
  }

  if (!found.size && typeof document !== 'undefined') {
    for (const name of SYSTEM_FONT_CANDIDATES) {
      try {
        if (document.fonts?.check?.(`16px "${name}"`)) add(name)
      } catch {
        // Ignore fonts the current browser cannot inspect.
      }
    }
  }

  return [...found.values()].sort((a, b) => a.label.localeCompare(b.label))
}

export function familyLabelForFont(font) {
  return familyLabel(font?.family || font?.label || '')
}

async function readFileAsDataUrl(file) {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read that file.'))
    reader.onload = () => resolve(String(reader.result || ''))
    reader.readAsDataURL(file)
  })
}

function cryptoSafeId(...parts) {
  const payload = parts.map((item) => String(item || '')).join('|')
  let hash = 0
  for (let i = 0; i < payload.length; i += 1) {
    hash = ((hash << 5) - hash) + payload.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}
