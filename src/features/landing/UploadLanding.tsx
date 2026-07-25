import type { ImportSessionSnapshot } from '../../core/vfs/snapshot'
import type { ImportResult } from '../../core/vfs/types'
import { Button } from '../../ui/Button'
import { SelectedSourceSummary } from './SelectedSourceSummary'
import { SourceDropzone } from './SourceDropzone'
import { OutputPromise } from './OutputPromise'

interface UploadLandingProps {
  readonly snapshot: ImportSessionSnapshot | null
  readonly isBusy: boolean
  readonly statusMessage: string
  readonly onImport: (result: ImportResult, label: string) => void
  readonly onClear: () => void
  readonly onStartProcessing: () => void
  readonly onError: (message: string) => void
}

export function UploadLanding({
  snapshot,
  isBusy,
  statusMessage,
  onImport,
  onClear,
  onStartProcessing,
  onError,
}: UploadLandingProps) {
  const hasProject = Boolean(snapshot && snapshot.fileCount > 0)

  return (
    <div className="upload-landing studio-landing" data-screen-heading>
      <header className="studio-landing__header">
        <div className="studio-landing__meta">
          <span className="studio-tag">ZIP / FOLDER / MANY FILES → 3 AI-READY FILES</span>
        </div>
        <h1
          aria-label="Prepare your project for AI: turn any project into 3 AI-ready files"
          className="studio-landing__title"
          tabIndex={-1}
        >
          Turn any project into 3 AI-ready files
        </h1>
        <p className="studio-landing__subtitle">
          Upload multiple files, a folder, or a ZIP. Get Markdown, PDF, and JSON attachments ready for AI assistants that limit file uploads.
        </p>
      </header>

      <OutputPromise />

      <div className="studio-workspace-card">
        <div className="studio-workspace-card__body">
          {!hasProject ? (
            <SourceDropzone isBusy={isBusy} onError={onError} onImport={onImport} />
          ) : (
            <SelectedSourceSummary onClear={onClear} snapshot={snapshot!} />
          )}
        </div>

        <div className="studio-workspace-card__footer">
          <div className="studio-status" aria-live="polite">
            <span className={`studio-status-indicator ${hasProject ? 'is-ready' : ''}`} />
            <span className="studio-status-text">{statusMessage}</span>
          </div>

          <div className="studio-actions">
            <Button
              aria-label="Start processing"
              className="studio-btn-primary"
              disabled={!hasProject || isBusy}
              onClick={onStartProcessing}
              variant="primary"
            >
              <span>{hasProject ? 'Create 3 AI files' : 'Start processing'}</span>
              <span className="studio-btn-icon" aria-hidden="true">→</span>
            </Button>
          </div>
        </div>
      </div>

      <footer className="studio-landing__footer">
        <span>100% In-Browser Processing</span>
        <span className="studio-footer-dot">•</span>
        <span>Virtual File System Sandbox</span>
      </footer>
    </div>
  )
}
