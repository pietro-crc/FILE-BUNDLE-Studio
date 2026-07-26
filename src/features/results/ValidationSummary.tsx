import { useEffect, useMemo, useState } from 'react'
import type { MarkdownArtifactSnapshot } from '../../core/markdown/types'
import type { ManifestArtifact, ManifestConversionStatus } from '../../core/manifest/types'
import type { ProjectBundle } from '../../core/output/types'
import { Button } from '../../ui/Button'

interface ValidationSummaryProps {
  readonly manifestArtifact: ManifestArtifact | null
  readonly markdownSnapshot: MarkdownArtifactSnapshot | null
  readonly projectBundle: ProjectBundle | null
}

interface ValidationIssueRow {
  readonly id: string
  readonly path: string
  readonly status: ManifestConversionStatus | 'invalid'
  readonly details: readonly string[]
}

const STATUS_PRIORITY: Readonly<Record<ManifestConversionStatus | 'invalid', number>> = {
  invalid: 5,
  failed: 4,
  partial: 3,
  'not-started': 2,
  completed: 1,
  'not-applicable': 0,
}

function mergeStatus(
  left: ManifestConversionStatus | 'invalid',
  right: ManifestConversionStatus | 'invalid',
): ManifestConversionStatus | 'invalid' {
  return STATUS_PRIORITY[right] > STATUS_PRIORITY[left] ? right : left
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

  const issueRows = useMemo<readonly ValidationIssueRow[]>(() => {
    const rows = new Map<string, ValidationIssueRow>()

    const mergeFileIssue = (
      fileId: string,
      path: string,
      status: ManifestConversionStatus,
      source: 'Markdown' | 'PDF',
      error: string | null,
      warnings: readonly string[],
    ) => {
      const details = [
        ...(error ? [`[${source}] ${error}`] : []),
        ...warnings.map((warning) => `[${source}] ${warning}`),
      ]
      if (details.length === 0) return

      const current = rows.get(fileId)
      rows.set(fileId, {
        id: fileId,
        path,
        status: current ? mergeStatus(current.status, status) : status,
        details: [...new Set([...(current?.details ?? []), ...details])],
      })
    }

    projectBundle?.markdown.records.forEach((record) => {
      mergeFileIssue(record.fileId, record.path, record.status, 'Markdown', record.error, record.warnings)
    })
    projectBundle?.documents.records.forEach((record) => {
      mergeFileIssue(record.fileId, record.path, record.status, 'PDF', record.error, record.warnings)
    })

    manifestArtifact?.validation.errors.forEach((error, index) => {
      rows.set(`manifest-${index}-${error.code}-${error.path}`, {
        id: `manifest-${index}-${error.code}-${error.path}`,
        path: error.path,
        status: 'invalid',
        details: [`[Manifest] ${error.code}: ${error.message}`],
      })
    })
    projectBundle?.markdown.validation.errors.forEach((error, index) => {
      rows.set(`markdown-${index}-${error.code}-${error.path}`, {
        id: `markdown-${index}-${error.code}-${error.path}`,
        path: error.path,
        status: 'invalid',
        details: [`[Markdown structure] ${error.code}: ${error.message}`],
      })
    })
    projectBundle?.documents.validation.errors.forEach((error, index) => {
      rows.set(`pdf-${index}-${error.code}-${error.path}`, {
        id: `pdf-${index}-${error.code}-${error.path}`,
        path: error.path,
        status: 'invalid',
        details: [`[PDF structure] ${error.code}: ${error.message}`],
      })
    })

    return [...rows.values()]
  }, [manifestArtifact, projectBundle])

  const totalIssues = issueRows.length > 0 ? issueRows.length : overallValid ? 0 : 1

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
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

  const issueLabel = totalIssues === 1 ? 'Validation Issue' : 'Validation Issues'

  return (
    <>
      <button
        className="validation-pill validation-pill--warning"
        onClick={() => setIsOpen(true)}
        type="button"
        aria-expanded={isOpen}
      >
        <span className="validation-pill__icon" aria-hidden="true">!</span>
        <span className="validation-pill__text">{totalIssues} {issueLabel}</span>
      </button>

      {isOpen && (
        <div className="validation-modal-overlay" onClick={() => setIsOpen(false)} role="dialog" aria-modal="true">
          <div className="validation-modal" onClick={(event) => event.stopPropagation()}>
            <header className="validation-modal__header">
              <div className="modal-title-group">
                <h3>Validation Details ({totalIssues} issues)</h3>
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
                  {isManifestValid ? 'Valid' : `${manifestArtifact?.validation.errors.length ?? 0} errors`}
                </strong>
              </div>
              <div className="val-box">
                <span>Markdown Structure</span>
                <strong className={isMarkdownValid ? 'text-valid' : 'text-invalid'}>
                  {isMarkdownValid ? 'Valid' : `${projectBundle?.markdown.validation.errors.length ?? 0} errors`}
                </strong>
              </div>
              <div className="val-box">
                <span>PDF Document</span>
                <strong className={isPdfValid ? 'text-valid' : 'text-invalid'}>
                  {isPdfValid ? 'Valid' : `${projectBundle?.documents.validation.errors.length ?? 0} errors`}
                </strong>
              </div>
            </div>

            <div className="validation-modal__content">
              {issueRows.length > 0 ? (
                <table className="issues-table">
                  <thead>
                    <tr>
                      <th scope="col">File / Validation Path</th>
                      <th scope="col">Status</th>
                      <th scope="col">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {issueRows.map((issue) => (
                      <tr key={issue.id}>
                        <td><code>{issue.path}</code></td>
                        <td><span className={`status-tag status-tag--${issue.status}`}>{issue.status}</span></td>
                        <td>
                          {issue.details.map((detail) => (
                            <div className={issue.status === 'failed' || issue.status === 'invalid' ? 'error-text' : 'warning-text'} key={`${issue.id}-${detail}`}>
                              {detail}
                            </div>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p>No record-level details are available for this validation failure.</p>
              )}
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
