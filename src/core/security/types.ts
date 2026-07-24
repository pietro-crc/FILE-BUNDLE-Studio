export type SecretHandlingMode = 'report-only' | 'redact' | 'exclude'

export type SecretFindingCategory =
  | 'sensitive-filename'
  | 'private-key'
  | 'cloud-credential'
  | 'access-token'
  | 'jwt'
  | 'connection-string'
  | 'password-assignment'
  | 'high-entropy'

export type SecretFindingSeverity = 'medium' | 'high'
export type SecretFindingSource = 'filename' | 'content'
export type SecretFindingConfidence = 'medium' | 'high'

export interface SecretFinding {
  readonly id: string
  readonly category: SecretFindingCategory
  readonly severity: SecretFindingSeverity
  readonly source: SecretFindingSource
  readonly confidence: SecretFindingConfidence
  readonly description: string
  readonly start: number | null
  readonly end: number | null
  readonly line: number | null
  readonly column: number | null
}

export interface SecretScanPolicy {
  readonly maxCharactersPerFile: number
  readonly maxFindingsPerFile: number
  readonly maxCandidateLength: number
  readonly minHighEntropyLength: number
  readonly highEntropyThreshold: number
  readonly scanHighEntropy: boolean
}

export interface SecretFileReport {
  readonly fileId: string
  readonly path: string
  readonly mode: SecretHandlingMode
  readonly status: 'not-scanned' | 'clean' | 'flagged' | 'redacted' | 'excluded' | 'failed'
  readonly scannedCharacters: number
  readonly scanTruncated: boolean
  readonly findings: readonly SecretFinding[]
  readonly redactionCount: number
  readonly excluded: boolean
  readonly visualOmitted: boolean
  readonly warnings: readonly string[]
  readonly error: string | null
}

export interface SecretCategoryCounts {
  readonly 'sensitive-filename': number
  readonly 'private-key': number
  readonly 'cloud-credential': number
  readonly 'access-token': number
  readonly jwt: number
  readonly 'connection-string': number
  readonly 'password-assignment': number
  readonly 'high-entropy': number
}

export interface SecuritySummary {
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

export interface SecuredContent {
  readonly content: string
  readonly report: SecretFileReport
}
