import { performance } from 'node:perf_hooks'
import { strToU8, zipSync } from 'fflate'
import { generateMarkdownBundle } from '../../src/core/markdown/generate'
import { createManifestV1 } from '../../src/core/manifest/generate'
import { analyzeVirtualFileSystem } from '../../src/core/preflight/analyze'
import { columnLettersFromIndex } from '../../src/core/spreadsheet/address'
import { createVirtualFileSystemFromFiles } from '../../src/core/vfs/import'

const GENERATED_AT = '2026-07-21T12:00:00.000Z'
const ROW_COUNT = 100
const COLUMN_COUNT = 20

function buildBenchmarkWorkbook(): Uint8Array {
  const rows = Array.from({ length: ROW_COUNT }, (_, rowOffset) => {
    const row = rowOffset + 1
    const cells = Array.from({ length: COLUMN_COUNT }, (_columnValue, columnOffset) => {
      const column = columnOffset + 1
      const address = `${columnLettersFromIndex(column)}${row}`
      if (column === COLUMN_COUNT) {
        return `<c r="${address}"><f>SUM(A${row}:S${row})</f><v>${row * (COLUMN_COUNT - 1)}</v></c>`
      }
      return `<c r="${address}"><v>${row * column}</v></c>`
    }).join('')
    return `<row r="${row}">${cells}</row>`
  }).join('')

  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
</Types>`),
    'xl/workbook.xml': strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Benchmark" sheetId="1" r:id="rId1"/></sheets>
</workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`),
    'xl/styles.xml': strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cellXfs count="1"><xf numFmtId="0"/></cellXfs></styleSheet>`),
    'xl/worksheets/sheet1.xml': strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:${columnLettersFromIndex(COLUMN_COUNT)}${ROW_COUNT}"/>
  <sheetData>${rows}</sheetData>
</worksheet>`),
  }
  return zipSync(files, { level: 6 })
}

test('records a bounded spreadsheet extraction and preview baseline', async () => {
  const bytes = buildBenchmarkWorkbook()
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  const result = createVirtualFileSystemFromFiles([{
    file: new File([copy.buffer], 'benchmark.xlsx', { lastModified: 1_000 }),
    path: 'data/benchmark.xlsx',
    source: 'directory-picker',
  }], { source: 'directory-picker' })
  const report = await analyzeVirtualFileSystem(result.fileSystem)
  const manifest = await createManifestV1(result.fileSystem, report, {
    excludedFileIds: new Set(),
    exclusionGlobs: [],
  }, {
    generatedAt: GENERATED_AT,
    projectName: 'spreadsheet-benchmark',
  })

  const startedAt = performance.now()
  const bundle = await generateMarkdownBundle(result.fileSystem, manifest, {
    generatedAt: GENERATED_AT,
    spreadsheetPolicy: {
      maxCells: 5_000,
      maxRowsPerSheet: 200,
      maxColumnsPerSheet: 50,
      maxMarkdownRowsPerSheet: ROW_COUNT,
      maxMarkdownColumnsPerSheet: COLUMN_COUNT,
    },
  })
  const elapsedMs = performance.now() - startedAt

  expect(bundle.markdown.validation.valid).toBe(true)
  expect(bundle.manifest.validation.valid).toBe(true)
  expect(bundle.markdown.spreadsheetWorkbooks).toHaveLength(1)
  expect(bundle.markdown.spreadsheetWorkbooks[0]?.totalCells).toBe(ROW_COUNT * COLUMN_COUNT)
  expect(bundle.markdown.spreadsheetWorkbooks[0]?.formulaCells).toBe(ROW_COUNT)
  expect(bundle.markdown.spreadsheetPreview?.pageCount).toBe(10)
  expect(bundle.markdown.spreadsheetPreview?.byteLength).toBeGreaterThan(10_000)
  expect(elapsedMs).toBeLessThan(10_000)

  console.info('SPREADSHEET_BENCHMARK', JSON.stringify({
    fixture: 'one-xlsx-100x20',
    workbookBytes: bytes.byteLength,
    cells: ROW_COUNT * COLUMN_COUNT,
    formulas: ROW_COUNT,
    markdownBytes: bundle.markdown.totalBytes,
    previewPages: bundle.markdown.spreadsheetPreview?.pageCount ?? 0,
    previewBytes: bundle.markdown.spreadsheetPreview?.byteLength ?? 0,
    elapsedMs: Number(elapsedMs.toFixed(2)),
  }))

  result.fileSystem.dispose()
})
