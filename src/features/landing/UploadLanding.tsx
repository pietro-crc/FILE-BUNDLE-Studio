import type { ImportSessionSnapshot } from '../../core/vfs/snapshot'
import type { ImportResult } from '../../core/vfs/types'
import { Button } from '../../ui/Button'
import { SelectedSourceSummary } from './SelectedSourceSummary'
import { SourceDropzone } from './SourceDropzone'

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
          <span className="studio-tag">CODE INGESTION STUDIO</span>
        </div>
        <h1 className="studio-landing__title" tabIndex={-1}>
          Prepare your project for AI
        </h1>
        <p className="studio-landing__subtitle">
          Extract, analyze, and synthesize code & documents into LLM-optimized bundles, Markdown, and PDF.
        </p>
      </header>

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
              className="studio-btn-primary"
              disabled={!hasProject || isBusy}
              onClick={onStartProcessing}
              variant="primary"
            >
              <span>Start processing</span>
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
