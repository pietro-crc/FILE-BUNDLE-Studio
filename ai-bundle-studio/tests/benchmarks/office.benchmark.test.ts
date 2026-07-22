import { performance } from 'node:perf_hooks'
import { generateProjectBundle } from '../../src/core/output/generate'
import { createManifestV1 } from '../../src/core/manifest/generate'
import { analyzeVirtualFileSystem } from '../../src/core/preflight/analyze'
import { createVirtualFileSystemFromFiles } from '../../src/core/vfs/import'
import { createDocxProductionFixture, createPptxProductionFixture } from '../fixtures/office'

const GENERATED_AT = '2026-07-21T12:00:00.000Z'

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

test('records a deterministic DOCX and PPTX extraction baseline', async () => {
  const docx = createDocxProductionFixture({ macroEnabled: true, includeImage: true })
  const pptx = createPptxProductionFixture({ macroEnabled: true, advancedFeatures: true })
  const result = createVirtualFileSystemFromFiles([
    {
      file: new File([asArrayBuffer(docx)], 'report.docm', {
        type: 'application/vnd.ms-word.document.macroEnabled.12',
        lastModified: 1_000,
      }),
      path: 'docs/report.docm',
      source: 'directory-picker' as const,
    },
    {
      file: new File([asArrayBuffer(pptx)], 'briefing.pptm', {
        type: 'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
        lastModified: 1_000,
      }),
      path: 'slides/briefing.pptm',
      source: 'directory-picker' as const,
    },
  ], { source: 'directory-picker' })
  const report = await analyzeVirtualFileSystem(result.fileSystem)
  const manifest = await createManifestV1(result.fileSystem, report, {
    excludedFileIds: new Set(),
    exclusionGlobs: [],
  }, {
    generatedAt: GENERATED_AT,
    projectName: 'office-benchmark',
  })

  const startedAt = performance.now()
  const bundle = await generateProjectBundle(result.fileSystem, manifest, {
    generatedAt: GENERATED_AT,
    officePolicy: { maxPreviewPages: 20 },
    documentsPolicy: { maxOutputPages: 50 },
  })
  const elapsedMs = performance.now() - startedAt

  expect(bundle.markdown.validation.valid).toBe(true)
  expect(bundle.manifest.validation.valid).toBe(true)
  expect(bundle.documents.validation.valid).toBe(true)
  expect(bundle.markdown.officeAssets).toHaveLength(2)
  expect(bundle.markdown.officePreview?.pageCount).toBeGreaterThanOrEqual(3)
  expect(bundle.markdown.records.filter((record) => record.status !== 'failed')).toHaveLength(2)
  expect(bundle.markdown.parts.some((part) => part.content.includes('AI Bundle Studio DOCX'))).toBe(true)
  expect(bundle.markdown.parts.some((part) => part.content.includes('Speaker note: emphasize privacy.'))).toBe(true)
  expect(bundle.documents.records.map((record) => record.adapterId)).toEqual(expect.arrayContaining(['docx', 'presentation-ooxml']))
  expect(elapsedMs).toBeLessThan(15_000)

  console.info('OFFICE_BENCHMARK', JSON.stringify({
    fixture: 'one-macro-docm-one-feature-rich-pptm',
    docxBytes: docx.byteLength,
    pptxBytes: pptx.byteLength,
    documents: bundle.markdown.officeAssets.length,
    slides: bundle.markdown.officeAssets.reduce((total, asset) => total + (asset.kind === 'pptx' ? asset.slides.length : 0), 0),
    markdownBytes: bundle.markdown.totalBytes,
    officePreviewPages: bundle.markdown.officePreview?.pageCount ?? 0,
    documentsPages: bundle.documents.pageCount,
    documentsBytes: bundle.documents.byteLength,
    elapsedMs: Number(elapsedMs.toFixed(2)),
  }))

  result.fileSystem.dispose()
}, 20_000)
