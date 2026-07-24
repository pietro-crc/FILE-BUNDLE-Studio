import { PDFDocument } from 'pdf-lib'
import { generateProjectBundle } from '../../src/core/output/generate'
import { createManifestV1 } from '../../src/core/manifest/generate'
import { DEFAULT_OFFICE_POLICY, extractOfficeFile } from '../../src/core/office/adapter'
import { sanitizeOfficeHtml } from '../../src/core/office/sanitize'
import { analyzeVirtualFileSystem } from '../../src/core/preflight/analyze'
import { createVirtualFileSystemFromFiles } from '../../src/core/vfs/import'
import { createDocxProductionFixture, createPptxProductionFixture } from '../fixtures/office'

const GENERATED_AT = '2026-07-21T12:00:00.000Z'

function buffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

async function setup(name: string, bytes: Uint8Array, mime: string) {
  const result = createVirtualFileSystemFromFiles([{ file: new File([buffer(bytes)], name, { type: mime }), path: name, source: 'file-picker' }])
  const report = await analyzeVirtualFileSystem(result.fileSystem)
  const manifest = await createManifestV1(result.fileSystem, report, { excludedFileIds: new Set(), exclusionGlobs: [] }, { generatedAt: GENERATED_AT, projectName: 'Office Demo' })
  const file = result.fileSystem.files[0]
  const manifestFile = manifest.manifest.files[0]
  if (!file || !manifestFile) throw new Error('Office fixture missing')
  return { result, report, manifest, file, manifestFile }
}

describe('Office HTML sanitizer', () => {
  it('removes scripts, event handlers, active links, and unknown active elements', () => {
    const sanitized = sanitizeOfficeHtml('<h1 onclick="alert(1)">Title</h1><a href="javascript:alert(1)">bad</a><a href="https://example.com">safe text</a><script>alert(1)</script><iframe src="x"></iframe>', 10000)
    expect(sanitized.html).toContain('<h1>Title</h1>')
    expect(sanitized.html).not.toMatch(/script|iframe|onclick|href|javascript:/u)
    expect(sanitized.html).toContain('data-ai-bundle-link="https://example.com"')
    expect(sanitized.markdown).toContain('safe text (destinazione: https://example.com)')
  })
})

describe('DOCX production adapter', () => {
  it('extracts headings, paragraphs and tables, sanitizes hyperlinks, and reports macros/external relationships', async () => {
    const fixture = await setup('report.docm', createDocxProductionFixture({ macroEnabled: true, includeImage: true }), 'application/vnd.ms-word.document.macroEnabled.12')
    const extraction = await extractOfficeFile(fixture.file, fixture.manifestFile)
    expect(extraction.asset.kind).toBe('docx')
    if (extraction.asset.kind !== 'docx') throw new Error('Expected DOCX asset')
    expect(extraction.content).toContain('AI Bundle Studio DOCX')
    expect(extraction.content).toContain('| Name | Value |')
    expect(extraction.asset.macros).toBe(true)
    expect(extraction.asset.externalRelationships).toBe(1)
    expect(extraction.asset.images).toHaveLength(1)
    expect(extraction.asset.images[0]).toMatchObject({ mime: 'image/png', bytes: expect.any(Uint8Array) })
    expect(extraction.asset.sanitizedHtml).not.toMatch(/href|javascript:/u)
    expect(extraction.record.sha256).toMatch(/^[a-f0-9]{64}$/u)
    fixture.result.fileSystem.dispose()
  })

  it('caps repeated image references by extracted byte budget', async () => {
    const fixture = await setup('images.docx', createDocxProductionFixture({ includeImage: true, imageReferences: 2 }), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    const extraction = await extractOfficeFile(fixture.file, fixture.manifestFile, { maxImageBytes: 100, maxTotalImageBytes: 100 })
    expect(extraction.asset.kind).toBe('docx')
    if (extraction.asset.kind !== 'docx') throw new Error('Expected DOCX asset')
    expect(extraction.asset.images).toHaveLength(2)
    expect(extraction.asset.images.filter((image) => image.bytes)).toHaveLength(1)
    expect(extraction.asset.images.filter((image) => image.omittedReason)).toHaveLength(1)
    fixture.result.fileSystem.dispose()
  })

  it('rejects DTD and entity declarations before Mammoth conversion', async () => {
    const fixture = await setup('hostile.docx', createDocxProductionFixture({ hostileXml: true }), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    await expect(extractOfficeFile(fixture.file, fixture.manifestFile)).rejects.toThrow(/DTD ed entità XML non sono consentite/u)
    fixture.result.fileSystem.dispose()
  })
})

describe('PPTX production fallback', () => {
  it('preserves slide order, text, notes, tables and media inventory without following external relationships', async () => {
    const fixture = await setup('briefing.pptm', createPptxProductionFixture({ macroEnabled: true, advancedFeatures: true }), 'application/vnd.ms-powerpoint.presentation.macroEnabled.12')
    const extraction = await extractOfficeFile(fixture.file, fixture.manifestFile)
    expect(extraction.asset.kind).toBe('pptx')
    if (extraction.asset.kind !== 'pptx') throw new Error('Expected PPTX asset')
    expect(extraction.asset.slideCount).toBe(2)
    expect(extraction.asset.slides[0]).toMatchObject({ title: 'Launch plan', notes: ['Speaker note: emphasize privacy.'] })
    expect(extraction.asset.slides[0]?.tables[0]?.rows[1]).toEqual(['008', 'Active'])
    expect(extraction.asset.slides[0]?.images[0]).toMatchObject({ mime: 'image/png', byteLength: expect.any(Number) })
    expect(extraction.asset.macros).toBe(true)
    expect(extraction.asset.hasCharts).toBe(true)
    expect(extraction.asset.hasEmbeddedObjects).toBe(true)
    expect(extraction.asset.hasAudioVideo).toBe(true)
    expect(extraction.asset.externalRelationships).toBe(1)
    expect(extraction.content).toContain('Speaker note: emphasize privacy.')
    fixture.result.fileSystem.dispose()
  })

  it('rejects presentations whose media inventory exceeds the configured image limit', async () => {
    const fixture = await setup('images.pptx', createPptxProductionFixture({ imageCount: 2 }), 'application/vnd.openxmlformats-officedocument.presentationml.presentation')
    await expect(extractOfficeFile(fixture.file, fixture.manifestFile, { maxImages: 1 })).rejects.toThrow(/oltre 1 immagini/u)
    fixture.result.fileSystem.dispose()
  })

  it('integrates DOCX and PPTX into Markdown, manifest and the visual PDF', async () => {
    const docx = createDocxProductionFixture()
    const pptx = createPptxProductionFixture()
    const result = createVirtualFileSystemFromFiles([
      { file: new File([buffer(docx)], 'report.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), path: 'report.docx', source: 'file-picker' },
      { file: new File([buffer(pptx)], 'briefing.pptx', { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }), path: 'briefing.pptx', source: 'file-picker' },
    ])
    const report = await analyzeVirtualFileSystem(result.fileSystem)
    const manifest = await createManifestV1(result.fileSystem, report, { excludedFileIds: new Set(), exclusionGlobs: [] }, { generatedAt: GENERATED_AT, projectName: 'Office Demo' })
    const bundle = await generateProjectBundle(result.fileSystem, manifest, { generatedAt: GENERATED_AT, officePolicy: { maxPreviewPages: 20 }, documentsPolicy: { maxOutputPages: 50 } })
    expect(bundle.markdown.officeAssets).toHaveLength(2)
    expect(bundle.markdown.officePreview?.pageCount).toBeGreaterThanOrEqual(3)
    expect(bundle.documents.records.map((record) => record.adapterId)).toEqual(expect.arrayContaining(['docx', 'presentation-ooxml']))
    expect(bundle.documents.pages.some((page) => page.kind === 'docx-derived')).toBe(true)
    expect(bundle.documents.pages.some((page) => page.kind === 'presentation-derived')).toBe(true)
    expect(bundle.manifest.validation.valid).toBe(true)
    expect(bundle.documents.validation.valid).toBe(true)
    const parsed = await PDFDocument.load(bundle.documents.bytes)
    expect(parsed.getPageCount()).toBe(bundle.documents.pageCount)
    const limited = await generateProjectBundle(result.fileSystem, manifest, { generatedAt: GENERATED_AT, officePolicy: { maxPreviewPages: 1 }, documentsPolicy: { maxOutputPages: 50 } })
    expect(limited.markdown.officePreview?.pageCount).toBe(1)
    expect(limited.markdown.officePreview?.warnings.join(' ')).toMatch(/troncata|truncated|non sono stati rappresentati|not represented/u)
    result.fileSystem.dispose()
  }, 20_000)
})

expect(DEFAULT_OFFICE_POLICY.maxDocumentBytes).toBeGreaterThan(0)
