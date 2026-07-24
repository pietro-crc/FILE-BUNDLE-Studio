import type { ImportSessionSnapshot } from '../../core/vfs/snapshot'
import { Button } from '../../ui/Button'
import { ArchiveIcon, FilesIcon, FolderIcon } from '../../ui/icons'

interface SelectedSourceSummaryProps {
  readonly snapshot: ImportSessionSnapshot
  readonly onClear: () => void
}

const SOURCE_LABELS: Record<ImportSessionSnapshot['source'], string> = {
  'file-picker': 'Multiple files',
  'directory-picker': 'Local folder',
  'drag-drop': 'Drag & Drop',
  zip: 'ZIP Archive',
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
  return `${value.toLocaleString('en-US', { maximumFractionDigits: value >= 10 ? 1 : 2 })} ${units[unitIndex]}`
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
    <div className="selected-source-summary" aria-label="Selected project summary">
      <div className="selected-source-summary__header">
        <div className="selected-source-summary__title-wrap">
          <div className="selected-source-summary__icon" aria-hidden="true">
            {getIcon()}
          </div>
          <div>
            <span className="eyebrow">Project Acquired</span>
            <h3 className="selected-source-summary__title">{SOURCE_LABELS[snapshot.source]}</h3>
          </div>
        </div>

        <Button onClick={onClear} variant="ghost">
          Remove or Replace
        </Button>
      </div>

      <div className="selected-source-summary__metrics">
        <div className="metric-box">
          <span className="metric-box__label">Valid files</span>
          <strong className="metric-box__value">{snapshot.fileCount}</strong>
        </div>
        <div className="metric-box">
          <span className="metric-box__label">Folders</span>
          <strong className="metric-box__value">{snapshot.directoryCount}</strong>
        </div>
        <div className="metric-box">
          <span className="metric-box__label">Logical size</span>
          <strong className="metric-box__value">{formatBytes(snapshot.totalBytes)}</strong>
        </div>
        <div className="metric-box">
          <span className="metric-box__label">Issues</span>
          <strong className={`metric-box__value ${snapshot.issues.length > 0 ? 'metric-box__value--warning' : ''}`}>
            {snapshot.issues.length}
          </strong>
        </div>
      </div>

      {snapshot.issues.length > 0 ? (
        <details className="selected-source-summary__issues">
          <summary>{snapshot.issues.length} acquisition warnings detected (click to expand)</summary>
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
