import { useState } from 'react'
import type { MarkdownArtifactSnapshot } from '../../core/markdown/types'
import type { ManifestArtifact } from '../../core/manifest/types'
import type { DocumentsArtifact } from '../../core/output/types'
import { Button } from '../../ui/Button'
import { ArchiveIcon, FilesIcon } from '../../ui/icons'
import {
  ArtifactFormatNav,
  type ArtifactFormatId,
  type ArtifactFormatItem,
} from './ArtifactFormatNav'
import { PdfDocumentPreview } from './PdfDocumentPreview'

interface ArtifactViewerProps {
  readonly manifestArtifact: ManifestArtifact | null
  readonly markdownSnapshot: MarkdownArtifactSnapshot | null
  readonly documentsArtifact: DocumentsArtifact | null
  readonly onDownloadPdf: () => void
  readonly onDownloadMarkdown: () => void
  readonly onDownloadManifest: () => void
}

interface ArtifactDetails {
  readonly description: string
  readonly downloadLabel: string
  readonly extension: string
  readonly isValid: boolean
  readonly metricLabel: string
  readonly metricValue: string
  readonly size: string
  readonly title: string
}

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
  const [activeFormat, setActiveFormat] = useState<ArtifactFormatId>('markdown')

  const artifactDetails: Record<ArtifactFormatId, ArtifactDetails> = {
    markdown: {
      description: 'Complete, AI-readable project content',
      downloadLabel: 'Download Markdown',
      extension: '.md',
      isValid: markdownSnapshot?.valid ?? false,
      metricLabel: 'Parts',
      metricValue: String(markdownSnapshot?.partCount ?? 0),
      size: markdownSnapshot ? formatBytes(markdownSnapshot.totalBytes) : '—',
      title: 'Markdown bundle',
    },
    pdf: {
      description: 'Visual document structure and page map',
      downloadLabel: 'Download PDF',
      extension: '.pdf',
      isValid: documentsArtifact?.validation.valid ?? false,
      metricLabel: 'Pages',
      metricValue: String(documentsArtifact?.pageCount ?? 0),
      size: markdownSnapshot ? formatBytes(markdownSnapshot.documentsBytes) : '—',
      title: 'PDF document',
    },
    manifest: {
      description: 'Machine-readable project index and metadata',
      downloadLabel: 'Download Manifest',
      extension: '.json',
      isValid: manifestArtifact?.validation.valid ?? false,
      metricLabel: 'Schema',
      metricValue: manifestArtifact?.manifest.schemaVersion ?? '1.0.0',
      size: manifestArtifact ? formatBytes(manifestArtifact.byteLength) : '—',
      title: 'JSON manifest',
    },
  }

  const formats: readonly ArtifactFormatItem[] = (
    Object.entries(artifactDetails) as Array<[ArtifactFormatId, ArtifactDetails]>
  ).map(([id, details]) => ({
    description: `${details.size} · ${details.metricValue} ${details.metricLabel.toLowerCase()}`,
    extension: details.extension,
    id,
    isValid: details.isValid,
    title: details.title,
  }))

  const activeArtifact = artifactDetails[activeFormat]
  const ActiveArtifactIcon = activeFormat === 'manifest' ? ArchiveIcon : FilesIcon

  const downloadActions: Record<ArtifactFormatId, () => void> = {
    markdown: onDownloadMarkdown,
    pdf: onDownloadPdf,
    manifest: onDownloadManifest,
  }

  const renderPreview = () => {
    switch (activeFormat) {
      case 'markdown':
        return (
          <pre className="preview-code-block">
            {markdownSnapshot?.preview || 'No preview available.'}
          </pre>
        )
      case 'pdf':
        return <PdfDocumentPreview bytes={documentsArtifact?.bytes ?? null} />
      case 'manifest':
        return (
          <pre className="preview-code-block">
            {manifestArtifact ? manifestArtifact.json.slice(0, 4000) : 'No manifest generated.'}
            {manifestArtifact && manifestArtifact.json.length > 4000
              ? '\n… [preview truncated] …'
              : ''}
          </pre>
        )
    }
  }

  return (
    <section className="artifact-viewer" aria-label="Generated artifact previews">
      <div className="artifact-viewer__shell">
        <aside className="artifact-viewer__sidebar">
          <ArtifactFormatNav
            activeFormat={activeFormat}
            formats={formats}
            onSelect={setActiveFormat}
          />
        </aside>

        <div
          aria-labelledby={`artifact-tab-${activeFormat}`}
          className="artifact-viewer__workspace"
          id={`artifact-panel-${activeFormat}`}
          role="tabpanel"
        >
          <div className="artifact-viewer__toolbar">
            <div className="artifact-viewer__identity">
              <span className="artifact-viewer__identity-icon">
                <ActiveArtifactIcon />
              </span>
              <div>
                <span>Previewing</span>
                <h3>{activeArtifact.title}</h3>
                <p>{activeArtifact.description}</p>
              </div>
            </div>

            <div className="artifact-viewer__toolbar-actions">
              <span
                className={`artifact-validation ${activeArtifact.isValid ? 'artifact-validation--valid' : 'artifact-validation--warning'}`}
              >
                {activeArtifact.isValid ? 'Validated' : 'Needs review'}
              </span>
              <Button
                className="artifact-download-btn"
                onClick={downloadActions[activeFormat]}
                variant="primary"
              >
                <ActiveArtifactIcon /> {activeArtifact.downloadLabel}
              </Button>
            </div>
          </div>

          <div className="artifact-viewer__details" aria-label="Artifact details">
            <div>
              <span>Format</span>
              <strong>{activeArtifact.extension}</strong>
            </div>
            <div>
              <span>Size</span>
              <strong>{activeArtifact.size}</strong>
            </div>
            <div>
              <span>{activeArtifact.metricLabel}</span>
              <strong>{activeArtifact.metricValue}</strong>
            </div>
          </div>

          <div className="artifact-viewer__preview">
            <div className="artifact-viewer__preview-header">
              <span>{activeFormat === 'pdf' ? 'Document structure' : 'Content preview'}</span>
              <span>Read-only</span>
            </div>
            {renderPreview()}
          </div>
        </div>
      </div>
    </section>
  )
}
