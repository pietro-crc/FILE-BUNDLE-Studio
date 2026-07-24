import { matchesAnyGlob } from '../preflight/glob'
import { DEFAULT_SECRET_SCAN_POLICY } from '../security/policy'
import type { SecretHandlingMode } from '../security/types'
import type { PreflightFileRecord, PreflightReport, PreflightSelection, RecommendedOutputMode, RiskLevel } from '../preflight/types'
import type { CapabilityLevel, VirtualDirectory, VirtualFile, VirtualFileSystem, VirtualNode } from '../vfs/types'
import { createManifestNodeId } from './ids'
import { serializeManifestV1 } from './serialize'
import {
  MANIFEST_MEDIA_TYPE,
  MANIFEST_SCHEMA_VERSION,
  type ManifestArtifact,
  type ManifestDirectoryRecord,
  type ManifestFileRecord,
  type ManifestInclusionRecord,
  type ManifestOutputRecord,
  type ManifestSummary,
  type ManifestTreeNode,
  type ManifestV1,
} from './types'
import { validateManifestV1 } from './validate'

const DEFAULT_APP_VERSION = '0.0.0-step-009'
const encoder = new TextEncoder()

export interface CreateManifestOptions {
  readonly generatedAt?: string
  readonly projectName?: string
  readonly appVersion?: string
  readonly outputMode?: RecommendedOutputMode
  readonly language?: string
  readonly secretHandling?: SecretHandlingMode
}

function normalizeProjectName(value: string | undefined): string {
  const unsafe = new Set(['\\', '/', ':', '*', '?', '"', '<', '>', '|'])
  const normalized = [...(value?.normalize('NFC').trim() ?? '')]
    .map((character) => unsafe.has(character) || (character.codePointAt(0) ?? 0) < 32 ? '-' : character)
    .join('')
  return normalized.length > 0 ? normalized.slice(0, 120) : 'project'
}

function assertGeneratedAt(value: string): string {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) {
    throw new Error('generatedAt deve essere una data ISO-8601 UTC canonica.')
  }
  return value
}

function parentPath(path: string): string {
  const lastSeparator = path.lastIndexOf('/')
  return lastSeparator < 0 ? '' : path.slice(0, lastSeparator)
}

function inclusionFor(record: PreflightFileRecord, selection: PreflightSelection): ManifestInclusionRecord {
  if (!record.defaultIncluded) {
    return { included: false, reason: 'blocked-capability', matchedGlob: null }
  }
  const matchedGlob = selection.exclusionGlobs.find((pattern) => matchesAnyGlob(record.path, [pattern])) ?? null
  if (matchedGlob) {
    return { included: false, reason: 'excluded-glob', matchedGlob }
  }
  if (selection.excludedFileIds.has(record.fileId)) {
    return { included: false, reason: 'excluded-manual', matchedGlob: null }
  }
  return { included: true, reason: 'selected', matchedGlob: null }
}

function emptyCapabilityCounts(): Record<CapabilityLevel, number> {
  return { A: 0, B: 0, C: 0, D: 0, E: 0 }
}

function emptyRiskCounts(): Record<RiskLevel, number> {
  return { low: 0, medium: 0, high: 0 }
}

function plannedOutputs(): readonly ManifestOutputRecord[] {
  return [
    { family: 'documents', kind: 'pdf', status: 'planned', parts: [], sha256: null },
    { family: 'content', kind: 'markdown', status: 'planned', parts: [], sha256: null },
    { family: 'manifest', kind: 'json', status: 'generated', parts: [], sha256: null },
  ]
}

async function createIdMaps(fileSystem: VirtualFileSystem): Promise<{
  readonly directoryIds: ReadonlyMap<string, string>
  readonly fileIds: ReadonlyMap<string, string>
}> {
  const directoryIds = new Map<string, string>()
  const fileIds = new Map<string, string>()
  await Promise.all([
    ...fileSystem.directories.map(async (directory) => {
      directoryIds.set(directory.normalizedPath, await createManifestNodeId('directory', directory.normalizedPath))
    }),
    ...fileSystem.files.map(async (file) => {
      fileIds.set(file.normalizedPath, await createManifestNodeId('file', file.normalizedPath))
    }),
  ])
  return { directoryIds, fileIds }
}

function requiredId(map: ReadonlyMap<string, string>, path: string, kind: 'directory' | 'file'): string {
  const id = map.get(path)
  if (!id) throw new Error(`ID manifest mancante per ${kind} ${path || '/'}.`)
  return id
}

function buildManifestTree(
  node: VirtualNode,
  directoryIds: ReadonlyMap<string, string>,
  fileIds: ReadonlyMap<string, string>,
): ManifestTreeNode {
  const nodeId = node.kind === 'directory'
    ? requiredId(directoryIds, node.normalizedPath, 'directory')
    : requiredId(fileIds, node.normalizedPath, 'file')
  return {
    nodeId,
    kind: node.kind,
    name: node.name,
    normalizedPath: node.normalizedPath,
    children: node.kind === 'directory'
      ? node.children.map((child) => buildManifestTree(child, directoryIds, fileIds))
      : [],
  }
}

function buildDirectoryRecord(
  directory: VirtualDirectory,
  directoryIds: ReadonlyMap<string, string>,
  fileIds: ReadonlyMap<string, string>,
): ManifestDirectoryRecord {
  return {
    directoryId: requiredId(directoryIds, directory.normalizedPath, 'directory'),
    originalPath: directory.path,
    normalizedPath: directory.normalizedPath,
    name: directory.name,
    source: directory.source,
    parentDirectoryId: directory.normalizedPath.length === 0
      ? null
      : requiredId(directoryIds, parentPath(directory.normalizedPath), 'directory'),
    childDirectoryIds: directory.children
      .filter((child): child is VirtualDirectory => child.kind === 'directory')
      .map((child) => requiredId(directoryIds, child.normalizedPath, 'directory')),
    childFileIds: directory.children
      .filter((child): child is VirtualFile => child.kind === 'file')
      .map((child) => requiredId(fileIds, child.normalizedPath, 'file')),
  }
}

function buildFileRecord(
  file: VirtualFile,
  preflight: PreflightFileRecord,
  manifestFileId: string,
  parentDirectoryId: string,
  index: number,
  selection: PreflightSelection,
): ManifestFileRecord {
  const inclusion = inclusionFor(preflight, selection)
  return {
    fileId: manifestFileId,
    originalPath: file.path,
    normalizedPath: file.normalizedPath,
    parentDirectoryId,
    name: file.name,
    extension: file.extension,
    source: file.source,
    size: file.size,
    compressedSize: preflight.compressedSize,
    lastModified: file.lastModified ?? null,
    mimeDeclared: file.mimeDeclared ?? null,
    mimeDetected: preflight.mimeDetected,
    detectionMethod: preflight.detectionMethod,
    category: preflight.category,
    capabilityLevel: preflight.capabilityLevel,
    supportReason: preflight.supportReason,
    isText: preflight.isText,
    encoding: preflight.encoding ?? null,
    risks: preflight.risks,
    riskLevel: preflight.riskLevel,
    warnings: [...new Set([...file.warnings, ...preflight.warnings])],
    errors: file.errors,
    inclusion,
    security: {
      status: 'not-scanned',
      findingCount: 0,
      highSeverityCount: 0,
      mediumSeverityCount: 0,
      categories: [],
      redactionCount: 0,
      excluded: false,
      visualOmitted: false,
      scanTruncated: false,
      warnings: [],
      error: null,
    },
    integrity: { algorithm: 'SHA-256', status: 'pending', value: null, error: null },
    adapter: { id: preflight.adapterId, version: null, conversionStatus: inclusion.included ? 'not-started' : 'not-applicable' },
    representations: {
      manifest: { recorded: true, pointer: `/files/${index}` },
      markdown: {
        status: inclusion.included ? 'not-started' : 'not-applicable',
        anchors: [],
        parts: [],
        truncated: false,
        originalBytes: file.size,
        extractedBytes: 0,
        extractedCharacters: 0,
        lineCount: 0,
        encoding: preflight.encoding ?? null,
        usedFallback: false,
        replacementCharacters: 0,
        newlineNormalization: null,
        error: null,
      },
      pdf: { status: inclusion.included ? 'not-started' : 'not-applicable', pages: [], parts: [] },
    },
  }
}

function buildSummary(files: readonly ManifestFileRecord[], fileSystem: VirtualFileSystem, report: PreflightReport): ManifestSummary {
  const capabilityCounts = emptyCapabilityCounts()
  const riskCounts = emptyRiskCounts()
  let includedLogicalBytes = 0
  let includedFileCount = 0
  let blockedFileCount = 0

  files.forEach((file) => {
    capabilityCounts[file.capabilityLevel] += 1
    riskCounts[file.riskLevel] += 1
    if (file.inclusion.included) {
      includedFileCount += 1
      includedLogicalBytes += file.size
    }
    if (file.inclusion.reason === 'blocked-capability') blockedFileCount += 1
  })

  return {
    fileCount: files.length,
    directoryCount: fileSystem.summary.directoryCount,
    includedFileCount,
    excludedFileCount: files.length - includedFileCount,
    blockedFileCount,
    sourceBytes: report.totals.sourceBytes,
    logicalBytes: report.totals.logicalBytes,
    includedLogicalBytes,
    capabilityCounts,
    riskCounts,
  }
}

export async function createManifestV1(
  fileSystem: VirtualFileSystem,
  report: PreflightReport,
  selection: PreflightSelection,
  options: CreateManifestOptions = {},
): Promise<ManifestArtifact> {
  if (report.files.length !== fileSystem.files.length) {
    throw new Error('Il report preflight non corrisponde al filesystem virtuale corrente.')
  }

  const generatedAt = assertGeneratedAt(options.generatedAt ?? new Date().toISOString())
  const { directoryIds, fileIds } = await createIdMaps(fileSystem)
  const preflightByPath = new Map(report.files.map((record) => [record.path, record]))
  const sortedFiles = [...fileSystem.files]
    // eslint-disable-next-line unicorn/no-array-sort -- Fresh copy; ES2022 lacks toSorted.
    .sort((left, right) => left.normalizedPath.localeCompare(right.normalizedPath, undefined, { numeric: true }))
  const files = sortedFiles.map((file, index) => {
    const preflight = preflightByPath.get(file.normalizedPath)
    if (!preflight) throw new Error(`Record preflight mancante per ${file.normalizedPath}.`)
    return buildFileRecord(
      file,
      preflight,
      requiredId(fileIds, file.normalizedPath, 'file'),
      requiredId(directoryIds, parentPath(file.normalizedPath), 'directory'),
      index,
      selection,
    )
  })
  const directories = [...fileSystem.directories]
    // eslint-disable-next-line unicorn/no-array-sort -- Fresh copy; ES2022 lacks toSorted.
    .sort((left, right) => left.normalizedPath.localeCompare(right.normalizedPath, undefined, { numeric: true }))
    .map((directory) => buildDirectoryRecord(directory, directoryIds, fileIds))
  const outputMode = options.outputMode ?? report.recommendation.mode
  const secretHandling = options.secretHandling ?? 'redact'
  const manifest: ManifestV1 = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    mediaType: MANIFEST_MEDIA_TYPE,
    application: { name: 'AI Bundle Studio', version: options.appVersion ?? DEFAULT_APP_VERSION },
    generatedAt,
    projectName: normalizeProjectName(options.projectName),
    instructions: {
      entryPoint: 'manifest',
      steps: [
        'Leggi questo manifest come indice autorevole prima degli altri output.',
        'Usa sempre i percorsi originali e non confondere file omonimi.',
        'Consulta il PDF per la rappresentazione visuale e il Markdown per testo, codice e tabelle.',
        'Dichiara quando un file è parziale, escluso, bloccato o non ancora convertito.',
        'In modalità multipart attendi tutte le parti dichiarate prima dell’analisi.',
      ],
    },
    input: {
      source: fileSystem.summary.source,
      sourceBytes: fileSystem.summary.sourceBytes,
      logicalBytes: fileSystem.summary.totalBytes,
      importIssues: report.importIssues.map((issue) => ({
        code: issue.code,
        severity: issue.severity,
        message: issue.message,
        path: issue.path ?? null,
      })),
    },
    settings: {
      outputMode,
      exclusionGlobs: [...selection.exclusionGlobs],
      language: options.language ?? 'it',
      includeExtractedText: true,
      nestedArchiveDepth: 0,
      secretHandling,
    },
    preflight: {
      status: 'complete',
      policy: report.policy,
      recommendation: report.recommendation,
      estimates: {
        markdown: report.totals.markdown,
        pdf: report.totals.pdf,
        manifest: report.totals.manifest,
        estimatedPeakMemory: report.totals.estimatedPeakMemory,
      },
    },
    summary: buildSummary(files, fileSystem, report),
    security: {
      mode: secretHandling,
      policy: DEFAULT_SECRET_SCAN_POLICY,
      scannedFileCount: 0,
      flaggedFileCount: 0,
      findingCount: 0,
      redactionCount: 0,
      excludedFileCount: 0,
      visualOmittedFileCount: 0,
      truncatedScanCount: 0,
      failedScanCount: 0,
      categoryCounts: {
        'sensitive-filename': 0,
        'private-key': 0,
        'cloud-credential': 0,
        'access-token': 0,
        jwt: 0,
        'connection-string': 0,
        'password-assignment': 0,
        'high-entropy': 0,
      },
    },
    tree: buildManifestTree(fileSystem.root, directoryIds, fileIds),
    directories,
    files,
    outputs: plannedOutputs(),
    sharding: { mode: outputMode, applied: false, parts: [] },
  }
  const validation = validateManifestV1(manifest)
  const json = serializeManifestV1(manifest)
  return { manifest, json, byteLength: encoder.encode(json).byteLength, validation }
}
