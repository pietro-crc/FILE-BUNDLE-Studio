import { ZipEntryByteSource } from './byte-sources'
import { createVirtualFileSystemFromPreparedFiles } from './import'
import { findVirtualPathConflict, normalizeVirtualPath, PathValidationError, type PathPolicy } from './path'
import type { VirtualDirectorySeed } from './tree'
import type { ImportIssue, ImportIssueCode, ImportResult, VirtualFile } from './types'

export interface ZipImportLimits {
  readonly maxArchiveBytes: number
  readonly maxEntries: number
  readonly maxEntryBytes: number
  readonly maxTotalUncompressedBytes: number
  readonly maxCompressionRatio: number
}

export interface ZipImportOptions {
  readonly limits?: ZipImportLimits
  readonly pathPolicy?: PathPolicy
}

export const DEFAULT_ZIP_IMPORT_LIMITS: ZipImportLimits = {
  maxArchiveBytes: 512 * 1024 * 1024,
  maxEntries: 20_000,
  maxEntryBytes: 256 * 1024 * 1024,
  maxTotalUncompressedBytes: 1024 * 1024 * 1024,
  maxCompressionRatio: 200,
}

interface CentralDirectoryFlag {
  readonly encrypted: boolean
  readonly dataOffset: number
}

interface ZipInventoryEntry {
  readonly name: string
  readonly compressedSize: number
  readonly originalSize: number
  readonly compression: number
  readonly encrypted: boolean
  readonly dataOffset: number
}

class ZipArchiveError extends Error {
  readonly issueCode: Extract<ImportIssueCode, 'archive-invalid' | 'archive-limit' | 'archive-unsupported'>

  constructor(issueCode: ZipArchiveError['issueCode'], message: string) {
    super(message)
    this.name = 'ZipArchiveError'
    this.issueCode = issueCode
  }
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) {
    return false
  }
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) {
      return false
    }
  }
  return true
}

function readCentralDirectoryFlags(data: Uint8Array, maxEntries: number): CentralDirectoryFlag[] {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const minimumEocdSize = 22
  const searchStart = Math.max(0, data.byteLength - 65_557)
  let eocdOffset = -1

  for (let offset = data.byteLength - minimumEocdSize; offset >= searchStart; offset -= 1) {
    if (view.getUint32(offset, true) !== 0x06054b50) {
      continue
    }
    const commentLength = view.getUint16(offset + 20, true)
    if (offset + minimumEocdSize + commentLength === data.byteLength) {
      eocdOffset = offset
      break
    }
  }

  if (eocdOffset < 0) {
    throw new ZipArchiveError('archive-invalid', 'Struttura ZIP non valida: record finale non trovato.')
  }

  const diskNumber = view.getUint16(eocdOffset + 4, true)
  const centralDirectoryDisk = view.getUint16(eocdOffset + 6, true)
  const entriesOnDisk = view.getUint16(eocdOffset + 8, true)
  const entryCount = view.getUint16(eocdOffset + 10, true)
  const centralDirectorySize = view.getUint32(eocdOffset + 12, true)
  const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true)

  if (diskNumber !== 0 || centralDirectoryDisk !== 0 || entriesOnDisk !== entryCount) {
    throw new ZipArchiveError('archive-unsupported', 'Gli archivi ZIP multi-volume non sono supportati.')
  }

  if (entryCount === 0xffff || centralDirectorySize === 0xffffffff || centralDirectoryOffset === 0xffffffff) {
    throw new ZipArchiveError('archive-unsupported', 'Gli archivi ZIP64 non sono ancora supportati nello STEP-002.')
  }

  if (entryCount > maxEntries) {
    throw new ZipArchiveError(
      'archive-limit',
      `L’archivio contiene ${entryCount} entry, oltre il limite di ${maxEntries}.`,
    )
  }

  const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize
  if (centralDirectoryEnd > eocdOffset || centralDirectoryEnd > data.byteLength) {
    throw new ZipArchiveError('archive-invalid', 'Directory centrale ZIP fuori dai limiti dell’archivio.')
  }

  const flags: CentralDirectoryFlag[] = []
  let offset = centralDirectoryOffset

  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > centralDirectoryEnd || view.getUint32(offset, true) !== 0x02014b50) {
      throw new ZipArchiveError('archive-invalid', 'Directory centrale ZIP corrotta o incompleta.')
    }

    const generalPurposeFlags = view.getUint16(offset + 8, true)
    const compressedSize = view.getUint32(offset + 20, true)
    const originalSize = view.getUint32(offset + 24, true)
    const fileNameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    const localHeaderOffset = view.getUint32(offset + 42, true)
    const centralEntryEnd = offset + 46 + fileNameLength + extraLength + commentLength

    if (centralEntryEnd > centralDirectoryEnd) {
      throw new ZipArchiveError('archive-invalid', 'Entry della directory centrale ZIP fuori dai limiti.')
    }
    if (compressedSize === 0xffffffff || originalSize === 0xffffffff || localHeaderOffset === 0xffffffff) {
      throw new ZipArchiveError('archive-unsupported', 'Le entry ZIP64 non sono ancora supportate nello STEP-002.')
    }
    if (localHeaderOffset + 30 > data.byteLength || view.getUint32(localHeaderOffset, true) !== 0x04034b50) {
      throw new ZipArchiveError('archive-invalid', 'Header locale ZIP mancante o fuori dai limiti.')
    }

    const localFlags = view.getUint16(localHeaderOffset + 6, true)
    const localFileNameLength = view.getUint16(localHeaderOffset + 26, true)
    const localExtraLength = view.getUint16(localHeaderOffset + 28, true)
    const localNameStart = localHeaderOffset + 30
    const localDataStart = localNameStart + localFileNameLength + localExtraLength
    const centralNameStart = offset + 46

    if (localDataStart + compressedSize > data.byteLength) {
      throw new ZipArchiveError('archive-invalid', 'Dati compressi ZIP fuori dai limiti dell’archivio.')
    }

    const centralName = data.subarray(centralNameStart, centralNameStart + fileNameLength)
    const localName = data.subarray(localNameStart, localNameStart + localFileNameLength)
    if (!bytesEqual(centralName, localName)) {
      throw new ZipArchiveError('archive-invalid', 'Nome entry ZIP incoerente tra header centrale e locale.')
    }

    flags.push({
      encrypted: (generalPurposeFlags & 0x0001) !== 0 || (localFlags & 0x0001) !== 0,
      dataOffset: localDataStart,
    })
    offset = centralEntryEnd
  }

  if (offset !== centralDirectoryEnd) {
    throw new ZipArchiveError('archive-unsupported', 'La directory centrale contiene record aggiuntivi non supportati.')
  }

  return flags
}

async function inventoryZip(data: Uint8Array, maxEntries: number): Promise<readonly ZipInventoryEntry[]> {
  const flags = readCentralDirectoryFlags(data, maxEntries)
  const { unzipSync } = await import('fflate')
  const entries: Array<Omit<ZipInventoryEntry, 'encrypted' | 'dataOffset'>> = []

  unzipSync(data, {
    filter: (entry) => {
      entries.push({
        name: entry.name,
        compressedSize: entry.size,
        originalSize: entry.originalSize,
        compression: entry.compression,
      })
      return false
    },
  })

  if (flags.length !== entries.length) {
    throw new ZipArchiveError('archive-invalid', 'Il numero di entry ZIP non coincide con la directory centrale.')
  }

  return entries.map((entry, index) => ({
    ...entry,
    encrypted: flags[index]?.encrypted ?? false,
    dataOffset: flags[index]?.dataOffset ?? 0,
  }))
}

function archiveLimitIssue(message: string, path?: string): ImportIssue {
  return { code: 'archive-limit', message, severity: 'error', ...(path ? { path } : {}) }
}

function fileDirectoryConflict(directoryPaths: ReadonlySet<string>, candidatePath: string): string | null {
  if (directoryPaths.has(candidatePath)) {
    return candidatePath
  }
  const descendantPrefix = `${candidatePath}/`
  return [...directoryPaths].find((directoryPath) => directoryPath.startsWith(descendantPrefix)) ?? null
}

function validateDirectoryEntry(
  entry: ZipInventoryEntry,
  pathPolicy: PathPolicy | undefined,
  directories: VirtualDirectorySeed[],
  directoryPaths: Set<string>,
  issues: ImportIssue[],
): void {
  if (entry.encrypted) {
    issues.push({
      code: 'archive-encrypted',
      message: 'L’entry directory è cifrata e non verrà aperta o aggirata.',
      path: entry.name,
      severity: 'error',
    })
    return
  }

  try {
    const normalized = normalizeVirtualPath(entry.name, pathPolicy)
    if (directoryPaths.has(normalized.normalizedPath)) {
      issues.push({
        code: 'duplicate-path',
        message: 'Un’altra directory usa già lo stesso percorso normalizzato; il duplicato è stato escluso.',
        path: entry.name,
        severity: 'error',
      })
      return
    }
    directoryPaths.add(normalized.normalizedPath)
    directories.push({
      path: entry.name,
      normalizedPath: normalized.normalizedPath,
      name: normalized.name,
      source: 'zip',
    })
  } catch (error) {
    if (error instanceof PathValidationError) {
      issues.push({ code: error.code, message: error.message, path: error.path, severity: 'error' })
      return
    }
    issues.push({
      code: 'archive-invalid',
      message: error instanceof Error ? error.message : 'Directory ZIP non valida.',
      path: entry.name,
      severity: 'error',
    })
  }
}

export async function importZipFile(file: File, options: ZipImportOptions = {}): Promise<ImportResult> {
  const limits = options.limits ?? DEFAULT_ZIP_IMPORT_LIMITS
  const issues: ImportIssue[] = []
  const files: VirtualFile[] = []
  const directories: VirtualDirectorySeed[] = []
  const knownFilePaths = new Set<string>()
  const knownDirectoryPaths = new Set<string>()

  if (file.size > limits.maxArchiveBytes) {
    return createVirtualFileSystemFromPreparedFiles(
      [],
      [archiveLimitIssue(`L’archivio supera il limite compresso di ${limits.maxArchiveBytes} byte.`)],
      'zip',
    )
  }

  let inventory: readonly ZipInventoryEntry[]
  try {
    const archiveBytes = new Uint8Array(await file.arrayBuffer())
    inventory = await inventoryZip(archiveBytes, limits.maxEntries)
  } catch (error) {
    const issueCode = error instanceof ZipArchiveError ? error.issueCode : 'archive-invalid'
    return createVirtualFileSystemFromPreparedFiles(
      [],
      [
        {
          code: issueCode,
          message: error instanceof Error ? error.message : 'Impossibile leggere l’archivio ZIP.',
          severity: 'error',
        },
      ],
      'zip',
    )
  }

  inventory
    .filter((entry) => entry.name.endsWith('/'))
    .forEach((entry) => {
      validateDirectoryEntry(entry, options.pathPolicy, directories, knownDirectoryPaths, issues)
    })

  let totalUncompressedBytes = 0

  inventory.forEach((entry, sequence) => {
    if (entry.name.endsWith('/')) {
      return
    }

    if (entry.encrypted) {
      issues.push({
        code: 'archive-encrypted',
        message: 'L’entry è cifrata e non verrà aperta o aggirata.',
        path: entry.name,
        severity: 'error',
      })
      return
    }

    if (entry.compression !== 0 && entry.compression !== 8) {
      issues.push({
        code: 'archive-unsupported',
        message: `Metodo di compressione ZIP non supportato: ${entry.compression}.`,
        path: entry.name,
        severity: 'error',
      })
      return
    }

    if (entry.originalSize > limits.maxEntryBytes) {
      issues.push(archiveLimitIssue(`L’entry supera il limite di ${limits.maxEntryBytes} byte non compressi.`, entry.name))
      return
    }

    const compressionRatio =
      entry.compressedSize === 0
        ? entry.originalSize === 0
          ? 1
          : Number.POSITIVE_INFINITY
        : entry.originalSize / entry.compressedSize
    if (compressionRatio > limits.maxCompressionRatio) {
      issues.push(
        archiveLimitIssue(
          `Rapporto di compressione ${compressionRatio.toFixed(1)}× oltre il limite ${limits.maxCompressionRatio}×.`,
          entry.name,
        ),
      )
      return
    }

    totalUncompressedBytes += entry.originalSize
    if (totalUncompressedBytes > limits.maxTotalUncompressedBytes) {
      issues.push(
        archiveLimitIssue(
          `La dimensione cumulativa supera il limite di ${limits.maxTotalUncompressedBytes} byte non compressi.`,
          entry.name,
        ),
      )
      return
    }

    try {
      const normalized = normalizeVirtualPath(entry.name, options.pathPolicy)
      if (knownFilePaths.has(normalized.normalizedPath)) {
        issues.push({
          code: 'duplicate-path',
          message: 'Un’altra entry usa già lo stesso percorso normalizzato; il duplicato è stato escluso.',
          path: entry.name,
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
          path: entry.name,
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
        id: `zip:${sequence}:${encodeURIComponent(normalized.normalizedPath)}`,
        path: entry.name,
        normalizedPath: normalized.normalizedPath,
        name: normalized.name,
        extension: normalized.extension,
        kind: 'file',
        size: entry.originalSize,
        source: 'zip',
        ...(file.lastModified ? { lastModified: file.lastModified } : {}),
        status: 'pending',
        warnings: [],
        errors: [],
        archive: {
          archiveName: file.name,
          compressedSize: entry.compressedSize,
          compressionMethod: entry.compression,
          encryptionFlag: entry.encrypted,
        },
        bytes: new ZipEntryByteSource(
          file,
          entry.originalSize,
          entry.compressedSize,
          entry.compression,
          entry.dataOffset,
        ),
      })
    } catch (error) {
      if (error instanceof PathValidationError) {
        issues.push({ code: error.code, message: error.message, path: error.path, severity: 'error' })
        return
      }
      issues.push({
        code: 'archive-invalid',
        message: error instanceof Error ? error.message : 'Entry ZIP non valida.',
        path: entry.name,
        severity: 'error',
      })
    }
  })

  return createVirtualFileSystemFromPreparedFiles(files, issues, 'zip', directories, file.size)
}
