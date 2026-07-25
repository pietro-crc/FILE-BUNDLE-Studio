import './output-promise.css'

const outputFormats = ['.md', '.pdf', '.json']

export function OutputPromise() {
  return (
    <ol className="studio-output-flow" aria-label="How your source becomes AI-ready outputs">
      <li className="studio-output-flow__step">
        <span className="studio-output-flow__number" aria-hidden="true">1</span>
        <span className="studio-output-flow__copy">
          <strong>ZIP, folder or files</strong>
          <small>Bring the whole project</small>
        </span>
      </li>
      <li className="studio-output-flow__connector" aria-hidden="true">→</li>
      <li className="studio-output-flow__step">
        <span className="studio-output-flow__number" aria-hidden="true">2</span>
        <span className="studio-output-flow__copy">
          <strong>Process locally</strong>
          <small>Nothing leaves your browser</small>
        </span>
      </li>
      <li className="studio-output-flow__connector" aria-hidden="true">→</li>
      <li className="studio-output-flow__step studio-output-flow__step--output">
        <span className="studio-output-flow__number" aria-hidden="true">3</span>
        <span className="studio-output-flow__copy">
          <strong>Three AI-ready files</strong>
          <span className="studio-output-flow__formats" aria-label="Markdown, PDF and JSON outputs">
            {outputFormats.map((format) => <code key={format}>{format}</code>)}
          </span>
        </span>
      </li>
    </ol>
  )
}
