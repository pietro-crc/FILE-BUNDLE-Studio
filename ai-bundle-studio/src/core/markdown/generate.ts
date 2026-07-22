import { extractImageFile } from '../image/adapter'
import type { ImageAsset, ImagePolicy } from '../image/types'
import type { ManifestArtifact, ManifestFileRecord, ManifestTreeNode } from '../manifest/types'
import { extractPdfFile } from '../pdf/adapter'
import type { PdfDocumentAsset, PdfPolicy } from '../pdf/types'
import type { VirtualFileSystem } from '../vfs/types'
import { secureDerivedContent } from '../security/apply'
import { createSecretScanPolicy } from '../security/policy'
import { notScannedSecretReport, scanSecrets } from '../security/scanner'
import { summarizeSecurity } from '../security/summary'
import type { SecretFileReport, SecretScanPolicy, SecuritySummary } from '../security/types'
import { extractSpreadsheetFile } from '../spreadsheet/adapter'
import { DEFAULT_SPREADSHEET_POLICY } from '../spreadsheet/ooxml'
import { SPREADSHEET_SHEET_BREAK } from '../spreadsheet/render'
import type { SpreadsheetPolicy, SpreadsheetWorkbook } from '../spreadsheet/types'
import { DEFAULT_OFFICE_POLICY, extractOfficeFile } from '../office/adapter'
import { renderOfficePreviewPdf } from '../office/preview'
import type { OfficeAsset, OfficePolicy } from '../office/types'
import { createMarkdownAnchor, renderMarkdownAnchor } from './anchor'
import { splitTextByUtf8Bytes, utf8ByteLength } from './chunk'
import { renderFencedContent } from './fence'
import { markdownLanguageFor } from './language'
import { updateManifestWithMarkdown } from './manifest-update'
import { extractTextFile, failedTextExtraction } from './text-adapter'
import type {
  MarkdownArtifact,
  MarkdownBundle,
  MarkdownGenerationPolicy,
  MarkdownGenerationProgress,
  MarkdownPart,
  TextExtractionRecord,
} from './types'
import { validateMarkdownBundle } from './validate'

export const DEFAULT_MARKDOWN_POLICY: MarkdownGenerationPolicy = {
  maxBytesPerFile: 1_048_576,
  maxCharactersPerFile: 1_000_000,
  maxPartBytes: 4_194_304,
  includeLineNumbers: false,
  language: 'it',
}

interface MarkdownAtom {
  readonly content: string
  readonly anchors: readonly string[]
  readonly fileId?: string
}

interface ExtractedMarkdownContent {
  readonly content: string
  readonly language: string
  readonly renderMode: 'fenced' | 'markdown'
}

interface MutableRecordState {
  record: TextExtractionRecord
  readonly anchors: string[]
  readonly parts: Set<string>
}

export interface GenerateMarkdownOptions {
  readonly generatedAt?: string
  readonly policy?: Partial<MarkdownGenerationPolicy>
  readonly signal?: AbortSignal
  readonly onProgress?: (progress: MarkdownGenerationProgress) => void
  readonly spreadsheetPolicy?: Partial<SpreadsheetPolicy>
  readonly pdfPolicy?: Partial<PdfPolicy>
  readonly imagePolicy?: Partial<ImagePolicy>
  readonly officePolicy?: Partial<OfficePolicy>
  readonly secretPolicy?: Partial<SecretScanPolicy>
}

function abortError(signal?: AbortSignal): DOMException {
  return new DOMException(signal?.reason ? String(signal.reason) : 'Operazione annullata.', 'AbortError')
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError(signal)
}

function assertGeneratedAt(value: string): string {
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new Error('generatedAt deve essere una data ISO-8601 UTC canonica.')
  }
  return value
}

function createPolicy(manifestArtifact: ManifestArtifact, overrides?: Partial<MarkdownGenerationPolicy>): MarkdownGenerationPolicy {
  const policy = {
    ...DEFAULT_MARKDOWN_POLICY,
    language: manifestArtifact.manifest.settings.language,
    ...overrides,
  }
  const integerKeys: readonly (keyof Pick<MarkdownGenerationPolicy, 'maxBytesPerFile' | 'maxCharactersPerFile' | 'maxPartBytes'>)[] = [
    'maxBytesPerFile',
    'maxCharactersPerFile',
    'maxPartBytes',
  ]
  integerKeys.forEach((key) => {
    if (!Number.isSafeInteger(policy[key]) || policy[key] < 1) throw new RangeError(`${key} deve essere un intero positivo.`)
  })
  if (policy.maxPartBytes < 4096) throw new RangeError('maxPartBytes deve essere almeno 4096 byte.')
  if (policy.language.trim().length < 2) throw new Error('La lingua output deve contenere almeno due caratteri.')
  return policy
}

function escapeMarkdown(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('\\', '\\\\')
    .replaceAll(/([*_[\]#])/gu, '\\$1')
}

function renderTree(node: ManifestTreeNode, depth = 0): string[] {
  if (node.normalizedPath === '') {
    return node.children.flatMap((child) => renderTree(child, 0))
  }
  const marker = node.kind === 'directory' ? '📁' : '📄'
  const line = `${'  '.repeat(depth)}- ${marker} ${escapeMarkdown(node.name)}`
  return node.kind === 'directory'
    ? [line, ...node.children.flatMap((child) => renderTree(child, depth + 1))]
    : [line]
}

function placeholderRecord(file: ManifestFileRecord): TextExtractionRecord {
  const status = file.inclusion.included ? 'not-started' : 'not-applicable'
  return {
    adapterId: file.adapter.id,
    adapterVersion: file.adapter.version ?? 'pending',
    contentKind: file.mimeDetected === 'application/pdf' ? 'pdf' : file.category === 'image' ? 'image' : file.category === 'spreadsheet' ? 'spreadsheet' : file.category === 'presentation' ? 'presentation' : file.category === 'document' ? 'document' : 'text',
    fileId: file.fileId,
    path: file.normalizedPath,
    status,
    encoding: file.encoding,
    usedFallback: false,
    replacementCharacters: 0,
    originalBytes: file.size,
    extractedBytes: 0,
    extractedCharacters: 0,
    lineCount: 0,
    truncated: false,
    truncationReason: null,
    newlineNormalization: null,
    anchors: [],
    parts: [],
    warnings: [],
    error: null,
    sha256: file.integrity.status === 'computed' ? file.integrity.value : null,
  }
}

function renderHeader(manifestArtifact: ManifestArtifact, policy: MarkdownGenerationPolicy, security: SecuritySummary): string {
  const manifest = manifestArtifact.manifest
  return [
    '## Descrizione del pacchetto semantico',
    '',
    '> Rappresentazione semantica generata localmente da AI Bundle Studio.',
    '',
    '## Istruzioni per l’assistente AI',
    '',
    '1. Leggi prima il manifest JSON e consideralo l’indice autorevole.',
    '2. Usa sempre i percorsi originali per distinguere file omonimi.',
    '3. Consulta il PDF per il layout visuale e questo Markdown per testo, codice e tabelle.',
    '4. Dichiara quando una sezione è parziale, troncata, esclusa, fallita o ancora non elaborata.',
    '5. In modalità multipart attendi tutte le parti dichiarate dal manifest.',
    '',
    '## Riepilogo',
    '',
    `- File totali: ${manifest.summary.fileCount}`,
    `- File inclusi: ${manifest.summary.includedFileCount}`,
    `- File esclusi: ${manifest.summary.excludedFileCount}`,
    `- Byte logici inclusi: ${manifest.summary.includedLogicalBytes}`,
    `- Limite per file testuale: ${policy.maxBytesPerFile} byte / ${policy.maxCharactersPerFile} caratteri`,
    `- Numeri di riga: ${policy.includeLineNumbers ? 'inclusi' : 'non inclusi'}`,
    `- Policy segreti: ${security.mode}`,
    `- File segnalati: ${security.flaggedFileCount}; finding: ${security.findingCount}; redazioni: ${security.redactionCount}; esclusioni: ${security.excludedFileCount}`,
    '- Normalizzazione testuale: terminatori di riga LF; byte originali non modificati.',
  ].join('\n')
}

function renderIndex(manifestArtifact: ManifestArtifact, reports: ReadonlyMap<string, SecretFileReport>): string {
  const lines = ['## Indice dei file', '']
  manifestArtifact.manifest.files.forEach((file) => {
    const path = escapeMarkdown(file.originalPath)
    const security = reports.get(file.fileId)
    if (!file.inclusion.included || security?.excluded) {
      lines.push(`- **${path}** — escluso (${security?.excluded ? 'excluded-secret-policy' : file.inclusion.reason})`)
    } else if (file.isText || file.mimeDetected === 'application/pdf' || file.category === 'image' || (file.category === 'spreadsheet' && ['xlsx', 'xlsm'].includes(file.extension)) || (file.category === 'document' && ['docx', 'docm'].includes(file.extension)) || (file.category === 'presentation' && ['pptx', 'pptm'].includes(file.extension))) {
      lines.push(`- **${path}** — anchor \`${createMarkdownAnchor(file.fileId)}\`${security?.status === 'redacted' ? ' · contenuto redatto' : security?.findings.length ? ` · ${security.findings.length} segnalazioni` : ''}`)
    } else {
      lines.push(`- **${path}** — adapter ${escapeMarkdown(file.adapter.id)} previsto in uno step successivo`)
    }
  })
  return lines.join('\n')
}

function renderInventory(manifestArtifact: ManifestArtifact): string {
  return [
    '## Tree compatto',
    '',
    ...renderTree(manifestArtifact.manifest.tree),
  ].join('\n')
}

function renderFileSection(
  file: ManifestFileRecord,
  record: TextExtractionRecord,
  content: string,
  language: string,
  anchor: string,
  segment: number,
  totalSegments: number,
  includeLineNumbers: boolean,
  renderMode: 'fenced' | 'markdown',
  security: SecretFileReport,
): string {
  const warningLines = record.warnings.length > 0
    ? ['', '**Avvisi:**', ...record.warnings.map((warning) => `- ${escapeMarkdown(warning)}`)]
    : []
  const status = record.status === 'partial' ? 'parziale' : record.status === 'failed' ? 'fallita' : 'completa'
  const metadata = [
    renderMarkdownAnchor(anchor),
    `## File: ${escapeMarkdown(file.originalPath)}`,
    '',
    `- Identificatore: \`${file.fileId}\``,
    `- Percorso normalizzato: ${escapeMarkdown(file.normalizedPath)}`,
    `- MIME rilevato: \`${escapeMarkdown(file.mimeDetected)}\``,
    `- Estensione: \`${escapeMarkdown(file.extension || '(nessuna)')}\``,
    `- Dimensione originale: ${file.size} byte`,
    `- SHA-256 originale: ${record.sha256 ? `\`${record.sha256}\`` : 'pending — byte completi non letti in questo step'}`,
    `- Encoding: ${record.encoding ?? 'non disponibile'}`,
    `- Stato: ${status}`,
    `- Troncamento: ${record.truncated ? `sì (${record.truncationReason})` : 'no'}`,
    `- Segmento: ${segment}/${totalSegments}`,
    `- Righe estratte: ${record.lineCount}`,
    `- Numeri di riga: ${record.contentKind === 'text' && includeLineNumbers ? 'sì' : 'no'}`,
    `- Normalizzazione: ${record.newlineNormalization === 'lf' ? 'terminatori LF' : 'non applicabile'}`,
    `- Scanner segreti: ${security.status}; finding ${security.findings.length}; redazioni ${security.redactionCount}`,
    `- Rappresentazione visuale omessa: ${security.visualOmitted ? 'sì' : 'no'}`,
    ...warningLines,
  ]
  if (record.status === 'failed') {
    return [...metadata, '', `**Errore:** ${escapeMarkdown(record.error ?? 'Estrazione non riuscita.')}`].join('\n')
  }
  return [...metadata, '', renderMode === 'markdown' ? content : renderFencedContent(content, language)].join('\n')
}

function splitPlainAtom(content: string, maxBytes: number): MarkdownAtom[] {
  return splitTextByUtf8Bytes(content, maxBytes).map((chunk) => ({ content: chunk, anchors: [] }))
}

function createFileAtoms(
  file: ManifestFileRecord,
  record: TextExtractionRecord,
  content: string,
  language: string,
  maxAtomBytes: number,
  includeLineNumbers: boolean,
  renderMode: 'fenced' | 'markdown',
  security: SecretFileReport,
): MarkdownAtom[] {
  if (record.status === 'failed') {
    const anchor = createMarkdownAnchor(file.fileId)
    return [{
      content: renderFileSection(file, record, '', language, anchor, 1, 1, includeLineNumbers, renderMode, security),
      anchors: [anchor],
      fileId: file.fileId,
    }]
  }
  let chunkBudget = Math.max(256, maxAtomBytes - 2048)
  let chunks = renderMode === 'markdown'
    ? content.split(SPREADSHEET_SHEET_BREAK).map((chunk) => chunk.trim()).filter(Boolean)
    : splitTextByUtf8Bytes(content, chunkBudget)
  if (chunks.length === 0) chunks = ['']
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const atoms = chunks.map((chunk, index) => {
      const anchor = createMarkdownAnchor(file.fileId, index + 1)
      return {
        content: renderFileSection(file, record, chunk, language, anchor, index + 1, chunks.length, includeLineNumbers, renderMode, security),
        anchors: [anchor],
        fileId: file.fileId,
      } satisfies MarkdownAtom
    })
    if (atoms.every((atom) => utf8ByteLength(atom.content) <= maxAtomBytes)) return atoms
    chunkBudget = Math.max(128, Math.floor(chunkBudget * 0.7))
    chunks = splitTextByUtf8Bytes(content, chunkBudget)
  }
  throw new Error(`Impossibile suddividere ${file.normalizedPath} entro la soglia Markdown.`)
}

function createPartName(projectName: string, index: number, total: number): string {
  return total === 1
    ? `${projectName}-content.md`
    : `${projectName}-content.part-${String(index + 1).padStart(3, '0')}.md`
}

function groupAtoms(atoms: readonly MarkdownAtom[], maxPartBytes: number): MarkdownAtom[][] {
  const payloadBudget = maxPartBytes - 1024
  const groups: MarkdownAtom[][] = []
  let current: MarkdownAtom[] = []
  let currentBytes = 0
  atoms.forEach((atom) => {
    const atomBytes = utf8ByteLength(atom.content) + 2
    if (atomBytes > payloadBudget) throw new Error('Una sezione Markdown supera il budget della singola parte.')
    if (current.length > 0 && currentBytes + atomBytes > payloadBudget) {
      groups.push(current)
      current = []
      currentBytes = 0
    }
    current.push(atom)
    currentBytes += atomBytes
  })
  if (current.length > 0) groups.push(current)
  return groups.length > 0 ? groups : [[]]
}

function renderParts(projectName: string, groups: readonly MarkdownAtom[][], maxPartBytes: number): MarkdownPart[] {
  return groups.map((atoms, index) => {
    const name = createPartName(projectName, index, groups.length)
    const prelude = [
      `<!-- ai-bundle-part:${name} -->`,
      `# ${escapeMarkdown(projectName)} — contenuto · parte ${index + 1}/${groups.length}`,
      '',
      groups.length > 1 ? '> Carica tutte le parti dichiarate dal manifest prima dell’analisi.' : '> Output Markdown principale del progetto.',
      '',
    ].join('\n')
    const content = `${prelude}${atoms.map((atom) => atom.content).join('\n\n')}\n`
    const byteLength = utf8ByteLength(content)
    if (byteLength > maxPartBytes) throw new Error(`La parte ${name} supera la soglia configurata.`)
    return {
      name,
      content,
      byteLength,
      anchors: atoms.flatMap((atom) => atom.anchors),
    }
  })
}


interface SecuredExtraction {
  readonly record: TextExtractionRecord
  readonly content: string
  readonly report: SecretFileReport
  readonly keepVisual: boolean
}

function secureExtraction(
  file: ManifestFileRecord,
  record: TextExtractionRecord,
  content: string,
  mode: ManifestArtifact['manifest']['settings']['secretHandling'],
  policy?: Partial<SecretScanPolicy>,
): SecuredExtraction {
  const secured = secureDerivedContent(file.fileId, file.normalizedPath, content, mode, policy)
  const visualOmitted = secured.report.status === 'redacted' && record.contentKind !== 'text'
  const report: SecretFileReport = visualOmitted
    ? { ...secured.report, visualOmitted: true, warnings: [...secured.report.warnings, 'La rappresentazione visuale originale è omessa perché non può essere redatta in modo affidabile.'] }
    : secured.report
  const findingWarning = report.findings.length > 0
    ? `Scanner segreti: ${report.findings.length} segnalazioni (${mode}).`
    : null
  if (report.excluded) {
    return {
      content: '',
      report,
      keepVisual: false,
      record: {
        ...record,
        status: 'not-applicable',
        extractedCharacters: 0,
        lineCount: 0,
        truncated: false,
        truncationReason: null,
        newlineNormalization: null,
        anchors: [],
        parts: [],
        warnings: [...record.warnings, ...report.warnings, ...(findingWarning ? [findingWarning, 'File escluso dagli output derivati dalla policy segreti.'] : [])],
      },
    }
  }
  return {
    content: secured.content,
    report,
    keepVisual: !report.visualOmitted,
    record: {
      ...record,
      extractedCharacters: secured.content.length,
      lineCount: secured.content.length === 0 ? 0 : secured.content.split('\n').length,
      warnings: [...record.warnings, ...report.warnings, ...(findingWarning ? [findingWarning] : [])],
    },
  }
}

export async function generateMarkdownBundle(
  fileSystem: VirtualFileSystem,
  manifestArtifact: ManifestArtifact,
  options: GenerateMarkdownOptions = {},
): Promise<MarkdownBundle> {
  if (!manifestArtifact.validation.valid) throw new Error('Il manifest deve essere valido prima della generazione Markdown.')
  const policy = createPolicy(manifestArtifact, options.policy)
  const generatedAt = assertGeneratedAt(options.generatedAt ?? new Date().toISOString())
  const secretPolicy = createSecretScanPolicy(options.secretPolicy)
  const filesByPath = new Map(fileSystem.files.map((file) => [file.normalizedPath, file]))
  const recordStates = new Map<string, MutableRecordState>()
  const extracted = new Map<string, ExtractedMarkdownContent>()
  const spreadsheetWorkbooks: SpreadsheetWorkbook[] = []
  const pdfDocuments: PdfDocumentAsset[] = []
  const imageAssets: ImageAsset[] = []
  const officeAssets: OfficeAsset[] = []
  const securityReports = new Map<string, SecretFileReport>()
  const processableFiles = manifestArtifact.manifest.files.filter((file) => file.inclusion.included && (
    file.isText
    || file.mimeDetected === 'application/pdf'
    || file.category === 'image'
    || (file.category === 'spreadsheet' && ['xlsx', 'xlsm'].includes(file.extension))
    || (file.category === 'document' && ['docx', 'docm'].includes(file.extension))
    || (file.category === 'presentation' && ['pptx', 'pptm'].includes(file.extension))
  ))
  let completed = 0
  let warningCount = 0
  let errorCount = 0

  for (const manifestFile of manifestArtifact.manifest.files) {
    assertNotAborted(options.signal)
    const isSpreadsheet = manifestFile.category === 'spreadsheet' && ['xlsx', 'xlsm'].includes(manifestFile.extension)
    const isPdf = manifestFile.mimeDetected === 'application/pdf'
    const isImage = manifestFile.category === 'image'
    const isOffice = (manifestFile.category === 'document' && ['docx', 'docm'].includes(manifestFile.extension)) || (manifestFile.category === 'presentation' && ['pptx', 'pptm'].includes(manifestFile.extension))
    if (!manifestFile.inclusion.included || (!manifestFile.isText && !isSpreadsheet && !isPdf && !isImage && !isOffice)) {
      const record = placeholderRecord(manifestFile)
      recordStates.set(manifestFile.fileId, { record, anchors: [], parts: new Set() })
      securityReports.set(manifestFile.fileId, notScannedSecretReport(manifestFile.fileId, manifestFile.normalizedPath, manifestArtifact.manifest.settings.secretHandling))
      continue
    }
    options.onProgress?.({ completed, total: processableFiles.length, currentPath: manifestFile.normalizedPath, warnings: warningCount, errors: errorCount })
    const file = filesByPath.get(manifestFile.normalizedPath)
    if (!file) throw new Error(`File VFS mancante: ${manifestFile.normalizedPath}.`)
    try {
      // eslint-disable-next-line no-await-in-loop -- Sequential reads provide deterministic progress and bounded memory before STEP-010 workers.
      if (isSpreadsheet) {
        // eslint-disable-next-line no-await-in-loop -- Sequential workbook reads preserve bounded memory before STEP-010 workers.
        const result = await extractSpreadsheetFile(file, manifestFile, options.spreadsheetPolicy, options.signal)
        const secured = secureExtraction(manifestFile, result.record, result.content, manifestArtifact.manifest.settings.secretHandling, secretPolicy)
        recordStates.set(manifestFile.fileId, { record: secured.record, anchors: [], parts: new Set() })
        securityReports.set(manifestFile.fileId, secured.report)
        if (!secured.report.excluded) extracted.set(manifestFile.fileId, { content: secured.content, language: result.language, renderMode: 'markdown' })
        if (secured.keepVisual) spreadsheetWorkbooks.push(result.workbook)
        warningCount += secured.record.warnings.length
      } else if (isPdf) {
        // eslint-disable-next-line no-await-in-loop -- Sequential PDF reads preserve bounded memory before STEP-010 workers.
        const result = await extractPdfFile(file, manifestFile, options.pdfPolicy, options.signal)
        const secured = secureExtraction(manifestFile, result.record, result.content, manifestArtifact.manifest.settings.secretHandling, secretPolicy)
        recordStates.set(manifestFile.fileId, { record: secured.record, anchors: [], parts: new Set() })
        securityReports.set(manifestFile.fileId, secured.report)
        if (!secured.report.excluded) extracted.set(manifestFile.fileId, { content: secured.content, language: result.language, renderMode: 'markdown' })
        if (secured.keepVisual) pdfDocuments.push(result.asset)
        warningCount += secured.record.warnings.length
      } else if (isImage) {
        // eslint-disable-next-line no-await-in-loop -- Sequential image reads preserve bounded memory before STEP-010 workers.
        const result = await extractImageFile(file, manifestFile, options.imagePolicy, options.signal)
        const secured = secureExtraction(manifestFile, result.record, result.content, manifestArtifact.manifest.settings.secretHandling, secretPolicy)
        recordStates.set(manifestFile.fileId, { record: secured.record, anchors: [], parts: new Set() })
        securityReports.set(manifestFile.fileId, secured.report)
        if (!secured.report.excluded) extracted.set(manifestFile.fileId, { content: secured.content, language: result.language, renderMode: 'markdown' })
        if (secured.keepVisual) imageAssets.push(result.asset)
        warningCount += secured.record.warnings.length
      } else if (isOffice) {
        // eslint-disable-next-line no-await-in-loop -- Sequential Office reads preserve bounded memory before STEP-010 workers.
        const result = await extractOfficeFile(file, manifestFile, options.officePolicy, options.signal)
        const secured = secureExtraction(manifestFile, result.record, result.content, manifestArtifact.manifest.settings.secretHandling, secretPolicy)
        recordStates.set(manifestFile.fileId, { record: secured.record, anchors: [], parts: new Set() })
        securityReports.set(manifestFile.fileId, secured.report)
        if (!secured.report.excluded) extracted.set(manifestFile.fileId, { content: secured.content, language: result.language, renderMode: 'markdown' })
        if (secured.keepVisual) officeAssets.push(result.asset)
        warningCount += secured.record.warnings.length
      } else {
        // eslint-disable-next-line no-await-in-loop -- Sequential text reads preserve deterministic progress and bounded memory before STEP-010 workers.
        const result = await extractTextFile(
          file,
          manifestFile,
          policy,
          markdownLanguageFor(file.name, file.extension),
          options.signal,
        )
        const secured = secureExtraction(manifestFile, result.record, result.content, manifestArtifact.manifest.settings.secretHandling, secretPolicy)
        recordStates.set(manifestFile.fileId, { record: secured.record, anchors: [], parts: new Set() })
        securityReports.set(manifestFile.fileId, secured.report)
        if (!secured.report.excluded) extracted.set(manifestFile.fileId, { content: secured.content, language: result.language, renderMode: 'fenced' })
        warningCount += secured.record.warnings.length
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      const failed = failedTextExtraction(manifestFile, error)
      const failedRecord = isSpreadsheet
        ? { ...failed.record, adapterId: 'spreadsheet-ooxml', adapterVersion: '1.0.0', contentKind: 'spreadsheet' as const, encoding: null, newlineNormalization: null }
        : isPdf
          ? { ...failed.record, adapterId: 'pdf', adapterVersion: '1.0.0', contentKind: 'pdf' as const, encoding: null, newlineNormalization: 'lf' as const }
          : isImage
            ? { ...failed.record, adapterId: 'image', adapterVersion: '1.0.0', contentKind: 'image' as const, encoding: null, newlineNormalization: 'lf' as const }
            : isOffice
              ? { ...failed.record, adapterId: manifestFile.category === 'presentation' ? 'presentation-ooxml' : 'docx', adapterVersion: '1.0.0', contentKind: manifestFile.category === 'presentation' ? 'presentation' as const : 'document' as const, encoding: null, newlineNormalization: 'lf' as const }
              : failed.record
      recordStates.set(manifestFile.fileId, { record: failedRecord, anchors: [], parts: new Set() })
      const filenameReport = scanSecrets(manifestFile.fileId, manifestFile.normalizedPath, '', manifestArtifact.manifest.settings.secretHandling, secretPolicy)
      securityReports.set(manifestFile.fileId, { ...filenameReport, status: 'failed', warnings: [...filenameReport.warnings, 'Contenuto non scansionato perché l’estrazione è fallita.'], error: failedRecord.error })
      const derived = isSpreadsheet || isPdf || isImage || isOffice
      extracted.set(manifestFile.fileId, { content: '', language: derived ? 'markdown' : failed.language, renderMode: derived ? 'markdown' : 'fenced' })
      errorCount += 1
    }
    completed += 1
    options.onProgress?.({ completed, total: processableFiles.length, currentPath: manifestFile.normalizedPath, warnings: warningCount, errors: errorCount })
    // Yield so React can publish progress before the next local read.
    // eslint-disable-next-line no-await-in-loop -- Intentional cooperative scheduling until worker orchestration arrives.
    await Promise.resolve()
  }

  const securityReportList = manifestArtifact.manifest.files.map((file) => securityReports.get(file.fileId) ?? notScannedSecretReport(file.fileId, file.normalizedPath, manifestArtifact.manifest.settings.secretHandling))
  const securitySummary = summarizeSecurity(securityReportList, manifestArtifact.manifest.settings.secretHandling, secretPolicy)
  const maxAtomBytes = policy.maxPartBytes - 1024
  const atoms: MarkdownAtom[] = [
    ...splitPlainAtom(renderHeader(manifestArtifact, policy, securitySummary), maxAtomBytes),
    ...splitPlainAtom(renderInventory(manifestArtifact), maxAtomBytes),
    ...splitPlainAtom(renderIndex(manifestArtifact, securityReports), maxAtomBytes),
  ]

  manifestArtifact.manifest.files.forEach((manifestFile) => {
    const state = recordStates.get(manifestFile.fileId)
    const content = extracted.get(manifestFile.fileId)
    const isSupportedSpreadsheet = manifestFile.category === 'spreadsheet' && ['xlsx', 'xlsm'].includes(manifestFile.extension)
    const isSupportedOffice = (manifestFile.category === 'document' && ['docx', 'docm'].includes(manifestFile.extension)) || (manifestFile.category === 'presentation' && ['pptx', 'pptm'].includes(manifestFile.extension))
    const isSupportedDerived = manifestFile.mimeDetected === 'application/pdf' || manifestFile.category === 'image' || isSupportedSpreadsheet || isSupportedOffice
    if (!state || !content || !manifestFile.inclusion.included || (!manifestFile.isText && !isSupportedDerived)) return
    const fileAtoms = createFileAtoms(
      manifestFile,
      state.record,
      content.content,
      content.language,
      maxAtomBytes,
      policy.includeLineNumbers,
      content.renderMode,
      securityReports.get(manifestFile.fileId) ?? notScannedSecretReport(manifestFile.fileId, manifestFile.normalizedPath, manifestArtifact.manifest.settings.secretHandling),
    )
    fileAtoms.forEach((atom) => {
      state.anchors.push(...atom.anchors)
      atoms.push(atom)
    })
  })

  const groups = groupAtoms(atoms, policy.maxPartBytes)
  const parts = renderParts(manifestArtifact.manifest.projectName, groups, policy.maxPartBytes)
  groups.forEach((atomsInPart, index) => {
    const partName = parts[index]?.name
    if (!partName) return
    atomsInPart.forEach((atom) => {
      if (!atom.fileId) return
      recordStates.get(atom.fileId)?.parts.add(partName)
    })
  })

  const records = manifestArtifact.manifest.files.map((file) => {
    const state = recordStates.get(file.fileId)
    if (!state) throw new Error(`Record Markdown mancante: ${file.normalizedPath}.`)
    return { ...state.record, anchors: [...state.anchors], parts: [...state.parts] }
  })
  const draft: Omit<MarkdownArtifact, 'validation'> = {
    mediaType: 'text/markdown',
    generatedAt,
    projectName: manifestArtifact.manifest.projectName,
    policy,
    parts,
    records,
    spreadsheetWorkbooks,
    pdfDocuments,
    imageAssets,
    officeAssets,
    securityReports: securityReportList,
    securitySummary,
    spreadsheetPreview: spreadsheetWorkbooks.length > 0
      ? await (await import('../spreadsheet/preview')).renderSpreadsheetPreviewPdf(spreadsheetWorkbooks, { ...DEFAULT_SPREADSHEET_POLICY, ...options.spreadsheetPolicy })
      : null,
    officePreview: officeAssets.length > 0
      ? await renderOfficePreviewPdf(officeAssets, { ...DEFAULT_OFFICE_POLICY, ...options.officePolicy })
      : null,
    totalBytes: parts.reduce((total, part) => total + part.byteLength, 0),
    sharded: parts.length > 1,
  }
  const updatedManifest = updateManifestWithMarkdown(manifestArtifact, draft, generatedAt)
  const validation = validateMarkdownBundle(draft, updatedManifest)
  const markdown: MarkdownArtifact = { ...draft, validation }
  return { markdown, manifest: updatedManifest }
}
