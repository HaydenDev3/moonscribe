import { getDB, uid, putRecord, removeRecord } from './db'

// Moodboard: a free-form board of image tiles and sticky notes per novel.
// Images are stored as dataURL strings (resized to keep the store light).
export async function listMoodboard(novelId) {
  const db = await getDB()
  const all = await db.getAllFromIndex('moodboard', 'by-novel', novelId)
  return all.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
}

export async function createTile(novelId, data) {
  const now = Date.now()
  const kind = data.kind || 'note' // 'image' | 'note' | 'link' | 'palette'
  const dims = {
    image: { w: 220, h: 260 },
    note: { w: 200, h: 150 },
    link: { w: 220, h: 96 },
    palette: { w: 220, h: 150 }
  }[kind] || { w: 200, h: 150 }
  const tile = {
    id: uid(),
    novelId,
    kind,
    x: data.x ?? 0,
    y: data.y ?? 0,
    w: data.w ?? dims.w,
    h: data.h ?? dims.h,
    color: data.color || '#FFF9E8',
    text: data.text || '',
    image: data.image || null, // dataURL
    url: data.url || '', // link tiles
    palette: data.palette || [], // palette tiles: hex strings
    links: data.links || [],
    stack: data.stack || null,
    createdAt: now,
    updatedAt: now
  }
  return putRecord('moodboard', tile)
}

export async function updateTile(id, patch) {
  const db = await getDB()
  const tile = await db.get('moodboard', id)
  if (!tile) return null
  const next = { ...tile, ...patch, id: tile.id, updatedAt: Date.now() }
  return putRecord('moodboard', next)
}

export async function deleteTile(id) {
  const db = await getDB()
  const t = await db.get('moodboard', id)
  await db.delete('moodboard', id)
  await removeRecord('moodboard', id, t?.novelId)
}

// Reads an image file, resizes it (max 1200px) and returns a JPEG dataURL.
export function fileToDataUrl(file, max = 1200) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(img.width * scale))
      canvas.height = Math.max(1, Math.round(img.height * scale))
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read that image.'))
    }
    img.src = url
  })
}
