import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { columnLettersFromIndex } from './address'
import type { SpreadsheetPolicy, SpreadsheetPreviewArtifact, SpreadsheetPreviewPage, SpreadsheetSheet, SpreadsheetWorkbook } from './types'

function crop(value: string, max = 28): string {
  const normalized = value.replaceAll(/\s+/gu, ' ').trim()
  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 1)}…`
}

function buildPageRows(sheet: SpreadsheetSheet, rowStart: number, rowEnd: number, columnStart: number, columnEnd: number): readonly (readonly string[])[] {
  const lookup = new Map(sheet.cells.map((cell) => [`${cell.row}:${cell.column}`, cell]))
  return Array.from({ length: rowEnd - rowStart + 1 }, (_rowValue, rowOffset) => {
    const row = rowStart + rowOffset
    return [String(row), ...Array.from({ length: columnEnd - columnStart + 1 }, (_columnValue, columnOffset) => {
      const cell = lookup.get(`${row}:${columnStart + columnOffset}`)
      if (!cell) return ''
      if (cell.formula) return crop(`=${cell.formula} -> ${cell.formattedValue}`)
      return crop(cell.formattedValue)
    })]
  })
}

export function createSpreadsheetPreviewPages(workbook: SpreadsheetWorkbook, policy: SpreadsheetPolicy): SpreadsheetPreviewPage[] {
  const pages: SpreadsheetPreviewPage[] = []
  workbook.sheets.forEach((sheet) => {
    const maxRow = Math.min(sheet.usedRange?.endRow ?? 1, policy.maxRowsPerSheet)
    const maxColumn = Math.min(sheet.usedRange?.endColumn ?? 1, policy.maxColumnsPerSheet)
    for (let columnStart = 1; columnStart <= maxColumn; columnStart += policy.maxPreviewColumnsPerPage) {
      const columnEnd = Math.min(maxColumn, columnStart + policy.maxPreviewColumnsPerPage - 1)
      for (let rowStart = 1; rowStart <= maxRow; rowStart += policy.maxPreviewRowsPerPage) {
        const rowEnd = Math.min(maxRow, rowStart + policy.maxPreviewRowsPerPage - 1)
        pages.push({
          workbookPath: workbook.path,
          sheetName: sheet.name,
          pageNumber: pages.length + 1,
          rowStart,
          rowEnd,
          columnStart,
          columnEnd,
          landscape: columnEnd - columnStart + 1 > 7,
          headings: ['Riga', ...Array.from({ length: columnEnd - columnStart + 1 }, (_, offset) => columnLettersFromIndex(columnStart + offset))],
          rows: buildPageRows(sheet, rowStart, rowEnd, columnStart, columnEnd),
          warnings: sheet.truncated ? ['Foglio rappresentato parzialmente secondo i limiti configurati.'] : [],
        })
      }
    }
  })
  return pages
}

function drawPage(page: ReturnType<PDFDocument['addPage']>, preview: SpreadsheetPreviewPage, font: Awaited<ReturnType<PDFDocument['embedFont']>>): void {
  const { width, height } = page.getSize()
  const margin = 28
  const titleSize = 12
  const bodySize = 7
  page.drawText(crop(`${preview.workbookPath} · ${preview.sheetName}`, 90), { x: margin, y: height - margin, size: titleSize, font })
  page.drawText(`Righe ${preview.rowStart}-${preview.rowEnd} · colonne ${columnLettersFromIndex(preview.columnStart)}-${columnLettersFromIndex(preview.columnEnd)}`, {
    x: margin,
    y: height - margin - 16,
    size: 8,
    font,
    color: rgb(0.25, 0.25, 0.25),
  })
  const tableTop = height - margin - 38
  const columns = preview.headings.length
  const cellWidth = (width - margin * 2) / columns
  const rowHeight = 16
  const allRows = [preview.headings, ...preview.rows]
  allRows.forEach((row, rowIndex) => {
    const y = tableTop - rowIndex * rowHeight
    if (y < margin) return
    row.forEach((value, columnIndex) => {
      const x = margin + columnIndex * cellWidth
      page.drawRectangle({ x, y: y - rowHeight + 3, width: cellWidth, height: rowHeight, borderWidth: 0.35, borderColor: rgb(0.65, 0.65, 0.65) })
      page.drawText(crop(value, Math.max(6, Math.floor(cellWidth / 4.2))), { x: x + 2, y: y - 9, size: bodySize, font })
    })
  })
  page.drawText(`Anteprima derivata · pagina ${preview.pageNumber}`, { x: margin, y: 14, size: 7, font, color: rgb(0.35, 0.35, 0.35) })
}

export async function renderSpreadsheetPreviewPdf(
  workbooks: readonly SpreadsheetWorkbook[],
  policy: SpreadsheetPolicy,
): Promise<SpreadsheetPreviewArtifact> {
  const pages = workbooks.flatMap((workbook) => createSpreadsheetPreviewPages(workbook, policy))
  const document = await PDFDocument.create()
  const font = await document.embedFont(StandardFonts.Helvetica)
  for (const preview of pages) {
    const page = document.addPage(preview.landscape ? [841.89, 595.28] : [595.28, 841.89])
    drawPage(page, preview, font)
  }
  if (pages.length === 0) {
    const page = document.addPage([595.28, 841.89])
    page.drawText('Nessun foglio rappresentabile nella preview spreadsheet.', { x: 40, y: 790, size: 12, font })
  }
  document.setTitle('AI Bundle Studio · Spreadsheet preview')
  document.setProducer('AI Bundle Studio')
  document.setCreator('AI Bundle Studio')
  const bytes = await document.save({ useObjectStreams: false, addDefaultPage: false })
  return {
    mediaType: 'application/pdf',
    bytes,
    byteLength: bytes.byteLength,
    pageCount: document.getPageCount(),
    pages,
    warnings: ['Preview PDF derivata: non replica layout, grafici, pivot o formattazione completa del workbook originale.'],
  }
}
