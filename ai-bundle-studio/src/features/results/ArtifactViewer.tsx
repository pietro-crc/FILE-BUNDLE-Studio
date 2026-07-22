import { useState } from 'react'
import type { MarkdownArtifactSnapshot } from '../../core/markdown/types'
import type { ManifestArtifact } from '../../core/manifest/types'
import type { DocumentsArtifact } from '../../core/output/types'
import { Button } from '../../ui/Button'
import { ArchiveIcon, FilesIcon } from '../../ui/icons'

interface ArtifactViewerProps {
  readonly manifestArtifact: ManifestArtifact | null
  readonly markdownSnapshot: MarkdownArtifactSnapshot | null
  readonly documentsArtifact: DocumentsArtifact | null
  readonly onDownloadPdf: () => void
  readonly onDownloadMarkdown: () => void
  readonly onDownloadManifest: () => void
}

type TabType = 'markdown' | 'pdf' | 'manifest'

const artifactTabs: ReadonlyArray<{ readonly id: TabType; readonly label: string }> = [
  { id: 'markdown', label: 'Markdown' },
  { id: 'pdf', label: 'PDF structure' },
  { id: 'manifest', label: 'Manifest' },
]

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes
  let index = -1
  do {
    value /= 1024
    index += 1
  } while (value >= 1024 && index < units.length - 1)
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${units[index]}`
}

export function ArtifactViewer({
  manifestArtifact,
  markdownSnapshot,
  documentsArtifact,
  onDownloadPdf,
  onDownloadMarkdown,
  onDownloadManifest,
}: ArtifactViewerProps) {
  const [activeTab, setActiveTab] = useState<TabType>('markdown')

  const renderContent = () => {
    switch (activeTab) {
      case 'markdown':
        return (
          <div className="artifact-viewer__pane">
            <div className="artifact-viewer__meta-bar">
              <div className="artifact-meta-group">
                <div className="artifact-meta-item">
                  <span className="artifact-meta-item__label">Size</span>
                  <strong>{markdownSnapshot ? formatBytes(markdownSnapshot.totalBytes) : '—'}</strong>
                </div>
                <div className="artifact-meta-item">
                  <span className="artifact-meta-item__label">Parts</span>
                  <strong>{markdownSnapshot?.partCount ?? 0}</strong>
                </div>
                <div className="artifact-meta-item">
                  <span className="artifact-meta-item__label">Validation</span>
                  <strong className={`artifact-status ${markdownSnapshot?.valid ? 'artifact-status--valid' : 'artifact-status--warning'}`}>
                    {markdownSnapshot?.valid ? 'Valid' : 'Warnings'}
                  </strong>
                </div>
              </div>
              <Button onClick={onDownloadMarkdown} variant="primary" className="artifact-download-btn">
                <FilesIcon /> Download .MD
              </Button>
            </div>
            <div className="artifact-viewer__preview">
              <div className="artifact-viewer__preview-header">
                <span>Content preview</span>
                <span>Read-only</span>
              </div>
              <pre className="preview-code-block">{markdownSnapshot?.preview || 'No preview available.'}</pre>
            </div>
          </div>
        )
      case 'pdf':
        return (
          <div className="artifact-viewer__pane">
            <div className="artifact-viewer__meta-bar">
              <div className="artifact-meta-group">
                <div className="artifact-meta-item">
                  <span className="artifact-meta-item__label">Size</span>
                  <strong>{markdownSnapshot ? formatBytes(markdownSnapshot.documentsBytes) : '—'}</strong>
                </div>
                <div className="artifact-meta-item">
                  <span className="artifact-meta-item__label">Pages</span>
                  <strong>{documentsArtifact?.pageCount ?? 0}</strong>
                </div>
                <div className="artifact-meta-item">
                  <span className="artifact-meta-item__label">Validation</span>
                  <strong className={`artifact-status ${documentsArtifact?.validation.valid ? 'artifact-status--valid' : 'artifact-status--warning'}`}>
                    {documentsArtifact?.validation.valid ? 'Valid' : 'Warnings'}
                  </strong>
                </div>
              </div>
              <Button onClick={onDownloadPdf} variant="primary" className="artifact-download-btn">
                <FilesIcon /> Download .PDF
              </Button>
            </div>
            <div className="artifact-viewer__preview">
              <div className="artifact-viewer__preview-header">
                <span>Document structure</span>
                <span>{documentsArtifact?.pageCount ?? 0} pages</span>
              </div>
              <div className="pdf-page-grid">
                {documentsArtifact?.pages.slice(0, 12).map((page, idx) => (
                  <div className="pdf-page-card" key={idx}>
                    <div className="pdf-page-card__header">
                      <span>Page {page.outputPage}</span>
                      <span className="page-kind-badge">{page.kind}</span>
                    </div>
                    <p className="pdf-page-card__path">{page.path ?? 'Index / Cover Page'}</p>
                  </div>
                ))}
              </div>
              {documentsArtifact && documentsArtifact.pages.length > 12 ? (
                <p className="preview-note">Showing first 12 pages of {documentsArtifact.pageCount}.</p>
              ) : null}
            </div>
          </div>
        )
      case 'manifest':
        return (
          <div className="artifact-viewer__pane">
            <div className="artifact-viewer__meta-bar">
              <div className="artifact-meta-group">
                <div className="artifact-meta-item">
                  <span className="artifact-meta-item__label">Size</span>
                  <strong>{manifestArtifact ? formatBytes(manifestArtifact.byteLength) : '—'}</strong>
                </div>
                <div className="artifact-meta-item">
                  <span className="artifact-meta-item__label">Schema</span>
                  <strong>{manifestArtifact?.manifest.schemaVersion ?? '1.0.0'}</strong>
                </div>
                <div className="artifact-meta-item">
                  <span className="artifact-meta-item__label">Validation</span>
                  <strong className={`artifact-status ${manifestArtifact?.validation.valid ? 'artifact-status--valid' : 'artifact-status--warning'}`}>
                    {manifestArtifact?.validation.valid ? 'Valid' : 'Invalid'}
                  </strong>
                </div>
              </div>
              <Button onClick={onDownloadManifest} variant="primary" className="artifact-download-btn">
                <ArchiveIcon /> Download .JSON
              </Button>
            </div>
            <div className="artifact-viewer__preview">
              <div className="artifact-viewer__preview-header">
                <span>Manifest preview</span>
                <span>Read-only</span>
              </div>
              <pre className="preview-code-block">
                {manifestArtifact ? manifestArtifact.json.slice(0, 4000) : 'No manifest generated.'}
                {manifestArtifact && manifestArtifact.json.length > 4000 ? '\n… [preview truncated] …' : ''}
              </pre>
            </div>
          </div>
        )
    }
  }

  return (
    <section className="artifact-viewer" aria-labelledby="artifact-viewer-title">
      <header className="artifact-viewer__header">
        <div className="artifact-viewer__heading">
          <span>Generated outputs</span>
          <h2 id="artifact-viewer-title">Inspect and download</h2>
        </div>
        <div className="artifact-viewer__tabs" role="tablist" aria-label="Select preview format">
          {artifactTabs.map((tab) => (
            <button
              aria-controls={`artifact-panel-${tab.id}`}
              aria-selected={activeTab === tab.id}
              className={`tab-button ${activeTab === tab.id ? 'tab-button--active' : ''}`}
              id={`artifact-tab-${tab.id}`}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              tabIndex={activeTab === tab.id ? 0 : -1}
              type="button"
            >
              <span>{tab.label}</span>
              <small>.{tab.id === 'markdown' ? 'md' : tab.id === 'manifest' ? 'json' : 'pdf'}</small>
            </button>
          ))}
        </div>
      </header>

      <div
        aria-labelledby={`artifact-tab-${activeTab}`}
        className="artifact-viewer__content"
        id={`artifact-panel-${activeTab}`}
        role="tabpanel"
      >
        {renderContent()}
      </div>
    </section>
  )
}
