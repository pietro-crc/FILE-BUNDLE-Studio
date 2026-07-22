import type { TextEncoding } from './types'

export interface TextInspection {
  readonly isText: boolean
  readonly encoding?: TextEncoding
  readonly decoded?: string
  readonly warning?: string
}

const UTF8_BOM = [0xef, 0xbb, 0xbf] as const

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((value, index) => bytes[index] === value)
}

function decode(bytes: Uint8Array, encoding: 'utf-8' | 'utf-16be' | 'utf-16le', fatal: boolean): string {
  return new TextDecoder(encoding, { fatal }).decode(bytes)
}

function printableRatio(value: string): number {
  if (value.length === 0) {
    return 1
  }
  let printable = 0
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0
    if (character === '\n' || character === '\r' || character === '\t' || code >= 0x20) {
      printable += 1
    }
  }
  return printable / value.length
}

export function inspectTextSample(bytes: Uint8Array): TextInspection {
  if (bytes.byteLength === 0) {
    return { isText: true, encoding: 'utf-8', decoded: '' }
  }

  if (startsWith(bytes, [0xff, 0xfe])) {
    return { isText: true, encoding: 'utf-16le', decoded: decode(bytes.subarray(2), 'utf-16le', false) }
  }
  if (startsWith(bytes, [0xfe, 0xff])) {
    return { isText: true, encoding: 'utf-16be', decoded: decode(bytes.subarray(2), 'utf-16be', false) }
  }

  const utf8Bytes = startsWith(bytes, UTF8_BOM) ? bytes.subarray(UTF8_BOM.length) : bytes
  if (utf8Bytes.includes(0)) {
    return { isText: false }
  }

  try {
    const decoded = decode(utf8Bytes, 'utf-8', true)
    if (printableRatio(decoded) < 0.85) {
      return { isText: false }
    }
    return {
      isText: true,
      encoding: startsWith(bytes, UTF8_BOM) ? 'utf-8-bom' : 'utf-8',
      decoded,
    }
  } catch {
    const decoded = decode(utf8Bytes, 'utf-8', false)
    if (printableRatio(decoded) < 0.9) {
      return { isText: false }
    }
    return {
      isText: true,
      encoding: startsWith(bytes, UTF8_BOM) ? 'utf-8-bom' : 'utf-8',
      decoded,
      warning: 'Il campione contiene sequenze UTF-8 non valide sostituite durante la lettura.',
    }
  }
}
