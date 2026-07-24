import { createVirtualFileSystemFromFiles } from '../../src/core/vfs/import'
import { createImportSessionSnapshot } from '../../src/core/vfs/snapshot'

describe('virtual filesystem', () => {
  it('builds a sorted tree while keeping bytes behind lazy sources', async () => {
    const readme = new File(['hello'], 'README.md', { type: 'text/markdown', lastModified: 10 })
    const config = new File(['{}'], 'config.json', { type: 'application/json', lastModified: 20 })
    const result = createVirtualFileSystemFromFiles([
      { file: config, path: 'src/config.json', source: 'directory-picker' },
      { file: readme, path: 'README.md', source: 'directory-picker' },
    ])

    expect(result.issues).toEqual([])
    expect(result.fileSystem.summary).toEqual({
      fileCount: 2,
      directoryCount: 1,
      totalBytes: 7,
      sourceBytes: 7,
      source: 'directory-picker',
    })
    expect(result.fileSystem.root.children.map((node) => node.name)).toEqual(['src', 'README.md'])
    expect(new TextDecoder().decode(await result.fileSystem.files[0]?.bytes.read())).toBe('{}')

    const snapshot = createImportSessionSnapshot(result.fileSystem, result.issues)
    expect(JSON.stringify(snapshot)).not.toContain('bytes')

    result.fileSystem.dispose()
    await expect(result.fileSystem.files[0]?.bytes.read()).rejects.toThrow('rilasciata')
  })


  it('preserves explicit empty directories exposed by capable acquisition APIs', () => {
    const result = createVirtualFileSystemFromFiles([], {
      directories: [
        { path: 'project', source: 'directory-picker' },
        { path: 'project/empty', source: 'directory-picker' },
      ],
      source: 'directory-picker',
    })

    expect(result.issues).toEqual([])
    expect(result.fileSystem.summary).toEqual({
      fileCount: 0,
      directoryCount: 2,
      totalBytes: 0,
      sourceBytes: 0,
      source: 'directory-picker',
    })
    expect(result.fileSystem.directories.map((directory) => directory.normalizedPath)).toEqual([
      '',
      'project',
      'project/empty',
    ])
  })

  it('reports duplicate normalized paths without overwriting the first file', () => {
    const first = new File(['first'], 'first.txt')
    const duplicate = new File(['second'], 'second.txt')
    const result = createVirtualFileSystemFromFiles([
      { file: first, path: 'folder/item.txt', source: 'file-picker' },
      { file: duplicate, path: 'folder\\item.txt', source: 'file-picker' },
    ])

    expect(result.fileSystem.files).toHaveLength(1)
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'duplicate-path' }))
  })


  it('rejects file-directory hierarchy conflicts instead of overwriting nodes', () => {
    const parentFile = new File(['parent'], 'a')
    const childFile = new File(['child'], 'child.txt')
    const result = createVirtualFileSystemFromFiles([
      { file: parentFile, path: 'a', source: 'file-picker' },
      { file: childFile, path: 'a/child.txt', source: 'file-picker' },
    ])

    expect(result.fileSystem.files.map((file) => file.normalizedPath)).toEqual(['a'])
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'path-conflict', path: 'a/child.txt' }))
  })


  it('honors an already-aborted read request', async () => {
    const file = new File(['secret'], 'secret.txt')
    const result = createVirtualFileSystemFromFiles([{ file, path: file.name, source: 'file-picker' }])
    const controller = new AbortController()
    controller.abort('test')

    await expect(result.fileSystem.files[0]?.bytes.read(controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  })
})
