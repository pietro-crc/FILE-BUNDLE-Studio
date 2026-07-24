import { SECRET_SCAN_POLICY_MAXIMUMS } from '../security/policy'
import {
  MANIFEST_MEDIA_TYPE,
  MANIFEST_SCHEMA_VERSION,
  type ManifestV1,
  type ManifestValidationError,
  type ManifestValidationResult,
} from './types'

const NODE_ID_PATTERN = /^(?:dir|file)_[a-f0-9]{64}$/u
const SHA256_PATTERN = /^[a-f0-9]{64}$/u
const MARKDOWN_ANCHOR_PATTERN = /^ai-bundle-file_[a-f0-9]{64}(?:-segment-[0-9]{3})?$/u

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function add(errors: ManifestValidationError[], code: string, path: string, message: string): void {
  errors.push({ code, path, message })
}

function requireArray(value: unknown, path: string, errors: ManifestValidationError[]): readonly unknown[] {
  if (!Array.isArray(value)) {
    add(errors, 'type-array', path, 'È richiesto un array.')
    return []
  }
  return value
}

function requireRecord(value: unknown, path: string, errors: ManifestValidationError[]): Record<string, unknown> {
  if (!isRecord(value)) {
    add(errors, 'type-object', path, 'È richiesto un oggetto.')
    return {}
  }
  return value
}

function requireString(value: unknown, path: string, errors: ManifestValidationError[]): string {
  if (typeof value !== 'string') {
    add(errors, 'type-string', path, 'È richiesta una stringa.')
    return ''
  }
  return value
}

function requireInteger(value: unknown, path: string, errors: ManifestValidationError[]): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    add(errors, 'type-nonnegative-integer', path, 'È richiesto un intero non negativo sicuro.')
    return 0
  }
  return value
}

function validateEnum(value: unknown, allowed: ReadonlySet<string>, path: string, code: string, errors: ManifestValidationError[]): string {
  const text = requireString(value, path, errors)
  if (!allowed.has(text)) add(errors, code, path, 'Valore non supportato.')
  return text
}

function validateStringArray(value: unknown, path: string, errors: ManifestValidationError[]): readonly string[] {
  const items = requireArray(value, path, errors)
  return items.map((item, index) => requireString(item, `${path}/${index}`, errors))
}

function validateRange(value: unknown, path: string, errors: ManifestValidationError[]): void {
  const range = requireRecord(value, path, errors)
  const minimum = requireInteger(range.minBytes, `${path}/minBytes`, errors)
  const maximum = requireInteger(range.maxBytes, `${path}/maxBytes`, errors)
  if (minimum > maximum) add(errors, 'range-order', path, 'minBytes non può superare maxBytes.')
}

function validateHeaderSections(root: Record<string, unknown>, errors: ManifestValidationError[]): void {
  const instructions = requireRecord(root.instructions, '/instructions', errors)
  if (instructions.entryPoint !== 'manifest') add(errors, 'instructions-entry-point', '/instructions/entryPoint', 'Il manifest deve essere il punto di ingresso.')
  const steps = validateStringArray(instructions.steps, '/instructions/steps', errors)
  if (steps.length === 0 || steps.some((step) => step.length === 0)) add(errors, 'instructions-empty', '/instructions/steps', 'È richiesta almeno un’istruzione non vuota.')

  const settings = requireRecord(root.settings, '/settings', errors)
  const modes = new Set(['three-files', 'multipart', 'quick-preview'])
  validateEnum(settings.outputMode, modes, '/settings/outputMode', 'output-mode', errors)
  validateStringArray(settings.exclusionGlobs, '/settings/exclusionGlobs', errors)
  requireString(settings.language, '/settings/language', errors)
  if (typeof settings.includeExtractedText !== 'boolean') add(errors, 'settings-boolean', '/settings/includeExtractedText', 'È richiesto un booleano.')
  requireInteger(settings.nestedArchiveDepth, '/settings/nestedArchiveDepth', errors)
  validateEnum(settings.secretHandling, new Set(['report-only', 'redact', 'exclude']), '/settings/secretHandling', 'secret-handling', errors)

  const preflight = requireRecord(root.preflight, '/preflight', errors)
  if (preflight.status !== 'complete') add(errors, 'preflight-status', '/preflight/status', 'Il manifest v1 richiede un preflight completo.')
  const policy = requireRecord(preflight.policy, '/preflight/policy', errors)
  ;['maxSignatureBytes', 'maxConcurrentReads', 'mediumFileBytes', 'highFileBytes', 'mediumCompressionRatio', 'multipartOutputBytes', 'quickPreviewLogicalBytes', 'quickPreviewFileCount'].forEach((key) => requireInteger(policy[key], `/preflight/policy/${key}`, errors))
  const recommendation = requireRecord(preflight.recommendation, '/preflight/recommendation', errors)
  validateEnum(recommendation.mode, modes, '/preflight/recommendation/mode', 'recommendation-mode', errors)
  requireString(recommendation.reason, '/preflight/recommendation/reason', errors)
  validateEnum(recommendation.confidence, new Set(['low', 'medium']), '/preflight/recommendation/confidence', 'recommendation-confidence', errors)
  const estimates = requireRecord(preflight.estimates, '/preflight/estimates', errors)
  ;['markdown', 'pdf', 'manifest', 'estimatedPeakMemory'].forEach((key) => validateRange(estimates[key], `/preflight/estimates/${key}`, errors))

  const sharding = requireRecord(root.sharding, '/sharding', errors)
  const shardingMode = validateEnum(sharding.mode, modes, '/sharding/mode', 'sharding-mode', errors)
  if (shardingMode !== settings.outputMode) add(errors, 'sharding-mode-consistency', '/sharding/mode', 'La modalità sharding deve corrispondere alle impostazioni.')
  if (typeof sharding.applied !== 'boolean') add(errors, 'sharding-applied', '/sharding/applied', 'È richiesto un booleano.')
  validateStringArray(sharding.parts, '/sharding/parts', errors)
}

function validateDate(value: unknown, path: string, errors: ManifestValidationError[]): void {
  const text = requireString(value, path, errors)
  const parsed = new Date(text)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== text) {
    add(errors, 'date-iso', path, 'La data deve essere ISO-8601 UTC canonica.')
  }
}

function validateNodeId(value: unknown, path: string, errors: ManifestValidationError[]): string {
  const id = requireString(value, path, errors)
  if (!NODE_ID_PATTERN.test(id)) add(errors, 'node-id', path, 'Identificatore nodo non valido.')
  return id
}

function validateTree(
  value: unknown,
  path: string,
  errors: ManifestValidationError[],
  visited: Set<string>,
  filePathsById: ReadonlyMap<string, string>,
  directoryPathsById: ReadonlyMap<string, string>,
): void {
  const node = requireRecord(value, path, errors)
  const nodeId = validateNodeId(node.nodeId, `${path}/nodeId`, errors)
  const kind = requireString(node.kind, `${path}/kind`, errors)
  requireString(node.name, `${path}/name`, errors)
  const normalizedPath = requireString(node.normalizedPath, `${path}/normalizedPath`, errors)
  if (visited.has(nodeId)) add(errors, 'tree-duplicate-node', `${path}/nodeId`, 'Il nodo compare più volte nel tree.')
  visited.add(nodeId)

  if (kind === 'file') {
    if (!filePathsById.has(nodeId)) add(errors, 'tree-file-reference', `${path}/nodeId`, 'Il file del tree non esiste nei record file.')
    else if (filePathsById.get(nodeId) !== normalizedPath) add(errors, 'tree-file-path', `${path}/normalizedPath`, 'Il percorso del tree non corrisponde al record file.')
  } else if (kind === 'directory') {
    if (!directoryPathsById.has(nodeId)) add(errors, 'tree-directory-reference', `${path}/nodeId`, 'La directory del tree non esiste nei record directory.')
    else if (directoryPathsById.get(nodeId) !== normalizedPath) add(errors, 'tree-directory-path', `${path}/normalizedPath`, 'Il percorso del tree non corrisponde al record directory.')
  } else {
    add(errors, 'tree-kind', `${path}/kind`, 'Il kind deve essere file o directory.')
  }

  const children = requireArray(node.children, `${path}/children`, errors)
  if (kind === 'file' && children.length > 0) {
    add(errors, 'tree-file-children', `${path}/children`, 'Un file non può avere figli.')
  }
  children.forEach((child, index) => validateTree(child, `${path}/children/${index}`, errors, visited, filePathsById, directoryPathsById))
}

function validateIntegrity(file: Record<string, unknown>, path: string, errors: ManifestValidationError[]): void {
  const integrity = requireRecord(file.integrity, `${path}/integrity`, errors)
  if (integrity.algorithm !== 'SHA-256') add(errors, 'integrity-algorithm', `${path}/integrity/algorithm`, 'Algoritmo non supportato.')
  const status = requireString(integrity.status, `${path}/integrity/status`, errors)
  const value = integrity.value
  const error = integrity.error
  if (status === 'pending') {
    if (value !== null || error !== null) add(errors, 'integrity-pending', `${path}/integrity`, 'Un hash pending non deve avere valore o errore.')
  } else if (status === 'computed') {
    if (typeof value !== 'string' || !SHA256_PATTERN.test(value) || error !== null) {
      add(errors, 'integrity-computed', `${path}/integrity`, 'Un hash computed richiede 64 caratteri esadecimali e nessun errore.')
    }
  } else if (status === 'failed') {
    if (value !== null || typeof error !== 'string' || error.length === 0) {
      add(errors, 'integrity-failed', `${path}/integrity`, 'Un hash failed richiede un errore e nessun valore.')
    }
  } else {
    add(errors, 'integrity-status', `${path}/integrity/status`, 'Stato integrità non valido.')
  }
}

function validateInclusion(file: Record<string, unknown>, path: string, errors: ManifestValidationError[]): boolean {
  const inclusion = requireRecord(file.inclusion, `${path}/inclusion`, errors)
  if (typeof inclusion.included !== 'boolean') add(errors, 'inclusion-boolean', `${path}/inclusion/included`, 'È richiesto un booleano.')
  const included = inclusion.included === true
  const reason = requireString(inclusion.reason, `${path}/inclusion/reason`, errors)
  const allowedReasons = new Set(['selected', 'blocked-capability', 'excluded-glob', 'excluded-manual', 'excluded-secret-policy'])
  if (!allowedReasons.has(reason)) add(errors, 'inclusion-reason', `${path}/inclusion/reason`, 'Motivo di inclusione non valido.')
  if (included !== (reason === 'selected')) {
    add(errors, 'inclusion-consistency', `${path}/inclusion`, 'included e reason non sono coerenti.')
  }
  if (reason === 'excluded-glob') {
    if (typeof inclusion.matchedGlob !== 'string' || inclusion.matchedGlob.length === 0) {
      add(errors, 'inclusion-glob', `${path}/inclusion/matchedGlob`, 'L’esclusione glob richiede il pattern corrispondente.')
    }
  } else if (inclusion.matchedGlob !== null) {
    add(errors, 'inclusion-glob-null', `${path}/inclusion/matchedGlob`, 'matchedGlob deve essere null per questo motivo.')
  }
  if (file.capabilityLevel === 'E' && reason !== 'blocked-capability') {
    add(errors, 'blocked-capability', `${path}/inclusion/reason`, 'Un file E deve essere bloccato per capacità.')
  }
  return included
}


function validateSecurityRecord(file: Record<string, unknown>, path: string, errors: ManifestValidationError[]): Record<string, unknown> {
  const security = requireRecord(file.security, `${path}/security`, errors)
  const status = validateEnum(security.status, new Set(['not-scanned', 'clean', 'flagged', 'redacted', 'excluded', 'failed']), `${path}/security/status`, 'security-status', errors)
  const findingCount = requireInteger(security.findingCount, `${path}/security/findingCount`, errors)
  const highSeverityCount = requireInteger(security.highSeverityCount, `${path}/security/highSeverityCount`, errors)
  const mediumSeverityCount = requireInteger(security.mediumSeverityCount, `${path}/security/mediumSeverityCount`, errors)
  if (highSeverityCount + mediumSeverityCount !== findingCount) add(errors, 'security-severity-count', `${path}/security`, 'I conteggi per severità devono corrispondere ai finding.')
  const allowedCategories = new Set(['sensitive-filename', 'private-key', 'cloud-credential', 'access-token', 'jwt', 'connection-string', 'password-assignment', 'high-entropy'])
  validateStringArray(security.categories, `${path}/security/categories`, errors).forEach((category, index) => {
    if (!allowedCategories.has(category)) add(errors, 'security-category', `${path}/security/categories/${index}`, 'Categoria segreto non supportata.')
  })
  const redactionCount = requireInteger(security.redactionCount, `${path}/security/redactionCount`, errors)
  ;['excluded', 'visualOmitted', 'scanTruncated'].forEach((key) => {
    if (typeof security[key] !== 'boolean') add(errors, 'security-boolean', `${path}/security/${key}`, 'È richiesto un booleano.')
  })
  validateStringArray(security.warnings, `${path}/security/warnings`, errors)
  if (security.error !== null) requireString(security.error, `${path}/security/error`, errors)
  if (status === 'not-scanned' && findingCount !== 0) add(errors, 'security-not-scanned-findings', `${path}/security/findingCount`, 'Un file non scansionato non può dichiarare finding.')
  if (status === 'clean' && findingCount !== 0) add(errors, 'security-clean-findings', `${path}/security/findingCount`, 'Un file clean non può dichiarare finding.')
  if ((status === 'flagged' || status === 'redacted' || status === 'excluded') && findingCount === 0) add(errors, 'security-findings-required', `${path}/security/findingCount`, 'Lo stato richiede almeno un finding.')
  if (status === 'excluded' && security.excluded !== true) add(errors, 'security-excluded-state', `${path}/security/excluded`, 'Lo stato excluded richiede excluded=true.')
  if (status !== 'excluded' && security.excluded === true) add(errors, 'security-excluded-flag', `${path}/security/excluded`, 'excluded=true è ammesso soltanto con stato excluded.')
  if (status === 'redacted' && redactionCount < 1) add(errors, 'security-redaction-required', `${path}/security/redactionCount`, 'Lo stato redacted richiede almeno una redazione.')
  if (status !== 'redacted' && redactionCount !== 0) add(errors, 'security-redaction-state', `${path}/security/redactionCount`, 'Le redazioni sono ammesse soltanto con stato redacted.')
  if (security.excluded === true && requireRecord(file.inclusion, `${path}/inclusion`, errors).reason !== 'excluded-secret-policy') add(errors, 'security-inclusion', `${path}/inclusion/reason`, 'Un file escluso dalla policy segreti deve usare excluded-secret-policy.')
  return security
}

function validateRepresentations(file: Record<string, unknown>, index: number, errors: ManifestValidationError[]): void {
  const path = `/files/${index}/representations`
  const representations = requireRecord(file.representations, path, errors)
  const manifest = requireRecord(representations.manifest, `${path}/manifest`, errors)
  if (manifest.recorded !== true) add(errors, 'manifest-recorded', `${path}/manifest/recorded`, 'Il record deve risultare presente nel manifest.')
  if (manifest.pointer !== `/files/${index}`) add(errors, 'manifest-pointer', `${path}/manifest/pointer`, 'Pointer del record file non coerente.')
  const markdown = requireRecord(representations.markdown, `${path}/markdown`, errors)
  const pdf = requireRecord(representations.pdf, `${path}/pdf`, errors)
  const markdownStatus = validateEnum(markdown.status, new Set(['not-started', 'completed', 'partial', 'failed', 'not-applicable']), `${path}/markdown/status`, 'representation-status', errors)
  const anchors = validateStringArray(markdown.anchors, `${path}/markdown/anchors`, errors)
  anchors.forEach((anchor, anchorIndex) => {
    if (!MARKDOWN_ANCHOR_PATTERN.test(anchor)) add(errors, 'markdown-anchor', `${path}/markdown/anchors/${anchorIndex}`, 'Anchor Markdown non valido.')
  })
  const parts = validateStringArray(markdown.parts, `${path}/markdown/parts`, errors)
  if (typeof markdown.truncated !== 'boolean') add(errors, 'markdown-truncated', `${path}/markdown/truncated`, 'È richiesto un booleano.')
  const originalBytes = requireInteger(markdown.originalBytes, `${path}/markdown/originalBytes`, errors)
  const extractedBytes = requireInteger(markdown.extractedBytes, `${path}/markdown/extractedBytes`, errors)
  requireInteger(markdown.extractedCharacters, `${path}/markdown/extractedCharacters`, errors)
  requireInteger(markdown.lineCount, `${path}/markdown/lineCount`, errors)
  if (extractedBytes > originalBytes) add(errors, 'markdown-extracted-bytes', `${path}/markdown/extractedBytes`, 'I byte estratti non possono superare gli originali.')
  if (markdown.encoding !== null) validateEnum(markdown.encoding, new Set(['utf-8', 'utf-8-bom', 'utf-16be', 'utf-16le', 'windows-1252']), `${path}/markdown/encoding`, 'markdown-encoding', errors)
  if (typeof markdown.usedFallback !== 'boolean') add(errors, 'markdown-fallback', `${path}/markdown/usedFallback`, 'È richiesto un booleano.')
  requireInteger(markdown.replacementCharacters, `${path}/markdown/replacementCharacters`, errors)
  if (markdown.newlineNormalization !== null && markdown.newlineNormalization !== 'lf') add(errors, 'markdown-newlines', `${path}/markdown/newlineNormalization`, 'Normalizzazione newline non valida.')
  if (markdown.error !== null) requireString(markdown.error, `${path}/markdown/error`, errors)
  if (markdownStatus === 'not-started' || markdownStatus === 'not-applicable') {
    if (anchors.length > 0 || parts.length > 0 || extractedBytes > 0 || markdown.error !== null) add(errors, 'markdown-pending', `${path}/markdown`, 'Una rappresentazione non iniziata/non applicabile non deve dichiarare output o errore.')
  }
  if (markdownStatus === 'completed' || markdownStatus === 'partial') {
    if (anchors.length === 0 || parts.length === 0 || markdown.error !== null || markdown.newlineNormalization !== 'lf') add(errors, 'markdown-completed', `${path}/markdown`, 'Una rappresentazione completata/parziale richiede anchor, parti, normalizzazione LF e nessun errore.')
    if (markdownStatus === 'completed' && markdown.truncated !== false) add(errors, 'markdown-completed-truncated', `${path}/markdown/truncated`, 'Una rappresentazione completa non può essere troncata.')
    if (markdownStatus === 'partial' && markdown.truncated !== true) add(errors, 'markdown-partial-truncated', `${path}/markdown/truncated`, 'Una rappresentazione parziale deve dichiarare il troncamento.')
  }
  if (markdownStatus === 'failed' && (anchors.length === 0 || parts.length === 0 || typeof markdown.error !== 'string' || markdown.error.length === 0)) {
    add(errors, 'markdown-failed', `${path}/markdown`, 'Una rappresentazione fallita richiede anchor, parte ed errore.')
  }
  const pdfStatus = validateEnum(pdf.status, new Set(['not-started', 'completed', 'partial', 'failed', 'not-applicable']), `${path}/pdf/status`, 'representation-status', errors)
  const pdfPages = requireArray(pdf.pages, `${path}/pdf/pages`, errors)
  pdfPages.forEach((page, pageIndex) => requireInteger(page, `${path}/pdf/pages/${pageIndex}`, errors))
  const pdfParts = requireArray(pdf.parts, `${path}/pdf/parts`, errors)
  if ((pdfStatus === 'not-started' || pdfStatus === 'not-applicable') && (pdfPages.length > 0 || pdfParts.length > 0)) add(errors, 'pdf-pending', `${path}/pdf`, 'Una rappresentazione PDF non iniziata/non applicabile non deve dichiarare pagine o parti.')
  if ((pdfStatus === 'completed' || pdfStatus === 'partial') && (pdfPages.length === 0 || pdfParts.length === 0)) add(errors, 'pdf-generated', `${path}/pdf`, 'Una rappresentazione PDF completata/parziale richiede pagine e parti.')
  const security = requireRecord(file.security, `${path.replace('/representations', '')}/security`, errors)
  if ((security.excluded === true || security.visualOmitted === true) && (pdfStatus !== 'not-applicable' || pdfPages.length > 0 || pdfParts.length > 0)) add(errors, 'pdf-security-omission', `${path}/pdf`, 'Un file escluso o omesso dalla policy sicurezza deve avere PDF non applicabile.')
}

export function validateManifestV1(value: unknown): ManifestValidationResult {
  const errors: ManifestValidationError[] = []
  const root = requireRecord(value, '', errors)
  if (root.schemaVersion !== MANIFEST_SCHEMA_VERSION) add(errors, 'schema-version', '/schemaVersion', 'Versione schema non supportata.')
  if (root.mediaType !== MANIFEST_MEDIA_TYPE) add(errors, 'media-type', '/mediaType', 'Media type manifest non valido.')
  validateDate(root.generatedAt, '/generatedAt', errors)
  const projectName = requireString(root.projectName, '/projectName', errors)
  if (projectName.length === 0 || projectName.length > 120) add(errors, 'project-name', '/projectName', 'Il nome progetto deve contenere da 1 a 120 caratteri.')
  validateHeaderSections(root, errors)

  const application = requireRecord(root.application, '/application', errors)
  if (application.name !== 'AI Bundle Studio') add(errors, 'application-name', '/application/name', 'Nome applicazione non valido.')
  requireString(application.version, '/application/version', errors)

  const input = requireRecord(root.input, '/input', errors)
  validateEnum(input.source, new Set(['file-picker', 'directory-picker', 'drag-drop', 'zip']), '/input/source', 'input-source', errors)
  const inputSourceBytes = requireInteger(input.sourceBytes, '/input/sourceBytes', errors)
  const inputLogicalBytes = requireInteger(input.logicalBytes, '/input/logicalBytes', errors)
  requireArray(input.importIssues, '/input/importIssues', errors).forEach((item, index) => {
    const issue = requireRecord(item, `/input/importIssues/${index}`, errors)
    requireString(issue.code, `/input/importIssues/${index}/code`, errors)
    validateEnum(issue.severity, new Set(['warning', 'error']), `/input/importIssues/${index}/severity`, 'issue-severity', errors)
    requireString(issue.message, `/input/importIssues/${index}/message`, errors)
    if (issue.path !== null && typeof issue.path !== 'string') add(errors, 'issue-path', `/input/importIssues/${index}/path`, 'Il path deve essere stringa o null.')
  })

  const files = requireArray(root.files, '/files', errors)
  const directories = requireArray(root.directories, '/directories', errors)
  const fileIds = new Set<string>()
  const filePaths = new Set<string>()
  const filePathsById = new Map<string, string>()
  const fileRecordsById = new Map<string, Record<string, unknown>>()
  const directoryIds = new Set<string>()
  const directoryPaths = new Set<string>()
  const directoryPathsById = new Map<string, string>()
  const directoryRecordsById = new Map<string, Record<string, unknown>>()
  let includedFileCount = 0
  let blockedFileCount = 0
  let logicalBytes = 0
  let includedLogicalBytes = 0
  const capabilityCounts = { A: 0, B: 0, C: 0, D: 0, E: 0 }
  const riskCounts = { low: 0, medium: 0, high: 0 }
  const securityCounts = { scannedFileCount: 0, flaggedFileCount: 0, findingCount: 0, redactionCount: 0, excludedFileCount: 0, visualOmittedFileCount: 0, truncatedScanCount: 0, failedScanCount: 0 }
  const securityCategoryCounts: Record<string, number> = { 'sensitive-filename': 0, 'private-key': 0, 'cloud-credential': 0, 'access-token': 0, jwt: 0, 'connection-string': 0, 'password-assignment': 0, 'high-entropy': 0 }

  directories.forEach((item, index) => {
    const path = `/directories/${index}`
    const directory = requireRecord(item, path, errors)
    const id = validateNodeId(directory.directoryId, `${path}/directoryId`, errors)
    const normalizedPath = requireString(directory.normalizedPath, `${path}/normalizedPath`, errors)
    if (directoryIds.has(id)) add(errors, 'directory-id-duplicate', `${path}/directoryId`, 'ID directory duplicato.')
    if (directoryPaths.has(normalizedPath)) add(errors, 'directory-path-duplicate', `${path}/normalizedPath`, 'Percorso directory duplicato.')
    directoryIds.add(id)
    directoryPaths.add(normalizedPath)
    directoryPathsById.set(id, normalizedPath)
    directoryRecordsById.set(id, directory)
    requireArray(directory.childDirectoryIds, `${path}/childDirectoryIds`, errors)
    requireArray(directory.childFileIds, `${path}/childFileIds`, errors)
  })

  files.forEach((item, index) => {
    const path = `/files/${index}`
    const file = requireRecord(item, path, errors)
    const id = validateNodeId(file.fileId, `${path}/fileId`, errors)
    const normalizedPath = requireString(file.normalizedPath, `${path}/normalizedPath`, errors)
    if (fileIds.has(id)) add(errors, 'file-id-duplicate', `${path}/fileId`, 'ID file duplicato.')
    if (filePaths.has(normalizedPath)) add(errors, 'file-path-duplicate', `${path}/normalizedPath`, 'Percorso file duplicato.')
    fileIds.add(id)
    filePaths.add(normalizedPath)
    filePathsById.set(id, normalizedPath)
    fileRecordsById.set(id, file)
    requireString(file.originalPath, `${path}/originalPath`, errors)
    requireString(file.name, `${path}/name`, errors)
    requireString(file.extension, `${path}/extension`, errors)
    validateEnum(file.source, new Set(['file-picker', 'directory-picker', 'drag-drop', 'zip']), `${path}/source`, 'file-source', errors)
    const size = requireInteger(file.size, `${path}/size`, errors)
    requireInteger(file.compressedSize, `${path}/compressedSize`, errors)
    if (file.lastModified !== null) requireInteger(file.lastModified, `${path}/lastModified`, errors)
    if (file.mimeDeclared !== null) requireString(file.mimeDeclared, `${path}/mimeDeclared`, errors)
    requireString(file.mimeDetected, `${path}/mimeDetected`, errors)
    requireString(file.detectionMethod, `${path}/detectionMethod`, errors)
    requireString(file.category, `${path}/category`, errors)
    requireString(file.supportReason, `${path}/supportReason`, errors)
    if (typeof file.isText !== 'boolean') add(errors, 'file-is-text', `${path}/isText`, 'È richiesto un booleano.')
    if (file.encoding !== null) requireString(file.encoding, `${path}/encoding`, errors)
    requireArray(file.risks, `${path}/risks`, errors)
    validateStringArray(file.warnings, `${path}/warnings`, errors)
    validateStringArray(file.errors, `${path}/errors`, errors)
    logicalBytes += size
    const included = validateInclusion(file, path, errors)
    if (included) {
      includedFileCount += 1
      includedLogicalBytes += size
    }
    if (requireRecord(file.inclusion, `${path}/inclusion`, errors).reason === 'blocked-capability') blockedFileCount += 1
    const capability = requireString(file.capabilityLevel, `${path}/capabilityLevel`, errors)
    if (capability in capabilityCounts) capabilityCounts[capability as keyof typeof capabilityCounts] += 1
    else add(errors, 'capability-level', `${path}/capabilityLevel`, 'Livello capacità non valido.')
    const risk = requireString(file.riskLevel, `${path}/riskLevel`, errors)
    if (risk in riskCounts) riskCounts[risk as keyof typeof riskCounts] += 1
    else add(errors, 'risk-level', `${path}/riskLevel`, 'Livello rischio non valido.')
    const adapter = requireRecord(file.adapter, `${path}/adapter`, errors)
    requireString(adapter.id, `${path}/adapter/id`, errors)
    if (adapter.version !== null) requireString(adapter.version, `${path}/adapter/version`, errors)
    validateEnum(adapter.conversionStatus, new Set(['not-started', 'completed', 'partial', 'failed', 'not-applicable']), `${path}/adapter/conversionStatus`, 'adapter-status', errors)
    if (!included && adapter.conversionStatus !== 'not-applicable') add(errors, 'adapter-inclusion', `${path}/adapter/conversionStatus`, 'Un file escluso deve avere conversione non applicabile.')
    const security = validateSecurityRecord(file, path, errors)
    if (security.status !== 'not-scanned') securityCounts.scannedFileCount += 1
    const findingCount = typeof security.findingCount === 'number' ? security.findingCount : 0
    securityCounts.findingCount += findingCount
    if (findingCount > 0) securityCounts.flaggedFileCount += 1
    if (typeof security.redactionCount === 'number') securityCounts.redactionCount += security.redactionCount
    if (security.excluded === true) securityCounts.excludedFileCount += 1
    if (security.visualOmitted === true) securityCounts.visualOmittedFileCount += 1
    if (security.scanTruncated === true) securityCounts.truncatedScanCount += 1
    if (security.status === 'failed') securityCounts.failedScanCount += 1
    validateStringArray(security.categories, `${path}/security/categories`, errors).forEach((category) => {
      if (Object.hasOwn(securityCategoryCounts, category)) securityCategoryCounts[category] = (securityCategoryCounts[category] ?? 0) + 1
    })
    validateIntegrity(file, path, errors)
    validateRepresentations(file, index, errors)
    const markdownRepresentation = requireRecord(
      requireRecord(file.representations, `${path}/representations`, errors).markdown,
      `${path}/representations/markdown`,
      errors,
    )
    if (markdownRepresentation.originalBytes !== size) {
      add(errors, 'markdown-original-bytes', `${path}/representations/markdown/originalBytes`, 'I byte originali devono corrispondere alla dimensione del file.')
    }
  })

  directories.forEach((item, index) => {
    if (!isRecord(item)) return
    const path = `/directories/${index}`
    const parent = item.parentDirectoryId
    if (item.normalizedPath === '') {
      if (parent !== null) add(errors, 'root-parent', `${path}/parentDirectoryId`, 'La root non deve avere parent.')
    } else if (typeof parent !== 'string' || !directoryIds.has(parent)) {
      add(errors, 'directory-parent', `${path}/parentDirectoryId`, 'Parent directory inesistente.')
    }
    requireArray(item.childDirectoryIds, `${path}/childDirectoryIds`, errors).forEach((id, childIndex) => {
      if (typeof id !== 'string' || !directoryIds.has(id)) add(errors, 'directory-child', `${path}/childDirectoryIds/${childIndex}`, 'Directory figlia inesistente.')
      else if (directoryRecordsById.get(id)?.parentDirectoryId !== item.directoryId) add(errors, 'directory-child-parent', `${path}/childDirectoryIds/${childIndex}`, 'La directory figlia non indica questo parent.')
    })
    requireArray(item.childFileIds, `${path}/childFileIds`, errors).forEach((id, childIndex) => {
      if (typeof id !== 'string' || !fileIds.has(id)) add(errors, 'file-child', `${path}/childFileIds/${childIndex}`, 'File figlio inesistente.')
      else if (fileRecordsById.get(id)?.parentDirectoryId !== item.directoryId) add(errors, 'file-child-parent', `${path}/childFileIds/${childIndex}`, 'Il file figlio non indica questa directory come parent.')
    })
  })

  files.forEach((item, index) => {
    if (!isRecord(item)) return
    if (typeof item.parentDirectoryId !== 'string' || !directoryIds.has(item.parentDirectoryId)) {
      add(errors, 'file-parent', `/files/${index}/parentDirectoryId`, 'Parent directory del file inesistente.')
    }
  })

  const visited = new Set<string>()
  validateTree(root.tree, '/tree', errors, visited, filePathsById, directoryPathsById)
  if (visited.size !== fileIds.size + directoryIds.size) {
    add(errors, 'tree-coverage', '/tree', 'Il tree non copre esattamente tutti i record file e directory.')
  }

  const summary = requireRecord(root.summary, '/summary', errors)
  const expectedDirectoryCount = Math.max(0, directories.length - 1)
  const summaryChecks: readonly [string, number][] = [
    ['fileCount', files.length],
    ['directoryCount', expectedDirectoryCount],
    ['includedFileCount', includedFileCount],
    ['excludedFileCount', files.length - includedFileCount],
    ['blockedFileCount', blockedFileCount],
    ['logicalBytes', logicalBytes],
    ['includedLogicalBytes', includedLogicalBytes],
    ['sourceBytes', inputSourceBytes],
  ]
  summaryChecks.forEach(([key, expected]) => {
    const actual = requireInteger(summary[key], `/summary/${key}`, errors)
    if (actual !== expected) add(errors, 'summary-consistency', `/summary/${key}`, `Valore atteso: ${expected}.`)
  })
  if (inputLogicalBytes !== logicalBytes) add(errors, 'input-logical-bytes', '/input/logicalBytes', 'I byte logici non corrispondono ai file.')

  const summaryCapabilityCounts = requireRecord(summary.capabilityCounts, '/summary/capabilityCounts', errors)
  Object.entries(capabilityCounts).forEach(([key, expected]) => {
    if (summaryCapabilityCounts[key] !== expected) add(errors, 'capability-count', `/summary/capabilityCounts/${key}`, `Valore atteso: ${expected}.`)
  })
  const summaryRiskCounts = requireRecord(summary.riskCounts, '/summary/riskCounts', errors)
  Object.entries(riskCounts).forEach(([key, expected]) => {
    if (summaryRiskCounts[key] !== expected) add(errors, 'risk-count', `/summary/riskCounts/${key}`, `Valore atteso: ${expected}.`)
  })


  const securitySummary = requireRecord(root.security, '/security', errors)
  const settings = requireRecord(root.settings, '/settings', errors)
  validateEnum(securitySummary.mode, new Set(['report-only', 'redact', 'exclude']), '/security/mode', 'security-mode', errors)
  if (securitySummary.mode !== settings.secretHandling) add(errors, 'security-mode-consistency', '/security/mode', 'La modalità sicurezza deve corrispondere alle impostazioni.')
  const secretPolicy = requireRecord(securitySummary.policy, '/security/policy', errors)
  ;(['maxCharactersPerFile', 'maxFindingsPerFile', 'maxCandidateLength', 'minHighEntropyLength'] as const).forEach((key) => {
    const policyValue = requireInteger(secretPolicy[key], `/security/policy/${key}`, errors)
    if (policyValue > SECRET_SCAN_POLICY_MAXIMUMS[key]) add(errors, 'security-policy-maximum', `/security/policy/${key}`, `Valore oltre il limite massimo di ${SECRET_SCAN_POLICY_MAXIMUMS[key]}.`)
  })
  if (typeof secretPolicy.highEntropyThreshold !== 'number' || !Number.isFinite(secretPolicy.highEntropyThreshold) || secretPolicy.highEntropyThreshold < 1 || secretPolicy.highEntropyThreshold > 8) add(errors, 'security-entropy-threshold', '/security/policy/highEntropyThreshold', 'Soglia entropia non valida.')
  if (typeof secretPolicy.scanHighEntropy !== 'boolean') add(errors, 'security-high-entropy', '/security/policy/scanHighEntropy', 'È richiesto un booleano.')
  Object.entries(securityCounts).forEach(([key, expected]) => {
    const actual = requireInteger(securitySummary[key], `/security/${key}`, errors)
    if (actual !== expected) add(errors, 'security-summary-consistency', `/security/${key}`, `Valore atteso: ${expected}.`)
  })
  const manifestCategoryCounts = requireRecord(securitySummary.categoryCounts, '/security/categoryCounts', errors)
  Object.entries(securityCategoryCounts).forEach(([key, expected]) => {
    const actual = requireInteger(manifestCategoryCounts[key], `/security/categoryCounts/${key}`, errors)
    if (actual !== expected) add(errors, 'security-category-count', `/security/categoryCounts/${key}`, `Valore atteso: ${expected}.`)
  })

  const outputs = requireArray(root.outputs, '/outputs', errors)
  const outputFamilies = new Set<string>()
  let contentOutput: Record<string, unknown> | undefined
  outputs.forEach((item, index) => {
    const output = requireRecord(item, `/outputs/${index}`, errors)
    const family = requireString(output.family, `/outputs/${index}/family`, errors)
    if (outputFamilies.has(family)) add(errors, 'output-family-duplicate', `/outputs/${index}/family`, 'Famiglia output duplicata.')
    outputFamilies.add(family)
    const expectedKinds: Readonly<Record<string, string>> = { documents: 'pdf', content: 'markdown', manifest: 'json' }
    if (expectedKinds[family] && output.kind !== expectedKinds[family]) add(errors, 'output-kind', `/outputs/${index}/kind`, 'Kind non coerente con la famiglia output.')
    validateEnum(output.status, new Set(['planned', 'generated', 'failed']), `/outputs/${index}/status`, 'output-status', errors)
    validateStringArray(output.parts, `/outputs/${index}/parts`, errors)
    if (output.sha256 !== null && (typeof output.sha256 !== 'string' || !SHA256_PATTERN.test(output.sha256))) add(errors, 'output-sha256', `/outputs/${index}/sha256`, 'Hash output non valido.')
    if (family === 'content') contentOutput = output
  })
  ;['documents', 'content', 'manifest'].forEach((family) => {
    if (!outputFamilies.has(family)) add(errors, 'output-family-missing', '/outputs', `Famiglia output mancante: ${family}.`)
  })

  const contentParts = contentOutput ? validateStringArray(contentOutput.parts, '/outputs/content/parts', errors) : []
  const contentPartSet = new Set(contentParts)
  const markdownAnchors = new Set<string>()
  files.forEach((item, index) => {
    if (!isRecord(item)) return
    const markdown = requireRecord(requireRecord(item.representations, `/files/${index}/representations`, errors).markdown, `/files/${index}/representations/markdown`, errors)
    validateStringArray(markdown.anchors, `/files/${index}/representations/markdown/anchors`, errors).forEach((anchor, anchorIndex) => {
      if (markdownAnchors.has(anchor)) add(errors, 'markdown-anchor-duplicate', `/files/${index}/representations/markdown/anchors/${anchorIndex}`, 'Anchor Markdown duplicato tra file.')
      markdownAnchors.add(anchor)
    })
    validateStringArray(markdown.parts, `/files/${index}/representations/markdown/parts`, errors).forEach((part, partIndex) => {
      if (!contentPartSet.has(part)) add(errors, 'markdown-part-reference', `/files/${index}/representations/markdown/parts/${partIndex}`, 'Parte Markdown non dichiarata dall’output content.')
    })
  })

  const sharding = requireRecord(root.sharding, '/sharding', errors)
  const shardingParts = validateStringArray(sharding.parts, '/sharding/parts', errors)
  if (contentOutput?.status === 'generated') {
    if (contentParts.length === 0) add(errors, 'content-parts-empty', '/outputs', 'Un output Markdown generato deve dichiarare almeno una parte.')
    if (shardingParts.join('\0') !== contentParts.join('\0')) add(errors, 'sharding-output-parts', '/sharding/parts', 'Le parti di sharding devono corrispondere all’output content.')
    if (sharding.applied !== (contentParts.length > 1)) add(errors, 'sharding-applied-consistency', '/sharding/applied', 'applied deve indicare se esiste più di una parte Markdown.')
  } else {
    if (contentParts.length > 0) add(errors, 'content-parts-planned', '/outputs', 'Un output Markdown non generato non deve dichiarare parti.')
    if (sharding.applied !== false || shardingParts.length > 0) add(errors, 'sharding-before-output', '/sharding', 'Lo sharding non può essere applicato prima della generazione Markdown.')
  }

  return { valid: errors.length === 0, errors }
}

export function assertValidManifestV1(value: unknown): asserts value is ManifestV1 {
  const result = validateManifestV1(value)
  if (!result.valid) {
    const first = result.errors[0]
    throw new Error(first ? `${first.path}: ${first.message}` : 'Manifest v1 non valido.')
  }
}
