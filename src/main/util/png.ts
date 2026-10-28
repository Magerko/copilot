import { deflateSync } from 'node:zlib'

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

export type Pixel = (x: number, y: number) => [number, number, number, number]

export function makePng(width: number, height: number, px: Pixel): Buffer {
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = px(x, y)
      const o = y * (width * 4 + 1) + 1 + x * 4
      raw[o] = r
      raw[o + 1] = g
      raw[o + 2] = b
      raw[o + 3] = a
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ])
}

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax
  const dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

/** App mark: a single «M» stroke on a deep ink tile with an amber "moment" dot. */
export function appIcon(size: number): Buffer {
  const s = size
  const r = s * 0.22
  const stroke = s * 0.085
  const pts: [number, number][] = [
    [0.24, 0.74],
    [0.24, 0.3],
    [0.5, 0.58],
    [0.76, 0.3],
    [0.76, 0.74]
  ].map(([x, y]) => [x * s, y * s])
  return makePng(s, s, (x, y) => {
    const cx = Math.min(Math.max(x, r), s - r)
    const cy = Math.min(Math.max(y, r), s - r)
    const inTile = Math.hypot(x - cx, y - cy) <= r
    if (!inTile) return [0, 0, 0, 0]
    const dot = Math.hypot(x - 0.5 * s, y - 0.2 * s) <= s * 0.065
    if (dot) return [245, 166, 35, 255]
    let d = Infinity
    for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, segDist(x, y, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]))
    const a = Math.max(0, Math.min(1, stroke / 2 + 0.5 - d))
    const bg: [number, number, number] = [22, 26, 34]
    const fg: [number, number, number] = [236, 238, 242]
    return [bg[0] + (fg[0] - bg[0]) * a, bg[1] + (fg[1] - bg[1]) * a, bg[2] + (fg[2] - bg[2]) * a, 255]
  })
}

export function solidPng(size: number, rgb: [number, number, number]): Buffer {
  return makePng(size, size, () => [rgb[0], rgb[1], rgb[2], 255])
}

/** Windows .ico with embedded PNG images (supported since Vista). */
export function makeIco(pngs: { size: number; data: Buffer }[]): Buffer {
  const header = Buffer.alloc(6 + 16 * pngs.length)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(pngs.length, 4)
  let offset = header.length
  pngs.forEach((p, i) => {
    const o = 6 + i * 16
    header[o] = p.size >= 256 ? 0 : p.size
    header[o + 1] = p.size >= 256 ? 0 : p.size
    header.writeUInt16LE(1, o + 4)
    header.writeUInt16LE(32, o + 6)
    header.writeUInt32LE(p.data.length, o + 8)
    header.writeUInt32LE(offset, o + 12)
    offset += p.data.length
  })
  return Buffer.concat([header, ...pngs.map((p) => p.data)])
}
