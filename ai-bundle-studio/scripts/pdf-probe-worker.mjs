import assert from 'node:assert/strict'
import { PDFDocument, StandardFonts } from 'pdf-lib'

// oxlint-disable-next-line typescript/no-extraneous-class -- PDF.js requires a constructable DOMMatrix shim.
class MinimalDOMMatrix {
  constructor() {
    this.a = 1
    this.b = 0
    this.c = 0
    this.d = 1
    this.e = 0
    this.f = 0
  }
}

globalThis.DOMMatrix = MinimalDOMMatrix

async function run() {
  const document = await PDFDocument.create()
  const font = await document.embedFont(StandardFonts.Helvetica)
  const page = document.addPage([595.28, 841.89])
  page.drawText('AI Bundle Studio PDF feasibility probe', { x: 48, y: 780, size: 18, font })
  const bytes = await document.save({ useObjectStreams: false })

  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const loadingTask = getDocument({
    data: bytes,
    useWorkerFetch: false,
    useSystemFonts: false,
    disableFontFace: true,
    isEvalSupported: false,
    verbosity: 0,
  })

  try {
    const parsed = await loadingTask.promise
    const parsedPage = await parsed.getPage(1)
    const textContent = await parsedPage.getTextContent()
    const text = textContent.items
      .filter((item) => 'str' in item)
      .map((item) => item.str)
      .join(' ')

    assert.equal(parsed.numPages, 1)
    assert.match(text, /AI Bundle Studio/u)
    parsedPage.cleanup()
  } finally {
    await loadingTask.destroy()
  }

  console.info('PDF_PROBE', JSON.stringify({ pages: 1, extractedText: true, resourcesReleased: true }))
}

run().then(
  () => process.exit(0),
  (error) => {
    console.error(error)
    process.exit(1)
  },
)
