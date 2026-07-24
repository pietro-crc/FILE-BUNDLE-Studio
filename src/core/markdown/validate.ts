import type { ManifestArtifact } from '../manifest/types'
import type { MarkdownArtifact, MarkdownValidationError, MarkdownValidationResult } from './types'
import { utf8ByteLength } from './chunk'
import { renderMarkdownAnchor } from './anchor'
import { summarizeSecurity } from '../security/summary'

function add(errors: MarkdownValidationError[], code: string, path: string, message: string): void {
  errors.push({ code, path, message })
}

export function validateMarkdownBundle(
  artifact: Omit<MarkdownArtifact, 'validation'>,
  manifestArtifact: ManifestArtifact,
): MarkdownValidationResult {
  const errors: MarkdownValidationError[] = []
  const partsByName = new Map<string, string>()
  const anchorLocations = new Map<string, string>()
  let totalBytes = 0

  artifact.parts.forEach((part, index) => {
    const path = `/parts/${index}`
    if (partsByName.has(part.name)) add(errors, 'part-duplicate', `${path}/name`, 'Nome parte duplicato.')
    partsByName.set(part.name, part.content)
    if (part.byteLength !== utf8ByteLength(part.content)) add(errors, 'part-byte-length', `${path}/byteLength`, 'Dimensione UTF-8 non coerente.')
    totalBytes += part.byteLength
    if (part.byteLength > artifact.policy.maxPartBytes) add(errors, 'part-limit', path, 'La parte supera la soglia configurata.')
    part.anchors.forEach((anchor) => {
      const marker = renderMarkdownAnchor(anchor)
      const occurrences = part.content.split(marker).length - 1
      if (occurrences !== 1) add(errors, 'anchor-occurrence', path, `L’anchor ${anchor} deve comparire esattamente una volta.`)
      if (anchorLocations.has(anchor)) add(errors, 'anchor-duplicate', path, `Anchor duplicato: ${anchor}.`)
      anchorLocations.set(anchor, part.name)
    })
  })
  if (artifact.totalBytes !== totalBytes) add(errors, 'total-bytes', '/totalBytes', 'Dimensione totale non coerente con le parti.')

  const manifestFiles = new Map(manifestArtifact.manifest.files.map((file) => [file.fileId, file]))
  const reportsByFileId = new Map<string, (typeof artifact.securityReports)[number]>()
  artifact.securityReports.forEach((report, index) => {
    const path = `/securityReports/${index}`
    if (reportsByFileId.has(report.fileId)) add(errors, 'security-report-duplicate', `${path}/fileId`, 'Report sicurezza duplicato.')
    reportsByFileId.set(report.fileId, report)
    const manifestFile = manifestFiles.get(report.fileId)
    if (!manifestFile) {
      add(errors, 'security-report-file', `${path}/fileId`, 'File manifest inesistente per il report sicurezza.')
      return
    }
    if (report.path !== manifestFile.normalizedPath) add(errors, 'security-report-path', `${path}/path`, 'Percorso del report sicurezza non coerente.')
    if (report.mode !== manifestArtifact.manifest.security.mode) add(errors, 'security-report-mode', `${path}/mode`, 'Modalità del report sicurezza non coerente.')
    const security = manifestFile.security
    if (security.status !== report.status) add(errors, 'security-status', path, 'Stato sicurezza diverso dal manifest.')
    if (security.findingCount !== report.findings.length) add(errors, 'security-findings', path, 'Conteggio finding diverso dal manifest.')
    if (security.redactionCount !== report.redactionCount) add(errors, 'security-redactions', path, 'Conteggio redazioni diverso dal manifest.')
    if (security.excluded !== report.excluded) add(errors, 'security-excluded', path, 'Esclusione sicurezza diversa dal manifest.')
    if (security.visualOmitted !== report.visualOmitted) add(errors, 'security-visual', path, 'Omissione visuale diversa dal manifest.')
    if (security.scanTruncated !== report.scanTruncated) add(errors, 'security-truncated', path, 'Troncamento scansione diverso dal manifest.')
    const categories = [...new Set(report.findings.map((finding) => finding.category))].sort()
    if (security.categories.join('\0') !== categories.join('\0')) add(errors, 'security-categories', path, 'Categorie sicurezza diverse dal manifest.')
    if (report.excluded) {
      if (manifestFile.inclusion.included || manifestFile.inclusion.reason !== 'excluded-secret-policy') add(errors, 'security-exclusion-inclusion', path, 'Il file escluso dalla policy deve risultare escluso nel manifest.')
      if (manifestFile.representations.markdown.anchors.length > 0 || manifestFile.representations.markdown.parts.length > 0) add(errors, 'security-exclusion-markdown', path, 'Un file escluso non deve avere riferimenti Markdown.')
    }
    if (report.visualOmitted && manifestFile.representations.pdf.pages.length > 0) add(errors, 'security-visual-pages', path, 'Un file omesso visualmente non deve avere pagine PDF.')
  })
  manifestArtifact.manifest.files.forEach((file, index) => {
    if (!reportsByFileId.has(file.fileId)) add(errors, 'security-report-missing', `/manifest/files/${index}/security`, 'Manca il report sicurezza del file.')
  })
  const recomputedSecurity = summarizeSecurity(artifact.securityReports, artifact.securitySummary.mode, artifact.securitySummary.policy)
  if (JSON.stringify(recomputedSecurity) !== JSON.stringify(artifact.securitySummary)) add(errors, 'security-summary', '/securitySummary', 'Riepilogo sicurezza non coerente con i report.')
  if (JSON.stringify(artifact.securitySummary) !== JSON.stringify(manifestArtifact.manifest.security)) add(errors, 'manifest-security-summary', '/manifest/security', 'Riepilogo sicurezza diverso dal manifest.')

  artifact.records.forEach((record, index) => {
    const path = `/records/${index}`
    const manifestFile = manifestFiles.get(record.fileId)
    if (!manifestFile) {
      add(errors, 'record-file', `${path}/fileId`, 'File manifest inesistente.')
      return
    }
    record.parts.forEach((part) => {
      if (!partsByName.has(part)) add(errors, 'record-part', `${path}/parts`, `Parte inesistente: ${part}.`)
    })
    record.anchors.forEach((anchor) => {
      const part = anchorLocations.get(anchor)
      if (!part) add(errors, 'record-anchor', `${path}/anchors`, `Anchor inesistente: ${anchor}.`)
      else if (!record.parts.includes(part)) add(errors, 'record-anchor-part', `${path}/parts`, `La parte ${part} non è dichiarata dal record.`)
    })
    const representation = manifestFile.representations.markdown
    if (representation.status !== record.status) add(errors, 'manifest-status', path, 'Stato Markdown diverso dal manifest.')
    if (representation.anchors.join('\0') !== record.anchors.join('\0')) add(errors, 'manifest-anchors', path, 'Anchor diversi dal manifest.')
    if (representation.parts.join('\0') !== record.parts.join('\0')) add(errors, 'manifest-parts', path, 'Parti diverse dal manifest.')
    if (representation.truncated !== record.truncated) add(errors, 'manifest-truncation', path, 'Troncamento diverso dal manifest.')
  })

  const contentOutput = manifestArtifact.manifest.outputs.find((output) => output.family === 'content')
  const partNames = artifact.parts.map((part) => part.name)
  if (!contentOutput || contentOutput.status !== 'generated') add(errors, 'output-status', '/manifest/outputs', 'Output Markdown non marcato come generato.')
  else if (contentOutput.parts.join('\0') !== partNames.join('\0')) add(errors, 'output-parts', '/manifest/outputs', 'Parti output non coerenti.')
  if (manifestArtifact.manifest.sharding.applied !== artifact.sharded) add(errors, 'sharding-applied', '/manifest/sharding', 'Stato sharding non coerente.')
  if (manifestArtifact.manifest.sharding.parts.join('\0') !== partNames.join('\0')) add(errors, 'sharding-parts', '/manifest/sharding', 'Parti sharding non coerenti.')
  if (!manifestArtifact.validation.valid) add(errors, 'manifest-invalid', '/manifest', 'Il manifest aggiornato non supera la validazione.')

  return { valid: errors.length === 0, errors }
}
