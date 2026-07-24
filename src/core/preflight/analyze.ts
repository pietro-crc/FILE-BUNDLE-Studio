import type { VirtualFile, VirtualFileSystem } from '../vfs/types'
import { classifyFileSample } from './classify'
import { buildPreflightTotals, estimateFileOutput, recommendOutputMode } from './estimate'
import { assessFileRisks, highestRisk } from './risk'
import type { PreflightFileRecord, PreflightPolicy, PreflightProgress, PreflightReport } from './types'

export const DEFAULT_PREFLIGHT_POLICY: PreflightPolicy = {
  maxSignatureBytes: 16 * 1024,
  maxConcurrentReads: 4,
  mediumFileBytes: 50 * 1024 * 1024,
  highFileBytes: 200 * 1024 * 1024,
  mediumCompressionRatio: 50,
  multipartOutputBytes: 100 * 1024 * 1024,
  quickPreviewLogicalBytes: 750 * 1024 * 1024,
  quickPreviewFileCount: 10_000,
}

export interface AnalyzePreflightOptions {
  readonly importIssues?: PreflightReport['importIssues']
  readonly policy?: PreflightPolicy
  readonly signal?: AbortSignal
  readonly onProgress?: (progress: PreflightProgress) => void
}

function abortIfNeeded(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException(signal.reason ? String(signal.reason) : 'Analisi annullata.', 'AbortError')
  }
}

async function analyzeFile(file: VirtualFile, policy: PreflightPolicy, signal?: AbortSignal): Promise<PreflightFileRecord> {
  abortIfNeeded(signal)
  const prefix = new Uint8Array(await file.bytes.readPrefix(policy.maxSignatureBytes, signal))
  abortIfNeeded(signal)
  const classification = classifyFileSample(file, prefix)
  const risks = assessFileRisks(
    file,
    classification.descriptor,
    classification.mimeDetected,
    classification.detectionMethod,
    policy,
    classification.warning,
  )
  const riskLevel = highestRisk(risks)
  const warnings = classification.warning ? [classification.warning] : []
  return {
    fileId: file.id,
    path: file.normalizedPath,
    name: file.name,
    extension: file.extension,
    source: file.source,
    size: file.size,
    compressedSize: file.archive?.compressedSize ?? file.size,
    ...(file.mimeDeclared ? { mimeDeclared: file.mimeDeclared } : {}),
    mimeDetected: classification.mimeDetected,
    detectionMethod: classification.detectionMethod,
    category: classification.category,
    capabilityLevel: classification.descriptor.level,
    adapterId: classification.descriptor.adapterId,
    supportReason: classification.descriptor.reason,
    isText: classification.isText,
    ...(classification.encoding ? { encoding: classification.encoding } : {}),
    risks,
    riskLevel,
    warnings,
    defaultIncluded: classification.descriptor.level !== 'E',
    estimate: estimateFileOutput(file.size, classification.category, classification.descriptor.level),
  }
}

function failedRecord(file: VirtualFile, error: unknown): PreflightFileRecord {
  const message = error instanceof Error ? error.message : 'Campione non leggibile.'
  return {
    fileId: file.id,
    path: file.normalizedPath,
    name: file.name,
    extension: file.extension,
    source: file.source,
    size: file.size,
    compressedSize: file.archive?.compressedSize ?? file.size,
    ...(file.mimeDeclared ? { mimeDeclared: file.mimeDeclared } : {}),
    mimeDetected: 'application/octet-stream',
    detectionMethod: 'unknown',
    category: 'binary',
    capabilityLevel: 'E',
    adapterId: 'blocked',
    supportReason: 'Il campione non è leggibile; il file resta escluso in sicurezza.',
    isText: false,
    risks: [{ code: 'binary-unknown', level: 'high', message }],
    riskLevel: 'high',
    warnings: [message],
    defaultIncluded: false,
    estimate: estimateFileOutput(file.size, 'binary', 'E'),
  }
}

export async function analyzeVirtualFileSystem(
  fileSystem: VirtualFileSystem,
  options: AnalyzePreflightOptions = {},
): Promise<PreflightReport> {
  const policy = options.policy ?? DEFAULT_PREFLIGHT_POLICY
  const records: PreflightFileRecord[] = []
  let nextIndex = 0
  let completed = 0

  const worker = async () => {
    while (true) {
      abortIfNeeded(options.signal)
      const index = nextIndex
      nextIndex += 1
      const file = fileSystem.files[index]
      if (!file) return
      options.onProgress?.({ completed, total: fileSystem.files.length, currentPath: file.normalizedPath })
      try {
        // eslint-disable-next-line no-await-in-loop -- Each bounded worker consumes the shared queue sequentially.
        records[index] = await analyzeFile(file, policy, options.signal)
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error
        records[index] = failedRecord(file, error)
      }
      completed += 1
      options.onProgress?.({ completed, total: fileSystem.files.length, currentPath: file.normalizedPath })
    }
  }

  const concurrency = Math.max(1, Math.min(policy.maxConcurrentReads, fileSystem.files.length || 1))
  await Promise.all(Array.from({ length: concurrency }, () => worker()))
  abortIfNeeded(options.signal)

  const totals = buildPreflightTotals(
    records,
    fileSystem.summary.sourceBytes,
    fileSystem.summary.totalBytes,
    fileSystem.summary.directoryCount,
  )
  return {
    files: records,
    totals,
    recommendation: recommendOutputMode(totals, policy),
    importIssues: options.importIssues ?? [],
    policy,
  }
}
