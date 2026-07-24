import { safeDynamicImport } from '../utils/dynamic-import'
import { sha256Hex } from '../hash/sha256'
import type { ManifestFileRecord } from '../manifest/types'
import type { TextExtractionRecord } from '../markdown/types'
import type { VirtualFile } from '../vfs/types'
import type { PdfDocumentAsset, PdfPageExtraction, PdfPolicy } from './types'

export const PDF_ADAPTER_ID = 'pdf' as const
export const PDF_ADAPTER_VERSION = '1.0.0' as const

export const DEFAULT_PDF_POLICY: PdfPolicy = {
  maxPdfBytes: 64 * 1024 * 1024,
  maxPages: 500,
  maxTextCharactersPerPage: 200_000,
  maxTotalTextCharacters: 2_000_000,
}

interface PdfTextItem {
  readonly str: string
  readonly hasEOL?: boolean
}

interface PdfJsPage {
  readonly rotate: number
  getViewport(options: { scale: number }): { width: number; height: number; rotation: number }
  getTextContent(): Promise<{ items: readonly unknown[] }>
  cleanup(): void
}

interface PdfJsDocument {
  readonly numPages: number
  getPage(pageNumber: number): Promise<PdfJsPage>
  getJSActions(): Promise<Record<string, unknown> | null>
}

interface PdfJsLoadingTask {
  readonly promise: Promise<PdfJsDocument>
  onPassword: ((updatePassword: (password: string) => void, reason: number) => void) | null
  destroy(): Promise<void>
}

function abortError(signal?: AbortSignal): DOMException {
  return new DOMException(signal?.reason ? String(signal.reason) : 'Operazione annullata.', 'AbortError')
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError(signal)
}

function validatePolicy(overrides?: Partial<PdfPolicy>): PdfPolicy {
  const policy = { ...DEFAULT_PDF_POLICY, ...overrides }
  for (const [key, value] of Object.entries(policy)) {
    if (!Number.isSafeInteger(value) || value < 1) throw new RangeError(`${key} deve essere un intero positivo.`)
  }
  return policy
}

function isTextItem(item: unknown): item is PdfTextItem {
  return typeof item === 'object' && item !== null && 'str' in item && typeof (item as { str?: unknown }).str === 'string'
}

function extractPageText(items: readonly unknown[], limit: number): { text: string; truncated: boolean } {
  let text = ''
  let truncated = false
  for (const item of items) {
    if (!isTextItem(item)) continue
    const separator = text.length === 0 ? '' : item.hasEOL ? '\n' : ' '
    const next = `${separator}${item.str}`
    if (text.length + next.length > limit) {
      text += next.slice(0, Math.max(0, limit - text.length))
      truncated = true
      break
    }
    text += next
  }
  return { text: text.replaceAll(/\n{3,}/gu, '\n\n').trim(), truncated }
}

function renderPdfMarkdown(asset: PdfDocumentAsset): string {
  const lines = [
    '### PDF document',
    '',
    `- Original pages: ${asset.pageCount}`,
    `- Processed pages: ${asset.importedPageCount}`,
    `- Embedded JavaScript detected: ${asset.hasJavaScript ? 'yes - not executed' : 'no'}`,
    `- Visual import: original pages copied without rasterization where possible`,
  ]
  asset.pages.forEach((page) => {
    lines.push('', `### Page ${page.pageNumber}`, '', `Dimensions: ${page.width.toFixed(2)} × ${page.height.toFixed(2)} pt · rotation ${page.rotation}°`, '')
    lines.push(page.text.length > 0 ? page.text : '_No extractable text detected on this page._')
    if (page.truncated) lines.push('', '> Page text truncated according to the configured limit.')
  })
  return lines.join('\n')
}

export interface ExtractedPdfFile {
  readonly record: TextExtractionRecord
  readonly content: string
  readonly language: 'markdown'
  readonly asset: PdfDocumentAsset
}

export async function extractPdfFile(
  file: VirtualFile,
  manifestFile: ManifestFileRecord,
  overrides?: Partial<PdfPolicy>,
  signal?: AbortSignal,
): Promise<ExtractedPdfFile> {
  const policy = validatePolicy(overrides)
  if (file.size > policy.maxPdfBytes) throw new RangeError(`PDF oltre il limite di ${policy.maxPdfBytes} byte.`)
  assertNotAborted(signal)
  const bytes = new Uint8Array(await file.bytes.read(signal))
  assertNotAborted(signal)
  const sha256 = await sha256Hex(bytes)

  const [{ getDocument }, workerModule] = await Promise.all([
    safeDynamicImport(() => import('pdfjs-dist')),
    safeDynamicImport(() => import('pdfjs-dist/build/pdf.worker.min.mjs')),
  ])
  ;(globalThis as typeof globalThis & { pdfjsWorker?: unknown }).pdfjsWorker = workerModule

  let encrypted = false
  const loadingTask = getDocument({
    data: bytes.slice(),
    useWorkerFetch: false,
    useSystemFonts: false,
    disableFontFace: true,
    isEvalSupported: false,
    stopAtErrors: true,
    verbosity: 0,
  } as unknown as Parameters<typeof getDocument>[0]) as unknown as PdfJsLoadingTask
  loadingTask.onPassword = () => {
    encrypted = true
    void loadingTask.destroy()
  }

  try {
    const document = await loadingTask.promise
    assertNotAborted(signal)
    const importedPageCount = Math.min(document.numPages, policy.maxPages)
    const pages: PdfPageExtraction[] = []
    const warnings: string[] = []
    let remainingTextCharacters = policy.maxTotalTextCharacters
    let anyTextTruncated = false

    for (let pageNumber = 1; pageNumber <= importedPageCount; pageNumber += 1) {
      assertNotAborted(signal)
      // eslint-disable-next-line no-await-in-loop -- PDF pages are read sequentially to bound memory until worker orchestration.
      const page = await document.getPage(pageNumber)
      try {
        const viewport = page.getViewport({ scale: 1 })
        // eslint-disable-next-line no-await-in-loop -- Text extraction must complete before page cleanup.
        const textContent = await page.getTextContent()
        const pageLimit = Math.min(policy.maxTextCharactersPerPage, remainingTextCharacters)
        const extracted = pageLimit > 0 ? extractPageText(textContent.items, pageLimit) : { text: '', truncated: true }
        remainingTextCharacters = Math.max(0, remainingTextCharacters - extracted.text.length)
        anyTextTruncated ||= extracted.truncated
        pages.push({
          pageNumber,
          width: viewport.width,
          height: viewport.height,
          rotation: viewport.rotation ?? page.rotate,
          text: extracted.text,
          truncated: extracted.truncated,
        })
      } finally {
        page.cleanup()
      }
    }

    if (document.numPages > policy.maxPages) warnings.push(`PDF limited to the first ${policy.maxPages} pages out of ${document.numPages}.`)
    if (anyTextTruncated || remainingTextCharacters === 0) warnings.push('PDF text truncated according to the configured limits.')
    let hasJavaScript = false
    try {
      const actions = await document.getJSActions()
      hasJavaScript = Boolean(actions && Object.keys(actions).length > 0)
      if (hasJavaScript) warnings.push('Embedded JavaScript detected and not executed.')
    } catch {
      warnings.push('Unable to verify embedded JavaScript actions.')
    }

    const partial = document.numPages > importedPageCount || anyTextTruncated || remainingTextCharacters === 0
    const asset: PdfDocumentAsset = {
      adapterId: PDF_ADAPTER_ID,
      adapterVersion: PDF_ADAPTER_VERSION,
      fileId: manifestFile.fileId,
      path: manifestFile.normalizedPath,
      bytes,
      byteLength: bytes.byteLength,
      pageCount: document.numPages,
      importedPageCount,
      pages,
      status: partial ? 'partial' : 'completed',
      encrypted: false,
      hasJavaScript,
      warnings,
      sha256,
    }
    const content = renderPdfMarkdown(asset)
    return {
      record: {
        adapterId: PDF_ADAPTER_ID,
        adapterVersion: PDF_ADAPTER_VERSION,
        contentKind: 'pdf',
        fileId: manifestFile.fileId,
        path: manifestFile.normalizedPath,
        status: asset.status,
        encoding: null,
        usedFallback: false,
        replacementCharacters: 0,
        originalBytes: manifestFile.size,
        extractedBytes: bytes.byteLength,
        extractedCharacters: content.length,
        lineCount: content.length === 0 ? 0 : content.split('\n').length,
        truncated: partial,
        truncationReason: document.numPages > importedPageCount ? 'pdf-page-limit' : anyTextTruncated || remainingTextCharacters === 0 ? 'pdf-text-limit' : null,
        newlineNormalization: 'lf',
        anchors: [],
        parts: [],
        warnings,
        error: null,
        sha256,
      },
      content,
      language: 'markdown',
      asset,
    }
  } catch (error) {
    if (encrypted) throw new Error('PDF is encrypted or password-protected; no bypass was attempted.', { cause: error })
    throw error
  } finally {
    await loadingTask.destroy().catch(() => undefined)
  }
}
