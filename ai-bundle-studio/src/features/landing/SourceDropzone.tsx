import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { ArchiveIcon, FilesIcon, FolderIcon } from '../../ui/icons'
import { Button } from '../../ui/Button'
import {
  candidatesFromDataTransfer,
  candidatesFromDirectoryPicker,
  candidatesFromFileList,
  isSingleZipSelection,
  supportsDirectoryPicker,
  type AcquisitionSelection,
} from '../import/acquisition'
import { importZipFile } from '../../core/vfs/zip'
import { createVirtualFileSystemFromFiles } from '../../core/vfs/import'
import type { ImportResult } from '../../core/vfs/types'

interface SourceDropzoneProps {
  readonly isBusy: boolean
  readonly onImport: (result: ImportResult, label: string) => void
  readonly onError: (message: string) => void
}

export function SourceDropzone({ isBusy, onImport, onError }: SourceDropzoneProps) {
  const zipInput = useRef<HTMLInputElement>(null)
  const filesInput = useRef<HTMLInputElement>(null)
  const directoryInput = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    directoryInput.current?.setAttribute('webkitdirectory', '')
    directoryInput.current?.setAttribute('directory', '')
  }, [])

  const executeImport = async (operation: () => Promise<ImportResult>, label: string) => {
    try {
      const result = await operation()
      onImport(result, label)
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Acquisition failed.')
    }
  }

  const importSelection = async (selection: AcquisitionSelection, label: string): Promise<void> => {
    if (isSingleZipSelection(selection)) {
      const zip = selection.files[0]?.file
      if (zip) {
        await executeImport(() => importZipFile(zip), label)
      }
      return
    }
    await executeImport(
      () => Promise.resolve(createVirtualFileSystemFromFiles(selection.files, { directories: selection.directories })),
      label,
    )
  }

  const handleZipSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    await executeImport(() => importZipFile(file), 'ZIP Archive')
  }

  const handleFileSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return
    const candidates = candidatesFromFileList(files, 'file-picker')
    event.target.value = ''
    await importSelection({ files: candidates, directories: [] }, 'Multiple files')
  }

  const handleDirectorySelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return
    const candidates = candidatesFromFileList(files, 'directory-picker')
    event.target.value = ''
    await importSelection({ files: candidates, directories: [] }, 'Local folder')
  }

  const chooseDirectory = async () => {
    if (!supportsDirectoryPicker()) {
      directoryInput.current?.click()
      return
    }
    await executeImport(async () => {
      const selection = await candidatesFromDirectoryPicker()
      return createVirtualFileSystemFromFiles(selection.files, { directories: selection.directories })
    }, 'Local folder')
  }

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    await executeImport(async () => {
      const selection = await candidatesFromDataTransfer(event.dataTransfer)
      if (isSingleZipSelection(selection)) {
        const zip = selection.files[0]?.file
        if (!zip) throw new Error('Invalid or unreadable ZIP archive.')
        return importZipFile(zip)
      }
      return createVirtualFileSystemFromFiles(selection.files, { directories: selection.directories })
    }, 'Drag & Drop')
  }

  return (
    <div className="source-dropzone-container">
      <div
        aria-label="Drag and drop area for files or folders"
        className={`dropzone-canvas ${isDragging ? 'dropzone-canvas--active' : ''}`}
        onDragEnter={(event) => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={(event) => {
          if (event.currentTarget === event.target) {
            setIsDragging(false)
          }
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => void handleDrop(event)}
        role="region"
        tabIndex={0}
      >
        <div className="dropzone-format-tags" aria-hidden="true">
          <span className="format-tag">.ZIP</span>
          <span className="format-tag">DIR</span>
          <span className="format-tag">SRC</span>
        </div>

        <div className="dropzone-prompt">
          <h2 className="dropzone-prompt__title">Drag & drop your source</h2>
          <p className="dropzone-prompt__subtitle">
            Drop a ZIP archive, local folder, or selected files. No files leave your browser.
          </p>
        </div>

        <div className="dropzone-triggers">
          <Button disabled={isBusy} onClick={() => zipInput.current?.click()} variant="primary">
            <ArchiveIcon /> <span>Select ZIP</span>
          </Button>
          <Button disabled={isBusy} onClick={() => void chooseDirectory()} variant="secondary">
            <FolderIcon /> <span>Select Folder</span>
          </Button>
          <Button disabled={isBusy} onClick={() => filesInput.current?.click()} variant="secondary">
            <FilesIcon /> <span>Multiple Files</span>
          </Button>
        </div>
      </div>

      <input
        accept=".zip,application/zip,application/x-zip-compressed"
        aria-label="Seleziona archivio ZIP"
        className="visually-hidden"
        onChange={(event) => void handleZipSelection(event)}
        ref={zipInput}
        type="file"
      />
      <input
        aria-label="Seleziona più file"
        className="visually-hidden"
        multiple
        onChange={(event) => void handleFileSelection(event)}
        ref={filesInput}
        type="file"
      />
      <input
        aria-label="Seleziona cartella locale"
        className="visually-hidden"
        multiple
        onChange={(event) => void handleDirectorySelection(event)}
        ref={directoryInput}
        type="file"
      />
    </div>
  )
}
