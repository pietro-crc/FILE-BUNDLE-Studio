import type { ManifestArtifact, ManifestConversionStatus } from '../manifest/types'
import type { TextEncoding } from '../preflight/types'
import type { ImageAsset } from '../image/types'
import type { PdfDocumentAsset } from '../pdf/types'
import type { SpreadsheetPreviewArtifact, SpreadsheetWorkbook } from '../spreadsheet/types'
import type { OfficeAsset, OfficePreviewArtifact } from '../office/types'
import type { SecretFileReport, SecuritySummary } from '../security/types'

export type MarkdownDetectedEncoding = TextEncoding | 'windows-1252'

export interface MarkdownGenerationPolicy {
  readonly maxBytesPerFile: number
  readonly maxCharactersPerFile: number
  readonly maxPartBytes: number
  readonly includeLineNumbers: boolean
  readonly language: string
}

export interface TextDecodeResult {
  readonly text: string
  readonly encoding: MarkdownDetectedEncoding
  readonly usedFallback: boolean
  readonly replacementCharacters: number
  readonly bomRemoved: boolean
  readonly newlineNormalization: 'lf'
  readonly warnings: readonly string[]
}

export interface TextExtractionRecord {
  readonly adapterId: string
  readonly adapterVersion: string
  readonly contentKind: 'document' | 'image' | 'pdf' | 'presentation' | 'spreadsheet' | 'text'
  readonly fileId: string
  readonly path: string
  readonly status: ManifestConversionStatus
  readonly encoding: MarkdownDetectedEncoding | null
  readonly usedFallback: boolean
  readonly replacementCharacters: number
  readonly originalBytes: number
  readonly extractedBytes: number
  readonly extractedCharacters: number
  readonly lineCount: number
  readonly truncated: boolean
  readonly truncationReason: 'byte-limit' | 'character-limit' | 'workbook-limit' | 'sheet-limit' | 'cell-limit' | 'pdf-page-limit' | 'pdf-text-limit' | 'image-rendering-unavailable' | 'office-limit' | 'presentation-limit' | null
  readonly newlineNormalization: 'lf' | null
  readonly anchors: readonly string[]
  readonly parts: readonly string[]
  readonly warnings: readonly string[]
  readonly error: string | null
  readonly sha256: string | null
}

export interface MarkdownPart {
  readonly name: string
  readonly content: string
  readonly byteLength: number
  readonly anchors: readonly string[]
}

export interface MarkdownValidationError {
  readonly code: string
  readonly path: string
  readonly message: string
}

export interface MarkdownValidationResult {
  readonly valid: boolean
  readonly errors: readonly MarkdownValidationError[]
}

export interface MarkdownArtifact {
  readonly mediaType: 'text/markdown'
  readonly generatedAt: string
  readonly projectName: string
  readonly policy: MarkdownGenerationPolicy
  readonly parts: readonly MarkdownPart[]
  readonly records: readonly TextExtractionRecord[]
  readonly spreadsheetWorkbooks: readonly SpreadsheetWorkbook[]
  readonly pdfDocuments: readonly PdfDocumentAsset[]
  readonly imageAssets: readonly ImageAsset[]
  readonly officeAssets: readonly OfficeAsset[]
  readonly securityReports: readonly SecretFileReport[]
  readonly securitySummary: SecuritySummary
  readonly spreadsheetPreview: SpreadsheetPreviewArtifact | null
  readonly officePreview: OfficePreviewArtifact | null
  readonly totalBytes: number
  readonly sharded: boolean
  readonly validation: MarkdownValidationResult
}

export interface MarkdownBundle {
  readonly markdown: MarkdownArtifact
  readonly manifest: ManifestArtifact
}

export interface MarkdownArtifactSnapshot {
  readonly generatedAt: string
  readonly partCount: number
  readonly totalBytes: number
  readonly completedFiles: number
  readonly partialFiles: number
  readonly failedFiles: number
  readonly spreadsheetWorkbooks: number
  readonly spreadsheetSheets: number
  readonly spreadsheetFormulaCells: number
  readonly spreadsheetPreviewPages: number
  readonly spreadsheetPreviewBytes: number
  readonly pdfDocuments: number
  readonly pdfSourcePages: number
  readonly imageFiles: number
  readonly imageVisualPages: number
  readonly officeDocuments: number
  readonly docxDocuments: number
  readonly presentations: number
  readonly presentationSlides: number
  readonly officePreviewPages: number
  readonly officePreviewBytes: number
  readonly documentsPages: number
  readonly documentsBytes: number
  readonly documentsValid: boolean
  readonly securityMode: SecuritySummary['mode']
  readonly secretFlaggedFiles: number
  readonly secretFindings: number
  readonly secretRedactions: number
  readonly secretExcludedFiles: number
  readonly secretVisualOmissions: number
  readonly sharded: boolean
  readonly valid: boolean
  readonly partSummaries: readonly {
    readonly name: string
    readonly byteLength: number
    readonly anchorCount: number
  }[]
  readonly preview: string
}

export interface MarkdownGenerationProgress {
  readonly completed: number
  readonly total: number
  readonly currentPath?: string
  readonly warnings: number
  readonly errors: number
}
