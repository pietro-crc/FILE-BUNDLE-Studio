import type { ManifestFileRecord } from '../manifest/types'
import type { VirtualFile } from '../vfs/types'
import { extractDocxFile, type ExtractedDocxFile } from './docx'
import { extractPptxFile, type ExtractedPptxFile } from './pptx'
import type { OfficePolicy } from './types'

export const DEFAULT_OFFICE_POLICY: OfficePolicy = {
  maxDocumentBytes: 64 * 1024 * 1024,
  maxArchiveEntries: 4_000,
  maxEntryBytes: 32 * 1024 * 1024,
  maxTotalUncompressedBytes: 192 * 1024 * 1024,
  maxTextCharacters: 1_000_000,
  maxHtmlCharacters: 2_000_000,
  maxImages: 100,
  maxImageBytes: 16 * 1024 * 1024,
  maxTotalImageBytes: 64 * 1024 * 1024,
  maxSlides: 500,
  maxTextCharactersPerSlide: 50_000,
  maxNotesCharactersPerSlide: 20_000,
  maxTableCells: 50_000,
  maxPreviewPages: 1_000,
}

function validatePolicy(overrides?: Partial<OfficePolicy>): OfficePolicy {
  const policy = { ...DEFAULT_OFFICE_POLICY, ...overrides }
  for (const [key, value] of Object.entries(policy)) {
    if (!Number.isSafeInteger(value) || value < 1) throw new RangeError(`${key} deve essere un intero positivo.`)
  }
  if (policy.maxImageBytes > policy.maxTotalImageBytes) throw new RangeError('maxImageBytes non può superare maxTotalImageBytes.')
  return policy
}

export type ExtractedOfficeFile = ExtractedDocxFile | ExtractedPptxFile

export async function extractOfficeFile(
  file: VirtualFile,
  manifestFile: ManifestFileRecord,
  overrides?: Partial<OfficePolicy>,
  signal?: AbortSignal,
): Promise<ExtractedOfficeFile> {
  const policy = validatePolicy(overrides)
  if (manifestFile.extension === 'docx' || manifestFile.extension === 'docm') return extractDocxFile(file, manifestFile, policy, signal)
  if (manifestFile.extension === 'pptx' || manifestFile.extension === 'pptm') return extractPptxFile(file, manifestFile, policy, signal)
  throw new Error(`Formato Office non supportato dall’adapter STEP-008: ${manifestFile.extension || manifestFile.mimeDetected}.`)
}
