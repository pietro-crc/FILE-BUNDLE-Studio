import { strFromU8, strToU8, zipSync } from 'fflate'
import { importZipFile } from '../../src/core/vfs/zip'

function asZipFile(bytes: Uint8Array, name = 'project.zip'): File {
  return new File([bytes.slice().buffer as ArrayBuffer], name, { type: 'application/zip', lastModified: 100 })
}

function markFirstEntryEncrypted(bytes: Uint8Array): Uint8Array {
  const copy = bytes.slice()
  const view = new DataView(copy.buffer)
  view.setUint16(6, view.getUint16(6, true) | 1, true)

  for (let offset = 0; offset <= copy.length - 4; offset += 1) {
    if (view.getUint32(offset, true) === 0x02014b50) {
      view.setUint16(offset + 8, view.getUint16(offset + 8, true) | 1, true)
      return copy
    }
  }
  throw new Error('Central directory not found')
}


function corruptFirstLocalName(bytes: Uint8Array): Uint8Array {
  const copy = bytes.slice()
  const view = new DataView(copy.buffer)
  if (view.getUint32(0, true) !== 0x04034b50) {
    throw new Error('Local header not found')
  }
  const nameLength = view.getUint16(26, true)
  if (nameLength === 0) {
    throw new Error('Local filename not found')
  }
  copy[30] = (copy[30] ?? 0) ^ 1
  return copy
}


describe('ZIP import', () => {
  it('inventories safe entries, rejects traversal, and reads entry bytes lazily', async () => {
    const archive = zipSync({
      'safe/readme.md': strToU8('hello zip'),
      '../secret.txt': strToU8('blocked'),
    })
    const result = await importZipFile(asZipFile(archive))

    expect(result.fileSystem.files.map((file) => file.normalizedPath)).toEqual(['safe/readme.md'])
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'path-traversal', path: '../secret.txt' }))

    const bytes = await result.fileSystem.files[0]?.bytes.read()
    expect(bytes && strFromU8(new Uint8Array(bytes))).toBe('hello zip')
    const prefix = await result.fileSystem.files[0]?.bytes.readPrefix(5)
    expect(prefix && strFromU8(new Uint8Array(prefix))).toBe('hello')
    expect(result.fileSystem.summary.sourceBytes).toBe(archive.byteLength)
  })


  it('preserves explicit empty directory entries in the virtual tree', async () => {
    const archive = zipSync({
      'empty/': new Uint8Array(),
      'src/readme.md': strToU8('content'),
    })
    const result = await importZipFile(asZipFile(archive))

    expect(result.issues).toEqual([])
    expect(result.fileSystem.summary.directoryCount).toBe(2)
    expect(result.fileSystem.directories.map((directory) => directory.normalizedPath)).toEqual([
      '',
      'empty',
      'src',
    ])
  })

  it('blocks encrypted entries without attempting a password bypass', async () => {
    const archive = markFirstEntryEncrypted(zipSync({ 'private.txt': strToU8('content') }))
    const result = await importZipFile(asZipFile(archive))

    expect(result.fileSystem.files).toHaveLength(0)
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'archive-encrypted', path: 'private.txt' }))
  })


  it('rejects inconsistent central and local entry names', async () => {
    const archive = corruptFirstLocalName(zipSync({ 'safe.txt': strToU8('content') }))
    const result = await importZipFile(asZipFile(archive))

    expect(result.fileSystem.files).toHaveLength(0)
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'archive-invalid', message: expect.stringMatching(/incoerente/) }),
    )
  })


  it('applies count, entry-size, cumulative-size, and compression-ratio limits', async () => {
    const archive = zipSync({
      'large.txt': strToU8('A'.repeat(20_000)),
      'second.txt': strToU8('small'),
    })
    const result = await importZipFile(asZipFile(archive), {
      limits: {
        maxArchiveBytes: 1_000_000,
        maxEntries: 10,
        maxEntryBytes: 30_000,
        maxTotalUncompressedBytes: 30_000,
        maxCompressionRatio: 2,
      },
    })

    expect(result.fileSystem.files.map((file) => file.name)).toEqual(['second.txt'])
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'archive-limit', path: 'large.txt' }))
  })

  it('rejects an archive before inventory when compressed size or entry count exceeds policy', async () => {
    const archive = asZipFile(zipSync({ 'a.txt': strToU8('a'), 'b.txt': strToU8('b') }))

    const compressedLimit = await importZipFile(archive, {
      limits: {
        maxArchiveBytes: 1,
        maxEntries: 10,
        maxEntryBytes: 100,
        maxTotalUncompressedBytes: 100,
        maxCompressionRatio: 100,
      },
    })
    expect(compressedLimit.issues).toContainEqual(expect.objectContaining({ code: 'archive-limit' }))

    const countLimit = await importZipFile(archive, {
      limits: {
        maxArchiveBytes: 10_000,
        maxEntries: 1,
        maxEntryBytes: 100,
        maxTotalUncompressedBytes: 100,
        maxCompressionRatio: 100,
      },
    })
    expect(countLimit.fileSystem.files).toHaveLength(0)
    expect(countLimit.issues[0]?.message).toMatch(/2 entry/)
  })
})
