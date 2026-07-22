import type { SecretCategoryCounts, SecretHandlingMode, SecretScanPolicy } from '../security/types'
import type {
  DetectionMethod,
  FileCategory,
  PreflightEstimateRange,
  PreflightPolicy,
  PreflightRecommendation,
  PreflightRisk,
  RecommendedOutputMode,
  RiskLevel,
  TextEncoding,
} from '../preflight/types'
import type {
  CapabilityLevel,
  ImportIssueCode,
  ImportIssueSeverity,
  InputSource,
} from '../vfs/types'

export const MANIFEST_SCHEMA_VERSION = '1.0.0' as const
export const MANIFEST_MEDIA_TYPE = 'application/vnd.ai-bundle-studio.manifest+json' as const

export type ManifestNodeKind = 'directory' | 'file'
export type ManifestOutputFamily = 'documents' | 'content' | 'manifest'
export type ManifestOutputKind = 'pdf' | 'markdown' | 'json'
export type ManifestOutputStatus = 'planned' | 'generated' | 'failed'
export type ManifestConversionStatus = 'not-started' | 'completed' | 'partial' | 'failed' | 'not-applicable'
export type ManifestIntegrityStatus = 'pending' | 'computed' | 'failed'
export type ManifestInclusionReason = 'selected' | 'blocked-capability' | 'excluded-glob' | 'excluded-manual' | 'excluded-secret-policy'

export interface ManifestApplication {
  readonly name: 'AI Bundle Studio'
  readonly version: string
}

export interface ManifestInstructionSet {
  readonly entryPoint: 'manifest'
  readonly steps: readonly string[]
}

export interface ManifestImportIssue {
  readonly code: ImportIssueCode
  readonly severity: ImportIssueSeverity
  readonly message: string
  readonly path: string | null
}

export interface ManifestInput {
  readonly source: InputSource
  readonly sourceBytes: number
  readonly logicalBytes: number
  readonly importIssues: readonly ManifestImportIssue[]
}

export interface ManifestSettings {
  readonly outputMode: RecommendedOutputMode
  readonly exclusionGlobs: readonly string[]
  readonly language: string
  readonly includeExtractedText: boolean
  readonly nestedArchiveDepth: number
  readonly secretHandling: SecretHandlingMode
}

export interface ManifestRangeSet {
  readonly markdown: PreflightEstimateRange
  readonly pdf: PreflightEstimateRange
  readonly manifest: PreflightEstimateRange
  readonly estimatedPeakMemory: PreflightEstimateRange
}

export interface ManifestPreflight {
  readonly status: 'complete'
  readonly policy: PreflightPolicy
  readonly recommendation: PreflightRecommendation
  readonly estimates: ManifestRangeSet
}

export interface ManifestTreeNode {
  readonly nodeId: string
  readonly kind: ManifestNodeKind
  readonly name: string
  readonly normalizedPath: string
  readonly children: readonly ManifestTreeNode[]
}

export interface ManifestDirectoryRecord {
  readonly directoryId: string
  readonly originalPath: string
  readonly normalizedPath: string
  readonly name: string
  readonly source: InputSource | 'virtual'
  readonly parentDirectoryId: string | null
  readonly childDirectoryIds: readonly string[]
  readonly childFileIds: readonly string[]
}

export interface ManifestIntegrityRecord {
  readonly algorithm: 'SHA-256'
  readonly status: ManifestIntegrityStatus
  readonly value: string | null
  readonly error: string | null
}

export interface ManifestInclusionRecord {
  readonly included: boolean
  readonly reason: ManifestInclusionReason
  readonly matchedGlob: string | null
}

export interface ManifestRepresentationRecord {
  readonly manifest: {
    readonly recorded: true
    readonly pointer: string
  }
  readonly markdown: {
    readonly status: ManifestConversionStatus
    readonly anchors: readonly string[]
    readonly parts: readonly string[]
    readonly truncated: boolean
    readonly originalBytes: number
    readonly extractedBytes: number
    readonly extractedCharacters: number
    readonly lineCount: number
    readonly encoding: TextEncoding | null
    readonly usedFallback: boolean
    readonly replacementCharacters: number
    readonly newlineNormalization: 'lf' | null
    readonly error: string | null
  }
  readonly pdf: {
    readonly status: ManifestConversionStatus
    readonly pages: readonly number[]
    readonly parts: readonly string[]
  }
}

export interface ManifestAdapterRecord {
  readonly id: string
  readonly version: string | null
  readonly conversionStatus: ManifestConversionStatus
}


export interface ManifestFileSecurityRecord {
  readonly status: 'not-scanned' | 'clean' | 'flagged' | 'redacted' | 'excluded' | 'failed'
  readonly findingCount: number
  readonly highSeverityCount: number
  readonly mediumSeverityCount: number
  readonly categories: readonly string[]
  readonly redactionCount: number
  readonly excluded: boolean
  readonly visualOmitted: boolean
  readonly scanTruncated: boolean
  readonly warnings: readonly string[]
  readonly error: string | null
}

export interface ManifestSecuritySummary {
  readonly mode: SecretHandlingMode
  readonly policy: SecretScanPolicy
  readonly scannedFileCount: number
  readonly flaggedFileCount: number
  readonly findingCount: number
  readonly redactionCount: number
  readonly excludedFileCount: number
  readonly visualOmittedFileCount: number
  readonly truncatedScanCount: number
  readonly failedScanCount: number
  readonly categoryCounts: SecretCategoryCounts
}

export interface ManifestFileRecord {
  readonly fileId: string
  readonly originalPath: string
  readonly normalizedPath: string
  readonly parentDirectoryId: string
  readonly name: string
  readonly extension: string
  readonly source: InputSource
  readonly size: number
  readonly compressedSize: number
  readonly lastModified: number | null
  readonly mimeDeclared: string | null
  readonly mimeDetected: string
  readonly detectionMethod: DetectionMethod
  readonly category: FileCategory
  readonly capabilityLevel: CapabilityLevel
  readonly supportReason: string
  readonly isText: boolean
  readonly encoding: TextEncoding | null
  readonly risks: readonly PreflightRisk[]
  readonly riskLevel: RiskLevel
  readonly warnings: readonly string[]
  readonly errors: readonly string[]
  readonly inclusion: ManifestInclusionRecord
  readonly security: ManifestFileSecurityRecord
  readonly integrity: ManifestIntegrityRecord
  readonly adapter: ManifestAdapterRecord
  readonly representations: ManifestRepresentationRecord
}

export interface ManifestOutputRecord {
  readonly family: ManifestOutputFamily
  readonly kind: ManifestOutputKind
  readonly status: ManifestOutputStatus
  readonly parts: readonly string[]
  readonly sha256: string | null
}

export interface ManifestSummary {
  readonly fileCount: number
  readonly directoryCount: number
  readonly includedFileCount: number
  readonly excludedFileCount: number
  readonly blockedFileCount: number
  readonly sourceBytes: number
  readonly logicalBytes: number
  readonly includedLogicalBytes: number
  readonly capabilityCounts: Readonly<Record<CapabilityLevel, number>>
  readonly riskCounts: Readonly<Record<RiskLevel, number>>
}

export interface ManifestShardingPlan {
  readonly mode: RecommendedOutputMode
  readonly applied: boolean
  readonly parts: readonly string[]
}

export interface ManifestV1 {
  readonly schemaVersion: typeof MANIFEST_SCHEMA_VERSION
  readonly mediaType: typeof MANIFEST_MEDIA_TYPE
  readonly application: ManifestApplication
  readonly generatedAt: string
  readonly projectName: string
  readonly instructions: ManifestInstructionSet
  readonly input: ManifestInput
  readonly settings: ManifestSettings
  readonly preflight: ManifestPreflight
  readonly summary: ManifestSummary
  readonly security: ManifestSecuritySummary
  readonly tree: ManifestTreeNode
  readonly directories: readonly ManifestDirectoryRecord[]
  readonly files: readonly ManifestFileRecord[]
  readonly outputs: readonly ManifestOutputRecord[]
  readonly sharding: ManifestShardingPlan
}

export interface ManifestValidationError {
  readonly code: string
  readonly path: string
  readonly message: string
}

export interface ManifestValidationResult {
  readonly valid: boolean
  readonly errors: readonly ManifestValidationError[]
}

export interface ManifestArtifact {
  readonly manifest: ManifestV1
  readonly json: string
  readonly byteLength: number
  readonly validation: ManifestValidationResult
}
