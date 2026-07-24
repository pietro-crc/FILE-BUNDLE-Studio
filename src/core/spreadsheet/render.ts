import { columnLettersFromIndex } from './address'
import type { SpreadsheetCell, SpreadsheetPolicy, SpreadsheetSheet, SpreadsheetWorkbook } from './types'

export const SPREADSHEET_SHEET_BREAK = '<!-- ai-bundle-spreadsheet-sheet-break -->'

function escapeMarkdown(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('|', '\\|')
    .replaceAll('\r', ' ')
    .replaceAll('\n', '<br>')
}

function cellDisplay(cell: SpreadsheetCell | undefined): string {
  if (!cell) return ''
  if (cell.formula) {
    const cached = cell.cachedFormulaValue === null ? 'nessun valore cache' : String(cell.formattedValue)
    return `Formula: \`=${escapeMarkdown(cell.formula)}\` · cache: ${escapeMarkdown(cached)}`
  }
  const suffix = cell.comment ? ` · commento: ${escapeMarkdown(cell.comment)}` : ''
  return `${escapeMarkdown(cell.formattedValue)}${suffix}`
}

function cellsByCoordinate(sheet: SpreadsheetSheet): Map<string, SpreadsheetCell> {
  return new Map(sheet.cells.map((cell) => [`${cell.row}:${cell.column}`, cell]))
}

function renderSheetTable(sheet: SpreadsheetSheet, policy: SpreadsheetPolicy): string[] {
  if (sheet.cells.length === 0) return ['_Nessuna cella estratta._']
  const rowLimit = Math.min(policy.maxMarkdownRowsPerSheet, sheet.usedRange?.endRow ?? policy.maxMarkdownRowsPerSheet)
  const columnLimit = Math.min(policy.maxMarkdownColumnsPerSheet, sheet.usedRange?.endColumn ?? policy.maxMarkdownColumnsPerSheet)
  const lookup = cellsByCoordinate(sheet)
  const header = ['Riga', ...Array.from({ length: columnLimit }, (_, index) => columnLettersFromIndex(index + 1))]
  const rows = [
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
  ]
  for (let row = 1; row <= rowLimit; row += 1) {
    const values = [String(row)]
    for (let column = 1; column <= columnLimit; column += 1) values.push(cellDisplay(lookup.get(`${row}:${column}`)))
    rows.push(`| ${values.join(' | ')} |`)
  }
  return rows
}

function featureList(workbook: SpreadsheetWorkbook): string[] {
  const labels: string[] = []
  if (workbook.features.macros) labels.push('macro VBA bloccate')
  if (workbook.features.externalLinks) labels.push('collegamenti esterni non caricati')
  if (workbook.features.charts) labels.push('grafici non riprodotti')
  if (workbook.features.pivots) labels.push('pivot non espanse')
  if (workbook.features.tables) labels.push('tabelle strutturate rilevate')
  if (workbook.features.connections) labels.push('connessioni dati non aperte')
  if (workbook.features.calculationChain) labels.push('formule non ricalcolate')
  return labels
}

function renderSheet(sheet: SpreadsheetSheet, policy: SpreadsheetPolicy, index: number): string {
  const omissions = [
    sheet.omittedRows > 0 ? `${sheet.omittedRows} righe oltre limite` : null,
    sheet.omittedColumns > 0 ? `${sheet.omittedColumns} colonne oltre limite` : null,
    sheet.omittedCells > 0 ? `${sheet.omittedCells} celle omesse` : null,
    sheet.omittedMergedRanges > 0 ? `${sheet.omittedMergedRanges} celle unite omesse` : null,
    sheet.omittedComments > 0 ? `${sheet.omittedComments} commenti omessi` : null,
    sheet.truncatedCellTexts > 0 ? `${sheet.truncatedCellTexts} testi cella troncati` : null,
  ].filter(Boolean)
  return [
    `### Foglio ${index + 1}: ${escapeMarkdown(sheet.name)}`,
    '',
    `- Visibilità: ${sheet.visibility}`,
    `- Range usato dichiarato: ${sheet.usedRange?.ref ?? 'non disponibile'}`,
    `- Celle estratte: ${sheet.cells.length}`,
    `- Celle con formule: ${sheet.cells.filter((cell) => cell.formula).length}`,
    `- Commenti: ${sheet.comments}`,
    `- Celle unite: ${sheet.mergedRanges.length > 0 ? sheet.mergedRanges.map(escapeMarkdown).join(', ') : 'nessuna'}`,
    `- Righe nascoste: ${sheet.hiddenRows.length > 0 ? sheet.hiddenRows.join(', ') : 'nessuna'}`,
    `- Colonne nascoste: ${sheet.hiddenColumns.length > 0 ? sheet.hiddenColumns.map((range) => range.ref).join(', ') : 'nessuna'}`,
    `- Troncamento: ${sheet.truncated ? `sì${omissions.length > 0 ? ` (${omissions.join('; ')})` : ''}` : 'no'}`,
    '',
    ...renderSheetTable(sheet, policy),
  ].join('\n')
}

export function renderWorkbookMarkdown(workbook: SpreadsheetWorkbook, policy: SpreadsheetPolicy): string {
  const names = workbook.definedNames.length > 0
    ? workbook.definedNames.map((name) => `- \`${escapeMarkdown(name.name)}\` → \`${escapeMarkdown(name.reference)}\`${name.scopeSheetIndex === null ? '' : ` (foglio ${name.scopeSheetIndex + 1})`}`).join('\n')
    : '_Nessun nome definito estratto._'
  const features = featureList(workbook)
  const header = [
    '### Riepilogo workbook',
    '',
    `- Sistema date: ${workbook.dateSystem}`,
    `- Fogli estratti: ${workbook.sheets.length}`,
    `- Celle estratte: ${workbook.totalCells}`,
    `- Celle con formule: ${workbook.formulaCells}`,
    `- Celle commentate: ${workbook.commentCells}`,
    `- Feature non rappresentate pienamente: ${features.length > 0 ? features.join('; ') : 'nessuna rilevata'}`,
    `- Nomi definiti omessi: ${workbook.omittedDefinedNames}`,
    `- Stato: ${workbook.truncated ? 'parziale' : 'completo entro i limiti configurati'}`,
    '',
    '> Le formule sono riportate come testo e non vengono mai valutate. I valori associati sono esclusivamente quelli cache presenti nel file.',
    '',
    '### Nomi definiti',
    '',
    names,
  ].join('\n')
  return [header, ...workbook.sheets.map((sheet, index) => `${SPREADSHEET_SHEET_BREAK}\n${renderSheet(sheet, policy, index)}`)].join('\n\n')
}
