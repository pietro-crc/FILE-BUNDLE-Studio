import { ArchiveIcon, FilesIcon } from '../../ui/icons'

export type ArtifactFormatId = 'markdown' | 'pdf' | 'manifest'

export interface ArtifactFormatItem {
  readonly description: string
  readonly extension: string
  readonly id: ArtifactFormatId
  readonly isValid: boolean
  readonly title: string
}

interface ArtifactFormatNavProps {
  readonly activeFormat: ArtifactFormatId
  readonly formats: readonly ArtifactFormatItem[]
  readonly onSelect: (format: ArtifactFormatId) => void
}

export function ArtifactFormatNav({ activeFormat, formats, onSelect }: ArtifactFormatNavProps) {
  return (
    <nav className="artifact-format-nav" aria-label="Generated output files">
      <div className="artifact-format-nav__heading">
        <span>Output files</span>
        <strong>{formats.length} artifacts ready</strong>
      </div>

      <div className="artifact-format-nav__list" role="tablist" aria-orientation="vertical">
        {formats.map((format) => {
          const isActive = activeFormat === format.id

          return (
            <button
              aria-controls={`artifact-panel-${format.id}`}
              aria-selected={isActive}
              className={`artifact-format-card ${isActive ? 'artifact-format-card--active' : ''}`}
              id={`artifact-tab-${format.id}`}
              key={format.id}
              onClick={() => onSelect(format.id)}
              role="tab"
              tabIndex={isActive ? 0 : -1}
              type="button"
            >
              <span className="artifact-format-card__icon">
                {format.id === 'manifest' ? <ArchiveIcon /> : <FilesIcon />}
              </span>

              <span className="artifact-format-card__copy">
                <strong>{format.title}</strong>
                <small>{format.description}</small>
              </span>

              <span className="artifact-format-card__meta">
                <code>{format.extension}</code>
                <small className={format.isValid ? 'is-valid' : 'has-warning'}>
                  {format.isValid ? 'Ready' : 'Review'}
                </small>
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
