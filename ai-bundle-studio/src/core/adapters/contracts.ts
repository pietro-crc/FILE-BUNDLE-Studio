import type { CapabilityLevel, VirtualFile } from '../vfs/types'

export interface AdapterContext {
  readonly signal: AbortSignal
  readonly maxExtractedBytes: number
  readonly locale: string
  reportProgress(event: AdapterProgressEvent): void
}

export interface AdapterProgressEvent {
  readonly phase: 'inspect' | 'extract' | 'render'
  readonly completed: number
  readonly total?: number
  readonly message?: string
}

export interface SupportDecision {
  readonly supported: boolean
  readonly capabilityLevel: CapabilityLevel
  readonly confidence: 'signature' | 'mime' | 'extension' | 'fallback'
  readonly reason: string
}

export interface InspectionResult {
  readonly metadata: Readonly<Record<string, unknown>>
  readonly warnings: readonly string[]
  readonly securityFlags: readonly string[]
}

export interface ExtractionResult {
  readonly markdown?: string
  readonly structuredData?: unknown
  readonly warnings: readonly string[]
  readonly truncated: boolean
}

export interface RenderResult {
  readonly mediaType: 'application/pdf' | 'image/png'
  readonly bytes: Uint8Array
  readonly warnings: readonly string[]
}

export interface FileAdapter {
  readonly id: string
  readonly version: string
  supports(file: VirtualFile, context: AdapterContext): Promise<SupportDecision>
  inspect(file: VirtualFile, context: AdapterContext): Promise<InspectionResult>
  extract(file: VirtualFile, context: AdapterContext): Promise<ExtractionResult>
  render?(file: VirtualFile, context: AdapterContext): Promise<RenderResult>
  dispose?(): void | Promise<void>
}
