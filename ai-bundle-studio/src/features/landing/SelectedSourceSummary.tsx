import type { ImportSessionSnapshot } from '../../core/vfs/snapshot'
import { Button } from '../../ui/Button'
import { ArchiveIcon, FilesIcon, FolderIcon } from '../../ui/icons'

interface SelectedSourceSummaryProps {
  readonly snapshot: ImportSessionSnapshot
  readonly onClear: () => void
}

const SOURCE_LABELS: Record<ImportSessionSnapshot['source'], string> = {
  'file-picker': 'File multipli',
  'directory-picker': 'Cartella locale',
  'drag-drop': 'Trascinamento',
  zip: 'Archivio ZIP',
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unitIndex = -1
  do {
    value /= 1024
    unitIndex += 1
  } while (value >= 1024 && unitIndex < units.length - 1)
  return `${value.toLocaleString('it-IT', { maximumFractionDigits: value >= 10 ? 1 : 2 })} ${units[unitIndex]}`
}

export function SelectedSourceSummary({ snapshot, onClear }: SelectedSourceSummaryProps) {
  const getIcon = () => {
    switch (snapshot.source) {
      case 'zip':
        return <ArchiveIcon />
      case 'directory-picker':
        return <FolderIcon />
      default:
        return <FilesIcon />
    }
  }

  return (
    <div className="selected-source-summary" aria-label="Riepilogo del progetto selezionato">
      <div className="selected-source-summary__header">
        <div className="selected-source-summary__title-wrap">
          <div className="selected-source-summary__icon" aria-hidden="true">
            {getIcon()}
          </div>
          <div>
            <span className="eyebrow">Progetto Acquisito</span>
            <h3 className="selected-source-summary__title">{SOURCE_LABELS[snapshot.source]}</h3>
          </div>
        </div>

        <Button onClick={onClear} variant="ghost">
          Rimuovi o Sostituisci
        </Button>
      </div>

      <div className="selected-source-summary__metrics">
        <div className="metric-box">
          <span className="metric-box__label">File validi</span>
          <strong className="metric-box__value">{snapshot.fileCount}</strong>
        </div>
        <div className="metric-box">
          <span className="metric-box__label">Cartelle</span>
          <strong className="metric-box__value">{snapshot.directoryCount}</strong>
        </div>
        <div className="metric-box">
          <span className="metric-box__label">Dimensione logica</span>
          <strong className="metric-box__value">{formatBytes(snapshot.totalBytes)}</strong>
        </div>
        <div className="metric-box">
          <span className="metric-box__label">Segnalazioni</span>
          <strong className={`metric-box__value ${snapshot.issues.length > 0 ? 'metric-box__value--warning' : ''}`}>
            {snapshot.issues.length}
          </strong>
        </div>
      </div>

      {snapshot.issues.length > 0 ? (
        <details className="selected-source-summary__issues">
          <summary>{snapshot.issues.length} avvisi di acquisizione rilevati (clicca per espandere)</summary>
          <ul>
            {snapshot.issues.slice(0, 10).map((issue, index) => (
              <li key={`${issue.code}-${issue.path ?? index}`}>
                <strong>{issue.code}</strong>: {issue.path ? `${issue.path} — ` : ''}{issue.message}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  )
}
