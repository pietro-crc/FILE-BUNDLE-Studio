import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { MarkdownArtifactSnapshot } from '../../core/markdown/types'
import type { ManifestArtifact } from '../../core/manifest/types'
import type { DocumentsArtifact } from '../../core/output/types'
import { ArtifactViewer } from './ArtifactViewer'

interface ArtifactExplorerModalProps {
  readonly documentsArtifact: DocumentsArtifact | null
  readonly isOpen: boolean
  readonly manifestArtifact: ManifestArtifact | null
  readonly markdownSnapshot: MarkdownArtifactSnapshot | null
  readonly onClose: () => void
  readonly onDownloadManifest: () => void
  readonly onDownloadMarkdown: () => void
  readonly onDownloadPdf: () => void
  readonly projectName: string
}

export function ArtifactExplorerModal({
  documentsArtifact,
  isOpen,
  manifestArtifact,
  markdownSnapshot,
  onClose,
  onDownloadManifest,
  onDownloadMarkdown,
  onDownloadPdf,
  projectName,
}: ArtifactExplorerModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const previousOverflow = document.body.style.overflow

    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus()
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div
      className="artifact-explorer-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      role="presentation"
    >
      <section
        aria-labelledby="artifact-explorer-title"
        aria-modal="true"
        className="artifact-explorer-modal"
        role="dialog"
      >
        <header className="artifact-explorer-modal__header">
          <div>
            <span>Generated outputs</span>
            <h2 id="artifact-explorer-title">Explore {projectName}</h2>
            <p>Preview, inspect and download every generated artifact.</p>
          </div>

          <button
            className="button button--secondary artifact-explorer-modal__close"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            Close explorer
          </button>
        </header>

        <div className="artifact-explorer-modal__body">
          <ArtifactViewer
            documentsArtifact={documentsArtifact}
            manifestArtifact={manifestArtifact}
            markdownSnapshot={markdownSnapshot}
            onDownloadManifest={onDownloadManifest}
            onDownloadMarkdown={onDownloadMarkdown}
            onDownloadPdf={onDownloadPdf}
          />
        </div>
      </section>
    </div>,
    document.body,
  )
}
