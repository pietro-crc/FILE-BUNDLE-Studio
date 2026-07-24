import type { CapabilityLevel, ImportIssue, InputSource } from '../vfs/types'

export type FileCategory =
  | 'archive'
  | 'audio'
  | 'binary'
  | 'code'
  | 'database'
  | 'document'
  | 'image'
  | 'presentation'
  | 'spreadsheet'
  | 'text'
  | 'video'

export type DetectionMethod = 'signature' | 'container-extension' | 'extension' | 'declared' | 'text-heuristic' | 'unknown'
export type TextEncoding = 'utf-8' | 'utf-8-bom' | 'utf-16be' | 'utf-16le' | 'windows-1252'
export type RiskLevel = 'low' | 'medium' | 'high'

export type PreflightRiskCode =
  | 'active-content'
  | 'archive-nested'
  | 'binary-unknown'
  | 'compression-ratio'
  | 'executable-content'
  | 'large-file'
  | 'mime-mismatch'
  | 'office-macro'
  | 'sensitive-name'
  | 'text-decoding'

export interface PreflightRisk {
  readonly code: PreflightRiskCode
  readonly level: RiskLevel
  readonly message: string
}

export interface PreflightEstimateRange {
  readonly minBytes: number
  readonly maxBytes: number
}

export interface FileOutputEstimate {
  readonly markdown: PreflightEstimateRange
  readonly pdf: PreflightEstimateRange
  readonly manifest: PreflightEstimateRange
}

export interface PreflightFileRecord {
  readonly fileId: string
  readonly path: string
  readonly name: string
  readonly extension: string
  readonly source: InputSource
  readonly size: number
  readonly compressedSize: number
  readonly mimeDeclared?: string
  readonly mimeDetected: string
  readonly detectionMethod: DetectionMethod
  readonly category: FileCategory
  readonly capabilityLevel: CapabilityLevel
  readonly adapterId: string
  readonly supportReason: string
  readonly isText: boolean
  readonly encoding?: TextEncoding
  readonly risks: readonly PreflightRisk[]
  readonly riskLevel: RiskLevel
  readonly warnings: readonly string[]
  readonly defaultIncluded: boolean
  readonly estimate: FileOutputEstimate
}

export interface PreflightTotals {
  readonly sourceBytes: number
  readonly compressedPayloadBytes: number
  readonly logicalBytes: number
  readonly fileCount: number
  readonly directoryCount: number
  readonly distinctMimeCount: number
  readonly capabilityCounts: Readonly<Record<CapabilityLevel, number>>
  readonly riskCounts: Readonly<Record<RiskLevel, number>>
  readonly markdown: PreflightEstimateRange
  readonly pdf: PreflightEstimateRange
  readonly manifest: PreflightEstimateRange
  readonly estimatedPeakMemory: PreflightEstimateRange
}

export type RecommendedOutputMode = 'three-files' | 'multipart' | 'quick-preview'

export interface PreflightRecommendation {
  readonly mode: RecommendedOutputMode
  readonly reason: string
  readonly confidence: 'low' | 'medium'
}

export interface PreflightPolicy {
  readonly maxSignatureBytes: number
  readonly maxConcurrentReads: number
  readonly mediumFileBytes: number
  readonly highFileBytes: number
  readonly mediumCompressionRatio: number
  readonly multipartOutputBytes: number
  readonly quickPreviewLogicalBytes: number
  readonly quickPreviewFileCount: number
}

export interface PreflightReport {
  readonly files: readonly PreflightFileRecord[]
  readonly totals: PreflightTotals
  readonly recommendation: PreflightRecommendation
  readonly importIssues: readonly ImportIssue[]
  readonly policy: PreflightPolicy
}

export interface PreflightProgress {
  readonly completed: number
  readonly total: number
  readonly currentPath?: string
}

export interface PreflightSelection {
  readonly excludedFileIds: ReadonlySet<string>
  readonly exclusionGlobs: readonly string[]
}
