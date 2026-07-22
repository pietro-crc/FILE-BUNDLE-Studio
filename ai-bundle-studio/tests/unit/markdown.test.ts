import { createSafeFence, renderFencedContent } from '../../src/core/markdown/fence'
import { decodeTextBytes } from '../../src/core/markdown/encoding'
import { generateMarkdownBundle } from '../../src/core/markdown/generate'
import { createManifestV1 } from '../../src/core/manifest/generate'
import { analyzeVirtualFileSystem } from '../../src/core/preflight/analyze'
import { createVirtualFileSystemFromFiles } from '../../src/core/vfs/import'

const GENERATED_AT = '2026-07-21T10:00:00.000Z'

describe('text decoding and Markdown safety', () => {
  it('detects BOM, normalizes newlines, and reports the transformation', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('a\r\nb\rc')])
    const result = decodeTextBytes(bytes)

    expect(result).toMatchObject({
      text: 'a\nb\nc',
      encoding: 'utf-8-bom',
      bomRemoved: true,
      newlineNormalization: 'lf',
      usedFallback: false,
    })
  })

  it('uses a controlled Windows-1252 fallback for invalid UTF-8', () => {
    const result = decodeTextBytes(new Uint8Array([0x63, 0x61, 0x66, 0xe9]))

    expect(result.text).toBe('café')
    expect(result.encoding).toBe('windows-1252')
    expect(result.usedFallback).toBe(true)
    expect(result.warnings).toContain('UTF-8 non valido: applicato fallback controllato Windows-1252.')
  })

  it('chooses a fence longer than every matching run in content', () => {
    const content = '```js\ncode\n```\n~~~~'
    const fence = createSafeFence(content)
    const rendered = renderFencedContent(content, 'javascript')

    expect(fence.marker.length).toBeGreaterThanOrEqual(4)
    expect(rendered.startsWith(`${fence.marker}javascript\n`)).toBe(true)
    expect(rendered.endsWith(fence.marker)).toBe(true)
  })
})

describe('Markdown bundle generation', () => {
  it('generates bounded parts, deterministic anchors, hashes complete files, and updates the manifest', async () => {
    const large = `${'line with ``` nested fence\n'.repeat(260)}tail`
    const result = createVirtualFileSystemFromFiles([
      { file: new File(['# Project\r\nhello'], 'README.md', { type: 'text/markdown' }), path: 'README.md', source: 'directory-picker' },
      { file: new File([large], 'large.ts', { type: 'text/typescript' }), path: 'src/large.ts', source: 'directory-picker' },
      { file: new File([new TextEncoder().encode('%PDF-1.7')], 'manual.pdf', { type: 'application/pdf' }), path: 'docs/manual.pdf', source: 'directory-picker' },
    ])
    const report = await analyzeVirtualFileSystem(result.fileSystem)
    const manifest = await createManifestV1(result.fileSystem, report, { excludedFileIds: new Set(), exclusionGlobs: [] }, {
      generatedAt: GENERATED_AT,
      projectName: 'Markdown Demo',
    })

    const bundle = await generateMarkdownBundle(result.fileSystem, manifest, {
      generatedAt: GENERATED_AT,
      policy: {
        maxBytesPerFile: 5000,
        maxCharactersPerFile: 5000,
        maxPartBytes: 4096,
        includeLineNumbers: true,
      },
    })

    expect(bundle.markdown.validation).toEqual({ valid: true, errors: [] })
    expect(bundle.manifest.validation).toEqual({ valid: true, errors: [] })
    expect(bundle.markdown.parts.length).toBeGreaterThan(1)
    expect(bundle.markdown.parts.every((part) => part.byteLength <= 4096)).toBe(true)
    expect(bundle.markdown.parts[0]?.content).toContain('Leggi prima il manifest JSON')
    expect(bundle.markdown.parts.some((part) => part.content.includes('line with ``` nested fence'))).toBe(true)

    const readme = bundle.manifest.manifest.files.find((file) => file.normalizedPath === 'README.md')
    const largeFile = bundle.manifest.manifest.files.find((file) => file.normalizedPath === 'src/large.ts')
    const pdf = bundle.manifest.manifest.files.find((file) => file.normalizedPath === 'docs/manual.pdf')
    expect(readme?.integrity.status).toBe('computed')
    expect(readme?.representations.markdown).toMatchObject({ status: 'completed', truncated: false, newlineNormalization: 'lf' })
    expect(readme?.representations.markdown.anchors[0]).toMatch(/^ai-bundle-file_[a-f0-9]{64}$/u)
    expect(largeFile?.representations.markdown).toMatchObject({ status: 'partial', truncated: true })
    expect(pdf?.representations.markdown.status).toBe('failed')
    expect(bundle.manifest.manifest.outputs.find((output) => output.family === 'content')).toMatchObject({ status: 'generated' })
    expect(bundle.manifest.manifest.sharding).toMatchObject({ applied: true })

    result.fileSystem.dispose()
  })

  it('never calls the full byte reader and propagates cancellation', async () => {
    const result = createVirtualFileSystemFromFiles([
      { file: new File(['hello'], 'hello.txt'), path: 'hello.txt', source: 'file-picker' },
    ])
    const file = result.fileSystem.files[0]
    if (!file) throw new Error('Fixture file missing')
    const fullRead = vi.spyOn(file.bytes, 'read')
    const report = await analyzeVirtualFileSystem(result.fileSystem)
    const manifest = await createManifestV1(result.fileSystem, report, { excludedFileIds: new Set(), exclusionGlobs: [] }, { generatedAt: GENERATED_AT })

    const controller = new AbortController()
    controller.abort('stop')
    await expect(generateMarkdownBundle(result.fileSystem, manifest, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
    expect(fullRead).not.toHaveBeenCalled()
    result.fileSystem.dispose()
  })
})
