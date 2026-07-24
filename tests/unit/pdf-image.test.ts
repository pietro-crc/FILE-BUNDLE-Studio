import { extractImageFile } from '../../src/core/image/adapter'
import { inspectImageBytes } from '../../src/core/image/inspect'
import type { PdfDocumentAsset } from '../../src/core/pdf/types'
import { sha256Hex } from '../../src/core/hash/sha256'
import { createManifestV1 } from '../../src/core/manifest/generate'
import type { MarkdownArtifact } from '../../src/core/markdown/types'
import { renderDocumentsPdf } from '../../src/core/output/documents'
import { updateManifestWithDocuments } from '../../src/core/output/manifest-update'
import { validateDocumentsArtifact } from '../../src/core/output/validate'
import { analyzeVirtualFileSystem } from '../../src/core/preflight/analyze'
import { createVirtualFileSystemFromFiles } from '../../src/core/vfs/import'
import { createHugePngHeader, createPdfFixture, createPngFixture, createVp8lHeader } from '../fixtures/media'

const GENERATED_AT = '2026-07-21T10:00:00.000Z'

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

async function createManifestFor(files: readonly { file: File; path: string }[]) {
  const result = createVirtualFileSystemFromFiles(files.map((entry) => ({ ...entry, source: 'file-picker' as const })))
  const report = await analyzeVirtualFileSystem(result.fileSystem)
  const manifest = await createManifestV1(result.fileSystem, report, { excludedFileIds: new Set(), exclusionGlobs: [] }, {
    generatedAt: GENERATED_AT,
    projectName: 'Visual Demo',
  })
  return { ...result, manifest }
}

function emptyMarkdown(overrides: Partial<MarkdownArtifact>): MarkdownArtifact {
  return {
    mediaType: 'text/markdown',
    generatedAt: GENERATED_AT,
    projectName: 'Visual Demo',
    policy: { maxBytesPerFile: 1024, maxCharactersPerFile: 1024, maxPartBytes: 4096, includeLineNumbers: false, language: 'it' },
    parts: [],
    records: [],
    spreadsheetWorkbooks: [],
    pdfDocuments: [],
    imageAssets: [],
    officeAssets: [],
    securityReports: [],
    securitySummary: {
      mode: 'redact',
      policy: { maxCharactersPerFile: 1024, maxFindingsPerFile: 10, maxCandidateLength: 100, minHighEntropyLength: 20, highEntropyThreshold: 4.5, scanHighEntropy: false },
      scannedFileCount: 0, flaggedFileCount: 0, findingCount: 0, redactionCount: 0, excludedFileCount: 0, visualOmittedFileCount: 0, truncatedScanCount: 0, failedScanCount: 0,
      categoryCounts: { 'sensitive-filename': 0, 'private-key': 0, 'cloud-credential': 0, 'access-token': 0, jwt: 0, 'connection-string': 0, 'password-assignment': 0, 'high-entropy': 0 },
    },
    spreadsheetPreview: null,
    officePreview: null,
    totalBytes: 0,
    sharded: false,
    validation: { valid: true, errors: [] },
    ...overrides,
  }
}

describe('image metadata and defensive limits', () => {
  it('reads PNG transparency and WebP lossless dimensions from headers', () => {
    expect(inspectImageBytes(createPngFixture(), 'image/png')).toMatchObject({ width: 2, height: 1, hasTransparency: true })
    expect(inspectImageBytes(createVp8lHeader(), 'image/webp')).toMatchObject({ width: 513, height: 257, formatLabel: 'WebP lossless' })
  })

  it('rejects an image bomb header before invoking the browser decoder', async () => {
    const huge = createHugePngHeader()
    const { fileSystem, manifest } = await createManifestFor([{ file: new File([asArrayBuffer(huge)], 'huge.png', { type: 'image/png' }), path: 'huge.png' }])
    const file = fileSystem.files[0]
    const manifestFile = manifest.manifest.files[0]
    if (!file || !manifestFile) throw new Error('Fixture image missing.')
    const decoder = vi.fn(async () => createPngFixture())

    await expect(extractImageFile(file, manifestFile, { maxMegapixels: 40 }, undefined, decoder)).rejects.toThrow(/oltre il limite|above the.*limit/u)
    expect(decoder).not.toHaveBeenCalled()
    fileSystem.dispose()
  })

  it('keeps an embeddable PNG lossless and produces a mapped image page', async () => {
    const png = createPngFixture()
    const { fileSystem, manifest } = await createManifestFor([{ file: new File([asArrayBuffer(png)], 'diagram.png', { type: 'image/png' }), path: 'assets/diagram.png' }])
    const file = fileSystem.files[0]
    const manifestFile = manifest.manifest.files[0]
    if (!file || !manifestFile) throw new Error('Fixture image missing.')
    const extracted = await extractImageFile(file, manifestFile)
    expect(extracted.asset).toMatchObject({ embeddedMime: 'image/png', downsampled: false, status: 'completed' })

    const draft = await renderDocumentsPdf(manifest, emptyMarkdown({ imageAssets: [extracted.asset] }), { maxOutputPages: 10 })
    const updated = updateManifestWithDocuments(manifest, draft)
    const validation = validateDocumentsArtifact(draft, updated)
    expect(validation).toEqual({ valid: true, errors: [] })
    expect(draft.pageCount).toBe(6)
    expect(draft.pages.some((page) => page.kind === 'image-derived' && page.path === 'assets/diagram.png')).toBe(true)
    expect(updated.manifest.files[0]?.representations.pdf).toMatchObject({ status: 'completed', pages: expect.arrayContaining([4, 5]) })
    fileSystem.dispose()
  })
})

describe('documents PDF page mapping and limits', () => {
  it('copies original PDF pages, preserves source mapping, and never exceeds the global page budget', async () => {
    const pdf = await createPdfFixture(6)
    const { fileSystem, manifest } = await createManifestFor([{ file: new File([asArrayBuffer(pdf)], 'manual.pdf', { type: 'application/pdf' }), path: 'docs/manual.pdf' }])
    const manifestFile = manifest.manifest.files[0]
    if (!manifestFile) throw new Error('Fixture PDF missing.')
    const asset: PdfDocumentAsset = {
      adapterId: 'pdf',
      adapterVersion: '1.0.0',
      fileId: manifestFile.fileId,
      path: manifestFile.normalizedPath,
      bytes: pdf,
      byteLength: pdf.byteLength,
      pageCount: 6,
      importedPageCount: 6,
      pages: Array.from({ length: 6 }, (_, index) => ({ pageNumber: index + 1, width: index % 2 === 0 ? 595.28 : 841.89, height: index % 2 === 0 ? 841.89 : 595.28, rotation: index === 1 ? 90 : 0, text: `Page ${index + 1}`, truncated: false })),
      status: 'completed',
      encrypted: false,
      hasJavaScript: false,
      warnings: [],
      sha256: await sha256Hex(pdf),
    }

    const draft = await renderDocumentsPdf(manifest, emptyMarkdown({ pdfDocuments: [asset] }), { maxOutputPages: 8 })
    const updated = updateManifestWithDocuments(manifest, draft)
    const validation = validateDocumentsArtifact(draft, updated)
    expect(validation).toEqual({ valid: true, errors: [] })
    expect(draft.pageCount).toBe(8)
    expect(draft.warnings.some((w) => /Output (limitato|limited) to 8|Output limitato a 8/i.test(w))).toBe(true)
    const record = draft.records[0]
    expect(record).toMatchObject({ status: 'partial', sourcePages: [{ sourcePage: 1, outputPage: 5 }, { sourcePage: 2, outputPage: 6 }, { sourcePage: 3, outputPage: 7 }] })
    const importedPages = draft.pages.filter((page) => page.kind === 'pdf-original')
    expect(importedPages).toHaveLength(3)
    expect(importedPages[1]?.rotation).toBe(90)
    expect(updated.manifest.files[0]?.representations.pdf.pages).toEqual(record?.pages)
    const corrupted = { ...draft, records: draft.records.map((candidate, index) => index === 0 ? { ...candidate, pages: [999] } : candidate) }
    expect(validateDocumentsArtifact(corrupted, updated).errors.map((error) => error.code)).toEqual(expect.arrayContaining(['record-page', 'manifest-pages']))
    fileSystem.dispose()
  })
})
