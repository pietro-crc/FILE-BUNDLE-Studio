import type { TextEncoding } from '../preflight/types'
import type { MarkdownDetectedEncoding, TextDecodeResult } from './types'

const UTF8_BOM = new Uint8Array([0xef, 0xbb, 0xbf])
const UTF16LE_BOM = new Uint8Array([0xff, 0xfe])
const UTF16BE_BOM = new Uint8Array([0xfe, 0xff])

function startsWith(bytes: Uint8Array, prefix: Uint8Array): boolean {
  return prefix.every((value, index) => bytes[index] === value)
}

function countReplacementCharacters(value: string): number {
  let count = 0
  for (const character of value) {
    if (character === '\uFFFD') count += 1
  }
  return count
}

function normalizeNewlines(value: string): string {
  return value.replaceAll('\r\n', '\n').replaceAll('\r', '\n')
}

function decodeWith(
  bytes: Uint8Array,
  encoding: 'utf-8' | 'utf-16be' | 'utf-16le' | 'windows-1252',
  fatal: boolean,
  stream: boolean,
): string {
  return new TextDecoder(encoding, { fatal }).decode(bytes, { stream })
}

function preferredEncoding(bytes: Uint8Array, hint?: TextEncoding): {
  readonly encoding: Exclude<MarkdownDetectedEncoding, 'utf-8-bom'>
  readonly offset: number
  readonly bomRemoved: boolean
  readonly declared: MarkdownDetectedEncoding
} {
  if (startsWith(bytes, UTF8_BOM)) {
    return { encoding: 'utf-8', offset: UTF8_BOM.length, bomRemoved: true, declared: 'utf-8-bom' }
  }
  if (startsWith(bytes, UTF16LE_BOM)) {
    return { encoding: 'utf-16le', offset: UTF16LE_BOM.length, bomRemoved: true, declared: 'utf-16le' }
  }
  if (startsWith(bytes, UTF16BE_BOM)) {
    return { encoding: 'utf-16be', offset: UTF16BE_BOM.length, bomRemoved: true, declared: 'utf-16be' }
  }
  if (hint === 'utf-16le' || hint === 'utf-16be') {
    return { encoding: hint, offset: 0, bomRemoved: false, declared: hint }
  }
  return { encoding: 'utf-8', offset: 0, bomRemoved: false, declared: hint === 'utf-8-bom' ? 'utf-8-bom' : 'utf-8' }
}

export function decodeTextBytes(
  input: ArrayBuffer | Uint8Array,
  options: { readonly hint?: TextEncoding; readonly truncatedInput?: boolean } = {},
): TextDecodeResult {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
  const preferred = preferredEncoding(bytes, options.hint)
  const content = bytes.subarray(preferred.offset)
  const warnings: string[] = []
  let text: string
  let encoding: MarkdownDetectedEncoding = preferred.declared
  let usedFallback = false

  try {
    text = decodeWith(content, preferred.encoding, true, options.truncatedInput === true)
  } catch {
    if (preferred.encoding !== 'utf-8') {
      text = decodeWith(content, preferred.encoding, false, options.truncatedInput === true)
      warnings.push(`Sono state sostituite sequenze ${preferred.encoding.toUpperCase()} non valide.`)
    } else {
      text = decodeWith(content, 'windows-1252', false, false)
      encoding = 'windows-1252'
      usedFallback = true
      warnings.push('UTF-8 non valido: applicato fallback controllato Windows-1252.')
    }
  }

  const replacementCharacters = countReplacementCharacters(text)
  if (replacementCharacters > 0) {
    warnings.push(`${replacementCharacters} caratteri non decodificabili sono stati sostituiti.`)
  }

  return {
    text: normalizeNewlines(text),
    encoding,
    usedFallback,
    replacementCharacters,
    bomRemoved: preferred.bomRemoved,
    newlineNormalization: 'lf',
    warnings,
  }
}
