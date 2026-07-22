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
  'file-picker': 'File multipli',
  'directory-picker': 'Cartella locale',
  'drag-drop': 'Trascinamento',
  zip: 'Archivio ZIP',
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
  return `${value.toLocaleString('it-IT', { maximumFractionDigits: value >= 10 ? 1 : 2 })} ${units[unitIndex]}`
}

export function ImportScreen({ onClear, onImport, onNavigate, snapshot }: ImportScreenProps) {
  const zipInput = useRef<HTMLInputElement>(null)
  const filesInput = useRef<HTMLInputElement>(null)
  const directoryInput = useRef<HTMLInputElement>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [statusMessage, setStatusMessage] = useState('Pronto per acquisire file locali.')

  useEffect(() => {
    directoryInput.current?.setAttribute('webkitdirectory', '')
    directoryInput.current?.setAttribute('directory', '')
  }, [])

  const executeImport = async (operation: () => Promise<ImportResult>, label: string) => {
    setIsBusy(true)
    setStatusMessage(`${label}: acquisizione locale in corso…`)
    try {
      const result = await operation()
      onImport(result)
      setStatusMessage(
        `${label}: ${result.fileSystem.summary.fileCount} file acquisiti, ${result.issues.length} segnalazioni.`,
      )
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Acquisizione non riuscita.')
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
    await executeImport(() => importZipFile(file), 'Archivio ZIP')
  }

  const handleFileSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) {
      return
    }
    const candidates = candidatesFromFileList(files, 'file-picker')
    event.target.value = ''
    await importSelection({ files: candidates, directories: [] }, 'File multipli')
  }

  const handleDirectorySelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) {
      return
    }
    const candidates = candidatesFromFileList(files, 'directory-picker')
    event.target.value = ''
    await importSelection({ files: candidates, directories: [] }, 'Cartella locale')
  }

  const chooseDirectory = async () => {
    if (!supportsDirectoryPicker()) {
      directoryInput.current?.click()
      return
    }
    await executeImport(async () => {
      const selection = await candidatesFromDirectoryPicker()
      return createVirtualFileSystemFromFiles(selection.files, { directories: selection.directories })
    }, 'Cartella locale')
  }

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    await executeImport(async () => {
      const selection = await candidatesFromDataTransfer(event.dataTransfer)
      if (isSingleZipSelection(selection)) {
        const zip = selection.files[0]?.file
        if (!zip) {
          throw new Error('Archivio ZIP non disponibile.')
        }
        return importZipFile(zip)
      }
      return createVirtualFileSystemFromFiles(selection.files, { directories: selection.directories })
    }, 'Trascinamento')
  }

  return (
    <div className="screen">
      <SectionIntro
        description="Acquisisci ZIP, cartelle o più file. Percorsi e limiti vengono verificati prima che il progetto entri nel filesystem virtuale."
        eyebrow="Fase 02 · Importazione"
        title="Porta il progetto nel browser."
      />

      <AvailabilityNotice active step="STEP-002">
        I byte restano dietro sorgenti lazy e non vengono salvati nello stato React. Una nuova acquisizione sostituisce il progetto corrente.
      </AvailabilityNotice>

      <section className="import-grid" aria-label="Metodi di importazione disponibili" aria-busy={isBusy}>
        <article className="import-card">
          <div className="import-card__icon" aria-hidden="true"><ArchiveIcon /></div>
          <h2>Archivio ZIP</h2>
          <p>Inventaria l’archivio, blocca traversal, cifratura e limiti anomali prima di esporre le entry.</p>
          <Button disabled={isBusy} onClick={() => zipInput.current?.click()} variant="secondary">Seleziona ZIP</Button>
        </article>
        <article className="import-card">
          <div className="import-card__icon" aria-hidden="true"><FolderIcon /></div>
          <h2>Cartella locale</h2>
          <p>Usa File System Access API quando disponibile e ricade sulla selezione directory compatibile.</p>
          <Button disabled={isBusy} onClick={() => void chooseDirectory()} variant="secondary">Scegli cartella</Button>
        </article>
        <article className="import-card">
          <div className="import-card__icon" aria-hidden="true"><FilesIcon /></div>
          <h2>File multipli</h2>
          <p>Combina più file in una selezione conservando i percorsi relativi forniti dal browser.</p>
          <Button disabled={isBusy} onClick={() => filesInput.current?.click()} variant="secondary">Aggiungi file</Button>
        </article>
      </section>

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
        aria-label="Area di trascinamento file"
      >
        <div className="dropzone__icon" aria-hidden="true"><ArchiveIcon /></div>
        <h2>Trascina qui il tuo progetto</h2>
        <p>Un singolo ZIP viene aperto; cartelle e selezioni multiple diventano nodi del filesystem virtuale.</p>
      </div>

      <p className="import-status" role="status" aria-live="polite">{statusMessage}</p>

      {snapshot ? (
        <div className="import-session">
          <section className="import-summary" aria-label="Riepilogo acquisizione">
            <div><span>Origine</span><strong>{SOURCE_LABELS[snapshot.source]}</strong></div>
            <div><span>File validi</span><strong>{snapshot.fileCount}</strong></div>
            <div><span>Cartelle</span><strong>{snapshot.directoryCount}</strong></div>
            <div><span>Dimensione logica</span><strong>{formatBytes(snapshot.totalBytes)}</strong></div>
          </section>

          {snapshot.issues.length > 0 ? (
            <section className="import-issues" aria-labelledby="import-issues-title">
              <div className="import-issues__header">
                <div>
                  <p className="eyebrow">Controlli difensivi</p>
                  <h2 id="import-issues-title">{snapshot.issues.length} segnalazioni</h2>
                </div>
                <div className="import-session__buttons">
                  <Button onClick={() => onNavigate('preflight')}>Analizza progetto</Button>
                  <Button onClick={onClear} variant="ghost">Rimuovi progetto</Button>
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
              {snapshot.issues.length > 20 ? <p>Mostrate le prime 20 segnalazioni.</p> : null}
            </section>
          ) : (
            <div className="import-session__actions">
              <p>Nessuna anomalia strutturale rilevata durante l’acquisizione.</p>
              <div className="import-session__buttons">
                <Button onClick={() => onNavigate('preflight')}>Analizza progetto</Button>
                <Button onClick={onClear} variant="ghost">Rimuovi progetto</Button>
              </div>
            </div>
          )}

          <ImportTree root={snapshot.root} />
        </div>
      ) : null}
    </div>
  )
}
