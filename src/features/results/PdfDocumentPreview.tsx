import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { safeDynamicImport } from '../../core/utils/dynamic-import'

interface PdfDocumentPreviewProps {
  readonly bytes: Uint8Array | null
}

type PreviewStatus = 'idle' | 'loading' | 'ready' | 'error'

export function PdfDocumentPreview({ bytes }: PdfDocumentPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [pageCount, setPageCount] = useState(0)
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>('idle')
  const [viewportWidth, setViewportWidth] = useState(0)

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setViewportWidth(Math.floor(entry.contentRect.width))
    })
    observer.observe(viewport)

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!bytes?.length) {
      setDocument(null)
      setPageCount(0)
      setPreviewStatus('idle')
      return
    }

    let isActive = true
    let loadedDocument: PDFDocumentProxy | null = null
    let loadingTask: { destroy(): Promise<void> } | null = null

    setPreviewStatus('loading')

    void (async () => {
      try {
        const [{ getDocument }, workerModule] = await Promise.all([
          safeDynamicImport(() => import('pdfjs-dist')),
          safeDynamicImport(() => import('pdfjs-dist/build/pdf.worker.min.mjs')),
        ])
        ;(globalThis as typeof globalThis & { pdfjsWorker?: unknown }).pdfjsWorker = workerModule

        const task = getDocument({
          data: bytes.slice(),
          disableFontFace: true,
          isEvalSupported: false,
          useSystemFonts: false,
          useWorkerFetch: false,
          verbosity: 0,
        } as unknown as Parameters<typeof getDocument>[0])
        loadingTask = task
        loadedDocument = await task.promise

        if (!isActive) return
        setDocument(loadedDocument)
        setPageCount(loadedDocument.numPages)
        setPageNumber(1)
        setPreviewStatus('ready')
      } catch {
        if (isActive) setPreviewStatus('error')
      }
    })()

    return () => {
      isActive = false
      void loadingTask?.destroy()
    }
  }, [bytes])

  useEffect(() => {
    if (!document || !canvasRef.current || viewportWidth === 0) return

    let isActive = true
    let renderTask: RenderTask | null = null

    void (async () => {
      const page = await document.getPage(pageNumber)
      if (!isActive || !canvasRef.current) return

      const baseViewport = page.getViewport({ scale: 1 })
      const availableWidth = Math.max(280, viewportWidth - 48)
      const cssScale = Math.min(1.6, availableWidth / baseViewport.width)
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
      const renderViewport = page.getViewport({ scale: cssScale * pixelRatio })
      const canvas = canvasRef.current

      canvas.width = Math.floor(renderViewport.width)
      canvas.height = Math.floor(renderViewport.height)
      canvas.style.width = `${Math.floor(renderViewport.width / pixelRatio)}px`
      canvas.style.height = `${Math.floor(renderViewport.height / pixelRatio)}px`

      renderTask = page.render({ canvas, viewport: renderViewport })
      await renderTask.promise
    })().catch(() => {
      if (isActive) setPreviewStatus('error')
    })

    return () => {
      isActive = false
      renderTask?.cancel()
    }
  }, [document, pageNumber, viewportWidth])

  const showPreviousPage = () => setPageNumber((current) => Math.max(1, current - 1))
  const showNextPage = () => setPageNumber((current) => Math.min(pageCount, current + 1))

  return (
    <div className="pdf-preview" aria-busy={previewStatus === 'loading'}>
      <div className="pdf-preview__toolbar">
        <button disabled={pageNumber <= 1} onClick={showPreviousPage} type="button">
          Previous
        </button>
        <span>
          Page <strong>{pageNumber}</strong> of <strong>{pageCount || '—'}</strong>
        </span>
        <button disabled={pageNumber >= pageCount} onClick={showNextPage} type="button">
          Next
        </button>
      </div>

      <div className="pdf-preview__viewport" ref={viewportRef}>
        {previewStatus === 'loading' ? (
          <div className="artifact-preview-empty">Rendering PDF preview…</div>
        ) : null}
        {previewStatus === 'error' ? (
          <div className="artifact-preview-empty">PDF preview unavailable. The download remains available.</div>
        ) : null}
        {previewStatus === 'idle' ? (
          <div className="artifact-preview-empty">No PDF preview available.</div>
        ) : null}
        <canvas
          className={previewStatus === 'ready' ? 'pdf-preview__canvas is-visible' : 'pdf-preview__canvas'}
          ref={canvasRef}
        />
      </div>
    </div>
  )
}
