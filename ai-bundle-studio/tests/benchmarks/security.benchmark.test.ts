import { performance } from 'node:perf_hooks'
import { generateMarkdownBundle } from '../../src/core/markdown/generate'
import { createManifestV1 } from '../../src/core/manifest/generate'
import { analyzeVirtualFileSystem } from '../../src/core/preflight/analyze'
import { createVirtualFileSystemFromFiles } from '../../src/core/vfs/import'

const FILE_COUNT = 300
const FLAGGED_COUNT = 60
const GENERATED_AT = '2026-07-22T09:00:00.000Z'

test('records a bounded secret scan and redaction baseline', async () => {
  const files = Array.from({ length: FILE_COUNT }, (_, index) => {
    const sensitive = index < FLAGGED_COUNT
    const content = sensitive
      ? `SERVICE_NAME=service-${index}\npassword=benchmark-secret-${index}-value\nSAFE=true\n`
      : `SERVICE_NAME=service-${index}\nSAFE=true\n`
    return {
      file: new File([content], sensitive ? `.env.service-${index}` : `config-${index}.txt`, {
        type: 'text/plain',
        lastModified: 1_000,
      }),
      path: sensitive ? `secrets/.env.service-${index}` : `config/config-${index}.txt`,
      source: 'directory-picker' as const,
    }
  })
  const result = createVirtualFileSystemFromFiles(files, { source: 'directory-picker' })
  const report = await analyzeVirtualFileSystem(result.fileSystem)
  const manifest = await createManifestV1(result.fileSystem, report, {
    excludedFileIds: new Set(),
    exclusionGlobs: [],
  }, {
    generatedAt: GENERATED_AT,
    projectName: 'security-benchmark',
    secretHandling: 'redact',
  })

  const startedAt = performance.now()
  const bundle = await generateMarkdownBundle(result.fileSystem, manifest, {
    generatedAt: GENERATED_AT,
    secretPolicy: { scanHighEntropy: false },
  })
  const elapsedMs = performance.now() - startedAt
  const content = bundle.markdown.parts.map((part) => part.content).join('\n')

  expect(bundle.markdown.validation.valid).toBe(true)
  expect(bundle.manifest.validation.valid).toBe(true)
  expect(bundle.markdown.securitySummary.flaggedFileCount).toBe(FLAGGED_COUNT)
  expect(bundle.markdown.securitySummary.redactionCount).toBe(FLAGGED_COUNT)
  expect(content).not.toContain('benchmark-secret-')
  expect(content).toContain('[REDACTED:password-assignment]')
  expect(elapsedMs).toBeLessThan(10_000)

  console.info('SECURITY_BENCHMARK', JSON.stringify({
    fixture: '300-text-files-60-flagged',
    files: FILE_COUNT,
    flaggedFiles: FLAGGED_COUNT,
    findings: bundle.markdown.securitySummary.findingCount,
    redactions: bundle.markdown.securitySummary.redactionCount,
    markdownBytes: bundle.markdown.totalBytes,
    elapsedMs: Number(elapsedMs.toFixed(2)),
  }))
  result.fileSystem.dispose()
})
