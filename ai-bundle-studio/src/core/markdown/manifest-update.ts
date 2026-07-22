import { serializeManifestV1 } from '../manifest/serialize'
import type {
  ManifestArtifact,
  ManifestFileRecord,
  ManifestFileSecurityRecord,
  ManifestSummary,
  ManifestV1,
} from '../manifest/types'
import { validateManifestV1 } from '../manifest/validate'
import type { SecretFileReport } from '../security/types'
import type { MarkdownArtifact, TextExtractionRecord } from './types'

const encoder = new TextEncoder()

function manifestSecurity(report: SecretFileReport | undefined): ManifestFileSecurityRecord {
  if (!report) {
    return {
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
    }
  }
  return {
    status: report.status,
    findingCount: report.findings.length,
    highSeverityCount: report.findings.filter((finding) => finding.severity === 'high').length,
    mediumSeverityCount: report.findings.filter((finding) => finding.severity === 'medium').length,
    categories: [...new Set(report.findings.map((finding) => finding.category))].sort(),
    redactionCount: report.redactionCount,
    excluded: report.excluded,
    visualOmitted: report.visualOmitted,
    scanTruncated: report.scanTruncated,
    warnings: report.warnings,
    error: report.error,
  }
}

function updateFile(
  file: ManifestFileRecord,
  record: TextExtractionRecord | undefined,
  securityReport: SecretFileReport | undefined,
): ManifestFileRecord {
  const security = manifestSecurity(securityReport)
  const excludedBySecurity = security.excluded
  if (!record) {
    return {
      ...file,
      security,
      ...(excludedBySecurity ? {
        inclusion: { included: false, reason: 'excluded-secret-policy', matchedGlob: null },
        adapter: { ...file.adapter, conversionStatus: 'not-applicable' },
        representations: {
          ...file.representations,
          markdown: { ...file.representations.markdown, status: 'not-applicable' },
          pdf: { status: 'not-applicable', pages: [], parts: [] },
        },
      } : {}),
    }
  }
  const conversionStatus = record.status
  return {
    ...file,
    ...(record.encoding ? { encoding: record.encoding } : {}),
    warnings: [...new Set([...file.warnings, ...record.warnings, ...security.warnings])],
    errors: record.error ? [...new Set([...file.errors, record.error])] : file.errors,
    inclusion: excludedBySecurity ? { included: false, reason: 'excluded-secret-policy', matchedGlob: null } : file.inclusion,
    security,
    integrity: record.sha256
      ? { algorithm: 'SHA-256', status: 'computed', value: record.sha256, error: null }
      : file.integrity,
    adapter: excludedBySecurity
      ? { id: record.adapterId, version: record.adapterVersion, conversionStatus: 'not-applicable' }
      : file.inclusion.included && record.status !== 'not-applicable'
        ? { id: record.adapterId, version: record.adapterVersion, conversionStatus }
        : file.adapter,
    representations: {
      ...file.representations,
      markdown: excludedBySecurity
        ? {
            status: 'not-applicable',
            anchors: [],
            parts: [],
            truncated: false,
            originalBytes: record.originalBytes,
            extractedBytes: 0,
            extractedCharacters: 0,
            lineCount: 0,
            encoding: record.encoding,
            usedFallback: record.usedFallback,
            replacementCharacters: record.replacementCharacters,
            newlineNormalization: null,
            error: null,
          }
        : {
            status: conversionStatus,
            anchors: record.anchors,
            parts: record.parts,
            truncated: record.truncated,
            originalBytes: record.originalBytes,
            extractedBytes: record.extractedBytes,
            extractedCharacters: record.extractedCharacters,
            lineCount: record.lineCount,
            encoding: record.encoding,
            usedFallback: record.usedFallback,
            replacementCharacters: record.replacementCharacters,
            newlineNormalization: record.newlineNormalization,
            error: record.error,
          },
      pdf: security.visualOmitted || excludedBySecurity
        ? { status: 'not-applicable', pages: [], parts: [] }
        : file.representations.pdf,
    },
  }
}

function recomputeSummary(summary: ManifestSummary, files: readonly ManifestFileRecord[]): ManifestSummary {
  const included = files.filter((file) => file.inclusion.included)
  return {
    ...summary,
    includedFileCount: included.length,
    excludedFileCount: files.length - included.length,
    includedLogicalBytes: included.reduce((total, file) => total + file.size, 0),
  }
}

export function updateManifestWithMarkdown(
  artifact: ManifestArtifact,
  markdown: Omit<MarkdownArtifact, 'validation'>,
  generatedAt: string,
): ManifestArtifact {
  const records = new Map(markdown.records.map((record) => [record.fileId, record]))
  const securityReports = new Map(markdown.securityReports.map((report) => [report.fileId, report]))
  const files = artifact.manifest.files.map((file) => updateFile(file, records.get(file.fileId), securityReports.get(file.fileId)))
  const manifest: ManifestV1 = {
    ...artifact.manifest,
    application: { ...artifact.manifest.application, version: '0.0.0-step-009' },
    generatedAt,
    files,
    summary: recomputeSummary(artifact.manifest.summary, files),
    security: markdown.securitySummary,
    outputs: artifact.manifest.outputs.map((output) => output.family === 'content'
      ? { ...output, status: 'generated', parts: markdown.parts.map((part) => part.name), sha256: null }
      : output),
    sharding: {
      mode: artifact.manifest.settings.outputMode,
      applied: markdown.sharded,
      parts: markdown.parts.map((part) => part.name),
    },
  }
  const validation = validateManifestV1(manifest)
  const json = serializeManifestV1(manifest)
  return { manifest, json, byteLength: encoder.encode(json).byteLength, validation }
}
