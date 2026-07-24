import type { MarkdownGenerationProgress } from '../../core/markdown/types'
import type { ProcessingPhase } from '../../app/types'
import { Button } from '../../ui/Button'
import { ProcessingVisual } from './ProcessingVisual'

interface ProcessingViewProps {
  readonly progress: MarkdownGenerationProgress | null
  readonly phase: ProcessingPhase
  readonly statusMessage: string
  readonly isProcessing: boolean
  readonly onCancel: () => void
}

export function ProcessingView({
  progress,
  phase,
  statusMessage,
  isProcessing,
  onCancel,
}: ProcessingViewProps) {
  const total = progress?.total ?? 0
  const completed = progress?.completed ?? 0
  const percentage = total === 0 ? 0 : Math.min(100, Math.round((completed / total) * 100))

  return (
    <div className="processing-view-wrapper" data-screen-heading>
      <div className="processing-card">
        <header className="processing-card__header">
          <span className="processing-card__eyebrow">LOCAL PROCESSING</span>
          <h1 className="processing-card__title">Generating Bundle</h1>
          <p className="processing-card__status-msg" aria-live="polite">
            {statusMessage}
          </p>
        </header>

        <ProcessingVisual
          currentPath={progress?.currentPath}
          percentage={percentage}
          phase={phase}
        />

        <div className="processing-card__metrics">
          <div className="processing-metric-item">
            <span className="metric-label">Progress</span>
            <strong className="metric-val">{completed} / {total}</strong>
          </div>
          <div className="processing-metric-item">
            <span className="metric-label">Warnings</span>
            <strong className={`metric-val ${progress && progress.warnings > 0 ? 'text-warning' : ''}`}>
              {progress?.warnings ?? 0}
            </strong>
          </div>
          <div className="processing-metric-item">
            <span className="metric-label">Errors</span>
            <strong className={`metric-val ${progress && progress.errors > 0 ? 'text-invalid' : ''}`}>
              {progress?.errors ?? 0}
            </strong>
          </div>
        </div>

        {isProcessing ? (
          <footer className="processing-card__footer">
            <Button onClick={onCancel} variant="secondary" className="cancel-btn">
              Cancel
            </Button>
          </footer>
        ) : null}
      </div>
    </div>
  )
}
