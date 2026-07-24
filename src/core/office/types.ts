import type { ManifestConversionStatus } from '../manifest/types'

export interface OfficePolicy {
  readonly maxDocumentBytes: number
  readonly maxArchiveEntries: number
  readonly maxEntryBytes: number
  readonly maxTotalUncompressedBytes: number
  readonly maxTextCharacters: number
  readonly maxHtmlCharacters: number
  readonly maxImages: number
  readonly maxImageBytes: number
  readonly maxTotalImageBytes: number
  readonly maxSlides: number
  readonly maxTextCharactersPerSlide: number
  readonly maxNotesCharactersPerSlide: number
  readonly maxTableCells: number
  readonly maxPreviewPages: number
}

export interface OfficeMetadata {
  readonly title: string | null
  readonly creator: string | null
  readonly description: string | null
  readonly created: string | null
  readonly modified: string | null
}

export interface OfficeImageAsset {
  readonly name: string
  readonly mime: string
  readonly bytes: Uint8Array | null
  readonly byteLength: number
  readonly alt: string
  readonly omittedReason: string | null
}

export interface DocxDocumentAsset {
  readonly kind: 'docx'
  readonly adapterId: 'docx'
  readonly adapterVersion: '1.0.0'
  readonly fileId: string
  readonly path: string
  readonly status: ManifestConversionStatus
  readonly sanitizedHtml: string
  readonly markdown: string
  readonly plainText: string
  readonly metadata: OfficeMetadata
  readonly images: readonly OfficeImageAsset[]
  readonly macros: boolean
  readonly externalRelationships: number
  readonly messages: readonly string[]
  readonly warnings: readonly string[]
  readonly truncated: boolean
  readonly sha256: string
}

export interface PresentationTable {
  readonly rows: readonly (readonly string[])[]
}

export interface PresentationSlide {
  readonly slideNumber: number
  readonly title: string
  readonly text: readonly string[]
  readonly notes: readonly string[]
  readonly tables: readonly PresentationTable[]
  readonly images: readonly OfficeImageAsset[]
  readonly externalRelationships: number
  readonly truncated: boolean
  readonly warnings: readonly string[]
}

export interface PptxPresentationAsset {
  readonly kind: 'pptx'
  readonly adapterId: 'presentation-ooxml'
  readonly adapterVersion: '1.0.0'
  readonly fileId: string
  readonly path: string
  readonly status: ManifestConversionStatus
  readonly markdown: string
  readonly metadata: OfficeMetadata
  readonly slides: readonly PresentationSlide[]
  readonly slideCount: number
  readonly macros: boolean
  readonly hasCharts: boolean
  readonly hasEmbeddedObjects: boolean
  readonly hasAudioVideo: boolean
  readonly externalRelationships: number
  readonly warnings: readonly string[]
  readonly truncated: boolean
  readonly sha256: string
}

export type OfficeAsset = DocxDocumentAsset | PptxPresentationAsset

export interface OfficePreviewPage {
  readonly fileId: string
  readonly path: string
  readonly kind: 'docx-derived' | 'presentation-derived'
  readonly sourcePage: number
  readonly outputPage: number
}

export interface OfficePreviewArtifact {
  readonly mediaType: 'application/pdf'
  readonly bytes: Uint8Array
  readonly byteLength: number
  readonly pageCount: number
  readonly pages: readonly OfficePreviewPage[]
  readonly warnings: readonly string[]
}
