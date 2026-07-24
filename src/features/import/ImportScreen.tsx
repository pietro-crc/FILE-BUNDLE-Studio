import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { createVirtualFileSystemFromFiles } from '../../core/vfs/import'
import type { ImportResult } from '../../core/vfs/types'
import { importZipFile } from '../../core/vfs/zip'
import type { ImportSessionSnapshot } from '../../core/vfs/snapshot'
import { AvailabilityNotice } from '../../ui/AvailabilityNotice'
import { Button } from '../../ui/Button'
import { SectionIntro } from '../../ui/SectionIntro'
import { ArchiveIcon, FilesIcon, FolderIcon } from '../../ui/icons'
import {
  candidatesFromDataTransfer,
  candidatesFromDirectoryPicker,
  candidatesFromFileList,
  isSingleZipSelection,
  type AcquisitionSelection,
  supportsDirectoryPicker,
} from './acquisition'
import { ImportTree } from './ImportTree'
import type { WorkflowStepId } from '../../app/workflow'

interface ImportScreenProps {
  readonly snapshot: ImportSessionSnapshot | null
  readonly onClear: () => void
  readonly onImport: (result: ImportResult) => void
  readonly onNavigate: (step: WorkflowStepId) => void
}

const SOURCE_LABELS: Record<ImportSessionSnapshot['source'], string> = {
  'file-picker': 'Multiple files',
  'directory-picker': 'Local folder',
  'drag-drop': 'Drag & Drop',
  zip: 'ZIP Archive',
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unitIndex = -1
  do {
    value /= 1024
    unitIndex += 1
  } while (value >= 1024 && unitIndex < units.length - 1)
  return `${value.toLocaleString('en-US', { maximumFractionDigits: value >= 10 ? 1 : 2 })} ${units[unitIndex]}`
}

export function ImportScreen({ onClear, onImport, onNavigate, snapshot }: ImportScreenProps) {
  const zipInput = useRef<HTMLInputElement>(null)
  const filesInput = useRef<HTMLInputElement>(null)
  const directoryInput = useRef<HTMLInputElement>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [statusMessage, setStatusMessage] = useState('Ready to acquire local files.')

  useEffect(() => {
    directoryInput.current?.setAttribute('webkitdirectory', '')
    directoryInput.current?.setAttribute('directory', '')
  }, [])

  const executeImport = async (operation: () => Promise<ImportResult>, label: string) => {
    setIsBusy(true)
    setStatusMessage(`${label}: local acquisition in progress…`)
    try {
      const result = await operation()
      onImport(result)
      setStatusMessage(
        `${label}: ${result.fileSystem.summary.fileCount} files acquired, ${result.issues.length} issues reported.`,
      )
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Acquisition failed.')
    } finally {
      setIsBusy(false)
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
      () => Promise.resolve(
        createVirtualFileSystemFromFiles(selection.files, { directories: selection.directories }),
      ),
      label,
    )
  }

  const handleZipSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }
    await executeImport(() => importZipFile(file), 'ZIP Archive')
  }

  const handleFileSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) {
      return
    }
    const candidates = candidatesFromFileList(files, 'file-picker')
    event.target.value = ''
    await importSelection({ files: candidates, directories: [] }, 'Multiple files')
  }

  const handleDirectorySelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) {
      return
    }
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
        if (!zip) {
          throw new Error('ZIP archive unavailable.')
        }
        return importZipFile(zip)
      }
      return createVirtualFileSystemFromFiles(selection.files, { directories: selection.directories })
    }, 'Drag & Drop')
  }

  return (
    <div className="screen">
      <SectionIntro
        description="Acquire ZIP, folders or multiple files. Paths and limits are verified before entering the virtual filesystem."
        eyebrow="Step 02 · Import"
        title="Bring your project into the browser."
      />

      <AvailabilityNotice active step="STEP-002">
        Bytes remain lazy and are not stored in React state. A new import replaces the current project.
      </AvailabilityNotice>

      <section className="import-grid" aria-label="Available import methods" aria-busy={isBusy}>
        <article className="import-card">
          <div className="import-card__icon" aria-hidden="true"><ArchiveIcon /></div>
          <h2>ZIP Archive</h2>
          <p>Inventories the archive, blocks traversal, encryption, and abnormal limits before exposing entries.</p>
          <Button disabled={isBusy} onClick={() => zipInput.current?.click()} variant="secondary">Select ZIP</Button>
        </article>
        <article className="import-card">
          <div className="import-card__icon" aria-hidden="true"><FolderIcon /></div>
          <h2>Local folder</h2>
          <p>Uses File System Access API when available, falling back to directory selection.</p>
          <Button disabled={isBusy} onClick={() => void chooseDirectory()} variant="secondary">Choose folder</Button>
        </article>
        <article className="import-card">
          <div className="import-card__icon" aria-hidden="true"><FilesIcon /></div>
          <h2>Multiple files</h2>
          <p>Combines multiple files in a single selection while preserving browser relative paths.</p>
          <Button disabled={isBusy} onClick={() => filesInput.current?.click()} variant="secondary">Add files</Button>
        </article>
      </section>

      <input
        accept=".zip,application/zip,application/x-zip-compressed"
        aria-label="Select ZIP archive"
        className="visually-hidden"
        onChange={(event) => void handleZipSelection(event)}
        ref={zipInput}
        type="file"
      />
      <input
        aria-label="Select multiple files"
        className="visually-hidden"
        multiple
        onChange={(event) => void handleFileSelection(event)}
        ref={filesInput}
        type="file"
      />
      <input
        aria-label="Select local folder"
        className="visually-hidden"
        multiple
        onChange={(event) => void handleDirectorySelection(event)}
        ref={directoryInput}
        type="file"
      />

      <div
        className={`dropzone ${isDragging ? 'dropzone--active' : ''}`}
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
        aria-label="File drop area"
      >
        <div className="dropzone__icon" aria-hidden="true"><ArchiveIcon /></div>
        <h2>Drag & drop your project here</h2>
        <p>A single ZIP is unpacked; folders and multiple selections become virtual filesystem nodes.</p>
      </div>

      <p className="import-status" role="status" aria-live="polite">{statusMessage}</p>

      {snapshot ? (
        <div className="import-session">
          <section className="import-summary" aria-label="Acquisition summary">
            <div><span>Source</span><strong>{SOURCE_LABELS[snapshot.source]}</strong></div>
            <div><span>Valid files</span><strong>{snapshot.fileCount}</strong></div>
            <div><span>Folders</span><strong>{snapshot.directoryCount}</strong></div>
            <div><span>Logical size</span><strong>{formatBytes(snapshot.totalBytes)}</strong></div>
          </section>

          {snapshot.issues.length > 0 ? (
            <section className="import-issues" aria-labelledby="import-issues-title">
              <div className="import-issues__header">
                <div>
                  <p className="eyebrow">Defensive checks</p>
                  <h2 id="import-issues-title">{snapshot.issues.length} issues reported</h2>
                </div>
                <div className="import-session__buttons">
                  <Button onClick={() => onNavigate('preflight')}>Analyze project</Button>
                  <Button onClick={onClear} variant="ghost">Remove project</Button>
                </div>
              </div>
              <ul>
                {snapshot.issues.slice(0, 20).map((issue, index) => (
                  <li key={`${issue.code}-${issue.path ?? index}`}>
                    <strong>{issue.code}</strong>
                    <span>{issue.path ? `${issue.path} — ` : ''}{issue.message}</span>
                  </li>
                ))}
              </ul>
              {snapshot.issues.length > 20 ? <p>Showing first 20 issues.</p> : null}
            </section>
          ) : (
            <div className="import-session__actions">
              <p>No structural anomalies detected during acquisition.</p>
              <div className="import-session__buttons">
                <Button onClick={() => onNavigate('preflight')}>Analyze project</Button>
                <Button onClick={onClear} variant="ghost">Remove project</Button>
              </div>
            </div>
          )}

          <ImportTree root={snapshot.root} />
        </div>
      ) : null}
    </div>
  )
}
