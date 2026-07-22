export type InputSource = 'file-picker' | 'directory-picker' | 'drag-drop' | 'zip'
export type VirtualNodeKind = 'file' | 'directory'
export type CapabilityLevel = 'A' | 'B' | 'C' | 'D' | 'E'
export type FileStatus = 'pending' | 'included' | 'excluded' | 'warning' | 'failed'

export type ImportIssueSeverity = 'warning' | 'error'

export type ImportIssueCode =
  | 'archive-encrypted'
  | 'archive-invalid'
  | 'archive-limit'
  | 'archive-unsupported'
  | 'duplicate-path'
  | 'empty-selection'
  | 'path-absolute'
  | 'path-control-character'
  | 'path-conflict'
  | 'path-depth'
  | 'path-empty'
  | 'path-length'
  | 'path-traversal'
  | 'read-failed'

export interface ImportIssue {
  readonly code: ImportIssueCode
  readonly message: string
  readonly severity: ImportIssueSeverity
  readonly path?: string
}

export interface ByteSource {
  readonly size: number
  read(signal?: AbortSignal): Promise<ArrayBuffer>
  readPrefix(maxBytes: number, signal?: AbortSignal): Promise<ArrayBuffer>
  dispose(): void
}

export interface ArchiveEntryMetadata {
  readonly archiveName: string
  readonly compressedSize: number
  readonly compressionMethod: number
  readonly encryptionFlag: boolean
}

export interface VirtualFile {
  readonly id: string
  readonly path: string
  readonly normalizedPath: string
  readonly name: string
  readonly extension: string
  readonly kind: 'file'
  readonly size: number
  readonly source: InputSource
  readonly mimeDeclared?: string
  readonly mimeDetected?: string
  readonly lastModified?: number
  readonly hash?: string
  readonly status: FileStatus
  readonly capabilityLevel?: CapabilityLevel
  readonly warnings: readonly string[]
  readonly errors: readonly string[]
  readonly archive?: ArchiveEntryMetadata
  readonly bytes: ByteSource
}

export interface VirtualDirectory {
  readonly id: string
  readonly path: string
  readonly normalizedPath: string
  readonly name: string
  readonly kind: 'directory'
  readonly source: InputSource | 'virtual'
  readonly children: readonly VirtualNode[]
}

export type VirtualNode = VirtualFile | VirtualDirectory

export interface VirtualFileSystemSummary {
  readonly fileCount: number
  readonly directoryCount: number
  readonly totalBytes: number
  readonly sourceBytes: number
  readonly source: InputSource
}

export interface VirtualFileSystem {
  readonly root: VirtualDirectory
  readonly files: readonly VirtualFile[]
  readonly directories: readonly VirtualDirectory[]
  readonly summary: VirtualFileSystemSummary
  dispose(): void
}

export interface ImportResult {
  readonly fileSystem: VirtualFileSystem
  readonly issues: readonly ImportIssue[]
}
