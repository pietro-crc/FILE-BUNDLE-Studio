import type { PDFDocument, PDFFont, PDFImage, PDFPage } from 'pdf-lib'
import { safeDynamicImport } from '../utils/dynamic-import'
import type { DocxDocumentAsset, OfficeAsset, OfficeImageAsset, OfficePolicy, OfficePreviewArtifact, OfficePreviewPage, PptxPresentationAsset } from './types'

function safe(value: string): string {
  return value
    .normalize('NFKD')
    .replaceAll(/\p{M}/gu, '')
    .replaceAll(/[–—]/gu, '-')
    .replaceAll(/[“”]/gu, '"')
    .replaceAll(/[‘’]/gu, "'")
    .replaceAll(/[^\x20-\x7e]/gu, '?')
}

function wrap(value: string, max = 88): string[] {
  const paragraphs = value.replaceAll('\r\n', '\n').replaceAll('\r', '\n').split('\n')
  const lines: string[] = []
  for (const paragraph of paragraphs) {
    const words = safe(paragraph).replaceAll(/\s+/gu, ' ').trim().split(' ').filter(Boolean)
    if (words.length === 0) {
      lines.push('')
      continue
    }
    let current = ''
    for (const word of words) {
      const next = current ? `${current} ${word}` : word
      if (next.length > max && current) {
        lines.push(current)
        current = word
      } else current = next
    }
    if (current) lines.push(current)
  }
  return lines
}

function drawTextPage(document: PDFDocument, font: PDFFont, title: string, subtitle: string, lines: readonly string[]): PDFPage {
  const page = document.addPage([595.28, 841.89])
  const { height } = page.getSize()
  page.drawText(safe(title).slice(0, 90), { x: 44, y: height - 54, size: 18, font })
  page.drawText(safe(subtitle).slice(0, 110), { x: 44, y: height - 78, size: 8, font })
  let y = height - 110
  for (const line of lines.slice(0, 46)) {
    page.drawText(safe(line).slice(0, 105), { x: 44, y, size: 9, font })
    y -= 15
  }
  return page
}

async function embedImage(document: PDFDocument, image: OfficeImageAsset): Promise<PDFImage | null> {
  if (!image.bytes) return null
  try {
    if (image.mime === 'image/png') return await document.embedPng(image.bytes)
    if (image.mime === 'image/jpeg') return await document.embedJpg(image.bytes)
  } catch {
    return null
  }
  return null
}

interface RenderedOfficePages {
  readonly pages: PDFPage[]
  readonly truncated: boolean
}

async function renderDocx(
  document: PDFDocument,
  font: PDFFont,
  asset: DocxDocumentAsset,
  pageBudget: number,
): Promise<RenderedOfficePages> {
  const pages: PDFPage[] = []
  const lines = wrap(asset.plainText || asset.markdown)
  const chunks = Array.from({ length: Math.max(1, Math.ceil(lines.length / 46)) }, (_, index) => lines.slice(index * 46, (index + 1) * 46))
  for (let index = 0; index < chunks.length && pages.length < pageBudget; index += 1) {
    pages.push(drawTextPage(document, font, asset.path, `Derived DOCX · semantic page ${index + 1}/${chunks.length} · rendering differs from Word`, chunks[index] ?? []))
  }
  for (const image of asset.images) {
    if (pages.length >= pageBudget) break
    // eslint-disable-next-line no-await-in-loop -- Embedding seriale limita la memoria fino allo STEP-010.
    const embedded = await embedImage(document, image)
    if (!embedded) continue
    const landscape = embedded.width / embedded.height > 1.2
    const page = document.addPage(landscape ? [841.89, 595.28] : [595.28, 841.89])
    const { width, height } = page.getSize()
    const maxWidth = width - 72
    const maxHeight = height - 110
    const scale = Math.min(maxWidth / embedded.width, maxHeight / embedded.height)
    page.drawImage(embedded, { x: (width - embedded.width * scale) / 2, y: 54, width: embedded.width * scale, height: embedded.height * scale })
    page.drawText(safe(`${asset.path} · ${image.alt}`).slice(0, 100), { x: 36, y: 28, size: 8, font })
    pages.push(page)
  }
  const expectedImagePages = asset.images.filter((image) => image.bytes && (image.mime === 'image/png' || image.mime === 'image/jpeg')).length
  return { pages, truncated: chunks.length + expectedImagePages > pageBudget }
}

async function renderPptx(
  document: PDFDocument,
  font: PDFFont,
  asset: PptxPresentationAsset,
  pageBudget: number,
): Promise<RenderedOfficePages> {
  const pages: PDFPage[] = []
  for (const slide of asset.slides) {
    if (pages.length >= pageBudget) break
    const page = document.addPage([960, 540])
    page.drawText(safe(`Slide ${slide.slideNumber}: ${slide.title || 'Untitled'}`).slice(0, 105), { x: 42, y: 492, size: 20, font })
    page.drawText('Simplified PPTX rendering: extractable text, notes, and media; layout and animations are not reproduced faithfully.', { x: 42, y: 470, size: 8, font })
    const firstImage = slide.images.find((image) => image.bytes && (image.mime === 'image/png' || image.mime === 'image/jpeg'))
    // eslint-disable-next-line no-await-in-loop -- Una sola immagine per slide limita la memoria.
    const embedded = firstImage ? await embedImage(document, firstImage) : null
    const textWidth = embedded ? 56 : 100
    let y = 438
    for (const line of wrap(slide.text.join('\n'), textWidth).slice(0, embedded ? 20 : 24)) {
      page.drawText(safe(line), { x: 42, y, size: 10, font })
      y -= 16
    }
    if (slide.notes.length > 0) {
      page.drawText('Speaker notes:', { x: 42, y: Math.max(90, y - 8), size: 9, font })
      y = Math.max(70, y - 24)
      for (const line of wrap(slide.notes.join('\n'), textWidth).slice(0, 7)) {
        page.drawText(safe(line), { x: 42, y, size: 8, font })
        y -= 13
      }
    }
    if (embedded) {
      const maxWidth = 350
      const maxHeight = 330
      const scale = Math.min(maxWidth / embedded.width, maxHeight / embedded.height)
      page.drawImage(embedded, { x: 570, y: 100, width: embedded.width * scale, height: embedded.height * scale })
    }
    page.drawText(safe(`${asset.path} · media ${slide.images.length} · tabelle ${slide.tables.length}`).slice(0, 110), { x: 42, y: 24, size: 8, font })
    pages.push(page)
  }
  return { pages, truncated: asset.slides.length > pageBudget }
}

export async function renderOfficePreviewPdf(assets: readonly OfficeAsset[], policy: OfficePolicy): Promise<OfficePreviewArtifact | null> {
  if (assets.length === 0) return null
  const { PDFDocument, StandardFonts } = await safeDynamicImport(() => import('pdf-lib'))
  const document = await PDFDocument.create()
  const font = await document.embedFont(StandardFonts.Helvetica)
  const records: OfficePreviewPage[] = []
  const warnings: string[] = []
  let remaining = policy.maxPreviewPages

  for (const asset of assets) {
    if (remaining <= 0) break
    // eslint-disable-next-line no-await-in-loop -- Rendering seriale preserva ordine e memoria.
    let rendered: RenderedOfficePages
    if (asset.kind === 'docx') {
      // eslint-disable-next-line no-await-in-loop -- Rendering seriale preserva ordine e limita la memoria.
      rendered = await renderDocx(document, font, asset, remaining)
    } else {
      // eslint-disable-next-line no-await-in-loop -- Rendering seriale preserva ordine e limita la memoria.
      rendered = await renderPptx(document, font, asset, remaining)
    }
    rendered.pages.forEach((page, index) => {
      records.push({
        fileId: asset.fileId,
        path: asset.path,
        kind: asset.kind === 'docx' ? 'docx-derived' : 'presentation-derived',
        sourcePage: index + 1,
        outputPage: records.length + 1,
      })
      void page
    })
    remaining -= rendered.pages.length
    if (rendered.truncated) warnings.push(`Office preview for ${asset.path} was truncated by the global limit of ${policy.maxPreviewPages} pages.`)
  }
  if (assets.some((asset) => !records.some((page) => page.fileId === asset.fileId))) warnings.push(`Office preview limited to ${policy.maxPreviewPages} pages; one or more documents were not represented.`)
  const bytes = await document.save({ useObjectStreams: true, addDefaultPage: false, updateFieldAppearances: false })
  return { mediaType: 'application/pdf', bytes, byteLength: bytes.byteLength, pageCount: document.getPageCount(), pages: records, warnings }
}
