import { performance } from 'node:perf_hooks'
import { analyzeVirtualFileSystem } from '../../src/core/preflight/analyze'
import { createVirtualFileSystemFromFiles } from '../../src/core/vfs/import'

it('records a bounded synthetic preflight baseline', async () => {
  const candidates = Array.from({ length: 1_000 }, (_, index) => ({
    file: new File([`export const value${index} = ${index};\n`], `file-${index}.ts`, { type: 'text/typescript' }),
    path: `src/generated/file-${index}.ts`,
    source: 'file-picker' as const,
  }))
  const fileSystem = createVirtualFileSystemFromFiles(candidates).fileSystem

  const startedAt = performance.now()
  const report = await analyzeVirtualFileSystem(fileSystem)
  const elapsedMs = performance.now() - startedAt

  const result = {
    fixture: '1000-small-typescript-files',
    files: report.totals.fileCount,
    logicalBytes: report.totals.logicalBytes,
    signatureBytesPerFile: report.policy.maxSignatureBytes,
    concurrency: report.policy.maxConcurrentReads,
    elapsedMs: Number(elapsedMs.toFixed(2)),
  }
  console.info(`PREFLIGHT_BENCHMARK ${JSON.stringify(result)}`)

  expect(report.totals.capabilityCounts.A).toBe(1_000)
  expect(elapsedMs).toBeLessThan(10_000)
  fileSystem.dispose()
})
