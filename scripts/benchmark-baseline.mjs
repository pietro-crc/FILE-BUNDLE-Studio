import { createHash, webcrypto } from 'node:crypto'
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { strToU8, unzipSync, zipSync } from 'fflate'
import { PDFDocument, StandardFonts } from 'pdf-lib'

const MB = 1024 * 1024
const timed = async (operation) => {
  const started = performance.now()
  const value = await operation()
  return { value, elapsedMs: Number((performance.now() - started).toFixed(2)) }
}

const hashPayload = new Uint8Array(25 * MB)
for (let index = 0; index < hashPayload.length; index += 4096) hashPayload[index] = index % 251

const hashResult = await timed(async () => {
  const digest = await webcrypto.subtle.digest('SHA-256', hashPayload)
  return Buffer.from(digest).toString('hex')
})

const smallFiles = {}
for (let index = 0; index < 1000; index += 1) {
  smallFiles[`src/file-${String(index).padStart(4, '0')}.txt`] = strToU8(`file ${index}\nlocal-only\n`)
}
const zipCreation = await timed(async () => zipSync(smallFiles, { level: 6 }))
const zipExtraction = await timed(async () => unzipSync(zipCreation.value))

const pdfGeneration = await timed(async () => {
  const document = await PDFDocument.create()
  const font = await document.embedFont(StandardFonts.Helvetica)
  for (let pageIndex = 0; pageIndex < 25; pageIndex += 1) {
    const page = document.addPage([595.28, 841.89])
    page.drawText(`AI Bundle Studio benchmark page ${pageIndex + 1}`, { x: 48, y: 780, size: 16, font })
  }
  return document.save({ useObjectStreams: false })
})

const markdownGeneration = await timed(async () => {
  const sections = []
  for (let index = 0; index < 500; index += 1) {
    sections.push(`## file-${index}.ts\n\nPath: src/file-${index}.ts\n\n\`\`\`ts\nexport const n = ${index}\n\`\`\``)
  }
  return sections.join('\n\n---\n\n')
})

async function directoryBytes(path) {
  let total = 0
  try {
    const entries = await readdir(path, { withFileTypes: true })
    const sizes = await Promise.all(
      entries.map(async (entry) => {
        const current = join(path, entry.name)
        return entry.isDirectory() ? directoryBytes(current) : (await stat(current)).size
      }),
    )
    total = sizes.reduce((sum, size) => sum + size, 0)
  } catch {
    return 0
  }
  return total
}

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  environment: {
    node: process.version,
    platform: process.platform,
    architecture: process.arch,
  },
  workloads: {
    sha256_25MiB: { elapsedMs: hashResult.elapsedMs, digest: hashResult.value },
    zip_1000_small_files: {
      creationMs: zipCreation.elapsedMs,
      extractionMs: zipExtraction.elapsedMs,
      compressedBytes: zipCreation.value.byteLength,
      extractedEntries: Object.keys(zipExtraction.value).length,
    },
    pdf_25_pages: { generationMs: pdfGeneration.elapsedMs, bytes: pdfGeneration.value.byteLength },
    markdown_500_sections: { generationMs: markdownGeneration.elapsedMs, bytes: Buffer.byteLength(markdownGeneration.value) },
  },
  buildArtifacts: {
    productionBytes: await directoryBytes('dist'),
    spikeBytes: await directoryBytes('dist-spikes'),
  },
  integrity: createHash('sha256').update(JSON.stringify({ zip: zipCreation.value.byteLength, pdf: pdfGeneration.value.byteLength })).digest('hex'),
  caveats: [
    'Single run on the CI/container host; values are a baseline, not a product promise.',
    'No large real-world Office corpus was used in STEP-000.',
    'Browser memory and rendering benchmarks remain scheduled for later steps.',
  ],
}

await mkdir('docs/benchmarks', { recursive: true })
await writeFile('docs/benchmarks/STEP-000.json', `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
