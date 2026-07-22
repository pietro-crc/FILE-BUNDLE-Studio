import type { ProcessingPhase } from '../../app/types'

interface ProcessingVisualProps {
  readonly phase: ProcessingPhase
  readonly percentage: number
  readonly currentPath?: string | undefined
}

const PHASE_LABELS: Record<ProcessingPhase, string> = {
  parsing: 'File Parsing & Classification',
  processing: 'Content Extraction & Conversion',
  recombining: 'PDF & Manifest Assembly',
  completed: 'Processing Complete',
}

export function ProcessingVisual({ phase, percentage, currentPath }: ProcessingVisualProps) {
  return (
    <div className="processing-linear-visual" aria-label={`Progress: ${percentage}%`}>
      <div className="processing-linear__header">
        <div className="processing-linear__phase">
          <span className="phase-indicator-dot" />
          <span className="phase-text">{PHASE_LABELS[phase]}</span>
        </div>
        <span className="processing-linear__percent">{percentage}%</span>
      </div>

      <div
        aria-label="Processing progress"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={percentage}
        className="processing-linear__track"
        role="progressbar"
      >
        <div className="processing-linear__fill" style={{ width: `${percentage}%` }} />
      </div>

      <div className="processing-linear__ticker">
        <span className="ticker-label">File:</span>
        <code className="ticker-path" title={currentPath || 'Initializing...'}>
          {currentPath || 'Initializing local session...'}
        </code>
      </div>
    </div>
  )
}
