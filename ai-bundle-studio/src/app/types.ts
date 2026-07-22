import type { ImportSessionSnapshot } from '../core/vfs/snapshot'
import type { VirtualFileSystem, ImportResult } from '../core/vfs/types'
import type { PreflightReport, PreflightSelection } from '../core/preflight/types'
import type { ManifestArtifact } from '../core/manifest/types'
import type { MarkdownArtifactSnapshot, MarkdownGenerationProgress } from '../core/markdown/types'
import type { ProjectBundle } from '../core/output/types'

export type AppWorkflowState =
  | 'idle'
  | 'file-selected'
  | 'ready-to-process'
  | 'processing'
  | 'completed'
  | 'error'

export type ProcessingPhase = 'parsing' | 'processing' | 'recombining' | 'completed'

export interface WorkflowStateData {
  readonly state: AppWorkflowState
  readonly fileSystem: VirtualFileSystem | null
  readonly importSnapshot: ImportSessionSnapshot | null
  readonly preflightReport: PreflightReport | null
  readonly preflightSelection: PreflightSelection
  readonly manifestArtifact: ManifestArtifact | null
  readonly projectBundle: ProjectBundle | null
  readonly markdownSnapshot: MarkdownArtifactSnapshot | null
  readonly progress: MarkdownGenerationProgress | null
  readonly phase: ProcessingPhase
  readonly statusMessage: string
  readonly errorMessage: string | null
}
