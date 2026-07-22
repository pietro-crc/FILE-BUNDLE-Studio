import type { ImageMetadata, ImageOrientation } from './types'

function requireLength(bytes: Uint8Array, length: number, format: string): void {
  if (bytes.byteLength < length) throw new Error(`${format} troncato o non valido.`)
}

function u16le(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8)
}

function u16be(bytes: Uint8Array, offset: number): number {
  return (bytes[offset]! << 8) | bytes[offset + 1]!
}

function u24le(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16)
}

function u32le(bytes: Uint8Array, offset: number): number {
  return (bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16) | (bytes[offset + 3]! << 24)) >>> 0
}

function u32be(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset]! << 24) | (bytes[offset + 1]! << 16) | (bytes[offset + 2]! << 8) | bytes[offset + 3]!) >>> 0
}

function metadata(mime: string, width: number, height: number, orientation: ImageOrientation, hasTransparency: boolean, animated: boolean, formatLabel: string): ImageMetadata {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) throw new Error(`${formatLabel}: dimensioni non valide.`)
  return { mime, width, height, megapixels: (width * height) / 1_000_000, orientation, hasTransparency, animated, formatLabel }
}

function parsePng(bytes: Uint8Array): ImageMetadata {
  requireLength(bytes, 33, 'PNG')
  const width = u32be(bytes, 16)
  const height = u32be(bytes, 20)
  const colorType = bytes[25]!
  let transparency = colorType === 4 || colorType === 6
  let offset = 8
  while (offset + 12 <= bytes.length) {
    const length = u32be(bytes, offset)
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8))
    if (type === 'tRNS') transparency = true
    offset += 12 + length
    if (type === 'IDAT' || type === 'IEND') break
  }
  return metadata('image/png', width, height, 1, transparency, false, 'PNG')
}

function parseExifOrientation(segment: Uint8Array): ImageOrientation {
  if (segment.byteLength < 14 || String.fromCharCode(...segment.subarray(0, 6)) !== 'Exif\0\0') return 1
  const tiff = 6
  const little = segment[tiff] === 0x49 && segment[tiff + 1] === 0x49
  const big = segment[tiff] === 0x4d && segment[tiff + 1] === 0x4d
  if (!little && !big) return 1
  const read16 = (offset: number) => little ? u16le(segment, offset) : u16be(segment, offset)
  const read32 = (offset: number) => little ? u32le(segment, offset) : u32be(segment, offset)
  const firstIfd = tiff + read32(tiff + 4)
  if (firstIfd + 2 > segment.length) return 1
  const entries = read16(firstIfd)
  for (let index = 0; index < entries; index += 1) {
    const entry = firstIfd + 2 + index * 12
    if (entry + 12 > segment.length) break
    if (read16(entry) !== 0x0112) continue
    const value = read16(entry + 8)
    return value >= 1 && value <= 8 ? value as ImageOrientation : 1
  }
  return 1
}

function parseJpeg(bytes: Uint8Array): ImageMetadata {
  requireLength(bytes, 4, 'JPEG')
  let offset = 2
  let orientation: ImageOrientation = 1
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1
      continue
    }
    const marker = bytes[offset + 1]!
    offset += 2
    if (marker === 0xd8 || marker === 0xd9) continue
    if (marker === 0xda) break
    const length = u16be(bytes, offset)
    if (length < 2 || offset + length > bytes.length) throw new Error('JPEG troncato o con segmenti non validi.')
    const payload = bytes.subarray(offset + 2, offset + length)
    if (marker === 0xe1) orientation = parseExifOrientation(payload)
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      requireLength(payload, 6, 'JPEG SOF')
      return metadata('image/jpeg', u16be(payload, 3), u16be(payload, 1), orientation, false, false, 'JPEG')
    }
    offset += length
  }
  throw new Error('JPEG senza dimensioni SOF valide.')
}

function parseGif(bytes: Uint8Array): ImageMetadata {
  requireLength(bytes, 13, 'GIF')
  let transparency = false
  let frames = 0
  for (let index = 13; index + 7 < bytes.length; index += 1) {
    if (bytes[index] === 0x21 && bytes[index + 1] === 0xf9 && bytes[index + 2] === 0x04) transparency ||= (bytes[index + 3]! & 1) === 1
    if (bytes[index] === 0x2c) frames += 1
  }
  return metadata('image/gif', u16le(bytes, 6), u16le(bytes, 8), 1, transparency, frames > 1, 'GIF')
}

function parseWebp(bytes: Uint8Array): ImageMetadata {
  requireLength(bytes, 30, 'WebP')
  const chunk = String.fromCharCode(...bytes.subarray(12, 16))
  if (chunk === 'VP8X') {
    const flags = bytes[20]!
    return metadata('image/webp', u24le(bytes, 24) + 1, u24le(bytes, 27) + 1, 1, (flags & 0x10) !== 0, (flags & 0x02) !== 0, 'WebP')
  }
  if (chunk === 'VP8L') {
    const b0 = bytes[21]!, b1 = bytes[22]!, b2 = bytes[23]!, b3 = bytes[24]!
    const width = 1 + (b0 | ((b1 & 0x3f) << 8))
    const height = 1 + ((b1 >> 6) | (b2 << 2) | ((b3 & 0x0f) << 10))
    return metadata('image/webp', width, height, 1, true, false, 'WebP lossless')
  }
  if (chunk === 'VP8 ') {
    const start = 20
    for (let index = start; index + 9 < bytes.length; index += 1) {
      if (bytes[index + 3] === 0x9d && bytes[index + 4] === 0x01 && bytes[index + 5] === 0x2a) {
        return metadata('image/webp', u16le(bytes, index + 6) & 0x3fff, u16le(bytes, index + 8) & 0x3fff, 1, false, false, 'WebP lossy')
      }
    }
  }
  throw new Error('WebP senza dimensioni riconoscibili.')
}

function parseBmp(bytes: Uint8Array): ImageMetadata {
  requireLength(bytes, 30, 'BMP')
  const dibSize = u32le(bytes, 14)
  if (dibSize < 12) throw new Error('BMP con header DIB non supportato.')
  const width = dibSize === 12 ? u16le(bytes, 18) : Math.abs(new DataView(bytes.buffer, bytes.byteOffset).getInt32(18, true))
  const height = dibSize === 12 ? u16le(bytes, 20) : Math.abs(new DataView(bytes.buffer, bytes.byteOffset).getInt32(22, true))
  const bitsPerPixel = u16le(bytes, dibSize === 12 ? 24 : 28)
  return metadata('image/bmp', width, height, 1, bitsPerPixel === 32, false, 'BMP')
}

function parseTiff(bytes: Uint8Array): ImageMetadata {
  requireLength(bytes, 16, 'TIFF')
  const little = bytes[0] === 0x49 && bytes[1] === 0x49
  const big = bytes[0] === 0x4d && bytes[1] === 0x4d
  if (!little && !big) throw new Error('TIFF con byte order non valido.')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const read16 = (offset: number) => view.getUint16(offset, little)
  const read32 = (offset: number) => view.getUint32(offset, little)
  const ifd = read32(4)
  if (ifd + 2 > bytes.length) throw new Error('TIFF con IFD non valido.')
  const entries = read16(ifd)
  let width = 0
  let height = 0
  let orientation: ImageOrientation = 1
  const readValue = (entry: number): number => {
    const type = read16(entry + 2)
    const count = read32(entry + 4)
    if (count !== 1) return 0
    return type === 3 ? read16(entry + 8) : type === 4 ? read32(entry + 8) : 0
  }
  for (let index = 0; index < entries; index += 1) {
    const entry = ifd + 2 + index * 12
    if (entry + 12 > bytes.length) break
    const tag = read16(entry)
    const value = readValue(entry)
    if (tag === 256) width = value
    if (tag === 257) height = value
    if (tag === 274 && value >= 1 && value <= 8) orientation = value as ImageOrientation
  }
  return metadata('image/tiff', width, height, orientation, false, false, 'TIFF')
}

export function inspectImageBytes(bytes: Uint8Array, mime: string): ImageMetadata {
  switch (mime) {
    case 'image/png': return parsePng(bytes)
    case 'image/jpeg': return parseJpeg(bytes)
    case 'image/gif': return parseGif(bytes)
    case 'image/webp': return parseWebp(bytes)
    case 'image/bmp': return parseBmp(bytes)
    case 'image/tiff': return parseTiff(bytes)
    default: throw new Error(`Formato immagine non ispezionabile in STEP-007: ${mime}.`)
  }
}
