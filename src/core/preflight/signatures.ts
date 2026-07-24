import type { FileCategory } from './types'

export interface SignatureMatch {
  readonly mime: string
  readonly category: FileCategory
  readonly executable?: boolean
}

function matches(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  return signature.every((value, index) => bytes[offset + index] === value)
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length))
}

export function detectFileSignature(bytes: Uint8Array): SignatureMatch | undefined {
  if (matches(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return { mime: 'application/pdf', category: 'document' }
  if (matches(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: 'image/png', category: 'image' }
  if (matches(bytes, [0xff, 0xd8, 0xff])) return { mime: 'image/jpeg', category: 'image' }
  if (ascii(bytes, 0, 6) === 'GIF87a' || ascii(bytes, 0, 6) === 'GIF89a') return { mime: 'image/gif', category: 'image' }
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return { mime: 'image/webp', category: 'image' }
  if (ascii(bytes, 0, 2) === 'BM') return { mime: 'image/bmp', category: 'image' }
  if (matches(bytes, [0x49, 0x49, 0x2a, 0x00]) || matches(bytes, [0x4d, 0x4d, 0x00, 0x2a])) return { mime: 'image/tiff', category: 'image' }
  if (matches(bytes, [0x50, 0x4b, 0x03, 0x04]) || matches(bytes, [0x50, 0x4b, 0x05, 0x06]) || matches(bytes, [0x50, 0x4b, 0x07, 0x08])) return { mime: 'application/zip', category: 'archive' }
  if (matches(bytes, [0x1f, 0x8b])) return { mime: 'application/gzip', category: 'archive' }
  if (matches(bytes, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])) return { mime: 'application/x-7z-compressed', category: 'archive' }
  if (ascii(bytes, 0, 6) === 'Rar!\x1a\x07') return { mime: 'application/vnd.rar', category: 'archive' }
  if (matches(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return { mime: 'application/x-ole-storage', category: 'binary' }
  if (ascii(bytes, 0, 16) === 'SQLite format 3\0') return { mime: 'application/vnd.sqlite3', category: 'database' }
  if (matches(bytes, [0x7f, 0x45, 0x4c, 0x46])) return { mime: 'application/x-elf', category: 'binary', executable: true }
  if (matches(bytes, [0x4d, 0x5a])) return { mime: 'application/vnd.microsoft.portable-executable', category: 'binary', executable: true }
  if (
    matches(bytes, [0xfe, 0xed, 0xfa, 0xce]) ||
    matches(bytes, [0xfe, 0xed, 0xfa, 0xcf]) ||
    matches(bytes, [0xce, 0xfa, 0xed, 0xfe]) ||
    matches(bytes, [0xcf, 0xfa, 0xed, 0xfe]) ||
    matches(bytes, [0xca, 0xfe, 0xba, 0xbe])
  ) return { mime: 'application/x-mach-binary', category: 'binary', executable: true }
  if (ascii(bytes, 0, 4) === 'OggS') return { mime: 'application/ogg', category: 'audio' }
  if (ascii(bytes, 0, 3) === 'ID3') return { mime: 'audio/mpeg', category: 'audio' }
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WAVE') return { mime: 'audio/wav', category: 'audio' }
  if (ascii(bytes, 4, 4) === 'ftyp') return { mime: 'video/mp4', category: 'video' }
  if (matches(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return { mime: 'video/webm', category: 'video' }
  if (matches(bytes, [0x00, 0x61, 0x73, 0x6d])) return { mime: 'application/wasm', category: 'binary', executable: true }
  return undefined
}
