import { sha256Hex } from '../hash/sha256'
import type { ManifestFileRecord } from '../manifest/types'
import type { VirtualFile } from '../vfs/types'
import { decodeTextBytes } from './encoding'
import type { MarkdownGenerationPolicy, TextExtractionRecord } from './types'

export const TEXT_ADAPTER_ID = 'text'
export const TEXT_ADAPTER_VERSION = '1.0.0'

export interface ExtractedTextFile {
  readonly record: TextExtractionRecord
  readonly content: string
  readonly language: string
}

function abortError(signal?: AbortSignal): DOMException {
  return new DOMException(signal?.reason ? String(signal.reason) : 'Operazione annullata.', 'AbortError')
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError(signal)
}

function countLines(value: string): number {
  if (value.length === 0) return 0
  return value.split('\n').length
}

function withLineNumbers(value: string): string {
  const lines = value.split('\n')
  const width = String(lines.length).length
  return lines.map((line, index) => `${String(index + 1).padStart(width, ' ')} | ${line}`).join('\n')
}

export async function extractTextFile(
  file: VirtualFile,
  manifestFile: ManifestFileRecord,
  policy: MarkdownGenerationPolicy,
  language: string,
  signal?: AbortSignal,
): Promise<ExtractedTextFile> {
  assertNotAborted(signal)
  const byteLimit = Math.min(file.size, policy.maxBytesPerFile)
  const input = await file.bytes.readPrefix(byteLimit, signal)
  assertNotAborted(signal)
  const truncatedByBytes = file.size > byteLimit
  const decoded = decodeTextBytes(input, {
    ...(manifestFile.encoding ? { hint: manifestFile.encoding } : {}),
    truncatedInput: truncatedByBytes,
  })

  let content = decoded.text
  let truncationReason: TextExtractionRecord['truncationReason'] = truncatedByBytes ? 'byte-limit' : null
  if (content.length > policy.maxCharactersPerFile) {
    content = content.slice(0, policy.maxCharactersPerFile)
    truncationReason = 'character-limit'
  }
  const truncated = truncationReason !== null
  const warnings = [...decoded.warnings]
  if (truncatedByBytes) warnings.push(`Contenuto limitato ai primi ${policy.maxBytesPerFile} byte.`)
  if (truncationReason === 'character-limit') warnings.push(`Contenuto limitato ai primi ${policy.maxCharactersPerFile} caratteri.`)
  if (decoded.bomRemoved) warnings.push('BOM rimosso dalla rappresentazione testuale.')
  warnings.push('Terminatori di riga normalizzati a LF nella rappresentazione Markdown.')

  const lineCount = countLines(content)
  const renderedContent = policy.includeLineNumbers ? withLineNumbers(content) : content
  const hash = file.size === input.byteLength ? await sha256Hex(input) : null

  return {
    record: {
      adapterId: TEXT_ADAPTER_ID,
      adapterVersion: TEXT_ADAPTER_VERSION,
      contentKind: 'text',
      fileId: manifestFile.fileId,
      path: manifestFile.normalizedPath,
      status: truncated ? 'partial' : 'completed',
      encoding: decoded.encoding,
      usedFallback: decoded.usedFallback,
      replacementCharacters: decoded.replacementCharacters,
      originalBytes: file.size,
      extractedBytes: input.byteLength,
      extractedCharacters: content.length,
      lineCount,
      truncated,
      truncationReason,
      newlineNormalization: 'lf',
      anchors: [],
      parts: [],
      warnings,
      error: null,
      sha256: hash,
    },
    content: renderedContent,
    language,
  }
}

export function failedTextExtraction(manifestFile: ManifestFileRecord, error: unknown): ExtractedTextFile {
  const message = error instanceof Error ? error.message : 'Estrazione testuale non riuscita.'
  return {
    record: {
      adapterId: TEXT_ADAPTER_ID,
      adapterVersion: TEXT_ADAPTER_VERSION,
      contentKind: 'text',
      fileId: manifestFile.fileId,
      path: manifestFile.normalizedPath,
      status: 'failed',
      encoding: manifestFile.encoding,
      usedFallback: false,
      replacementCharacters: 0,
      originalBytes: manifestFile.size,
      extractedBytes: 0,
      extractedCharacters: 0,
      lineCount: 0,
      truncated: false,
      truncationReason: null,
      newlineNormalization: null,
      anchors: [],
      parts: [],
      warnings: [],
      error: message,
      sha256: null,
    },
    content: '',
    language: 'text',
  }
}
