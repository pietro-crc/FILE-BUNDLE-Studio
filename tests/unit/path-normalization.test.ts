import { normalizeVirtualPath, PathValidationError } from '../../src/core/vfs/path'

describe('virtual path normalization', () => {
  it('normalizes separators, dot segments, Unicode, and extensions deterministically', () => {
    const decomposed = 'cafe\u0301'
    const result = normalizeVirtualPath(`./src\\${decomposed}/config.JSON`)

    expect(result.normalizedPath).toBe('src/café/config.JSON')
    expect(result.name).toBe('config.JSON')
    expect(result.extension).toBe('json')
    expect(result.depth).toBe(3)
  })

  it.each([
    ['../secret.txt', 'path-traversal'],
    ['safe/../../secret.txt', 'path-traversal'],
    ['/etc/passwd', 'path-absolute'],
    ['C:\\Windows\\system.ini', 'path-absolute'],
    ['\\\\server\\share\\file.txt', 'path-absolute'],
    ['safe/evil\u0000.txt', 'path-control-character'],
  ])('rejects unsafe path %s', (path, code) => {
    expect(() => normalizeVirtualPath(path)).toThrowError(PathValidationError)

    try {
      normalizeVirtualPath(path)
    } catch (error) {
      expect(error).toMatchObject({ code })
    }
  })

  it('enforces configurable depth and path length limits', () => {
    expect(() => normalizeVirtualPath('a/b/c.txt', { maxDepth: 2, maxLength: 100 })).toThrowError(
      expect.objectContaining({ code: 'path-depth' }),
    )
    expect(() => normalizeVirtualPath('folder/long-name.txt', { maxDepth: 10, maxLength: 8 })).toThrowError(
      expect.objectContaining({ code: 'path-length' }),
    )
  })
})
