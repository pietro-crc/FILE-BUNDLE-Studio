import { useState } from 'react'
import type { MarkdownArtifactSnapshot } from '../../core/markdown/types'
import type { ManifestArtifact } from '../../core/manifest/types'
import type { ProjectBundle } from '../../core/output/types'
import { Button } from '../../ui/Button'
import { ArchiveIcon, FilesIcon } from '../../ui/icons'
import { ArtifactExplorerModal } from './ArtifactExplorerModal'
import { ValidationSummary } from './ValidationSummary'
import { AiGuidePanel } from './AiGuidePanel'
import { prepareMarkdownDownload, prepareProjectPackage, type PreparedDownload } from './downloads'

interface ResultsDashboardProps {
  readonly manifestArtifact: ManifestArtifact | null
  readonly markdownSnapshot: MarkdownArtifactSnapshot | null
  readonly projectBundle: ProjectBundle | null
  readonly onNewProject: () => void
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function downloadPreparedArtifact(download: PreparedDownload): void {
  const copy = new Uint8Array(download.bytes.byteLength)
  copy.set(download.bytes)
  downloadBlob(new Blob([copy.buffer], { type: download.mediaType }), download.filename)
}

const SECRET_POLICY_LABELS = {
  'report-only': 'Report only',
  redact: 'Redacted',
  exclude: 'Excluded',
} as const

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

export function ResultsDashboard({
  manifestArtifact,
  markdownSnapshot,
  projectBundle,
  onNewProject,
}: ResultsDashboardProps) {
  const [isExplorerOpen, setIsExplorerOpen] = useState(false)
  const [isPackaging, setIsPackaging] = useState(false)
  const [packageError, setPackageError] = useState<string | null>(null)
  const projectName = manifestArtifact?.manifest.projectName || 'project'
  const includedCount = manifestArtifact?.manifest.summary.includedFileCount ?? 0
  const excludedCount = manifestArtifact?.manifest.summary.excludedFileCount ?? 0
  const totalAcquired = includedCount + excludedCount
  const markdownPartCount = projectBundle?.markdown.parts.length ?? 0
  const secretPolicy = manifestArtifact?.manifest.settings.secretHandling ?? 'redact'
  const totalOutputBytes =
    (projectBundle?.markdown.totalBytes ?? markdownSnapshot?.totalBytes ?? 0) +
    (projectBundle?.documents.byteLength ?? 0) +
    (manifestArtifact?.byteLength ?? 0)

  const handleDownloadPdf = () => {
    if (!projectBundle?.documents.bytes) return
    downloadPreparedArtifact({
      bytes: new Uint8Array(projectBundle.documents.bytes),
      filename: projectBundle.documents.name,
      mediaType: projectBundle.documents.mediaType,
    })
  }

  const handleDownloadMarkdown = () => {
    if (!projectBundle?.markdown.parts) return

    try {
      downloadPreparedArtifact(prepareMarkdownDownload(projectName, projectBundle.markdown.parts))
    } catch (error) {
      setPackageError(error instanceof Error ? error.message : 'Markdown download could not be prepared.')
    }
  }

  const handleDownloadManifest = () => {
    if (!manifestArtifact?.json) return
    downloadPreparedArtifact({
      bytes: new TextEncoder().encode(manifestArtifact.json),
      filename: `${projectName}-manifest.json`,
      mediaType: 'application/json;charset=utf-8',
    })
  }

  const handleDownloadZipPackage = async () => {
    if (!projectBundle || !manifestArtifact || isPackaging) return

    setIsPackaging(true)
    setPackageError(null)

    try {
      // Let React paint the busy state before the synchronous ZIP encoder starts.
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
      downloadPreparedArtifact(prepareProjectPackage(projectName, projectBundle, manifestArtifact))
    } catch (error) {
      setPackageError(error instanceof Error ? error.message : 'The ZIP package could not be created.')
    } finally {
      setIsPackaging(false)
    }
  }

  return (
    <div className="results-dashboard" data-screen-heading tabIndex={-1}>
      <header className="results-dashboard__glass-header">
        <div className="results-dashboard__top-row">
          <div className="results-dashboard__title-group">
            <span className="results-dashboard__eyebrow">PROCESSING COMPLETE</span>
            <h1 className="results-dashboard__title">{projectName}</h1>
          </div>

          <div className="results-dashboard__header-right">
            <ValidationSummary
              manifestArtifact={manifestArtifact}
              markdownSnapshot={markdownSnapshot}
              projectBundle={projectBundle}
            />
            <Button onClick={onNewProject} variant="secondary">
              New project
            </Button>
          </div>
        </div>

        <div className="results-dashboard__metrics-row">
          <div className="metric-badge">
            <span className="metric-badge__label">Files Ingested</span>
            <strong className="metric-badge__value">{totalAcquired}</strong>
          </div>
          <div className="metric-badge">
            <span className="metric-badge__label">Files Included</span>
            <strong className="metric-badge__value text-valid">{includedCount}</strong>
          </div>
          <div className="metric-badge">
            <span className="metric-badge__label">Files Excluded</span>
            <strong className="metric-badge__value text-muted">{excludedCount}</strong>
          </div>
          <div className="metric-badge">
            <span className="metric-badge__label">Output Size</span>
            <strong className="metric-badge__value">
              {totalOutputBytes > 0 ? formatBytes(totalOutputBytes) : '—'}
            </strong>
          </div>
          <div className="metric-badge">
            <span className="metric-badge__label">Secret Policy</span>
            <strong className="metric-badge__value">{SECRET_POLICY_LABELS[secretPolicy]}</strong>
          </div>
        </div>

        <div className="results-dashboard__download-bar">
          <Button
            aria-busy={isPackaging}
            disabled={!projectBundle || !manifestArtifact || isPackaging}
            onClick={() => void handleDownloadZipPackage()}
            variant="primary"
            className="dl-btn dl-btn--zip-primary"
          >
            <ArchiveIcon /> {isPackaging ? 'Packaging…' : 'Download Package (.ZIP)'}
          </Button>

          <div className="download-bar__sub-buttons">
            <span className="download-bar__label">Single outputs:</span>
            <Button
              onClick={handleDownloadMarkdown}
              variant="secondary"
              className="dl-btn dl-btn--sm"
              title={markdownPartCount > 1 ? `Download ${markdownPartCount} Markdown parts as ZIP` : 'Download Markdown'}
            >
              <FilesIcon /> {markdownPartCount > 1 ? '.MD ZIP' : '.MD'}
            </Button>
            <Button onClick={handleDownloadPdf} variant="secondary" className="dl-btn dl-btn--sm">
              <FilesIcon /> .PDF
            </Button>
            <Button onClick={handleDownloadManifest} variant="secondary" className="dl-btn dl-btn--sm">
              <ArchiveIcon /> .JSON
            </Button>
          </div>

          {packageError ? <p className="download-bar__error" role="alert">{packageError}</p> : null}
        </div>
      </header>

      <main className="results-dashboard__workspace">
        <AiGuidePanel onOpenOutputs={() => setIsExplorerOpen(true)} />
      </main>

      <ArtifactExplorerModal
        documentsArtifact={projectBundle?.documents ?? null}
        isOpen={isExplorerOpen}
        manifestArtifact={manifestArtifact}
        markdownSnapshot={markdownSnapshot}
        onClose={() => setIsExplorerOpen(false)}
        onDownloadManifest={handleDownloadManifest}
        onDownloadMarkdown={handleDownloadMarkdown}
        onDownloadPdf={handleDownloadPdf}
        projectName={projectName}
      />
    </div>
  )
}
