import type { ManifestConversionStatus } from '../manifest/types'

export interface PdfPolicy {
  readonly maxPdfBytes: number
  readonly maxPages: number
  readonly maxTextCharactersPerPage: number
  readonly maxTotalTextCharacters: number
}

export interface PdfPageExtraction {
  readonly pageNumber: number
  readonly width: number
  readonly height: number
  readonly rotation: number
  readonly text: string
  readonly truncated: boolean
}

export interface PdfDocumentAsset {
  readonly adapterId: 'pdf'
  readonly adapterVersion: '1.0.0'
  readonly fileId: string
  readonly path: string
  readonly bytes: Uint8Array
  readonly byteLength: number
  readonly pageCount: number
  readonly importedPageCount: number
  readonly pages: readonly PdfPageExtraction[]
  readonly status: ManifestConversionStatus
  readonly encrypted: false
  readonly hasJavaScript: boolean
  readonly warnings: readonly string[]
  readonly sha256: string
}
