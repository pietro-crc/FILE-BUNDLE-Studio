import { sha256Hex } from '../hash/sha256'
import type { ManifestFileRecord } from '../manifest/types'
import type { TextExtractionRecord } from '../markdown/types'
import type { VirtualFile } from '../vfs/types'
import {
  countExternalRelationships,
  directChildrenByLocalName,
  elementsByLocalName,
  parseOfficeXml,
  readOfficeMetadata,
  readOfficePackage,
  readOfficeXml,
  resolvePackageTarget,
  type OfficePackage,
} from './package'
import type { OfficeImageAsset, OfficePolicy, PptxPresentationAsset, PresentationSlide, PresentationTable } from './types'

export const PPTX_ADAPTER_ID = 'presentation-ooxml' as const
export const PPTX_ADAPTER_VERSION = '1.0.0' as const

interface Relationship {
  readonly id: string
  readonly type: string
  readonly target: string
  readonly external: boolean
}

function escapeMarkdown(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll(/([*_[\]`#|])/gu, '\\$1').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function relationshipMap(packageData: OfficePackage, path: string): Map<string, Relationship> {
  const xml = readOfficeXml(packageData, path, false)
  if (!xml) return new Map()
  const document = parseOfficeXml(xml, path)
  const entries: Array<readonly [string, Relationship]> = []
  for (const element of elementsByLocalName(document, 'Relationship')) {
    const relationship: Relationship = {
      id: element.getAttribute('Id') ?? '',
      type: element.getAttribute('Type') ?? '',
      target: element.getAttribute('Target') ?? '',
      external: element.getAttribute('TargetMode')?.toLowerCase() === 'external',
    }
    if (relationship.id.length > 0) entries.push([relationship.id, relationship])
  }
  return new Map(entries)
}

function relsPathFor(part: string): string {
  const segments = part.split('/')
  const name = segments.pop() ?? ''
  return [...segments, '_rels', `${name}.rels`].join('/')
}

function textRuns(document: XMLDocument): string[] {
  return elementsByLocalName(document, 't')
    .map((element) => element.textContent?.replaceAll('\r\n', '\n').replaceAll('\r', '\n').trim() ?? '')
    .filter(Boolean)
}

function parseTables(document: XMLDocument, policy: OfficePolicy): { tables: PresentationTable[]; omittedCells: number } {
  const tables: PresentationTable[] = []
  let cells = 0
  let omittedCells = 0
  for (const table of elementsByLocalName(document, 'tbl')) {
    const rows: string[][] = []
    for (const row of directChildrenByLocalName(table, 'tr')) {
      const values: string[] = []
      for (const cell of directChildrenByLocalName(row, 'tc')) {
        if (cells >= policy.maxTableCells) {
          omittedCells += 1
          continue
        }
        values.push(elementsByLocalName(cell, 't').map((item) => item.textContent?.trim() ?? '').filter(Boolean).join(' '))
        cells += 1
      }
      if (values.length > 0) rows.push(values)
    }
    if (rows.length > 0) tables.push({ rows })
  }
  return { tables, omittedCells }
}

function mimeForMedia(path: string): string {
  const extension = path.split('.').pop()?.toLowerCase()
  if (extension === 'png') return 'image/png'
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg'
  if (extension === 'gif') return 'image/gif'
  if (extension === 'webp') return 'image/webp'
  if (extension === 'bmp') return 'image/bmp'
  if (extension === 'tif' || extension === 'tiff') return 'image/tiff'
  return 'application/octet-stream'
}

function slideImages(
  packageData: OfficePackage,
  slidePath: string,
  relationships: ReadonlyMap<string, Relationship>,
  policy: OfficePolicy,
): OfficeImageAsset[] {
  const images: OfficeImageAsset[] = []
  for (const relationship of relationships.values()) {
    if (relationship.external || !relationship.type.toLowerCase().endsWith('/image')) continue
    const path = resolvePackageTarget(slidePath, relationship.target)
    const bytes = packageData.entries.get(path)
    if (!bytes) continue
    const mime = mimeForMedia(path)
    const supported = mime === 'image/png' || mime === 'image/jpeg'
    const withinLimit = bytes.byteLength <= policy.maxImageBytes
    images.push({
      name: path.split('/').pop() ?? path,
      mime,
      bytes: supported && withinLimit ? bytes : null,
      byteLength: bytes.byteLength,
      alt: `Media della slide: ${path.split('/').pop() ?? path}`,
      omittedReason: !supported ? `Formato ${mime} non incorporabile nella preview PDF.` : !withinLimit ? `Media oltre ${policy.maxImageBytes} byte.` : null,
    })
    if (images.length >= policy.maxImages) break
  }
  return images
}

function renderTable(table: PresentationTable): string {
  if (table.rows.length === 0) return ''
  const width = Math.max(...table.rows.map((row) => row.length), 1)
  const rows = table.rows.map((row) => [...row, ...Array.from({ length: width - row.length }, () => '')])
  const header = rows[0] ?? Array.from({ length: width }, () => '')
  return [`| ${header.map(escapeMarkdown).join(' | ')} |`, `| ${header.map(() => '---').join(' | ')} |`, ...rows.slice(1).map((row) => `| ${row.map(escapeMarkdown).join(' | ')} |`)].join('\n')
}

function renderPresentationMarkdown(asset: PptxPresentationAsset): string {
  const metadata = asset.metadata
  const header = [
    '### Presentazione PowerPoint (rappresentazione semplificata)',
    '',
    `- Titolo: ${metadata.title ?? 'non disponibile'}`,
    `- Autore: ${metadata.creator ?? 'non disponibile'}`,
    `- Slide dichiarate: ${asset.slideCount}`,
    `- Slide estratte: ${asset.slides.length}`,
    `- Macro: ${asset.macros ? 'rilevate e non eseguite' : 'non rilevate'}`,
    `- Relazioni esterne: ${asset.externalRelationships} (mai caricate)`,
    `- Grafici: ${asset.hasCharts ? 'rilevati, non renderizzati fedelmente' : 'non rilevati'}`,
    `- Oggetti incorporati: ${asset.hasEmbeddedObjects ? 'rilevati, non aperti' : 'non rilevati'}`,
    `- Audio/video: ${asset.hasAudioVideo ? 'rilevati, inventariati soltanto' : 'non rilevati'}`,
    '',
    '> Ogni slide è una rappresentazione testuale/visuale derivata. Layout, animazioni, font, SmartArt e transizioni non sono riprodotti fedelmente.',
  ]
  const slides = asset.slides.map((slide) => {
    const sections = [
      `### Slide ${slide.slideNumber}: ${escapeMarkdown(slide.title || 'Senza titolo')}`,
      '',
      ...(slide.text.length > 0 ? slide.text.map((line) => `- ${escapeMarkdown(line)}`) : ['_Nessun testo estratto._']),
      '',
      `**Note relatore:** ${slide.notes.length > 0 ? '' : 'non disponibili'}`,
      ...(slide.notes.length > 0 ? slide.notes.map((line) => `- ${escapeMarkdown(line)}`) : []),
      '',
      `**Media inventariati:** ${slide.images.length}`,
      ...slide.images.map((image) => `- ${escapeMarkdown(image.name)} · ${image.mime} · ${image.byteLength} byte${image.omittedReason ? ` · ${escapeMarkdown(image.omittedReason)}` : ''}`),
    ]
    slide.tables.forEach((table, index) => sections.push('', `**Tabella ${index + 1}:**`, '', renderTable(table)))
    if (slide.warnings.length > 0) sections.push('', '**Avvisi slide:**', ...slide.warnings.map((warning) => `- ${escapeMarkdown(warning)}`))
    return sections.join('\n')
  })
  return [...header, ...slides].join('\n\n')
}

export interface ExtractedPptxFile {
  readonly record: TextExtractionRecord
  readonly content: string
  readonly language: 'markdown'
  readonly asset: PptxPresentationAsset
}

export async function extractPptxFile(
  file: VirtualFile,
  manifestFile: ManifestFileRecord,
  policy: OfficePolicy,
  signal?: AbortSignal,
): Promise<ExtractedPptxFile> {
  if (signal?.aborted) throw new DOMException(String(signal.reason ?? 'Operazione annullata.'), 'AbortError')
  const buffer = await file.bytes.read(signal)
  const packageData = await readOfficePackage(buffer, policy, (name) => (
    name === 'ppt/presentation.xml'
    || name === 'ppt/_rels/presentation.xml.rels'
    || name === 'docProps/core.xml'
    || /^ppt\/(?:slides|notesSlides)\/[^/]+\.xml$/u.test(name)
    || /^ppt\/(?:slides|notesSlides)\/_rels\/[^/]+\.xml\.rels$/u.test(name)
    || /^ppt\/media\/[^/]+\.(?:png|jpe?g|gif|webp|bmp|tiff?)$/iu.test(name)
    || name.endsWith('.rels')
  ))
  const mediaInventory = packageData.inventory.filter((entry) => /^ppt\/media\/[^/]+\.(?:png|jpe?g|gif|webp|bmp|tiff?)$/iu.test(entry.name))
  if (mediaInventory.length > policy.maxImages) throw new RangeError(`Presentazione oltre ${policy.maxImages} immagini.`)
  const totalMediaBytes = mediaInventory.reduce((total, entry) => total + entry.originalSize, 0)
  if (totalMediaBytes > policy.maxTotalImageBytes) throw new RangeError(`Media PowerPoint oltre ${policy.maxTotalImageBytes} byte complessivi.`)
  if (mediaInventory.some((entry) => entry.originalSize > policy.maxImageBytes)) throw new RangeError(`Un’immagine PowerPoint supera ${policy.maxImageBytes} byte.`)
  const sha256 = await sha256Hex(new Uint8Array(buffer))
  const presentationXml = readOfficeXml(packageData, 'ppt/presentation.xml')
  if (!presentationXml) throw new Error('PresentationML principale mancante.')
  const presentationDocument = parseOfficeXml(presentationXml, 'ppt/presentation.xml')
  const presentationRelationships = relationshipMap(packageData, 'ppt/_rels/presentation.xml.rels')
  const slideIds = elementsByLocalName(presentationDocument, 'sldId')
  const slideCount = slideIds.length
  const selectedSlideIds = slideIds.slice(0, policy.maxSlides)
  const slides: PresentationSlide[] = []
  let totalImageBytes = 0
  let totalImages = 0
  let anyTruncated = slideCount > selectedSlideIds.length

  for (let index = 0; index < selectedSlideIds.length; index += 1) {
    if (signal?.aborted) throw new DOMException(String(signal.reason ?? 'Operazione annullata.'), 'AbortError')
    const slideId = selectedSlideIds[index]
    const relationshipId = slideId?.getAttribute('r:id') ?? slideId?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ?? ''
    const relationship = presentationRelationships.get(relationshipId)
    if (!relationship || relationship.external) {
      slides.push({ slideNumber: index + 1, title: '', text: [], notes: [], tables: [], images: [], externalRelationships: relationship?.external ? 1 : 0, truncated: true, warnings: ['Relazione slide mancante o esterna; slide non letta.'] })
      anyTruncated = true
      continue
    }
    const slidePath = resolvePackageTarget('ppt/presentation.xml', relationship.target)
    const slideXml = readOfficeXml(packageData, slidePath)
    if (!slideXml) throw new Error(`Slide mancante: ${slidePath}.`)
    const slideDocument = parseOfficeXml(slideXml, slidePath)
    const slideRelationships = relationshipMap(packageData, relsPathFor(slidePath))
    const rawText = textRuns(slideDocument)
    let textCharacters = 0
    const text: string[] = []
    let truncated = false
    for (const line of rawText) {
      if (textCharacters + line.length > policy.maxTextCharactersPerSlide) {
        const remaining = Math.max(0, policy.maxTextCharactersPerSlide - textCharacters)
        if (remaining > 0) text.push(line.slice(0, remaining))
        truncated = true
        break
      }
      text.push(line)
      textCharacters += line.length
    }
    const notesRelationship = [...slideRelationships.values()].find((candidate) => !candidate.external && candidate.type.toLowerCase().endsWith('/notesslide'))
    let notes: string[] = []
    if (notesRelationship) {
      const notesPath = resolvePackageTarget(slidePath, notesRelationship.target)
      const notesXml = readOfficeXml(packageData, notesPath, false)
      if (notesXml) {
        const noteRuns = textRuns(parseOfficeXml(notesXml, notesPath))
        let noteCharacters = 0
        notes = []
        for (const line of noteRuns) {
          if (noteCharacters + line.length > policy.maxNotesCharactersPerSlide) {
            const remaining = Math.max(0, policy.maxNotesCharactersPerSlide - noteCharacters)
            if (remaining > 0) notes.push(line.slice(0, remaining))
            truncated = true
            break
          }
          notes.push(line)
          noteCharacters += line.length
        }
      }
    }
    const parsedTables = parseTables(slideDocument, policy)
    if (parsedTables.omittedCells > 0) truncated = true
    let images = slideImages(packageData, slidePath, slideRelationships, policy)
    images = images.filter((image) => {
      if (totalImages >= policy.maxImages || totalImageBytes + image.byteLength > policy.maxTotalImageBytes) return false
      totalImages += 1
      totalImageBytes += image.byteLength
      return true
    })
    const externalRelationships = [...slideRelationships.values()].filter((candidate) => candidate.external).length
    const warnings: string[] = []
    if (externalRelationships > 0) warnings.push(`${externalRelationships} relazioni esterne non caricate.`)
    if (parsedTables.omittedCells > 0) warnings.push(`${parsedTables.omittedCells} celle tabella omesse dal limite.`)
    if (truncated) warnings.push('Contenuto slide troncato secondo i limiti configurati.')
    slides.push({
      slideNumber: index + 1,
      title: text[0] ?? '',
      text,
      notes,
      tables: parsedTables.tables,
      images,
      externalRelationships,
      truncated,
      warnings,
    })
    anyTruncated ||= truncated
    // eslint-disable-next-line no-await-in-loop -- Yield cooperativo fino allo STEP-010.
    await Promise.resolve()
  }

  const macros = manifestFile.extension === 'pptm' || packageData.entryNames.some((name) => /(?:^|\/)vbaProject\.bin$/iu.test(name))
  const hasCharts = packageData.entryNames.some((name) => name.startsWith('ppt/charts/'))
  const hasEmbeddedObjects = packageData.entryNames.some((name) => name.startsWith('ppt/embeddings/'))
  const hasAudioVideo = packageData.entryNames.some((name) => /^ppt\/media\/.*\.(?:mp3|m4a|wav|mp4|mov|avi|wmv|webm)$/iu.test(name))
  const externalRelationships = countExternalRelationships(packageData)
  const warnings: string[] = ['Resa PPTX semplificata: layout, font, SmartArt, animazioni e transizioni non sono riprodotti fedelmente.']
  if (slideCount > policy.maxSlides) warnings.push(`Presentazione limitata alle prime ${policy.maxSlides} slide su ${slideCount}.`)
  if (macros) warnings.push('Macro VBA rilevate e mai aperte o eseguite.')
  if (externalRelationships > 0) warnings.push(`${externalRelationships} relazioni esterne rilevate e non caricate.`)
  if (hasCharts) warnings.push('Grafici rilevati e inventariati senza rendering fedele.')
  if (hasEmbeddedObjects) warnings.push('Oggetti incorporati rilevati e non aperti.')
  if (hasAudioVideo) warnings.push('Audio/video rilevati e inventariati senza riproduzione.')
  const partial = anyTruncated || macros || hasCharts || hasEmbeddedObjects || hasAudioVideo || externalRelationships > 0
  const assetBase = {
    kind: 'pptx' as const,
    adapterId: PPTX_ADAPTER_ID,
    adapterVersion: PPTX_ADAPTER_VERSION,
    fileId: manifestFile.fileId,
    path: manifestFile.normalizedPath,
    status: partial ? 'partial' as const : 'completed' as const,
    metadata: readOfficeMetadata(packageData),
    slides,
    slideCount,
    macros,
    hasCharts,
    hasEmbeddedObjects,
    hasAudioVideo,
    externalRelationships,
    warnings: [...new Set([...warnings, ...slides.flatMap((slide) => slide.warnings)])],
    truncated: anyTruncated,
    sha256,
  }
  const markdown = renderPresentationMarkdown({ ...assetBase, markdown: '' })
  const asset: PptxPresentationAsset = { ...assetBase, markdown }
  return {
    record: {
      adapterId: PPTX_ADAPTER_ID,
      adapterVersion: PPTX_ADAPTER_VERSION,
      contentKind: 'presentation',
      fileId: manifestFile.fileId,
      path: manifestFile.normalizedPath,
      status: asset.status,
      encoding: null,
      usedFallback: false,
      replacementCharacters: 0,
      originalBytes: manifestFile.size,
      extractedBytes: buffer.byteLength,
      extractedCharacters: markdown.length,
      lineCount: markdown.split('\n').length,
      truncated: asset.status === 'partial',
      truncationReason: anyTruncated ? 'presentation-limit' : null,
      newlineNormalization: 'lf',
      anchors: [],
      parts: [],
      warnings: asset.warnings,
      error: null,
      sha256,
    },
    content: markdown,
    language: 'markdown',
    asset,
  }
}
