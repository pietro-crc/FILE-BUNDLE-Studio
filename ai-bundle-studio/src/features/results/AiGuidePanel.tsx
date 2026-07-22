export function AiGuidePanel() {
  return (
    <section className="ai-guide-panel" aria-labelledby="ai-guide-title">
      <header className="ai-guide-panel__header">
        <div className="ai-guide-panel__title-group">
          <span className="ai-guide-panel__tag">HOW TO USE YOUR BUNDLE WITH AI</span>
          <h2 id="ai-guide-title" className="ai-guide-panel__title">
            3 simple steps to feed your project to any AI Assistant
          </h2>
        </div>

      </header>

      <div className="ai-guide-card">
        <div className="ai-guide-card__steps">
          <div className="guide-step">
            <span className="step-num">1</span>
            <div className="step-content">
              <strong>Download your bundle</strong>
              <p>
                Download the <code>.ZIP</code> package or use the single output files below.
              </p>
            </div>
          </div>

          <div className="guide-step">
            <span className="step-num">2</span>
            <div className="step-content">
              <strong>Extract or Prepare Files</strong>
              <p>
                If you downloaded the <code>.ZIP</code> package, unzip it to get the folder containing the 3 files (<code>.md</code>, <code>.pdf</code>, <code>.json</code>).
              </p>
            </div>
          </div>

          <div className="guide-step">
            <span className="step-num">3</span>
            <div className="step-content">
              <strong>Attach to your AI Assistant</strong>
              <p>
                Open your preferred AI Assistant and drag & drop or attach all 3 generated files into the chat box.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
