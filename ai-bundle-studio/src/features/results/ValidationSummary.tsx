import { useEffect, useState } from 'react'
import type { MarkdownArtifactSnapshot } from '../../core/markdown/types'
import type { ManifestArtifact } from '../../core/manifest/types'
import type { ProjectBundle } from '../../core/output/types'
import { Button } from '../../ui/Button'

interface ValidationSummaryProps {
  readonly manifestArtifact: ManifestArtifact | null
  readonly markdownSnapshot: MarkdownArtifactSnapshot | null
  readonly projectBundle: ProjectBundle | null
}

export function ValidationSummary({
  manifestArtifact,
  markdownSnapshot,
  projectBundle,
}: ValidationSummaryProps) {
  const [isOpen, setIsOpen] = useState(false)

  const isManifestValid = manifestArtifact?.validation.valid ?? true
  const isMarkdownValid = markdownSnapshot?.valid ?? true
  const isPdfValid = markdownSnapshot?.documentsValid ?? true
  const overallValid = isManifestValid && isMarkdownValid && isPdfValid

  const textRecordsWithIssues = projectBundle?.markdown.records.filter(
    (record) => record.warnings.length > 0 || record.error !== null,
  ) ?? []

  const pdfRecordsWithIssues = projectBundle?.documents.records.filter(
    (record) => record.warnings.length > 0 || record.error !== null,
  ) ?? []

  const totalIssues = textRecordsWithIssues.length + pdfRecordsWithIssues.length

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  if (overallValid && totalIssues === 0) {
    return (
      <div className="validation-pill validation-pill--success" title="All integrity checks passed">
        <span className="validation-pill__icon" aria-hidden="true">✓</span>
        <span className="validation-pill__text">100% Validated</span>
      </div>
    )
  }

  return (
    <>
      <button 
        className="validation-pill validation-pill--warning" 
        onClick={() => setIsOpen(true)}
        type="button"
        aria-expanded={isOpen}
      >
        <span className="validation-pill__icon" aria-hidden="true">!</span>
        <span className="validation-pill__text">{totalIssues} Validation Warnings</span>
      </button>

      {isOpen && (
        <div className="validation-modal-overlay" onClick={() => setIsOpen(false)} role="dialog" aria-modal="true">
          <div className="validation-modal" onClick={(e) => e.stopPropagation()}>
            <header className="validation-modal__header">
              <div className="modal-title-group">
                <h3>Validation Details ({totalIssues} files)</h3>
                <span className="modal-subtitle">Local compliance checks</span>
              </div>
              <Button onClick={() => setIsOpen(false)} variant="secondary" className="back-btn">
                ← Go Back
              </Button>
            </header>
            
            <div className="validation-metrics">
              <div className="val-box">
                <span>Manifest JSON</span>
                <strong className={isManifestValid ? 'text-valid' : 'text-invalid'}>
                  {isManifestValid ? 'Valid' : `${manifestArtifact?.validation.errors.length} errors`}
                </strong>
              </div>
              <div className="val-box">
                <span>Markdown Structure</span>
                <strong className={isMarkdownValid ? 'text-valid' : 'text-invalid'}>
                  {isMarkdownValid ? 'Valid' : `${projectBundle?.markdown.validation.errors.length} errors`}
                </strong>
              </div>
              <div className="val-box">
                <span>PDF Document</span>
                <strong className={isPdfValid ? 'text-valid' : 'text-invalid'}>
                  {isPdfValid ? 'Valid' : `${projectBundle?.documents.validation.errors.length} errors`}
                </strong>
              </div>
            </div>

            <div className="validation-modal__content">
              <table className="issues-table">
                <thead>
                  <tr>
                    <th scope="col">File Path</th>
                    <th scope="col">Status</th>
                    <th scope="col">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {textRecordsWithIssues.map((record) => (
                    <tr key={record.fileId}>
                      <td><code>{record.path}</code></td>
                      <td><span className={`status-tag status-tag--${record.status}`}>{record.status}</span></td>
                      <td>
                        {record.error ? <div className="error-text">{record.error}</div> : null}
                        {record.warnings.map((w, idx) => (
                          <div className="warning-text" key={idx}>{w}</div>
                        ))}
                      </td>
                    </tr>
                  ))}
                  {pdfRecordsWithIssues.map((record) => (
                    <tr key={record.fileId}>
                      <td><code>{record.path}</code></td>
                      <td><span className={`status-tag status-tag--${record.status}`}>{record.status}</span></td>
                      <td>
                        {record.error ? <div className="error-text">{record.error}</div> : null}
                        {record.warnings.map((w, idx) => (
                          <div className="warning-text" key={idx}>{w}</div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <footer className="validation-modal__footer">
              <Button onClick={() => setIsOpen(false)} variant="primary">
                ← Back to Dashboard
              </Button>
            </footer>
          </div>
        </div>
      )}
    </>
  )
}
