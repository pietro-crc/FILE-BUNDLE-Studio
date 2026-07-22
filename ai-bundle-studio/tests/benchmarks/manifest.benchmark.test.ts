import { performance } from 'node:perf_hooks'
import { createManifestV1 } from '../../src/core/manifest/generate'
import { analyzeVirtualFileSystem } from '../../src/core/preflight/analyze'
import { createVirtualFileSystemFromFiles } from '../../src/core/vfs/import'

test('records a deterministic 1,000-file manifest baseline', async () => {
  const files = Array.from({ length: 1000 }, (_, index) => ({
    file: new File([`export const value${index} = ${index}\n`], `file-${index}.ts`, {
      type: 'text/typescript',
      lastModified: 1000,
    }),
    path: `src/group-${index % 20}/file-${index}.ts`,
    source: 'directory-picker' as const,
  }))
  const result = createVirtualFileSystemFromFiles(files, { source: 'directory-picker' })
  const report = await analyzeVirtualFileSystem(result.fileSystem)
  const startedAt = performance.now()
  const artifact = await createManifestV1(result.fileSystem, report, {
    excludedFileIds: new Set(),
    exclusionGlobs: [],
  }, {
    generatedAt: '2026-07-20T12:00:00.000Z',
    projectName: 'benchmark',
  })
  const elapsedMs = performance.now() - startedAt

  expect(artifact.validation.valid).toBe(true)
  expect(artifact.manifest.summary.fileCount).toBe(1000)
  expect(artifact.byteLength).toBeGreaterThan(1_000_000)
  expect(elapsedMs).toBeLessThan(5000)
  console.info('MANIFEST_BENCHMARK', JSON.stringify({
    fixture: '1000-small-typescript-files',
    files: 1000,
    directories: artifact.manifest.summary.directoryCount,
    canonicalBytes: artifact.byteLength,
    elapsedMs: Number(elapsedMs.toFixed(2)),
  }))

  result.fileSystem.dispose()
})
