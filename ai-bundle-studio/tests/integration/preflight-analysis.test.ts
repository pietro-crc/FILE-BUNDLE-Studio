import { analyzeVirtualFileSystem } from '../../src/core/preflight/analyze'
import { createVirtualFileSystemFromFiles, createVirtualFileSystemFromPreparedFiles } from '../../src/core/vfs/import'
import type { ByteSource, VirtualFile } from '../../src/core/vfs/types'

function preparedFile(bytes: ByteSource): VirtualFile {
  return {
    id: 'prepared:bounded',
    path: 'bounded.bin',
    normalizedPath: 'bounded.bin',
    name: 'bounded.bin',
    extension: 'bin',
    kind: 'file',
    size: bytes.size,
    source: 'file-picker',
    status: 'pending',
    warnings: [],
    errors: [],
    bytes,
  }
}

describe('preflight analysis', () => {
  it('classifies a mixed project, assigns capabilities, risks and estimates', async () => {
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37])
    const result = createVirtualFileSystemFromFiles([
      { file: new File(['# hello'], 'README.md', { type: 'text/markdown' }), path: 'README.md', source: 'file-picker' },
      { file: new File(['TOKEN=fake'], '.env', { type: 'text/plain' }), path: '.env', source: 'file-picker' },
      { file: new File([pdf], 'renamed.txt', { type: 'text/plain' }), path: 'renamed.txt', source: 'file-picker' },
      { file: new File([new Uint8Array([0x4d, 0x5a, 0, 0])], 'program.txt'), path: 'program.txt', source: 'file-picker' },
    ])

    const progress: number[] = []
    const report = await analyzeVirtualFileSystem(result.fileSystem, { onProgress: ({ completed }) => progress.push(completed) })

    expect(report.files).toHaveLength(4)
    expect(report.files.find(({ path }) => path === 'README.md')).toMatchObject({ capabilityLevel: 'A', mimeDetected: 'text/markdown' })
    expect(report.files.find(({ path }) => path === '.env')).toMatchObject({ riskLevel: 'high' })
    expect(report.files.find(({ path }) => path === 'renamed.txt')).toMatchObject({ mimeDetected: 'application/pdf', detectionMethod: 'signature' })
    expect(report.files.find(({ path }) => path === 'program.txt')).toMatchObject({ capabilityLevel: 'E', defaultIncluded: false })
    expect(report.totals.fileCount).toBe(4)
    expect(report.totals.markdown.maxBytes).toBeGreaterThan(0)
    expect(progress.at(-1)).toBe(4)

    result.fileSystem.dispose()
  })

  it('uses only the bounded prefix contract during preflight', async () => {
    const read = vi.fn(async () => { throw new Error('full read must not run') })
    const readPrefix = vi.fn(async (maxBytes: number) => new TextEncoder().encode('hello').slice(0, maxBytes).buffer)
    const source: ByteSource = { size: 10_000_000, read, readPrefix, dispose() {} }
    const result = createVirtualFileSystemFromPreparedFiles([preparedFile(source)], [], 'file-picker')

    const report = await analyzeVirtualFileSystem(result.fileSystem)

    expect(report.files[0]).toMatchObject({ isText: true, capabilityLevel: 'B' })
    expect(read).not.toHaveBeenCalled()
    expect(readPrefix).toHaveBeenCalledWith(16 * 1024, undefined)
  })

  it('supports cancellation without converting it into a per-file warning', async () => {
    const controller = new AbortController()
    controller.abort('stop')
    const result = createVirtualFileSystemFromFiles([
      { file: new File(['hello'], 'hello.txt'), path: 'hello.txt', source: 'file-picker' },
    ])

    await expect(analyzeVirtualFileSystem(result.fileSystem, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
    result.fileSystem.dispose()
  })
})
