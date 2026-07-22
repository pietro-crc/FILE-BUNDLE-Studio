import type { ManifestFileRecord } from '../manifest/types'
import type { VirtualFile } from '../vfs/types'
import type { TextExtractionRecord } from '../markdown/types'
import { DEFAULT_SPREADSHEET_POLICY, extractOoxmlWorkbook, SPREADSHEET_ADAPTER_ID, SPREADSHEET_ADAPTER_VERSION } from './ooxml'
import { renderWorkbookMarkdown } from './render'
import type { SpreadsheetPolicy, SpreadsheetWorkbook } from './types'

export interface ExtractedSpreadsheetFile {
  readonly record: TextExtractionRecord
  readonly content: string
  readonly language: 'markdown'
  readonly workbook: SpreadsheetWorkbook
}

export async function extractSpreadsheetFile(
  file: VirtualFile,
  manifestFile: ManifestFileRecord,
  policy: Partial<SpreadsheetPolicy> | undefined,
  signal?: AbortSignal,
): Promise<ExtractedSpreadsheetFile> {
  const result = await extractOoxmlWorkbook(file, manifestFile, policy, signal)
  const effectivePolicy = { ...DEFAULT_SPREADSHEET_POLICY, ...policy }
  const content = renderWorkbookMarkdown(result.workbook, effectivePolicy)
  const truncated = result.workbook.truncated
  return {
    record: {
      adapterId: SPREADSHEET_ADAPTER_ID,
      adapterVersion: SPREADSHEET_ADAPTER_VERSION,
      contentKind: 'spreadsheet',
      fileId: manifestFile.fileId,
      path: manifestFile.normalizedPath,
      status: truncated ? 'partial' : 'completed',
      encoding: null,
      usedFallback: false,
      replacementCharacters: 0,
      originalBytes: manifestFile.size,
      extractedBytes: result.bytesRead,
      extractedCharacters: content.length,
      lineCount: content.length === 0 ? 0 : content.split('\n').length,
      truncated,
      truncationReason: truncated ? 'workbook-limit' : null,
      newlineNormalization: 'lf',
      anchors: [],
      parts: [],
      warnings: result.workbook.warnings,
      error: null,
      sha256: result.sha256,
    },
    content,
    language: 'markdown',
    workbook: result.workbook,
  }
}
