import { performance } from 'node:perf_hooks'
import { extractImageFile } from '../../src/core/image/adapter'
import { sha256Hex } from '../../src/core/hash/sha256'
import { createManifestV1 } from '../../src/core/manifest/generate'
import type { MarkdownArtifact } from '../../src/core/markdown/types'
import type { PdfDocumentAsset } from '../../src/core/pdf/types'
import { renderDocumentsPdf } from '../../src/core/output/documents'
import { updateManifestWithDocuments } from '../../src/core/output/manifest-update'
import { validateDocumentsArtifact } from '../../src/core/output/validate'
import { analyzeVirtualFileSystem } from '../../src/core/preflight/analyze'
import { createVirtualFileSystemFromFiles } from '../../src/core/vfs/import'
import { createPdfFixture, createPngFixture } from '../fixtures/media'

const GENERATED_AT = '2026-07-21T12:00:00.000Z'
const IMAGE_COUNT = 8
const PDF_PAGES = 25

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

test('records a local PDF and image assembly baseline', async () => {
  const pdf = await createPdfFixture(PDF_PAGES)
  const png = createPngFixture()
  const files = [
    { file: new File([asArrayBuffer(pdf)], 'manual.pdf', { type: 'application/pdf', lastModified: 1_000 }), path: 'docs/manual.pdf', source: 'directory-picker' as const },
    ...Array.from({ length: IMAGE_COUNT }, (_, index) => ({
      file: new File([asArrayBuffer(png)], `diagram-${index + 1}.png`, { type: 'image/png', lastModified: 1_000 }),
      path: `images/diagram-${index + 1}.png`,
      source: 'directory-picker' as const,
    })),
  ]
  const result = createVirtualFileSystemFromFiles(files, { source: 'directory-picker' })
  const report = await analyzeVirtualFileSystem(result.fileSystem)
  const manifest = await createManifestV1(result.fileSystem, report, { excludedFileIds: new Set(), exclusionGlobs: [] }, {
    generatedAt: GENERATED_AT,
    projectName: 'visual-benchmark',
  })
  const pdfFile = manifest.manifest.files.find((file) => file.mimeDetected === 'application/pdf')
  if (!pdfFile) throw new Error('Benchmark PDF missing.')
  const pdfAsset: PdfDocumentAsset = {
    adapterId: 'pdf', adapterVersion: '1.0.0', fileId: pdfFile.fileId, path: pdfFile.normalizedPath,
    bytes: pdf, byteLength: pdf.byteLength, pageCount: PDF_PAGES, importedPageCount: PDF_PAGES,
    pages: Array.from({ length: PDF_PAGES }, (_, index) => ({ pageNumber: index + 1, width: 595.28, height: 841.89, rotation: 0, text: `Page ${index + 1}`, truncated: false })),
    status: 'completed', encrypted: false, hasJavaScript: false, warnings: [], sha256: await sha256Hex(pdf),
  }

  const startedAt = performance.now()
  const imageAssets = []
  for (const manifestFile of manifest.manifest.files.filter((file) => file.category === 'image')) {
    const file = result.fileSystem.files.find((candidate) => candidate.normalizedPath === manifestFile.normalizedPath)
    if (!file) throw new Error(`Benchmark image missing: ${manifestFile.normalizedPath}`)
    // eslint-disable-next-line no-await-in-loop -- Sequential extraction keeps peak memory bounded in the benchmark.
    imageAssets.push((await extractImageFile(file, manifestFile)).asset)
  }
  const markdown: MarkdownArtifact = {
    mediaType: 'text/markdown', generatedAt: GENERATED_AT, projectName: 'visual-benchmark',
    policy: { maxBytesPerFile: 1024, maxCharactersPerFile: 1024, maxPartBytes: 4096, includeLineNumbers: false, language: 'it' },
    parts: [], records: [], spreadsheetWorkbooks: [], pdfDocuments: [pdfAsset], imageAssets, officeAssets: [], spreadsheetPreview: null, officePreview: null,
    totalBytes: 0, sharded: false, validation: { valid: true, errors: [] },
  }
  const draft = await renderDocumentsPdf(manifest, markdown, { maxOutputPages: 100 })
  const updated = updateManifestWithDocuments(manifest, draft)
  const validation = validateDocumentsArtifact(draft, updated)
  const elapsedMs = performance.now() - startedAt

  expect(validation.valid).toBe(true)
  expect(draft.pageCount).toBe(46)
  expect(draft.records).toHaveLength(IMAGE_COUNT + 1)
  expect(draft.byteLength).toBeGreaterThan(pdf.byteLength)
  expect(elapsedMs).toBeLessThan(10_000)
  console.info('PDF_IMAGE_BENCHMARK', JSON.stringify({
    fixture: 'one-25-page-pdf-eight-png-images',
    sourcePdfBytes: pdf.byteLength,
    sourcePdfPages: PDF_PAGES,
    images: IMAGE_COUNT,
    outputPages: draft.pageCount,
    outputBytes: draft.byteLength,
    elapsedMs: Number(elapsedMs.toFixed(2)),
  }))
  result.fileSystem.dispose()
})
