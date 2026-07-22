import type { ManifestConversionStatus } from '../manifest/types'

export type SpreadsheetSheetVisibility = 'visible' | 'hidden' | 'veryHidden'
export type SpreadsheetCellKind = 'blank' | 'boolean' | 'date' | 'error' | 'number' | 'string'

export interface SpreadsheetPolicy {
  readonly maxWorkbookBytes: number
  readonly maxArchiveEntries: number
  readonly maxXmlPartBytes: number
  readonly maxTotalXmlBytes: number
  readonly maxSheets: number
  readonly maxCells: number
  readonly maxRowsPerSheet: number
  readonly maxColumnsPerSheet: number
  readonly maxCellTextCharacters: number
  readonly maxMarkdownRowsPerSheet: number
  readonly maxMarkdownColumnsPerSheet: number
  readonly maxPreviewRowsPerPage: number
  readonly maxPreviewColumnsPerPage: number
  readonly maxMergedRanges: number
  readonly maxComments: number
  readonly maxDefinedNames: number
}

export interface SpreadsheetCell {
  readonly address: string
  readonly row: number
  readonly column: number
  readonly kind: SpreadsheetCellKind
  readonly rawValue: string | number | boolean | null
  readonly formattedValue: string
  readonly formula: string | null
  readonly cachedFormulaValue: string | number | boolean | null
  readonly styleIndex: number | null
  readonly comment: string | null
  readonly commentAuthor: string | null
  readonly formulaLikeLiteral: boolean
  readonly truncated: boolean
}

export interface SpreadsheetRange {
  readonly ref: string
  readonly startRow: number
  readonly startColumn: number
  readonly endRow: number
  readonly endColumn: number
}

export interface SpreadsheetSheet {
  readonly name: string
  readonly sheetId: string
  readonly visibility: SpreadsheetSheetVisibility
  readonly relationshipId: string
  readonly sourcePath: string
  readonly usedRange: SpreadsheetRange | null
  readonly cells: readonly SpreadsheetCell[]
  readonly mergedRanges: readonly string[]
  readonly hiddenRows: readonly number[]
  readonly hiddenColumns: readonly SpreadsheetRange[]
  readonly comments: number
  readonly omittedRows: number
  readonly omittedColumns: number
  readonly omittedCells: number
  readonly omittedMergedRanges: number
  readonly omittedComments: number
  readonly truncatedCellTexts: number
  readonly truncated: boolean
}

export interface SpreadsheetDefinedName {
  readonly name: string
  readonly reference: string
  readonly scopeSheetIndex: number | null
  readonly hidden: boolean
  readonly comment: string | null
}

export interface SpreadsheetFeatureFlags {
  readonly macros: boolean
  readonly externalLinks: boolean
  readonly charts: boolean
  readonly pivots: boolean
  readonly tables: boolean
  readonly connections: boolean
  readonly calculationChain: boolean
}

export interface SpreadsheetWorkbook {
  readonly path: string
  readonly dateSystem: '1900' | '1904'
  readonly sheets: readonly SpreadsheetSheet[]
  readonly definedNames: readonly SpreadsheetDefinedName[]
  readonly omittedDefinedNames: number
  readonly features: SpreadsheetFeatureFlags
  readonly totalCells: number
  readonly formulaCells: number
  readonly commentCells: number
  readonly warnings: readonly string[]
  readonly truncated: boolean
}

export interface SpreadsheetPreviewPage {
  readonly workbookPath: string
  readonly sheetName: string
  readonly pageNumber: number
  readonly rowStart: number
  readonly rowEnd: number
  readonly columnStart: number
  readonly columnEnd: number
  readonly landscape: boolean
  readonly headings: readonly string[]
  readonly rows: readonly (readonly string[])[]
  readonly warnings: readonly string[]
}

export interface SpreadsheetPreviewArtifact {
  readonly mediaType: 'application/pdf'
  readonly bytes: Uint8Array
  readonly byteLength: number
  readonly pageCount: number
  readonly pages: readonly SpreadsheetPreviewPage[]
  readonly warnings: readonly string[]
}

export interface SpreadsheetExtractionRecord {
  readonly fileId: string
  readonly path: string
  readonly status: ManifestConversionStatus
  readonly originalBytes: number
  readonly extractedBytes: number
  readonly extractedCharacters: number
  readonly lineCount: number
  readonly truncated: boolean
  readonly truncationReason: 'workbook-limit' | 'sheet-limit' | 'cell-limit' | null
  readonly anchors: readonly string[]
  readonly parts: readonly string[]
  readonly warnings: readonly string[]
  readonly error: string | null
  readonly sha256: string | null
  readonly workbook: SpreadsheetWorkbook | null
}
