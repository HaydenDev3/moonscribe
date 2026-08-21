// Minimal ZIP archive writer (STORE method only — no compression). Built for
// EPUB export so no new dependency is needed; the `mimetype` file must be
// stored uncompressed and first, which this writer guarantees.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(bytes) {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function dosDateTime(date = new Date()) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1)
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  return { time, day }
}

export function toBytes(data) {
  if (data instanceof Uint8Array) return data
  if (typeof data === 'string') return new TextEncoder().encode(data)
  throw new Error('zip: unsupported entry data')
}

function u16(out, v) { out.push(v & 0xff, (v >>> 8) & 0xff) }
function u32(out, v) {
  out.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff)
}

// files: [{ name, data: string|Uint8Array, stored?: boolean }]
// The entry named 'mimetype' is always forced to STORE and placed first, as
// the EPUB spec requires.
export function buildZip(files) {
  const now = new Date()
  const { time, day } = dosDateTime(now)
  const local = []
  const central = []
  let offset = 0

  const entries = [...files].sort((a, b) => (a.name === 'mimetype' ? -1 : 0) - (b.name === 'mimetype' ? -1 : 0))

  for (const f of entries) {
    const bytes = toBytes(f.data)
    const name = f.name
    const nameBytes = new TextEncoder().encode(name)
    const crc = crc32(bytes)
    const size = bytes.length
    const method = name === 'mimetype' ? 0 : 0 // STORE for everything

    u32(local, 0x04034b50)
    u16(local, 20)
    u16(local, 0)
    u16(local, method)
    u16(local, time)
    u16(local, day)
    u32(local, crc)
    u32(local, size)
    u32(local, size)
    u16(local, nameBytes.length)
    u16(local, 0)
    for (const b of nameBytes) local.push(b)
    for (const b of bytes) local.push(b)

    u32(central, 0x02014b50)
    u16(central, 20)
    u16(central, 20)
    u16(central, 0)
    u16(central, method)
    u16(central, time)
    u16(central, day)
    u32(central, crc)
    u32(central, size)
    u32(central, size)
    u16(central, nameBytes.length)
    u16(central, 0)
    u16(central, 0)
    u16(central, 0)
    u16(central, 0)
    u32(central, 0)
    u32(central, offset)
    for (const b of nameBytes) central.push(b)

    offset += 30 + nameBytes.length + size
  }

  const cdStart = local.length
  const cdSize = central.length
  const eocd = []
  u32(eocd, 0x06054b50)
  u16(eocd, 0)
  u16(eocd, 0)
  u16(eocd, entries.length)
  u16(eocd, entries.length)
  u32(eocd, cdSize)
  u32(eocd, cdStart)
  u16(eocd, 0)

  return new Uint8Array([...local, ...central, ...eocd])
}
