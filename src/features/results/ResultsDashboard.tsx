import { useState } from 'react'
import { zipSync, strToU8 } from 'fflate'
import type { MarkdownArtifactSnapshot } from '../../core/markdown/types'
import type { ManifestArtifact } from '../../core/manifest/types'
import type { ProjectBundle } from '../../core/output/types'
import { Button } from '../../ui/Button'
import { ArchiveIcon, FilesIcon } from '../../ui/icons'
import { ArtifactExplorerModal } from './ArtifactExplorerModal'
import { ValidationSummary } from './ValidationSummary'
import { AiGuidePanel } from './AiGuidePanel'

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
  const projectName = manifestArtifact?.manifest.projectName || 'project'
  const includedCount = manifestArtifact?.manifest.summary.includedFileCount ?? 0
  const excludedCount = manifestArtifact?.manifest.summary.excludedFileCount ?? 0
  const totalAcquired = includedCount + excludedCount

  const handleDownloadPdf = () => {
    if (!projectBundle?.documents.bytes) return
    const blob = new Blob([new Uint8Array(projectBundle.documents.bytes)], { type: 'application/pdf' })
    downloadBlob(blob, `${projectName}_bundle.pdf`)
  }

  const handleDownloadMarkdown = () => {
    if (!projectBundle?.markdown.parts) return
    const fullMarkdown = projectBundle.markdown.parts.map((p) => p.content).join('\n\n---\n\n')
    const blob = new Blob([fullMarkdown], { type: 'text/markdown;charset=utf-8' })
    downloadBlob(blob, `${projectName}_bundle.md`)
  }

  const handleDownloadManifest = () => {
    if (!manifestArtifact?.json) return
    const blob = new Blob([manifestArtifact.json], { type: 'application/json;charset=utf-8' })
    downloadBlob(blob, `${projectName}_manifest.json`)
  }

  const handleDownloadZipPackage = () => {
    const zipData: Record<string, Uint8Array> = {}

    if (projectBundle?.markdown.parts) {
      const fullMarkdown = projectBundle.markdown.parts.map((p) => p.content).join('\n\n---\n\n')
      zipData[`${projectName}_bundle.md`] = strToU8(fullMarkdown)
    }

    if (projectBundle?.documents.bytes) {
      zipData[`${projectName}_bundle.pdf`] = new Uint8Array(projectBundle.documents.bytes)
    }

    if (manifestArtifact?.json) {
      zipData[`${projectName}_manifest.json`] = strToU8(manifestArtifact.json)
    }

    const zipped = zipSync(zipData)
    const blob = new Blob([zipped.buffer as ArrayBuffer], { type: 'application/zip' })
    downloadBlob(blob, `${projectName}_package.zip`)
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
            <span className="metric-badge__label">Total Size</span>
            <strong className="metric-badge__value">
              {markdownSnapshot ? formatBytes(markdownSnapshot.totalBytes) : '—'}
            </strong>
          </div>
        </div>

        <div className="results-dashboard__download-bar">
          <Button onClick={handleDownloadZipPackage} variant="primary" className="dl-btn dl-btn--zip-primary">
            <ArchiveIcon /> Download Package (.ZIP)
          </Button>

          <div className="download-bar__sub-buttons">
            <span className="download-bar__label">Single files:</span>
            <Button onClick={handleDownloadMarkdown} variant="secondary" className="dl-btn dl-btn--sm">
              <FilesIcon /> .MD
            </Button>
            <Button onClick={handleDownloadPdf} variant="secondary" className="dl-btn dl-btn--sm">
              <FilesIcon /> .PDF
            </Button>
            <Button onClick={handleDownloadManifest} variant="secondary" className="dl-btn dl-btn--sm">
              <ArchiveIcon /> .JSON
            </Button>
          </div>
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
