import type { ManifestArtifact, ManifestConversionStatus } from '../manifest/types'
import type { MarkdownArtifact } from '../markdown/types'

export type DocumentsPageKind = 'cover' | 'instructions' | 'index' | 'separator' | 'pdf-original' | 'image-derived' | 'spreadsheet-derived' | 'docx-derived' | 'presentation-derived' | 'error' | 'report'

export interface DocumentsPolicy {
  readonly maxOutputPages: number
  readonly indexEntriesPerPage: number
  readonly includeSpreadsheetPreview: boolean
}

export interface DocumentsPageRecord {
  readonly outputPage: number
  readonly kind: DocumentsPageKind
  readonly fileId: string | null
  readonly path: string | null
  readonly sourcePage: number | null
  readonly width: number
  readonly height: number
  readonly rotation: number
}

export interface DocumentsFileRecord {
  readonly fileId: string
  readonly path: string
  readonly adapterId: string
  readonly adapterVersion: string
  readonly status: ManifestConversionStatus
  readonly pages: readonly number[]
  readonly sourcePages: readonly { readonly sourcePage: number; readonly outputPage: number }[]
  readonly warnings: readonly string[]
  readonly error: string | null
}

export interface DocumentsValidationError {
  readonly code: string
  readonly path: string
  readonly message: string
}

export interface DocumentsValidationResult {
  readonly valid: boolean
  readonly errors: readonly DocumentsValidationError[]
}

export interface DocumentsArtifact {
  readonly mediaType: 'application/pdf'
  readonly generatedAt: string
  readonly name: string
  readonly bytes: Uint8Array
  readonly byteLength: number
  readonly pageCount: number
  readonly policy: DocumentsPolicy
  readonly pages: readonly DocumentsPageRecord[]
  readonly records: readonly DocumentsFileRecord[]
  readonly warnings: readonly string[]
  readonly validation: DocumentsValidationResult
}

export interface ProjectBundle {
  readonly markdown: MarkdownArtifact
  readonly documents: DocumentsArtifact
  readonly manifest: ManifestArtifact
}
