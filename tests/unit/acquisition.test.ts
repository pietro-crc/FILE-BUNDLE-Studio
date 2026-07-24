import {
  candidatesFromDataTransfer,
  candidatesFromDirectoryPicker,
  candidatesFromFileList,
  isSingleZipSelection,
  supportsDirectoryPicker,
} from '../../src/features/import/acquisition'

describe('browser acquisition adapters', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, 'showDirectoryPicker')
  })

  it('preserves webkitRelativePath for directory-input fallback files', () => {
    const file = new File(['content'], 'readme.md')
    Object.defineProperty(file, 'webkitRelativePath', { configurable: true, value: 'project/docs/readme.md' })

    expect(candidatesFromFileList([file], 'directory-picker')).toEqual([
      { file, path: 'project/docs/readme.md', source: 'directory-picker' },
    ])
  })

  it('walks File System Access directory handles and preserves empty directories', async () => {
    const nestedFile = new File(['{}'], 'config.json')
    const root = {
      kind: 'directory' as const,
      name: 'project',
      async *values() {
        yield {
          kind: 'directory' as const,
          name: 'empty',
          async *values() {},
        }
        yield {
          kind: 'directory' as const,
          name: 'src',
          async *values() {
            yield {
              kind: 'file' as const,
              name: 'config.json',
              async getFile() {
                return nestedFile
              },
            }
          },
        }
      },
    }
    Object.defineProperty(window, 'showDirectoryPicker', { configurable: true, value: async () => root })

    expect(supportsDirectoryPicker()).toBe(true)
    expect(await candidatesFromDirectoryPicker()).toEqual({
      directories: [
        { path: 'project', source: 'directory-picker' },
        { path: 'project/empty', source: 'directory-picker' },
        { path: 'project/src', source: 'directory-picker' },
      ],
      files: [
        { file: nestedFile, path: 'project/src/config.json', source: 'directory-picker' },
      ],
    })
  })


  it('preserves an empty directory from the legacy drag-and-drop entry API', async () => {
    const emptyDirectory = {
      isDirectory: true,
      isFile: false,
      name: 'empty',
      createReader() {
        return {
          readEntries(success: (entries: FileSystemEntry[]) => void) {
            success([])
          },
        }
      },
    }
    const dataTransfer = {
      files: [],
      items: [{ webkitGetAsEntry: () => emptyDirectory }],
    } as unknown as DataTransfer

    expect(await candidatesFromDataTransfer(dataTransfer)).toEqual({
      directories: [{ path: 'empty', source: 'drag-drop' }],
      files: [],
    })
  })

  it('recognizes only a single ZIP without directory entries as an archive acquisition', () => {
    const zip = new File(['zip'], 'project.ZIP')
    const text = new File(['text'], 'notes.txt')

    expect(isSingleZipSelection({ files: candidatesFromFileList([zip], 'drag-drop'), directories: [] })).toBe(true)
    expect(isSingleZipSelection({ files: candidatesFromFileList([zip, text], 'drag-drop'), directories: [] })).toBe(false)
    expect(
      isSingleZipSelection({
        files: candidatesFromFileList([zip], 'drag-drop'),
        directories: [{ path: 'folder', source: 'drag-drop' }],
      }),
    ).toBe(false)
  })
})
