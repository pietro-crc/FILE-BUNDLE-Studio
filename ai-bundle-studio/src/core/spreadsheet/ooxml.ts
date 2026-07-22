import { sha256Hex } from '../hash/sha256'
import type { ManifestFileRecord } from '../manifest/types'
import type { VirtualFile } from '../vfs/types'
import { columnLettersFromIndex, parseCellAddress, parseRange } from './address'
import { readSpreadsheetPackage, readXmlPart, type SpreadsheetPackage } from './package'
import type {
  SpreadsheetCell,
  SpreadsheetDefinedName,
  SpreadsheetFeatureFlags,
  SpreadsheetPolicy,
  SpreadsheetRange,
  SpreadsheetSheet,
  SpreadsheetSheetVisibility,
  SpreadsheetWorkbook,
} from './types'
import { directChildrenByLocalName, elementsByLocalName, firstByLocalName, parseXmlDocument, textContentNormalized } from './xml'

export const SPREADSHEET_ADAPTER_ID = 'spreadsheet-ooxml'
export const SPREADSHEET_ADAPTER_VERSION = '1.0.0'

export const DEFAULT_SPREADSHEET_POLICY: SpreadsheetPolicy = {
  maxWorkbookBytes: 64 * 1024 * 1024,
  maxArchiveEntries: 2_000,
  maxXmlPartBytes: 16 * 1024 * 1024,
  maxTotalXmlBytes: 64 * 1024 * 1024,
  maxSheets: 100,
  maxCells: 50_000,
  maxRowsPerSheet: 1_000,
  maxColumnsPerSheet: 100,
  maxCellTextCharacters: 20_000,
  maxMarkdownRowsPerSheet: 200,
  maxMarkdownColumnsPerSheet: 30,
  maxPreviewRowsPerPage: 24,
  maxPreviewColumnsPerPage: 12,
  maxMergedRanges: 5_000,
  maxComments: 5_000,
  maxDefinedNames: 1_000,
}

interface Relationship {
  readonly id: string
  readonly type: string
  readonly target: string
  readonly external: boolean
}

interface StyleInfo {
  readonly formatCode: string | null
  readonly dateLike: boolean
}

interface CommentInfo {
  readonly text: string
  readonly author: string | null
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException(signal.reason ? String(signal.reason) : 'Operazione annullata.', 'AbortError')
}

function mergePolicy(overrides?: Partial<SpreadsheetPolicy>): SpreadsheetPolicy {
  const policy = { ...DEFAULT_SPREADSHEET_POLICY, ...overrides }
  Object.entries(policy).forEach(([key, value]) => {
    if (!Number.isSafeInteger(value) || value < 1) throw new RangeError(`${key} deve essere un intero positivo.`)
  })
  return policy
}

function normalizeRelationshipTarget(baseDirectory: string, target: string): string {
  if (target.includes('\\') || target.includes('\0') || /^[a-z][a-z0-9+.-]*:/iu.test(target)) {
    throw new Error(`Target relationship interno non sicuro: ${target}.`)
  }
  if (target.startsWith('/')) return target.slice(1)
  const segments = `${baseDirectory}/${target}`.split('/')
  const normalized: string[] = []
  segments.forEach((segment) => {
    if (!segment || segment === '.') return
    if (segment === '..') {
      if (normalized.length === 0) throw new Error(`Target relationship fuori dal pacchetto: ${target}.`)
      normalized.pop()
      return
    }
    normalized.push(segment)
  })
  return normalized.join('/')
}

function parseRelationships(xml: string | null, path: string, baseDirectory: string): Relationship[] {
  if (!xml) return []
  const document = parseXmlDocument(xml, path)
  return elementsByLocalName(document, 'Relationship').map((element) => {
    const external = (element.getAttribute('TargetMode') ?? '').toLowerCase() === 'external'
    return {
      id: element.getAttribute('Id') ?? '',
      type: element.getAttribute('Type') ?? '',
      target: external ? '' : normalizeRelationshipTarget(baseDirectory, element.getAttribute('Target') ?? ''),
      external,
    }
  }).filter((relationship) => relationship.id.length > 0)
}

function parseSharedStrings(packageData: SpreadsheetPackage): string[] {
  const xml = readXmlPart(packageData, 'xl/sharedStrings.xml', false)
  if (!xml) return []
  const document = parseXmlDocument(xml, 'xl/sharedStrings.xml')
  return elementsByLocalName(document, 'si').map((item) => elementsByLocalName(item, 't').map((node) => node.textContent ?? '').join(''))
}

function looksLikeDateFormat(formatCode: string): boolean {
  const cleaned = formatCode.replaceAll(/"[^"]*"|\\.|\[[^\]]*\]/gu, '').toLowerCase()
  return /(?:^|[^a-z])[ymdhis]+(?:[^a-z]|$)/u.test(cleaned)
}

function parseStyles(packageData: SpreadsheetPackage): StyleInfo[] {
  const xml = readXmlPart(packageData, 'xl/styles.xml', false)
  if (!xml) return []
  const document = parseXmlDocument(xml, 'xl/styles.xml')
  const customFormats = new Map<number, string>()
  elementsByLocalName(document, 'numFmt').forEach((element) => {
    const id = Number(element.getAttribute('numFmtId'))
    const code = element.getAttribute('formatCode')
    if (Number.isSafeInteger(id) && code) customFormats.set(id, code)
  })
  const cellXfs = elementsByLocalName(document, 'cellXfs')[0]
  if (!cellXfs) return []
  return directChildrenByLocalName(cellXfs, 'xf').map((element) => {
    const id = Number(element.getAttribute('numFmtId') ?? 0)
    const formatCode = customFormats.get(id) ?? null
    return {
      formatCode,
      dateLike: (id >= 14 && id <= 22) || (id >= 45 && id <= 47) || Boolean(formatCode && looksLikeDateFormat(formatCode)),
    }
  })
}

function excelSerialToIso(value: number, dateSystem: '1900' | '1904'): string {
  const offset = dateSystem === '1904' ? 24_107 : 25_569
  const milliseconds = Math.round((value - offset) * 86_400_000)
  const date = new Date(milliseconds)
  return Number.isFinite(date.getTime()) ? date.toISOString().replace(/\.000Z$/u, 'Z') : String(value)
}

function formatNumeric(value: number, style: StyleInfo | undefined, dateSystem: '1900' | '1904'): string {
  if (style?.dateLike) return excelSerialToIso(value, dateSystem)
  const format = style?.formatCode ?? ''
  if (format.includes('%')) {
    const decimals = format.match(/0\.([0]+)/u)?.[1]?.length ?? 0
    return `${(value * 100).toFixed(decimals)}%`
  }
  const decimals = format.match(/0\.([0]+)/u)?.[1]?.length
  return decimals === undefined ? String(value) : value.toFixed(decimals)
}

function sanitizeLiteral(value: string): { readonly value: string; readonly dangerous: boolean } {
  const dangerous = /^[=+\-@\t\r\n]/u.test(value)
  return { value: dangerous ? `'${value}` : value, dangerous }
}

function truncateCellText(value: string, limit: number): { readonly value: string; readonly truncated: boolean } {
  if (value.length <= limit) return { value, truncated: false }
  return { value: `${value.slice(0, Math.max(0, limit - 1))}…`, truncated: true }
}

function parseComments(packageData: SpreadsheetPackage, relationships: readonly Relationship[], policy: SpreadsheetPolicy): { readonly comments: Map<string, CommentInfo>; readonly omitted: number } {
  const relation = relationships.find((item) => item.type.endsWith('/comments') && !item.external)
  if (!relation) return { comments: new Map(), omitted: 0 }
  const xml = readXmlPart(packageData, relation.target, false)
  if (!xml) return { comments: new Map(), omitted: 0 }
  const document = parseXmlDocument(xml, relation.target)
  const authors = elementsByLocalName(document, 'author').map((author) => author.textContent ?? '')
  const comments = new Map<string, CommentInfo>()
  const commentElements = elementsByLocalName(document, 'comment')
  for (const element of commentElements.slice(0, policy.maxComments)) {
    const ref = element.getAttribute('ref') ?? ''
    if (!ref) continue
    const authorId = Number(element.getAttribute('authorId') ?? -1)
    comments.set(ref, {
      text: elementsByLocalName(element, 't').map((node) => node.textContent ?? '').join(''),
      author: authors[authorId] ?? null,
    })
  }
  return { comments, omitted: Math.max(0, commentElements.length - policy.maxComments) }
}

function parseHiddenColumns(document: XMLDocument): SpreadsheetRange[] {
  return elementsByLocalName(document, 'col').flatMap((element) => {
    const start = Number(element.getAttribute('min'))
    const end = Number(element.getAttribute('max'))
    if (element.getAttribute('hidden') !== '1' || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || end < start) return []
    return [{
      ref: `${columnLettersFromIndex(start)}:${columnLettersFromIndex(end)}`,
      startRow: 1,
      endRow: 1_048_576,
      startColumn: start,
      endColumn: end,
    }]
  })
}

function parseSheet(
  packageData: SpreadsheetPackage,
  path: string,
  sheetInfo: { name: string; sheetId: string; visibility: SpreadsheetSheetVisibility; relationshipId: string },
  sharedStrings: readonly string[],
  styles: readonly StyleInfo[],
  dateSystem: '1900' | '1904',
  policy: SpreadsheetPolicy,
  totalCellsBefore: number,
): SpreadsheetSheet {
  const xml = readXmlPart(packageData, path)
  const document = parseXmlDocument(xml ?? '', path)
  const relationPath = path.replace(/\/([^/]+)$/u, '/_rels/$1.rels')
  const relations = parseRelationships(readXmlPart(packageData, relationPath, false), relationPath, path.slice(0, path.lastIndexOf('/')))
  const commentResult = parseComments(packageData, relations, policy)
  const comments = commentResult.comments
  const cells: SpreadsheetCell[] = []
  let omittedRows = 0
  let omittedColumns = 0
  let omittedCells = 0
  let encounteredRows = 0
  let maxColumn = 0
  let truncatedCellTexts = 0
  const rows = elementsByLocalName(document, 'row')
  for (const rowElement of rows) {
    encounteredRows += 1
    if (encounteredRows > policy.maxRowsPerSheet) {
      omittedRows += 1
      omittedCells += directChildrenByLocalName(rowElement, 'c').length
      continue
    }
    for (const cellElement of directChildrenByLocalName(rowElement, 'c')) {
      if (totalCellsBefore + cells.length >= policy.maxCells) {
        omittedCells += 1
        continue
      }
      const address = cellElement.getAttribute('r') ?? ''
      const parsedAddress = parseCellAddress(address)
      if (!parsedAddress) continue
      maxColumn = Math.max(maxColumn, parsedAddress.column)
      if (parsedAddress.column > policy.maxColumnsPerSheet) {
        omittedColumns = Math.max(omittedColumns, parsedAddress.column - policy.maxColumnsPerSheet)
        omittedCells += 1
        continue
      }
      const cellType = cellElement.getAttribute('t') ?? 'n'
      const styleIndexValue = Number(cellElement.getAttribute('s'))
      const styleIndex = Number.isSafeInteger(styleIndexValue) ? styleIndexValue : null
      const formula = textContentNormalized(firstByLocalName(cellElement, 'f')) || null
      const valueText = textContentNormalized(firstByLocalName(cellElement, 'v'))
      let kind: SpreadsheetCell['kind'] = 'blank'
      let rawValue: SpreadsheetCell['rawValue'] = null
      let formattedValue = ''
      if (cellType === 's') {
        kind = 'string'
        rawValue = sharedStrings[Number(valueText)] ?? ''
        formattedValue = String(rawValue)
      } else if (cellType === 'inlineStr') {
        kind = 'string'
        rawValue = elementsByLocalName(cellElement, 't').map((node) => node.textContent ?? '').join('')
        formattedValue = String(rawValue)
      } else if (cellType === 'str') {
        kind = 'string'
        rawValue = valueText
        formattedValue = valueText
      } else if (cellType === 'b') {
        kind = 'boolean'
        rawValue = valueText === '1'
        formattedValue = rawValue ? 'TRUE' : 'FALSE'
      } else if (cellType === 'e') {
        kind = 'error'
        rawValue = valueText
        formattedValue = valueText
      } else if (valueText !== '') {
        const numeric = Number(valueText)
        if (Number.isFinite(numeric)) {
          const style = styleIndex === null ? undefined : styles[styleIndex]
          kind = style?.dateLike ? 'date' : 'number'
          rawValue = numeric
          formattedValue = formatNumeric(numeric, style, dateSystem)
        } else {
          kind = 'string'
          rawValue = valueText
          formattedValue = valueText
        }
      }
      const truncated = truncateCellText(formattedValue, policy.maxCellTextCharacters)
      if (truncated.truncated) truncatedCellTexts += 1
      const sanitized = kind === 'string' && !formula ? sanitizeLiteral(truncated.value) : { value: truncated.value, dangerous: false }
      const comment = comments.get(address)
      cells.push({
        address,
        row: parsedAddress.row,
        column: parsedAddress.column,
        kind,
        rawValue,
        formattedValue: sanitized.value,
        formula,
        cachedFormulaValue: formula ? rawValue : null,
        styleIndex,
        comment: comment?.text ?? null,
        commentAuthor: comment?.author ?? null,
        formulaLikeLiteral: sanitized.dangerous,
        truncated: truncated.truncated,
      })
    }
  }
  const dimension = firstByLocalName(document, 'dimension')?.getAttribute('ref') ?? ''
  const usedRange = parseRange(dimension) ?? (() => {
    if (cells.length === 0) return null
    const rowsUsed = cells.map((cell) => cell.row)
    const columnsUsed = cells.map((cell) => cell.column)
    return {
      ref: `${columnLettersFromIndex(Math.min(...columnsUsed))}${Math.min(...rowsUsed)}:${columnLettersFromIndex(Math.max(...columnsUsed))}${Math.max(...rowsUsed)}`,
      startRow: Math.min(...rowsUsed),
      endRow: Math.max(...rowsUsed),
      startColumn: Math.min(...columnsUsed),
      endColumn: Math.max(...columnsUsed),
    }
  })()
  const mergedRanges = elementsByLocalName(document, 'mergeCell').map((element) => element.getAttribute('ref') ?? '').filter((reference) => Boolean(reference && parseRange(reference)))
  const omittedMergedRanges = Math.max(0, mergedRanges.length - policy.maxMergedRanges)
  const hiddenRows = rows.filter((element) => element.getAttribute('hidden') === '1').map((element) => Number(element.getAttribute('r'))).filter(Number.isSafeInteger)
  return {
    ...sheetInfo,
    sourcePath: path,
    usedRange,
    cells,
    mergedRanges: mergedRanges.slice(0, policy.maxMergedRanges),
    hiddenRows,
    hiddenColumns: parseHiddenColumns(document),
    comments: comments.size,
    omittedRows,
    omittedColumns: Math.max(0, maxColumn - policy.maxColumnsPerSheet, omittedColumns),
    omittedCells,
    omittedMergedRanges,
    omittedComments: commentResult.omitted,
    truncatedCellTexts,
    truncated: omittedRows > 0 || omittedColumns > 0 || omittedCells > 0 || omittedMergedRanges > 0 || commentResult.omitted > 0 || truncatedCellTexts > 0,
  }
}

function featureFlags(entryNames: readonly string[]): SpreadsheetFeatureFlags {
  return {
    macros: entryNames.some((name) => name === 'xl/vbaProject.bin'),
    externalLinks: entryNames.some((name) => name.startsWith('xl/externalLinks/')),
    charts: entryNames.some((name) => name.startsWith('xl/charts/')),
    pivots: entryNames.some((name) => name.startsWith('xl/pivot')),
    tables: entryNames.some((name) => name.startsWith('xl/tables/')),
    connections: entryNames.includes('xl/connections.xml'),
    calculationChain: entryNames.includes('xl/calcChain.xml'),
  }
}

function parseDefinedNames(document: XMLDocument, policy: SpreadsheetPolicy): { readonly names: SpreadsheetDefinedName[]; readonly omitted: number } {
  const elements = elementsByLocalName(document, 'definedName')
  const names = elements.slice(0, policy.maxDefinedNames).map((element) => {
    const scopeValue = Number(element.getAttribute('localSheetId'))
    return {
      name: element.getAttribute('name') ?? '',
      reference: textContentNormalized(element),
      scopeSheetIndex: Number.isSafeInteger(scopeValue) ? scopeValue : null,
      hidden: element.getAttribute('hidden') === '1',
      comment: element.getAttribute('comment'),
    }
  }).filter((name) => name.name.length > 0)
  return { names, omitted: Math.max(0, elements.length - policy.maxDefinedNames) }
}

export async function extractOoxmlWorkbook(
  file: VirtualFile,
  manifestFile: ManifestFileRecord,
  overrides?: Partial<SpreadsheetPolicy>,
  signal?: AbortSignal,
): Promise<{ readonly workbook: SpreadsheetWorkbook; readonly sha256: string; readonly bytesRead: number }> {
  assertNotAborted(signal)
  if (!['xlsx', 'xlsm'].includes(manifestFile.extension)) throw new Error('Formato workbook non supportato dal parser OOXML dello STEP-006.')
  const policy = mergePolicy(overrides)
  if (file.size > policy.maxWorkbookBytes) throw new RangeError(`Workbook oltre il limite di ${policy.maxWorkbookBytes} byte.`)
  const buffer = await file.bytes.read(signal)
  assertNotAborted(signal)
  const packageData = await readSpreadsheetPackage(buffer, policy)
  const workbookXml = readXmlPart(packageData, 'xl/workbook.xml')
  const workbookDocument = parseXmlDocument(workbookXml ?? '', 'xl/workbook.xml')
  const workbookRelationships = parseRelationships(
    readXmlPart(packageData, 'xl/_rels/workbook.xml.rels'),
    'xl/_rels/workbook.xml.rels',
    'xl',
  )
  const relationshipById = new Map(workbookRelationships.map((relationship) => [relationship.id, relationship]))
  const workbookProperties = firstByLocalName(workbookDocument, 'workbookPr')
  const dateSystem = workbookProperties?.getAttribute('date1904') === '1' ? '1904' : '1900'
  const sharedStrings = parseSharedStrings(packageData)
  const styles = parseStyles(packageData)
  const sheetElements = elementsByLocalName(workbookDocument, 'sheet')
  const warnings: string[] = []
  if (sheetElements.length > policy.maxSheets) warnings.push(`Workbook limitato ai primi ${policy.maxSheets} fogli.`)
  const sheets: SpreadsheetSheet[] = []
  let totalCells = 0
  for (const element of sheetElements.slice(0, policy.maxSheets)) {
    assertNotAborted(signal)
    const relationshipId = element.getAttribute('r:id') ?? element.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ?? ''
    const relationship = relationshipById.get(relationshipId)
    if (!relationship || relationship.external || !relationship.type.endsWith('/worksheet')) {
      warnings.push(`Foglio ${element.getAttribute('name') ?? '(senza nome)'} senza relationship interna valida.`)
      continue
    }
    const stateValue = element.getAttribute('state')
    const visibility: SpreadsheetSheetVisibility = stateValue === 'hidden' || stateValue === 'veryHidden' ? stateValue : 'visible'
    const sheet = parseSheet(packageData, relationship.target, {
      name: element.getAttribute('name') ?? `Sheet ${sheets.length + 1}`,
      sheetId: element.getAttribute('sheetId') ?? String(sheets.length + 1),
      visibility,
      relationshipId,
    }, sharedStrings, styles, dateSystem, policy, totalCells)
    sheets.push(sheet)
    totalCells += sheet.cells.length
    if (sheet.truncated) {
      const omissions = [
        sheet.omittedRows ? `${sheet.omittedRows} righe` : null,
        sheet.omittedColumns ? `${sheet.omittedColumns} colonne` : null,
        sheet.omittedCells ? `${sheet.omittedCells} celle` : null,
        sheet.omittedMergedRanges ? `${sheet.omittedMergedRanges} merge` : null,
        sheet.omittedComments ? `${sheet.omittedComments} commenti` : null,
        sheet.truncatedCellTexts ? `${sheet.truncatedCellTexts} testi cella troncati` : null,
      ].filter(Boolean)
      warnings.push(`${sheet.name}: rappresentazione parziale (${omissions.join(', ')}).`)
    }
    if (totalCells >= policy.maxCells) {
      warnings.push(`Workbook limitato a ${policy.maxCells} celle estratte.`)
      break
    }
  }
  const definedNames = parseDefinedNames(workbookDocument, policy)
  if (definedNames.omitted > 0) warnings.push(`${definedNames.omitted} nomi definiti omessi per limite.`)
  const features = featureFlags(packageData.entryNames)
  if (features.macros) warnings.push('Macro VBA rilevate e non eseguite.')
  if (features.externalLinks) warnings.push('Collegamenti esterni inventariati ma non caricati.')
  if (features.charts) warnings.push('Grafici rilevati ma non riprodotti nella baseline tabellare.')
  if (features.pivots) warnings.push('Pivot rilevate ma non espanse o ricalcolate.')
  if (features.tables) warnings.push('Tabelle strutturate rilevate; la baseline rappresenta i valori delle celle.')
  if (features.connections) warnings.push('Connessioni dati rilevate e non aperte.')
  if (features.calculationChain) warnings.push('Calculation chain rilevata; le formule non vengono ricalcolate.')
  const workbook: SpreadsheetWorkbook = {
    path: manifestFile.originalPath,
    dateSystem,
    sheets,
    definedNames: definedNames.names,
    omittedDefinedNames: definedNames.omitted,
    features,
    totalCells,
    formulaCells: sheets.reduce((total, sheet) => total + sheet.cells.filter((cell) => cell.formula).length, 0),
    commentCells: sheets.reduce((total, sheet) => total + sheet.comments, 0),
    warnings,
    truncated: sheetElements.length > sheets.length || sheets.some((sheet) => sheet.truncated) || definedNames.omitted > 0,
  }
  return { workbook, sha256: await sha256Hex(packageData.bytes), bytesRead: packageData.bytes.byteLength }
}
