import { Button } from '../../ui/Button'
import { FilesIcon } from '../../ui/icons'

interface AiGuidePanelProps {
  readonly onOpenOutputs: () => void
}

export function AiGuidePanel({ onOpenOutputs }: AiGuidePanelProps) {
  return (
    <section className="ai-guide-panel" aria-labelledby="ai-guide-title">
      <header className="ai-guide-panel__header">
        <div className="ai-guide-panel__title-group">
          <span className="ai-guide-panel__tag">HOW TO USE YOUR BUNDLE WITH AI</span>
          <h2 id="ai-guide-title" className="ai-guide-panel__title">
            Attach your whole project in 3 files
          </h2>
        </div>

        <Button className="guide-output-explorer-btn" onClick={onOpenOutputs} variant="primary">
          <FilesIcon /> View generated outputs
        </Button>
      </header>

      <div className="ai-guide-card">
        <div className="ai-guide-card__steps">
          <div className="guide-step">
            <span className="step-num">1</span>
            <div className="step-content">
              <strong>Download your bundle</strong>
              <p>
                Download the <code>.ZIP</code> package or open the output explorer for the three individual files.
              </p>
            </div>
          </div>

          <div className="guide-step">
            <span className="step-num">2</span>
            <div className="step-content">
              <strong>Extract or prepare files</strong>
              <p>
                If you downloaded the <code>.ZIP</code> package, unzip it to get the three files (<code>.md</code>, <code>.pdf</code>, <code>.json</code>).
              </p>
            </div>
          </div>

          <div className="guide-step">
            <span className="step-num">3</span>
            <div className="step-content">
              <strong>Attach to your AI Assistant</strong>
              <p>
                Open your preferred AI Assistant and attach all 3 files to the chat. This keeps a complete project within a 3-file limit.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
