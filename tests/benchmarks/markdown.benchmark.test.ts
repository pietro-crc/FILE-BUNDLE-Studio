import { performance } from 'node:perf_hooks'
import { generateMarkdownBundle } from '../../src/core/markdown/generate'
import { createManifestV1 } from '../../src/core/manifest/generate'
import { analyzeVirtualFileSystem } from '../../src/core/preflight/analyze'
import { createVirtualFileSystemFromFiles } from '../../src/core/vfs/import'

const FILE_COUNT = 500
const GENERATED_AT = '2026-07-21T12:00:00.000Z'

test('records a deterministic 500-file Markdown baseline', async () => {
  const files = Array.from({ length: FILE_COUNT }, (_, index) => ({
    file: new File([
      `export const value${index} = ${index}\n`,
      `export function getValue${index}() { return value${index} }\n`,
    ], `file-${index}.ts`, {
      type: 'text/typescript',
      lastModified: 1000,
    }),
    path: `src/group-${index % 20}/file-${index}.ts`,
    source: 'directory-picker' as const,
  }))
  const result = createVirtualFileSystemFromFiles(files, { source: 'directory-picker' })
  const report = await analyzeVirtualFileSystem(result.fileSystem)
  const manifest = await createManifestV1(result.fileSystem, report, {
    excludedFileIds: new Set(),
    exclusionGlobs: [],
  }, {
    generatedAt: GENERATED_AT,
    projectName: 'markdown-benchmark',
  })

  const startedAt = performance.now()
  const bundle = await generateMarkdownBundle(result.fileSystem, manifest, {
    generatedAt: GENERATED_AT,
    policy: {
      maxBytesPerFile: 65_536,
      maxCharactersPerFile: 65_536,
      maxPartBytes: 262_144,
      includeLineNumbers: false,
    },
  })
  const elapsedMs = performance.now() - startedAt

  expect(bundle.markdown.validation.valid).toBe(true)
  expect(bundle.manifest.validation.valid).toBe(true)
  expect(bundle.markdown.records.filter((record) => record.status === 'completed')).toHaveLength(FILE_COUNT)
  expect(bundle.markdown.totalBytes).toBeGreaterThan(400_000)
  expect(bundle.markdown.parts.every((part) => part.byteLength <= 262_144)).toBe(true)
  expect(elapsedMs).toBeLessThan(10_000)

  console.info('MARKDOWN_BENCHMARK', JSON.stringify({
    fixture: '500-small-typescript-files',
    files: FILE_COUNT,
    parts: bundle.markdown.parts.length,
    markdownBytes: bundle.markdown.totalBytes,
    manifestBytes: bundle.manifest.byteLength,
    elapsedMs: Number(elapsedMs.toFixed(2)),
  }))

  result.fileSystem.dispose()
})
