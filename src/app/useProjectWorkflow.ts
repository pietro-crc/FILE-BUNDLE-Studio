import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppWorkflowState, ProcessingPhase } from './types'
import { createImportSessionSnapshot, type ImportSessionSnapshot } from '../core/vfs/snapshot'
import type { ImportResult, VirtualFileSystem } from '../core/vfs/types'
import type { PreflightReport, PreflightSelection } from '../core/preflight/types'
import type { ManifestArtifact } from '../core/manifest/types'
import { createMarkdownArtifactSnapshot } from '../core/markdown/snapshot'
import type { MarkdownArtifactSnapshot, MarkdownGenerationProgress } from '../core/markdown/types'
import type { ProjectBundle } from '../core/output/types'
import type { SecretHandlingMode } from '../core/security/types'
import { analyzeVirtualFileSystem } from '../core/preflight/analyze'
import { createManifestV1 } from '../core/manifest/generate'
import { generateProjectBundle } from '../core/output/generate'

export function useProjectWorkflow() {
  const [state, setState] = useState<AppWorkflowState>('idle')
  const fileSystem = useRef<VirtualFileSystem | null>(null)
  const [importSnapshot, setImportSnapshot] = useState<ImportSessionSnapshot | null>(null)
  const [preflightReport, setPreflightReport] = useState<PreflightReport | null>(null)
  const [manifestArtifact, setManifestArtifact] = useState<ManifestArtifact | null>(null)
  const projectBundle = useRef<ProjectBundle | null>(null)
  const [markdownSnapshot, setMarkdownSnapshot] = useState<MarkdownArtifactSnapshot | null>(null)
  const [progress, setProgress] = useState<MarkdownGenerationProgress | null>(null)
  const [phase, setPhase] = useState<ProcessingPhase>('parsing')
  const [statusMessage, setStatusMessage] = useState('Ready to acquire local files.')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [secretHandling, setSecretHandling] = useState<SecretHandlingMode>('redact')
  const abortController = useRef<AbortController | null>(null)

  const [preflightSelection] = useState<PreflightSelection>({
    excludedFileIds: new Set(),
    exclusionGlobs: [],
  })

  useEffect(() => () => fileSystem.current?.dispose(), [])

  const resetAll = useCallback(() => {
    if (abortController.current) {
      abortController.current.abort('Application reset')
      abortController.current = null
    }
    fileSystem.current?.dispose()
    fileSystem.current = null
    setImportSnapshot(null)
    setPreflightReport(null)
    setManifestArtifact(null)
    projectBundle.current = null
    setMarkdownSnapshot(null)
    setProgress(null)
    setPhase('parsing')
    setErrorMessage(null)
    setSecretHandling('redact')
    setStatusMessage('Ready to acquire local files.')
    setState('idle')
  }, [])

  const handleImport = useCallback((result: ImportResult, sourceLabel: string) => {
    fileSystem.current?.dispose()
    fileSystem.current = result.fileSystem
    const snapshot = createImportSessionSnapshot(result.fileSystem, result.issues)
    setImportSnapshot(snapshot)
    setPreflightReport(null)
    setManifestArtifact(null)
    projectBundle.current = null
    setMarkdownSnapshot(null)
    setErrorMessage(null)
    setStatusMessage(`${sourceLabel}: ${snapshot.fileCount} files acquired.`)
    setState('file-selected')
  }, [])

  const cancelProcessing = useCallback(() => {
    if (abortController.current) {
      abortController.current.abort('User request')
      abortController.current = null
    }
    setStatusMessage('Processing cancelled by user.')
    setState('file-selected')
  }, [])

  const startProcessing = useCallback(async () => {
    if (!fileSystem.current) {
      setErrorMessage('No project selected.')
      setState('error')
      return
    }

    const controller = new AbortController()
    abortController.current = controller
    setState('processing')
    setPhase('parsing')
    setErrorMessage(null)
    setStatusMessage('Preflight analysis and indexing in progress…')

    try {
      // Step 1: Preflight analysis if not already run
      let currentReport = preflightReport
      if (!currentReport) {
        currentReport = await analyzeVirtualFileSystem(fileSystem.current, {
          importIssues: importSnapshot?.issues ?? [],
          signal: controller.signal,
        })
        setPreflightReport(currentReport)
      }

      // Step 2: Manifest V1 creation if not already created
      let currentManifest = manifestArtifact
      if (!currentManifest || currentManifest.manifest.settings.secretHandling !== secretHandling) {
        currentManifest = await createManifestV1(
          fileSystem.current,
          currentReport,
          preflightSelection,
          {
            projectName: importSnapshot?.root.name || 'project',
            outputMode: currentReport.recommendation.mode,
            secretHandling,
          },
        )
        setManifestArtifact(currentManifest)
      }

      // Step 3: Bundle & Markdown generation
      setPhase('processing')
      setStatusMessage('Extracting content, PDF, and Markdown…')

      const bundle = await generateProjectBundle(fileSystem.current, currentManifest, {
        signal: controller.signal,
        onProgress: (p) => {
          setProgress(p)
          if (p.completed > 0 && p.total > 0) {
            const ratio = p.completed / p.total
            if (ratio > 0.8) {
              setPhase('recombining')
              setStatusMessage('Assembling and validating final output…')
            } else {
              setPhase('processing')
              setStatusMessage(`Processing files: ${p.completed} / ${p.total}`)
            }
          }
        },
      })

      const snapshot = createMarkdownArtifactSnapshot(bundle.markdown, bundle.documents)
      projectBundle.current = bundle
      setMarkdownSnapshot(snapshot)
      setManifestArtifact(bundle.manifest)
      setPhase('completed')
      setStatusMessage('Processing completed successfully!')
      setState('completed')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setStatusMessage('Processing cancelled.')
        setState('file-selected')
      } else {
        const msg = error instanceof Error ? error.message : 'Unexpected error during processing.'
        setErrorMessage(msg)
        setStatusMessage(`Error: ${msg}`)
        setState('error')
      }
    } finally {
      abortController.current = null
    }
  }, [importSnapshot, manifestArtifact, preflightReport, preflightSelection, secretHandling])

  return {
    state,
    fileSystem: fileSystem.current,
    importSnapshot,
    preflightReport,
    manifestArtifact,
    projectBundle: projectBundle.current,
    markdownSnapshot,
    progress,
    phase,
    statusMessage,
    errorMessage,
    secretHandling,
    handleImport,
    resetAll,
    startProcessing,
    cancelProcessing,
    setStatusMessage,
    setErrorMessage,
    setSecretHandling,
  }
}
