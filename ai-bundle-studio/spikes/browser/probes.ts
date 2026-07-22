import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import mammoth from 'mammoth/mammoth.browser'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { createDocxFixture, createXlsxFixture } from './fixtures'

export interface ProbeResult {
  readonly id: 'zip' | 'pdf' | 'docx' | 'xlsx'
  readonly ok: boolean
  readonly summary: string
  readonly details: Readonly<Record<string, unknown>>
}

export function runZipProbe(): ProbeResult {
  const source = {
    'README.md': strToU8('# Probe'),
    'src/example.ts': strToU8('export const local = true'),
  }
  const compressed = zipSync(source, { level: 6 })
  const restored = unzipSync(compressed)

  return {
    id: 'zip',
    ok: Object.keys(restored).length === 2 && strFromU8(restored['README.md'] ?? new Uint8Array()) === '# Probe',
    summary: 'ZIP entries can be created and read locally without network access.',
    details: { compressedBytes: compressed.byteLength, entries: Object.keys(restored).toSorted() },
  }
}

export async function runPdfProbe(): Promise<ProbeResult> {
  const [{ getDocument, GlobalWorkerOptions }, { default: PdfWorker }] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])
  GlobalWorkerOptions.workerSrc = PdfWorker
  const document = await PDFDocument.create()
  const font = await document.embedFont(StandardFonts.Helvetica)
  const page = document.addPage([595.28, 841.89])
  page.drawText('AI Bundle Studio PDF feasibility probe', { x: 48, y: 780, size: 18, font })
  const bytes = await document.save({ useObjectStreams: false })

  const loadingTask = getDocument({ data: bytes })
  const parsed = await loadingTask.promise
  const textContent = await (await parsed.getPage(1)).getTextContent()
  const text = textContent.items
    .filter((item): item is typeof item & { str: string } => 'str' in item)
    .map((item) => item.str)
    .join(' ')
  await loadingTask.destroy()

  return {
    id: 'pdf',
    ok: parsed.numPages === 1 && text.includes('AI Bundle Studio'),
    summary: 'PDF generation, re-opening, page counting, and text extraction are feasible in-browser.',
    details: { bytes: bytes.byteLength, pages: parsed.numPages, extractedText: text },
  }
}

export async function runDocxProbe(): Promise<ProbeResult> {
  const fixture = createDocxFixture()
  const result = await mammoth.convertToHtml({ arrayBuffer: fixture.buffer as ArrayBuffer })

  return {
    id: 'docx',
    ok: result.value.includes('AI Bundle Studio') && result.value.includes('<h1>'),
    summary: 'DOCX semantic conversion to clean HTML is feasible; pixel-perfect Word rendering is not implied.',
    details: { bytes: fixture.byteLength, html: result.value, messages: result.messages.length },
  }
}

function parseXml(bytes: Uint8Array): Document {
  const document = new DOMParser().parseFromString(strFromU8(bytes), 'application/xml')
  if (document.querySelector('parsererror')) {
    throw new Error('Invalid XML in XLSX feasibility fixture')
  }
  return document
}

export function runXlsxProbe(): ProbeResult {
  const fixture = createXlsxFixture()
  const entries = unzipSync(fixture)
  const workbookBytes = entries['xl/workbook.xml']
  const sheetBytes = entries['xl/worksheets/sheet1.xml']
  const sharedBytes = entries['xl/sharedStrings.xml']

  if (!workbookBytes || !sheetBytes || !sharedBytes) {
    throw new Error('Incomplete XLSX feasibility fixture')
  }

  const workbook = parseXml(workbookBytes)
  const sheet = parseXml(sheetBytes)
  const shared = parseXml(sharedBytes)
  const sharedStrings = [...shared.querySelectorAll('si > t')].map((node) => node.textContent ?? '')
  const formula = sheet.querySelector('c[r="B2"] > f')?.textContent ?? ''
  const storedValue = sheet.querySelector('c[r="B2"] > v')?.textContent ?? ''
  const sheetName = workbook.querySelector('sheet')?.getAttribute('name') ?? ''

  return {
    id: 'xlsx',
    ok: sheetName === 'Summary' && sharedStrings[0] === 'Files' && formula === 'SUM(B1,A2)' && storedValue === '5',
    summary: 'XLSX OOXML inspection can recover sheet names, shared strings, formulas, and cached values.',
    details: { bytes: fixture.byteLength, sheetName, sharedStrings, formula, storedValue },
  }
}

export async function runAllProbes(): Promise<readonly ProbeResult[]> {
  return [runZipProbe(), await runPdfProbe(), await runDocxProbe(), runXlsxProbe()]
}
