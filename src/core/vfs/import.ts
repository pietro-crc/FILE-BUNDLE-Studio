import { BlobByteSource } from './byte-sources'
import { findVirtualPathConflict, normalizeVirtualPath, PathValidationError, type PathPolicy } from './path'
import { buildVirtualTree, type VirtualDirectorySeed } from './tree'
import type {
  ImportIssue,
  ImportResult,
  InputSource,
  VirtualFile,
  VirtualFileSystem,
} from './types'

export interface FileCandidate {
  readonly file: File
  readonly path: string
  readonly source: Exclude<InputSource, 'zip'>
}

export interface DirectoryCandidate {
  readonly path: string
  readonly source: Exclude<InputSource, 'file-picker' | 'zip'>
}

export interface BuildFileSystemOptions {
  readonly directories?: readonly DirectoryCandidate[]
  readonly pathPolicy?: PathPolicy
  readonly source?: Exclude<InputSource, 'zip'>
}

function createFileId(source: InputSource, normalizedPath: string, sequence: number): string {
  return `${source}:${sequence}:${encodeURIComponent(normalizedPath)}`
}

function buildFileSystem(
  files: readonly VirtualFile[],
  source: InputSource,
  explicitDirectories: readonly VirtualDirectorySeed[] = [],
  sourceBytes = files.reduce((total, file) => total + file.size, 0),
): VirtualFileSystem {
  const { root, directories } = buildVirtualTree(files, explicitDirectories)
  return {
    root,
    files,
    directories,
    summary: {
      fileCount: files.length,
      directoryCount: Math.max(0, directories.length - 1),
      totalBytes: files.reduce((total, file) => total + file.size, 0),
      sourceBytes,
      source,
    },
    dispose() {
      files.forEach((file) => file.bytes.dispose())
    },
  }
}

function directoryConflict(
  directoryPaths: ReadonlySet<string>,
  filePaths: ReadonlySet<string>,
  candidatePath: string,
): string | null {
  if (filePaths.has(candidatePath)) {
    return candidatePath
  }
  return findVirtualPathConflict(filePaths, candidatePath) ??
    [...directoryPaths].find((directoryPath) => directoryPath === candidatePath) ??
    null
}

function fileDirectoryConflict(directoryPaths: ReadonlySet<string>, candidatePath: string): string | null {
  if (directoryPaths.has(candidatePath)) {
    return candidatePath
  }
  const descendantPrefix = `${candidatePath}/`
  return [...directoryPaths].find((directoryPath) => directoryPath.startsWith(descendantPrefix)) ?? null
}

export function createEmptyFileSystem(source: InputSource): VirtualFileSystem {
  return buildFileSystem([], source)
}

export function createVirtualFileSystemFromFiles(
  candidates: readonly FileCandidate[],
  options: BuildFileSystemOptions = {},
): ImportResult {
  const issues: ImportIssue[] = []
  const files: VirtualFile[] = []
  const directories: VirtualDirectorySeed[] = []
  const knownFilePaths = new Set<string>()
  const knownDirectoryPaths = new Set<string>()
  const source = candidates[0]?.source ?? options.directories?.[0]?.source ?? options.source ?? 'file-picker'

  if (candidates.length === 0 && (options.directories?.length ?? 0) === 0) {
    issues.push({ code: 'empty-selection', message: 'Nessun file o cartella selezionato.', severity: 'warning' })
  }

  options.directories?.forEach((candidate) => {
    try {
      const normalized = normalizeVirtualPath(candidate.path, options.pathPolicy)
      if (knownDirectoryPaths.has(normalized.normalizedPath)) {
        return
      }
      const conflictingPath = directoryConflict(knownDirectoryPaths, knownFilePaths, normalized.normalizedPath)
      if (conflictingPath) {
        issues.push({
          code: 'path-conflict',
          message: `La cartella collide con il nodo file o directory ${conflictingPath}.`,
          path: candidate.path,
          severity: 'error',
        })
        return
      }
      knownDirectoryPaths.add(normalized.normalizedPath)
      directories.push({
        path: candidate.path,
        normalizedPath: normalized.normalizedPath,
        name: normalized.name,
        source: candidate.source,
      })
    } catch (error) {
      if (error instanceof PathValidationError) {
        issues.push({ code: error.code, message: error.message, path: error.path, severity: 'error' })
        return
      }
      issues.push({
        code: 'read-failed',
        message: error instanceof Error ? error.message : 'Impossibile acquisire la cartella.',
        path: candidate.path,
        severity: 'error',
      })
    }
  })

  candidates.forEach((candidate, sequence) => {
    try {
      const normalized = normalizeVirtualPath(candidate.path, options.pathPolicy)
      if (knownFilePaths.has(normalized.normalizedPath)) {
        issues.push({
          code: 'duplicate-path',
          message: 'Un altro file usa già lo stesso percorso normalizzato; il duplicato è stato escluso.',
          path: candidate.path,
          severity: 'error',
        })
        return
      }

      const conflictingPath =
        findVirtualPathConflict(knownFilePaths, normalized.normalizedPath) ??
        fileDirectoryConflict(knownDirectoryPaths, normalized.normalizedPath)
      if (conflictingPath) {
        issues.push({
          code: 'path-conflict',
          message: `Il percorso collide con il nodo file o directory ${conflictingPath}.`,
          path: candidate.path,
          severity: 'error',
        })
        return
      }

      knownFilePaths.add(normalized.normalizedPath)
      const segments = normalized.normalizedPath.split('/')
      for (let index = 1; index < segments.length; index += 1) {
        knownDirectoryPaths.add(segments.slice(0, index).join('/'))
      }

      files.push({
        id: createFileId(candidate.source, normalized.normalizedPath, sequence),
        path: candidate.path,
        normalizedPath: normalized.normalizedPath,
        name: normalized.name,
        extension: normalized.extension,
        kind: 'file',
        size: candidate.file.size,
        source: candidate.source,
        ...(candidate.file.type ? { mimeDeclared: candidate.file.type } : {}),
        ...(candidate.file.lastModified ? { lastModified: candidate.file.lastModified } : {}),
        status: 'pending',
        warnings: [],
        errors: [],
        bytes: new BlobByteSource(candidate.file),
      })
    } catch (error) {
      if (error instanceof PathValidationError) {
        issues.push({ code: error.code, message: error.message, path: error.path, severity: 'error' })
        return
      }
      issues.push({
        code: 'read-failed',
        message: error instanceof Error ? error.message : 'Impossibile acquisire il file.',
        path: candidate.path,
        severity: 'error',
      })
    }
  })

  return { fileSystem: buildFileSystem(files, source, directories), issues }
}

export function createVirtualFileSystemFromPreparedFiles(
  files: readonly VirtualFile[],
  issues: readonly ImportIssue[],
  source: InputSource,
  directories: readonly VirtualDirectorySeed[] = [],
  sourceBytes?: number,
): ImportResult {
  return { fileSystem: buildFileSystem(files, source, directories, sourceBytes), issues }
}
