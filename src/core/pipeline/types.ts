export const PIPELINE_PHASES = [
  'acquisition',
  'preflight',
  'path-normalization',
  'security-scan',
  'inventory',
  'classification',
  'estimation',
  'adapter-selection',
  'extraction',
  'transformation',
  'markdown-generation',
  'pdf-generation',
  'manifest-generation',
  'cross-validation',
  'sharding',
  'output-hashing',
  'download',
] as const

export type PipelinePhase = (typeof PIPELINE_PHASES)[number]

export interface PipelineProgress {
  readonly phase: PipelinePhase
  readonly completed: number
  readonly total?: number
  readonly currentPath?: string
  readonly elapsedMs: number
  readonly warnings: number
  readonly errors: number
}
