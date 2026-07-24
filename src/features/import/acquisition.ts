import type { DirectoryCandidate, FileCandidate } from '../../core/vfs/import'

interface BrowserFileHandle {
  readonly kind: 'file'
  readonly name: string
  getFile(): Promise<File>
}

interface BrowserDirectoryHandle {
  readonly kind: 'directory'
  readonly name: string
  values(): AsyncIterable<BrowserDirectoryHandle | BrowserFileHandle>
}

interface DirectoryPickerWindow extends Window {
  showDirectoryPicker?: () => Promise<BrowserDirectoryHandle>
}

export interface AcquisitionSelection {
  readonly files: readonly FileCandidate[]
  readonly directories: readonly DirectoryCandidate[]
}

function relativePathForFile(file: File): string {
  return file.webkitRelativePath || file.name
}

export function candidatesFromFileList(
  files: FileList | readonly File[],
  source: FileCandidate['source'],
): readonly FileCandidate[] {
  return Array.from(files, (file) => ({ file, path: relativePathForFile(file), source }))
}

function readLegacyFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise<File>((resolve, reject) => entry.file(resolve, reject))
}

function readLegacyDirectoryBatch(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject))
}

async function collectLegacyEntry(
  entry: FileSystemEntry,
  parentPath: string,
  files: FileCandidate[],
  directories: DirectoryCandidate[],
): Promise<void> {
  const path = parentPath.length === 0 ? entry.name : `${parentPath}/${entry.name}`

  if (entry.isFile) {
    const file = await readLegacyFile(entry as FileSystemFileEntry)
    files.push({ file, path, source: 'drag-drop' })
    return
  }

  if (!entry.isDirectory) {
    return
  }

  directories.push({ path, source: 'drag-drop' })
  const reader = (entry as FileSystemDirectoryEntry).createReader()
  while (true) {
    // eslint-disable-next-line no-await-in-loop -- The legacy API exposes directory batches sequentially.
    const entries = await readLegacyDirectoryBatch(reader)
    if (entries.length === 0) {
      break
    }
    for (const child of entries) {
      // eslint-disable-next-line no-await-in-loop -- Preserve deterministic browser directory order.
      await collectLegacyEntry(child, path, files, directories)
    }
  }
}

export async function candidatesFromDataTransfer(dataTransfer: DataTransfer): Promise<AcquisitionSelection> {
  const files: FileCandidate[] = []
  const directories: DirectoryCandidate[] = []
  const entries = Array.from(dataTransfer.items)
    .map((item) => item.webkitGetAsEntry?.() ?? null)
    .filter((entry): entry is FileSystemEntry => entry !== null)

  if (entries.length > 0) {
    for (const entry of entries) {
      // eslint-disable-next-line no-await-in-loop -- Preserve deterministic drop order.
      await collectLegacyEntry(entry, '', files, directories)
    }
    return { files, directories }
  }

  return { files: candidatesFromFileList(dataTransfer.files, 'drag-drop'), directories }
}

export function supportsDirectoryPicker(): boolean {
  return typeof (window as DirectoryPickerWindow).showDirectoryPicker === 'function'
}

async function collectDirectoryHandle(
  handle: BrowserDirectoryHandle,
  parentPath: string,
  files: FileCandidate[],
  directories: DirectoryCandidate[],
): Promise<void> {
  const directoryPath = parentPath.length === 0 ? handle.name : `${parentPath}/${handle.name}`
  directories.push({ path: directoryPath, source: 'directory-picker' })

  for await (const child of handle.values()) {
    if (child.kind === 'file') {
      files.push({ file: await child.getFile(), path: `${directoryPath}/${child.name}`, source: 'directory-picker' })
    } else {
      await collectDirectoryHandle(child, directoryPath, files, directories)
    }
  }
}

export async function candidatesFromDirectoryPicker(): Promise<AcquisitionSelection> {
  const picker = (window as DirectoryPickerWindow).showDirectoryPicker
  if (!picker) {
    throw new Error('File System Access API non disponibile.')
  }

  const rootHandle = await picker()
  const files: FileCandidate[] = []
  const directories: DirectoryCandidate[] = []
  await collectDirectoryHandle(rootHandle, '', files, directories)
  return { files, directories }
}

export function isSingleZipSelection(selection: AcquisitionSelection): boolean {
  return selection.directories.length === 0 &&
    selection.files.length === 1 &&
    selection.files[0]?.file.name.toLowerCase().endsWith('.zip') === true
}
