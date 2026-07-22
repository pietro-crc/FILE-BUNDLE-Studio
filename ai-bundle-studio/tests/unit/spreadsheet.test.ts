import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { PDFDocument } from 'pdf-lib'
import { generateMarkdownBundle } from '../../src/core/markdown/generate'
import { createManifestV1 } from '../../src/core/manifest/generate'
import { analyzeVirtualFileSystem } from '../../src/core/preflight/analyze'
import { extractOoxmlWorkbook } from '../../src/core/spreadsheet/ooxml'
import { renderSpreadsheetPreviewPdf } from '../../src/core/spreadsheet/preview'
import { createVirtualFileSystemFromFiles } from '../../src/core/vfs/import'
import { createSpreadsheetFixture } from '../fixtures/xlsx'

const GENERATED_AT = '2026-07-21T12:00:00.000Z'

async function setupWorkbook(macroEnabled = false) {
  const bytes = createSpreadsheetFixture({ macroEnabled })
  const name = macroEnabled ? 'finance.xlsm' : 'finance.xlsx'
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  const result = createVirtualFileSystemFromFiles([{ file: new File([copy.buffer], name), path: name, source: 'file-picker' }])
  const report = await analyzeVirtualFileSystem(result.fileSystem)
  const manifest = await createManifestV1(result.fileSystem, report, { excludedFileIds: new Set(), exclusionGlobs: [] }, { generatedAt: GENERATED_AT, projectName: 'Finance' })
  const file = result.fileSystem.files[0]
  const manifestFile = manifest.manifest.files[0]
  if (!file || !manifestFile) throw new Error('Fixture workbook missing')
  return { result, report, manifest, file, manifestFile }
}

describe('OOXML spreadsheet adapter', () => {
  it('extracts sheets, cached formula values, dates, comments, names, merges, and visibility without evaluating formulas', async () => {
    const fixture = await setupWorkbook()
    const extraction = await extractOoxmlWorkbook(fixture.file, fixture.manifestFile)

    expect(extraction.workbook.sheets).toHaveLength(2)
    expect(extraction.workbook.sheets[1]?.visibility).toBe('veryHidden')
    expect(extraction.workbook.definedNames[0]).toMatchObject({ name: 'Revenue', reference: 'Data!$B$1:$B$2' })
    expect(extraction.workbook.features).toMatchObject({ charts: true, pivots: true, externalLinks: true, tables: true, connections: true, calculationChain: true })
    const data = extraction.workbook.sheets[0]
    expect(data?.mergedRanges).toEqual(['A3:B3'])
    expect(data?.hiddenRows).toEqual([2])
    expect(data?.hiddenColumns[0]?.ref).toBe('C:C')
    expect(data?.cells.find((cell) => cell.address === 'C1')).toMatchObject({ formula: 'SUM(B1:B2)', cachedFormulaValue: 50, formattedValue: '50' })
    expect(data?.cells.find((cell) => cell.address === 'D1')?.formattedValue).toMatch(/^2024-01-01/u)
    expect(data?.cells.find((cell) => cell.address === 'B1')).toMatchObject({ comment: 'Verified total', commentAuthor: 'Alice' })
    expect(data?.cells.find((cell) => cell.address === 'E1')).toMatchObject({ formulaLikeLiteral: true, formattedValue: "'=WEBSERVICE(\"https://example.invalid\")" })
    fixture.result.fileSystem.dispose()
  })

  it('rejects DTD or entity declarations and never follows external relationships', async () => {
    const original = unzipSync(createSpreadsheetFixture())
    original['xl/workbook.xml'] = strToU8('<?xml version="1.0"?><!DOCTYPE workbook [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">&xxe;</workbook>')
    const hostile = zipSync(original)
    const copy = new Uint8Array(hostile.byteLength)
    copy.set(hostile)
    const result = createVirtualFileSystemFromFiles([{ file: new File([copy.buffer], 'hostile.xlsx'), path: 'hostile.xlsx', source: 'file-picker' }])
    const report = await analyzeVirtualFileSystem(result.fileSystem)
    const manifest = await createManifestV1(result.fileSystem, report, { excludedFileIds: new Set(), exclusionGlobs: [] }, { generatedAt: GENERATED_AT })
    const file = result.fileSystem.files[0]
    const manifestFile = manifest.manifest.files[0]
    if (!file || !manifestFile) throw new Error('Hostile fixture missing')
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    await expect(extractOoxmlWorkbook(file, manifestFile)).rejects.toThrow(/DTD ed entità XML non sono consentite/u)
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
    result.fileSystem.dispose()
  })

  it('records comment, merge, defined-name, and cell-text omissions when limits are reached', async () => {
    const original = unzipSync(createSpreadsheetFixture())
    original['xl/workbook.xml'] = strToU8(strFromU8(original['xl/workbook.xml'] ?? new Uint8Array()).replace(
      '</definedNames>',
      '<definedName name="SecondName">Data!$A$1</definedName></definedNames>',
    ))
    original['xl/comments1.xml'] = strToU8(strFromU8(original['xl/comments1.xml'] ?? new Uint8Array()).replace(
      '</commentList>',
      '<comment ref="B2" authorId="0"><text><t>Second comment</t></text></comment></commentList>',
    ))
    original['xl/worksheets/sheet1.xml'] = strToU8(strFromU8(original['xl/worksheets/sheet1.xml'] ?? new Uint8Array()).replace(
      '<mergeCells count="1"><mergeCell ref="A3:B3"/></mergeCells>',
      '<mergeCells count="2"><mergeCell ref="A3:B3"/><mergeCell ref="C3:D3"/></mergeCells>',
    ))
    const bytes = zipSync(original)
    const copy = new Uint8Array(bytes.byteLength)
    copy.set(bytes)
    const result = createVirtualFileSystemFromFiles([{ file: new File([copy.buffer], 'limited.xlsx'), path: 'limited.xlsx', source: 'file-picker' }])
    const report = await analyzeVirtualFileSystem(result.fileSystem)
    const manifest = await createManifestV1(result.fileSystem, report, { excludedFileIds: new Set(), exclusionGlobs: [] }, { generatedAt: GENERATED_AT })
    const file = result.fileSystem.files[0]
    const manifestFile = manifest.manifest.files[0]
    if (!file || !manifestFile) throw new Error('Limited fixture missing')

    const extraction = await extractOoxmlWorkbook(file, manifestFile, {
      maxComments: 1,
      maxMergedRanges: 1,
      maxDefinedNames: 1,
      maxCellTextCharacters: 5,
    })

    expect(extraction.workbook.omittedDefinedNames).toBe(1)
    expect(extraction.workbook.sheets[0]).toMatchObject({
      omittedComments: 1,
      omittedMergedRanges: 1,
      truncated: true,
    })
    expect(extraction.workbook.sheets[0]?.truncatedCellTexts).toBeGreaterThan(0)
    expect(extraction.workbook.warnings.some((warning) => warning.includes('rappresentazione parziale'))).toBe(true)
    result.fileSystem.dispose()
  })

  it('detects macro-enabled packages but never opens or executes VBA', async () => {
    const fixture = await setupWorkbook(true)
    const extraction = await extractOoxmlWorkbook(fixture.file, fixture.manifestFile)
    expect(extraction.workbook.features.macros).toBe(true)
    expect(extraction.workbook.warnings).toContain('Macro VBA rilevate e non eseguite.')
    fixture.result.fileSystem.dispose()
  })

  it('applies workbook and cell limits before unbounded output', async () => {
    const fixture = await setupWorkbook()
    const extraction = await extractOoxmlWorkbook(fixture.file, fixture.manifestFile, { maxCells: 2, maxRowsPerSheet: 1, maxColumnsPerSheet: 2 })
    expect(extraction.workbook.totalCells).toBeLessThanOrEqual(2)
    expect(extraction.workbook.truncated).toBe(true)
    fixture.result.fileSystem.dispose()
  })

  it('adds structured workbook Markdown and a readable derived PDF preview to the bundle', async () => {
    const fixture = await setupWorkbook()
    const bundle = await generateMarkdownBundle(fixture.result.fileSystem, fixture.manifest, { generatedAt: GENERATED_AT })
    const content = bundle.markdown.parts.map((part) => part.content).join('\n')
    expect(content).toContain('Foglio 1: Data')
    expect(content).toContain('Formula: `=SUM(B1:B2)`')
    expect(content).toContain('Le formule sono riportate come testo e non vengono mai valutate')
    expect(bundle.markdown.validation.valid).toBe(true)
    expect(bundle.manifest.validation.valid).toBe(true)
    expect(bundle.markdown.spreadsheetWorkbooks).toHaveLength(1)
    expect(bundle.markdown.spreadsheetPreview?.pageCount).toBeGreaterThan(0)
    const pdf = await PDFDocument.load(bundle.markdown.spreadsheetPreview?.bytes ?? new Uint8Array())
    expect(pdf.getPageCount()).toBe(bundle.markdown.spreadsheetPreview?.pageCount)
    expect(bundle.manifest.manifest.files[0]?.adapter).toMatchObject({ id: 'spreadsheet-ooxml', version: '1.0.0', conversionStatus: 'completed' })
    expect(bundle.manifest.manifest.files[0]?.integrity.status).toBe('computed')
    fixture.result.fileSystem.dispose()
  })

  it('creates landscape preview pages when a sheet chunk is wide', async () => {
    const fixture = await setupWorkbook()
    const extraction = await extractOoxmlWorkbook(fixture.file, fixture.manifestFile)
    const artifact = await renderSpreadsheetPreviewPdf([extraction.workbook], { ...((await import('../../src/core/spreadsheet/ooxml')).DEFAULT_SPREADSHEET_POLICY), maxPreviewColumnsPerPage: 12 })
    expect(artifact.pages.some((page) => page.landscape)).toBe(true)
    expect(artifact.byteLength).toBeGreaterThan(500)
    fixture.result.fileSystem.dispose()
  })
})
