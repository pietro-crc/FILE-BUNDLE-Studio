import type { PDFDocument, PDFFont, PDFImage, PDFPage } from 'pdf-lib'
import type { ImageAsset } from '../image/types'
import type { ManifestArtifact, ManifestFileRecord } from '../manifest/types'
import type { MarkdownArtifact } from '../markdown/types'
import type { PdfDocumentAsset } from '../pdf/types'
import type { SpreadsheetPreviewArtifact } from '../spreadsheet/types'
import type { OfficePreviewArtifact } from '../office/types'
import type { DocumentsArtifact, DocumentsFileRecord, DocumentsPageRecord, DocumentsPolicy } from './types'

export const DOCUMENTS_ADAPTER_VERSION = '1.0.0' as const

export const DEFAULT_DOCUMENTS_POLICY: DocumentsPolicy = {
  maxOutputPages: 2_000,
  indexEntriesPerPage: 34,
  includeSpreadsheetPreview: true,
}

interface PreparedEntry {
  readonly file: ManifestFileRecord
  readonly adapterId: string
  readonly warnings: string[]
  readonly error: string | null
  readonly kind: 'docx' | 'image' | 'pdf' | 'presentation' | 'spreadsheet'
  readonly pages: readonly PDFPage[]
  readonly image: PDFImage | null
  readonly sourcePageNumbers: readonly number[]
  readonly status: 'completed' | 'partial' | 'failed'
}

function validatePolicy(overrides?: Partial<DocumentsPolicy>): DocumentsPolicy {
  const policy = { ...DEFAULT_DOCUMENTS_POLICY, ...overrides }
  if (!Number.isSafeInteger(policy.maxOutputPages) || policy.maxOutputPages < 4) throw new RangeError('maxOutputPages deve essere almeno 4.')
  if (!Number.isSafeInteger(policy.indexEntriesPerPage) || policy.indexEntriesPerPage < 1) throw new RangeError('indexEntriesPerPage deve essere positivo.')
  return policy
}

function pdfSafe(value: string): string {
  return value
    .normalize('NFKD')
    .replaceAll(/\p{M}/gu, '')
    .replaceAll(/[–—]/gu, '-')
    .replaceAll(/[“”]/gu, '"')
    .replaceAll(/[‘’]/gu, "'")
    .replaceAll(/[^\x20-\x7e]/gu, '?')
}

function crop(value: string, max: number): string {
  const normalized = pdfSafe(value).replaceAll(/\s+/gu, ' ').trim()
  return normalized.length <= max ? normalized : `${normalized.slice(0, Math.max(0, max - 3))}...`
}

function wrap(value: string, maxCharacters: number): string[] {
  const words = pdfSafe(value).replaceAll(/\s+/gu, ' ').trim().split(' ').filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current.length === 0 ? word : `${current} ${word}`
    if (next.length > maxCharacters && current.length > 0) {
      lines.push(current)
      current = word
    } else current = next
  }
  if (current.length > 0) lines.push(current)
  return lines.length > 0 ? lines : ['']
}

function drawLines(page: PDFPage, font: PDFFont, lines: readonly string[], x: number, y: number, size: number, lineHeight: number): number {
  let cursor = y
  for (const line of lines) {
    page.drawText(pdfSafe(line), { x, y: cursor, size, font })
    cursor -= lineHeight
  }
  return cursor
}

function pageRecord(page: PDFPage, outputPage: number, kind: DocumentsPageRecord['kind'], fileId: string | null, path: string | null, sourcePage: number | null): DocumentsPageRecord {
  const size = page.getSize()
  return {
    outputPage,
    kind,
    fileId,
    path,
    sourcePage,
    width: size.width,
    height: size.height,
    rotation: page.getRotation().angle,
  }
}

function drawHeaderPage(document: PDFDocument, font: PDFFont, title: string, subtitle: string, label: string): PDFPage {
  const page = document.addPage([595.28, 841.89])
  const { height } = page.getSize()
  page.drawText(pdfSafe(label.toUpperCase()), { x: 48, y: height - 64, size: 9, font })
  drawLines(page, font, wrap(title, 54), 48, height - 110, 24, 30)
  drawLines(page, font, wrap(subtitle, 82), 48, height - 210, 11, 17)
  return page
}

function drawSeparator(document: PDFDocument, font: PDFFont, entry: PreparedEntry): PDFPage {
  const file = entry.file
  const page = drawHeaderPage(
    document,
    font,
    file.originalPath,
    `Tipo rilevato: ${file.mimeDetected}\nDimensione: ${file.size} byte\nSHA-256: ${file.integrity.value ?? 'pending'}\nStato visuale: ${entry.status}`,
    'Separatore file',
  )
  const { height } = page.getSize()
  let y = height - 320
  for (const warning of entry.warnings.slice(0, 8)) {
    y = drawLines(page, font, wrap(`Avviso: ${warning}`, 82), 48, y, 9, 14) - 4
  }
  return page
}

function drawErrorPage(document: PDFDocument, font: PDFFont, entry: PreparedEntry): PDFPage {
  return drawHeaderPage(document, font, 'Rappresentazione visuale non disponibile', entry.error ?? 'Il file non è stato rappresentato nel PDF.', entry.file.originalPath)
}

function drawImagePage(document: PDFDocument, font: PDFFont, entry: PreparedEntry): PDFPage {
  if (!entry.image) return drawErrorPage(document, font, entry)
  const image = entry.image
  const landscape = image.width / image.height > 1.2
  const page = document.addPage(landscape ? [841.89, 595.28] : [595.28, 841.89])
  const { width, height } = page.getSize()
  const margin = 36
  const caption = 42
  const availableWidth = width - margin * 2
  const availableHeight = height - margin * 2 - caption
  const scale = Math.min(availableWidth / image.width, availableHeight / image.height)
  const drawWidth = image.width * scale
  const drawHeight = image.height * scale
  page.drawImage(image, { x: (width - drawWidth) / 2, y: margin + caption, width: drawWidth, height: drawHeight })
  page.drawText(crop(entry.file.originalPath, 92), { x: margin, y: 24, size: 8, font })
  return page
}

async function preparePdfEntry(output: PDFDocument, file: ManifestFileRecord, asset: PdfDocumentAsset | undefined): Promise<PreparedEntry> {
  if (!asset) return { file, adapterId: 'pdf', warnings: [], error: 'Estrazione PDF non riuscita o documento cifrato.', kind: 'pdf', pages: [], image: null, sourcePageNumbers: [], status: 'failed' }
  try {
    const { PDFDocument } = await import('pdf-lib')
    const source = await PDFDocument.load(asset.bytes, { ignoreEncryption: false, updateMetadata: false })
    const indices = Array.from({ length: asset.importedPageCount }, (_, index) => index)
    const pages = await output.copyPages(source, indices)
    return {
      file,
      adapterId: asset.adapterId,
      warnings: [...asset.warnings],
      error: null,
      kind: 'pdf',
      pages,
      image: null,
      sourcePageNumbers: indices.map((index) => index + 1),
      status: asset.status === 'partial' ? 'partial' : 'completed',
    }
  } catch (error) {
    return { file, adapterId: 'pdf', warnings: [...asset.warnings], error: error instanceof Error ? error.message : 'Importazione pagine PDF non riuscita.', kind: 'pdf', pages: [], image: null, sourcePageNumbers: [], status: 'failed' }
  }
}

async function prepareImageEntry(output: PDFDocument, file: ManifestFileRecord, asset: ImageAsset | undefined): Promise<PreparedEntry> {
  if (!asset) return { file, adapterId: 'image', warnings: [], error: 'Metadati o decodifica immagine non disponibili.', kind: 'image', pages: [], image: null, sourcePageNumbers: [], status: 'failed' }
  if (!asset.bytes || !asset.embeddedMime) return { file, adapterId: asset.adapterId, warnings: [...asset.warnings], error: 'Il browser non ha prodotto una rappresentazione PNG/JPEG sicura.', kind: 'image', pages: [], image: null, sourcePageNumbers: [], status: 'partial' }
  try {
    const image = asset.embeddedMime === 'image/png' ? await output.embedPng(asset.bytes) : await output.embedJpg(asset.bytes)
    return { file, adapterId: asset.adapterId, warnings: [...asset.warnings], error: null, kind: 'image', pages: [], image, sourcePageNumbers: [1], status: asset.status === 'partial' ? 'partial' : 'completed' }
  } catch (error) {
    return { file, adapterId: asset.adapterId, warnings: [...asset.warnings], error: error instanceof Error ? error.message : 'Embedding immagine non riuscito.', kind: 'image', pages: [], image: null, sourcePageNumbers: [], status: 'failed' }
  }
}

async function prepareSpreadsheetEntries(
  output: PDFDocument,
  manifest: ManifestArtifact,
  preview: SpreadsheetPreviewArtifact | null,
): Promise<PreparedEntry[]> {
  if (!preview) return []
  const { PDFDocument } = await import('pdf-lib')
  const source = await PDFDocument.load(preview.bytes, { updateMetadata: false })
  const byPath = new Map<string, number[]>()
  preview.pages.forEach((page, index) => {
    const list = byPath.get(page.workbookPath) ?? []
    list.push(index)
    byPath.set(page.workbookPath, list)
  })
  const results: PreparedEntry[] = []
  for (const [path, indices] of byPath) {
    const file = manifest.manifest.files.find((candidate) => candidate.normalizedPath === path)
    if (!file) continue
    // eslint-disable-next-line no-await-in-loop -- Workbook page groups are copied in deterministic order.
    const pages = await output.copyPages(source, indices)
    results.push({
      file,
      adapterId: 'spreadsheet-ooxml',
      warnings: [...preview.warnings],
      error: null,
      kind: 'spreadsheet',
      pages,
      image: null,
      sourcePageNumbers: indices.map((index) => index + 1),
      status: file.adapter.conversionStatus === 'partial' ? 'partial' : 'completed',
    })
  }
  return results
}


async function prepareOfficeEntries(
  output: PDFDocument,
  manifest: ManifestArtifact,
  preview: OfficePreviewArtifact | null,
): Promise<PreparedEntry[]> {
  if (!preview || preview.pageCount === 0) return []
  const { PDFDocument } = await import('pdf-lib')
  const source = await PDFDocument.load(preview.bytes, { updateMetadata: false })
  const groups = new Map<string, { indices: number[]; kind: 'docx' | 'presentation'; sourcePages: number[] }>()
  preview.pages.forEach((page, index) => {
    const current = groups.get(page.path) ?? { indices: [], kind: page.kind === 'docx-derived' ? 'docx' : 'presentation', sourcePages: [] }
    current.indices.push(index)
    current.sourcePages.push(page.sourcePage)
    groups.set(page.path, current)
  })
  const results: PreparedEntry[] = []
  for (const [path, group] of groups) {
    const file = manifest.manifest.files.find((candidate) => candidate.normalizedPath === path)
    if (!file) continue
    // eslint-disable-next-line no-await-in-loop -- I gruppi Office sono copiati in ordine deterministico.
    const pages = await output.copyPages(source, group.indices)
    results.push({
      file,
      adapterId: group.kind === 'docx' ? 'docx' : 'presentation-ooxml',
      warnings: [...preview.warnings],
      error: null,
      kind: group.kind,
      pages,
      image: null,
      sourcePageNumbers: group.sourcePages,
      status: file.adapter.conversionStatus === 'partial' ? 'partial' : 'completed',
    })
  }
  return results
}

function contentPageCount(entry: PreparedEntry): number {
  if (entry.kind === 'image') return 1
  return entry.pages.length > 0 ? entry.pages.length : 1
}

function fitEntriesToPageBudget(
  entries: readonly PreparedEntry[],
  policy: DocumentsPolicy,
): { entries: PreparedEntry[]; warning: string | null } {
  const selected: PreparedEntry[] = []
  let contentPages = 0
  let limited = false

  for (const entry of entries) {
    const prospectiveEntries = selected.length + 1
    const prospectiveIndexPages = Math.max(1, Math.ceil(prospectiveEntries / policy.indexEntriesPerPage))
    const fixedPages = 3 + prospectiveIndexPages // cover, instructions, final report, index
    const remainingForEntry = policy.maxOutputPages - fixedPages - prospectiveEntries - contentPages
    if (remainingForEntry < 1) {
      limited = true
      break
    }

    const requested = contentPageCount(entry)
    const allowed = Math.min(requested, remainingForEntry)
    if (entry.kind !== 'image' && entry.pages.length > allowed) {
      selected.push({
        ...entry,
        pages: entry.pages.slice(0, allowed),
        sourcePageNumbers: entry.sourcePageNumbers.slice(0, allowed),
        status: 'partial',
        warnings: [...entry.warnings, `Rappresentazione PDF limitata a ${allowed} pagine dal budget globale.`],
      })
      contentPages += allowed
      limited = true
      break
    }

    selected.push(entry)
    contentPages += requested
  }

  return {
    entries: selected,
    warning: limited ? `Output limitato a ${policy.maxOutputPages} pagine; alcuni file o pagine non sono rappresentati.` : null,
  }
}

export async function renderDocumentsPdf(
  manifestArtifact: ManifestArtifact,
  markdown: MarkdownArtifact,
  overrides?: Partial<DocumentsPolicy>,
): Promise<Omit<DocumentsArtifact, 'validation'>> {
  const policy = validatePolicy(overrides)
  const { PDFDocument, StandardFonts } = await import('pdf-lib')
  const document = await PDFDocument.create()
  const font = await document.embedFont(StandardFonts.Helvetica)
  const pdfAssets = new Map(markdown.pdfDocuments.map((asset) => [asset.fileId, asset]))
  const imageAssets = new Map(markdown.imageAssets.map((asset) => [asset.fileId, asset]))
  const candidateFiles = manifestArtifact.manifest.files
    .filter((file) => file.inclusion.included && !file.security.visualOmitted && (file.mimeDetected === 'application/pdf' || file.category === 'image'))
  // eslint-disable-next-line unicorn/no-array-sort -- Array#toSorted is unavailable in the ES2022 application target.
  candidateFiles.sort((left, right) => left.normalizedPath.localeCompare(right.normalizedPath))
  const prepared: PreparedEntry[] = []
  for (const file of candidateFiles) {
    let entry: PreparedEntry
    if (file.mimeDetected === 'application/pdf') {
      // eslint-disable-next-line no-await-in-loop -- Asset preparation is ordered to cap simultaneous PDF/image memory.
      entry = await preparePdfEntry(document, file, pdfAssets.get(file.fileId))
    } else {
      // eslint-disable-next-line no-await-in-loop -- Asset preparation is ordered to cap simultaneous PDF/image memory.
      entry = await prepareImageEntry(document, file, imageAssets.get(file.fileId))
    }
    prepared.push(entry)
  }
  if (policy.includeSpreadsheetPreview) prepared.push(...await prepareSpreadsheetEntries(document, manifestArtifact, markdown.spreadsheetPreview))
  prepared.push(...await prepareOfficeEntries(document, manifestArtifact, markdown.officePreview))
  prepared.sort((left, right) => left.file.normalizedPath.localeCompare(right.file.normalizedPath))

  const fitted = fitEntriesToPageBudget(prepared, policy)
  const entries = fitted.entries
  const indexPages = Math.max(1, Math.ceil(entries.length / policy.indexEntriesPerPage))
  const warnings = fitted.warning ? [fitted.warning] : []
  const pageRecords: DocumentsPageRecord[] = []
  const fileRecords: DocumentsFileRecord[] = []

  const cover = drawHeaderPage(document, font, manifestArtifact.manifest.projectName, 'Pacchetto visuale generato interamente nel browser. Consulta il manifest JSON come indice autorevole e il Markdown per testo, codice e tabelle.', 'AI Bundle Studio')
  pageRecords.push(pageRecord(cover, document.getPageCount(), 'cover', null, null, null))
  const instructions = drawHeaderPage(document, font, 'Istruzioni per l’assistente AI', 'Usa sempre i percorsi originali. Non assumere contenuti esclusi. Le pagine PDF originali sono copiate senza rasterizzazione quando possibile; immagini, fogli e documenti Office sono rappresentazioni derivate con limiti dichiarati.', 'Uso del pacchetto')
  pageRecords.push(pageRecord(instructions, document.getPageCount(), 'instructions', null, null, null))

  const startPages = new Map<string, number>()
  let nextStart = 2 + indexPages + 1
  entries.forEach((entry) => {
    startPages.set(entry.file.fileId, nextStart)
    nextStart += 1 + contentPageCount(entry)
  })
  for (let index = 0; index < indexPages; index += 1) {
    const page = document.addPage([595.28, 841.89])
    page.drawText('Indice visuale', { x: 48, y: 790, size: 20, font })
    const slice = entries.slice(index * policy.indexEntriesPerPage, (index + 1) * policy.indexEntriesPerPage)
    let y = 755
    slice.forEach((entry) => {
      page.drawText(`${String(startPages.get(entry.file.fileId) ?? 0).padStart(4, ' ')}  ${crop(entry.file.originalPath, 72)}`, { x: 48, y, size: 9, font })
      y -= 20
    })
    pageRecords.push(pageRecord(page, document.getPageCount(), 'index', null, null, null))
  }

  for (const entry of entries) {
    const separator = drawSeparator(document, font, entry)
    const pages: number[] = [document.getPageCount()]
    const sourcePages: { sourcePage: number; outputPage: number }[] = []
    pageRecords.push(pageRecord(separator, document.getPageCount(), 'separator', entry.file.fileId, entry.file.normalizedPath, null))

    if (entry.kind === 'image') {
      const page = drawImagePage(document, font, entry)
      const outputPage = document.getPageCount()
      pages.push(outputPage)
      if (entry.image) sourcePages.push({ sourcePage: 1, outputPage })
      pageRecords.push(pageRecord(page, outputPage, entry.image ? 'image-derived' : 'error', entry.file.fileId, entry.file.normalizedPath, entry.image ? 1 : null))
    } else if (entry.pages.length > 0) {
      entry.pages.forEach((page, index) => {
        document.addPage(page)
        const outputPage = document.getPageCount()
        const sourcePage = entry.sourcePageNumbers[index] ?? index + 1
        pages.push(outputPage)
        sourcePages.push({ sourcePage, outputPage })
        const pageKind: DocumentsPageRecord['kind'] = entry.kind === 'pdf'
          ? 'pdf-original'
          : entry.kind === 'spreadsheet'
            ? 'spreadsheet-derived'
            : entry.kind === 'docx'
              ? 'docx-derived'
              : 'presentation-derived'
        pageRecords.push(pageRecord(page, outputPage, pageKind, entry.file.fileId, entry.file.normalizedPath, sourcePage))
      })
    } else {
      const page = drawErrorPage(document, font, entry)
      const outputPage = document.getPageCount()
      pages.push(outputPage)
      pageRecords.push(pageRecord(page, outputPage, 'error', entry.file.fileId, entry.file.normalizedPath, null))
    }

    fileRecords.push({
      fileId: entry.file.fileId,
      path: entry.file.normalizedPath,
      adapterId: entry.adapterId,
      adapterVersion: DOCUMENTS_ADAPTER_VERSION,
      status: entry.status,
      pages,
      sourcePages,
      warnings: entry.warnings,
      error: entry.error,
    })
  }

  const excluded = manifestArtifact.manifest.files.filter((file) => !file.inclusion.included).length
  const unrepresented = manifestArtifact.manifest.files.filter((file) => file.inclusion.included && !fileRecords.some((record) => record.fileId === file.fileId)).length
  const report = drawHeaderPage(document, font, 'Report finale', `File esclusi: ${excluded}\nFile inclusi senza rappresentazione visuale nello STEP-009: ${unrepresented}\nErrori visuali isolati: ${fileRecords.filter((record) => record.status === 'failed').length}`, 'Completezza')
  pageRecords.push(pageRecord(report, document.getPageCount(), 'report', null, null, null))

  document.setTitle(`${pdfSafe(manifestArtifact.manifest.projectName)} - documents`)
  document.setAuthor('AI Bundle Studio')
  document.setCreator('AI Bundle Studio')
  document.setProducer('AI Bundle Studio')
  const bytes = await document.save({ useObjectStreams: false, addDefaultPage: false })
  return {
    mediaType: 'application/pdf',
    generatedAt: markdown.generatedAt,
    name: `${manifestArtifact.manifest.projectName}-documents.pdf`,
    bytes,
    byteLength: bytes.byteLength,
    pageCount: document.getPageCount(),
    policy,
    pages: pageRecords,
    records: fileRecords,
    warnings,
  }
}
