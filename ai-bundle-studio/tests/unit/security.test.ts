import { generateProjectBundle } from '../../src/core/output/generate'
import { createManifestV1 } from '../../src/core/manifest/generate'
import { analyzeVirtualFileSystem } from '../../src/core/preflight/analyze'
import { redactSecretFindings } from '../../src/core/security/redact'
import { scanSecrets } from '../../src/core/security/scanner'
import { createVirtualFileSystemFromFiles } from '../../src/core/vfs/import'

const GENERATED_AT = '2026-07-22T08:00:00.000Z'
const FAKE_AWS = 'AKIAABCDEFGHIJKLMNOP'
const FAKE_GITHUB = 'ghp_abcdefghijklmnopqrstuvwxyz1234567890'

async function createBundle(mode: 'report-only' | 'redact' | 'exclude') {
  const source = [
    'SERVICE_URL=postgres://demo:super-secret-password@localhost/app',
    `AWS_ACCESS_KEY_ID=${FAKE_AWS}`,
    `GITHUB_TOKEN=${FAKE_GITHUB}`,
    'SAFE=value',
  ].join('\n')
  const result = createVirtualFileSystemFromFiles([
    { file: new File([source], '.env', { type: 'text/plain' }), path: '.env', source: 'file-picker' },
  ])
  const report = await analyzeVirtualFileSystem(result.fileSystem)
  const manifest = await createManifestV1(result.fileSystem, report, { excludedFileIds: new Set(), exclusionGlobs: [] }, {
    generatedAt: GENERATED_AT,
    projectName: 'Security Demo',
    secretHandling: mode,
  })
  const bundle = await generateProjectBundle(result.fileSystem, manifest, {
    generatedAt: GENERATED_AT,
    secretPolicy: { scanHighEntropy: false },
  })
  return { result, bundle, source }
}

describe('secret scanner and redaction', () => {
  it('detects sensitive names and known secret patterns without storing matched values', () => {
    const content = `password=hunter2\n${FAKE_AWS}\n${FAKE_GITHUB}`
    const report = scanSecrets('file_test', '.env.production', content, 'report-only', { scanHighEntropy: false })

    expect(report.findings.map((finding) => finding.category)).toEqual(expect.arrayContaining([
      'sensitive-filename',
      'password-assignment',
      'cloud-credential',
      'access-token',
    ]))
    const serialized = JSON.stringify(report)
    expect(serialized).not.toContain('hunter2')
    expect(serialized).not.toContain(FAKE_AWS)
    expect(serialized).not.toContain(FAKE_GITHUB)
  })

  it('redacts only content intervals and preserves line count', () => {
    const content = `first\npassword=hunter2\nlast`
    const report = scanSecrets('file_test', 'config.txt', content, 'redact', { scanHighEntropy: false })
    const redacted = redactSecretFindings(content, report)

    expect(redacted.content).not.toContain('hunter2')
    expect(redacted.content).toContain('[REDACTED:password-assignment]')
    expect(redacted.content.split('\n')).toHaveLength(content.split('\n').length)
    expect(redacted.report.redactionCount).toBe(1)
  })

  it('keeps content in report-only mode while recording category-only evidence in the manifest', async () => {
    const { result, bundle, source } = await createBundle('report-only')
    const markdown = bundle.markdown.parts.map((part) => part.content).join('\n')
    const file = bundle.manifest.manifest.files[0]

    expect(markdown).toContain(source)
    expect(file?.security.findingCount).toBeGreaterThanOrEqual(3)
    expect(file?.security.categories).toContain('sensitive-filename')
    expect(bundle.manifest.json).not.toContain('super-secret-password')
    expect(bundle.manifest.json).not.toContain(FAKE_AWS)
    expect(bundle.manifest.validation.valid).toBe(true)
    result.fileSystem.dispose()
  })

  it('redacts derived text, keeps originals unchanged, and records redaction without leaking values', async () => {
    const { result, bundle, source } = await createBundle('redact')
    const markdown = bundle.markdown.parts.map((part) => part.content).join('\n')
    const file = bundle.manifest.manifest.files[0]
    const original = new TextDecoder().decode(await result.fileSystem.files[0]?.bytes.read())

    expect(original).toBe(source)
    expect(markdown).not.toContain('super-secret-password')
    expect(markdown).not.toContain(FAKE_AWS)
    expect(markdown).not.toContain(FAKE_GITHUB)
    expect(markdown).toContain('[REDACTED:')
    expect(file?.security.status).toBe('redacted')
    expect(file?.security.redactionCount).toBeGreaterThan(0)
    expect(file?.inclusion.included).toBe(true)
    expect(bundle.manifest.validation.valid).toBe(true)
    result.fileSystem.dispose()
  })

  it('excludes flagged files from derived outputs and recomputes manifest totals', async () => {
    const { result, bundle } = await createBundle('exclude')
    const markdown = bundle.markdown.parts.map((part) => part.content).join('\n')
    const file = bundle.manifest.manifest.files[0]

    expect(markdown).not.toContain('super-secret-password')
    expect(file?.inclusion).toEqual({ included: false, reason: 'excluded-secret-policy', matchedGlob: null })
    expect(file?.security.status).toBe('excluded')
    expect(file?.representations.markdown.status).toBe('not-applicable')
    expect(file?.adapter.conversionStatus).toBe('not-applicable')
    expect(bundle.manifest.manifest.summary.includedFileCount).toBe(0)
    expect(bundle.manifest.manifest.security.excludedFileCount).toBe(1)
    expect(bundle.manifest.validation.valid).toBe(true)
    result.fileSystem.dispose()
  })

  it('bounds scans and reports high-entropy candidates as possible false positives', () => {
    const report = scanSecrets('file_test', 'config.txt', `safe\nABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-\nignored=password`, 'report-only', {
      maxCharactersPerFile: 42,
      maxFindingsPerFile: 5,
      minHighEntropyLength: 24,
      maxCandidateLength: 64,
      highEntropyThreshold: 3.5,
      scanHighEntropy: true,
    })

    expect(report.scanTruncated).toBe(true)
    expect(report.findings.some((finding) => finding.category === 'high-entropy')).toBe(true)
    expect(report.warnings).toContain('Le segnalazioni ad alta entropia possono includere falsi positivi.')
    expect(JSON.stringify(report)).not.toContain('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-')
  })

  it('rejects inconsistent security page references during cross-validation', async () => {
    const { result, bundle } = await createBundle('redact')
    const file = bundle.manifest.manifest.files[0]
    expect(file).toBeDefined()
    const mutated = structuredClone(bundle.manifest.manifest)
    if (mutated.files[0]) {
      mutated.files[0].security.visualOmitted = true
      mutated.files[0].representations.pdf = { status: 'completed', pages: [1], parts: ['project-documents.pdf'] }
    }
    const { validateManifestV1 } = await import('../../src/core/manifest/validate')
    const validation = validateManifestV1(mutated)
    expect(validation.valid).toBe(false)
    expect(validation.errors.some((error) => error.code === 'pdf-security-omission')).toBe(true)
    result.fileSystem.dispose()
  })

  it('rejects scanner policies that exceed defensive configuration ceilings', async () => {
    const { createSecretScanPolicy } = await import('../../src/core/security/policy')
    expect(() => createSecretScanPolicy({ maxCandidateLength: 1_000_000 })).toThrow(/limite massimo/u)
    expect(() => createSecretScanPolicy({ maxFindingsPerFile: 10_000 })).toThrow(/limite massimo/u)
    expect(() => createSecretScanPolicy({ maxCharactersPerFile: 100_000_000 })).toThrow(/limite massimo/u)
  })

})
