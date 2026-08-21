// Sync serialization: IndexedDB can hold Blobs, but the wire format is JSON.
// We convert a novel's cover Blob to a dataURL when pushing and back to a
// Blob when applying. Everything else already round-trips through JSON.

function isBlobLike(value) {
  return !!value && typeof value === 'object' && (
    (typeof Blob !== 'undefined' && value instanceof Blob) ||
    (typeof value.arrayBuffer === 'function' && typeof value.type === 'string' && typeof value.size === 'number')
  )
}

export function blobToDataUrl(blob) {
  if (!blob) return null
  if (isBlobLike(blob)) {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  }
  return typeof blob === 'string' ? blob : null
}

export function dataUrlToBlob(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return null
  try {
    const [head, body] = dataUrl.split(',', 2)
    const mime = /data:([^;]+)/.exec(head)?.[1] || 'application/octet-stream'
    const bin = atob(body)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return new Blob([bytes], { type: mime })
  } catch {
    return null
  }
}

// Make a record safe for JSON transport (Blobs → dataURL).
export async function toWire(record) {
  if (!record) return null
  const copy = { ...record }
  if (isBlobLike(record.cover)) {
    copy.cover = await blobToDataUrl(record.cover)
    copy.__hadCover = true
  }
  return copy
}

// Restore wire data into a store-ready record (dataURL → Blob).
export function fromWire(record) {
  if (!record) return null
  const copy = { ...record }
  if (isBlobLike(record.cover)) {
    copy.cover = record.cover
  } else if (typeof record.cover === 'string' && record.cover.startsWith('data:')) {
    copy.cover = dataUrlToBlob(record.cover) || null
  } else if (typeof record.cover === 'string' && /^https?:\/\//i.test(record.cover)) {
    // Imported libraries may legitimately reference a hosted cover.
    copy.cover = record.cover
  } else if (record.__hadCover || record.cover != null) {
    // Older JSON backups serialized Blob as `{}`. The image bytes cannot be
    // recovered from that value, but the malformed cover must never prevent
    // the rest of the novel from loading.
    copy.cover = null
  }
  delete copy.__hadCover
  delete copy.pendingSync
  return copy
}
