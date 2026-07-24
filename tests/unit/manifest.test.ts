import schema from '../../src/schemas/manifest-v1.schema.json'
import { sha256Hex } from '../../src/core/hash/sha256'
import { createManifestV1 } from '../../src/core/manifest/generate'
import { createManifestNodeId } from '../../src/core/manifest/ids'
import { serializeManifestV1 } from '../../src/core/manifest/serialize'
import { MANIFEST_SCHEMA_VERSION } from '../../src/core/manifest/types'
import { validateManifestV1 } from '../../src/core/manifest/validate'
import { analyzeVirtualFileSystem } from '../../src/core/preflight/analyze'
import type { PreflightSelection } from '../../src/core/preflight/types'
import { createVirtualFileSystemFromFiles } from '../../src/core/vfs/import'

const GENERATED_AT = '2026-07-20T12:00:00.000Z'

function fixtureCandidates(reverse = false) {
  const candidates = [
    {
      file: new File(['# Project'], 'README.md', { type: 'text/markdown', lastModified: 1000 }),
      path: 'README.md',
      source: 'directory-picker' as const,
    },
    {
      file: new File(['debug'], 'debug.log', { type: 'text/plain', lastModified: 2000 }),
      path: 'dist/debug.log',
      source: 'directory-picker' as const,
    },
    {
      file: new File(['notes'], 'notes.txt', { type: 'text/plain', lastModified: 3000 }),
      path: 'docs/notes.txt',
      source: 'directory-picker' as const,
    },
    {
      file: new File([new Uint8Array([0x4d, 0x5a, 0, 0])], 'program.bin', { lastModified: 4000 }),
      path: 'bin/program.bin',
      source: 'directory-picker' as const,
    },
  ]
  return reverse ? candidates.toReversed() : candidates
}

async function buildFixture(reverse = false) {
  const result = createVirtualFileSystemFromFiles(fixtureCandidates(reverse), {
    directories: [{ path: 'empty', source: 'directory-picker' }],
    source: 'directory-picker',
  })
  const report = await analyzeVirtualFileSystem(result.fileSystem)
  const notes = report.files.find(({ path }) => path === 'docs/notes.txt')
  if (!notes) throw new Error('Fixture notes missing')
  const selection: PreflightSelection = {
    excludedFileIds: new Set([notes.fileId]),
    exclusionGlobs: ['dist/**'],
  }
  const artifact = await createManifestV1(result.fileSystem, report, selection, {
    generatedAt: GENERATED_AT,
    projectName: 'Demo / Project',
  })
  return { result, report, artifact }
}

describe('manifest v1', () => {
  it('matches standard SHA-256 vectors without requiring a secure browser context', async () => {
    await expect(sha256Hex('')).resolves.toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    await expect(sha256Hex('abc')).resolves.toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('derives stable SHA-256 node identifiers from kind and normalized path', async () => {
    await expect(createManifestNodeId('file', 'docs/readme.md')).resolves.toMatch(/^file_[a-f0-9]{64}$/u)
    expect(await createManifestNodeId('file', 'docs/readme.md')).toBe(await createManifestNodeId('file', 'docs/readme.md'))
    expect(await createManifestNodeId('file', 'docs/readme.md')).not.toBe(await createManifestNodeId('directory', 'docs/readme.md'))
  })

  it('generates a valid manifest with explicit exclusion reasons and pending hashes', async () => {
    const { result, artifact } = await buildFixture()

    expect(artifact.validation).toEqual({ valid: true, errors: [] })
    expect(artifact.manifest.schemaVersion).toBe(MANIFEST_SCHEMA_VERSION)
    expect(artifact.manifest.projectName).toBe('Demo - Project')
    expect(artifact.manifest.summary).toMatchObject({
      fileCount: 4,
      directoryCount: 4,
      includedFileCount: 1,
      excludedFileCount: 3,
      blockedFileCount: 1,
    })
    expect(artifact.manifest.files.find(({ normalizedPath }) => normalizedPath === 'README.md')?.inclusion).toEqual({
      included: true,
      reason: 'selected',
      matchedGlob: null,
    })
    expect(artifact.manifest.files.find(({ normalizedPath }) => normalizedPath === 'dist/debug.log')?.inclusion).toEqual({
      included: false,
      reason: 'excluded-glob',
      matchedGlob: 'dist/**',
    })
    expect(artifact.manifest.files.find(({ normalizedPath }) => normalizedPath === 'docs/notes.txt')?.inclusion.reason).toBe('excluded-manual')
    expect(artifact.manifest.files.find(({ normalizedPath }) => normalizedPath === 'bin/program.bin')?.inclusion.reason).toBe('blocked-capability')
    expect(artifact.manifest.files.every(({ integrity }) => integrity.status === 'pending' && integrity.value === null)).toBe(true)
    expect(artifact.byteLength).toBe(new TextEncoder().encode(artifact.json).byteLength)

    result.fileSystem.dispose()
  })

  it('serializes equivalent projects identically despite acquisition order and session IDs', async () => {
    const first = await buildFixture(false)
    const second = await buildFixture(true)

    expect(first.artifact.json).toBe(second.artifact.json)
    expect(first.artifact.manifest.files.map(({ fileId }) => fileId)).toEqual(second.artifact.manifest.files.map(({ fileId }) => fileId))
    expect(serializeManifestV1(first.artifact.manifest)).toBe(first.artifact.json)

    first.result.fileSystem.dispose()
    second.result.fileSystem.dispose()
  })

  it('detects broken counts, references, inclusion and integrity state', async () => {
    const { result, artifact } = await buildFixture()
    const malformed = structuredClone(artifact.manifest) as unknown as Record<string, unknown>
    const summary = malformed.summary as Record<string, unknown>
    summary.fileCount = 99
    const files = malformed.files as Record<string, unknown>[]
    const firstFile = files[0]
    if (!firstFile) throw new Error('Fixture file missing')
    firstFile.parentDirectoryId = 'dir_'.padEnd(68, '0')
    firstFile.integrity = { algorithm: 'SHA-256', status: 'computed', value: 'bad', error: null }
    firstFile.inclusion = { included: true, reason: 'excluded-manual', matchedGlob: null }

    const validation = validateManifestV1(malformed)
    expect(validation.valid).toBe(false)
    expect(validation.errors.map(({ code }) => code)).toEqual(expect.arrayContaining([
      'summary-consistency',
      'file-parent',
      'integrity-computed',
      'inclusion-consistency',
    ]))

    result.fileSystem.dispose()
  })

  it('keeps the JSON schema and the generated golden artifact version-aligned', async () => {
    const { result, artifact } = await buildFixture()

    expect(schema.properties.schemaVersion.const).toBe(MANIFEST_SCHEMA_VERSION)
    expect(schema.properties.mediaType.const).toBe(artifact.manifest.mediaType)
    expect(artifact.json).toMatchSnapshot()

    result.fileSystem.dispose()
  })
})
