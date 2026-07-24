import { safeDynamicImport } from '../utils/dynamic-import'
import { sha256Hex } from '../hash/sha256'
import type { ManifestFileRecord } from '../manifest/types'
import type { TextExtractionRecord } from '../markdown/types'
import type { VirtualFile } from '../vfs/types'
import { countExternalRelationships, readOfficeMetadata, readOfficePackage, readOfficeXml } from './package'
import { sanitizeOfficeHtml } from './sanitize'
import type { DocxDocumentAsset, OfficeImageAsset, OfficePolicy } from './types'

export const DOCX_ADAPTER_ID = 'docx' as const
export const DOCX_ADAPTER_VERSION = '1.0.0' as const

const SUPPORTED_IMAGE_MIME = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp'])

function decodeBase64(value: string): Uint8Array {
  const decoded = atob(value)
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0))
}

function renderMetadata(asset: DocxDocumentAsset): string {
  const metadata = asset.metadata
  return [
    '### Documento Word (rappresentazione semantica)',
    '',
    `- Titolo: ${metadata.title ?? 'non disponibile'}`,
    `- Autore: ${metadata.creator ?? 'non disponibile'}`,
    `- Descrizione: ${metadata.description ?? 'non disponibile'}`,
    `- Creato: ${metadata.created ?? 'non disponibile'}`,
    `- Modificato: ${metadata.modified ?? 'non disponibile'}`,
    `- Macro: ${asset.macros ? 'rilevate e non eseguite' : 'non rilevate'}`,
    `- Relazioni esterne: ${asset.externalRelationships} (mai caricate)`,
    `- Immagini inventariate: ${asset.images.length}`,
    `- HTML sanitizzato: ${asset.sanitizedHtml.length} caratteri`,
    `- Fedeltà: resa semantica derivata, non identica a Microsoft Word`,
    '',
    asset.markdown || '_Nessun contenuto semantico estratto._',
  ].join('\n')
}

export interface ExtractedDocxFile {
  readonly record: TextExtractionRecord
  readonly content: string
  readonly language: 'markdown'
  readonly asset: DocxDocumentAsset
}

export async function extractDocxFile(
  file: VirtualFile,
  manifestFile: ManifestFileRecord,
  policy: OfficePolicy,
  signal?: AbortSignal,
): Promise<ExtractedDocxFile> {
  if (signal?.aborted) throw new DOMException(String(signal.reason ?? 'Operazione annullata.'), 'AbortError')
  const buffer = await file.bytes.read(signal)
  const packageData = await readOfficePackage(buffer, policy, (name) => name.endsWith('.rels') || name === 'docProps/core.xml' || (name.startsWith('word/') && name.endsWith('.xml')))
  for (const name of packageData.entryNames) {
    if ((name.startsWith('word/') || name === 'docProps/core.xml') && name.endsWith('.xml') && packageData.entries.has(name)) {
      readOfficeXml(packageData, name, false)
    }
  }
  const mediaInventory = packageData.inventory.filter((entry) => entry.name.startsWith('word/media/') && !entry.name.endsWith('/'))
  if (mediaInventory.length > policy.maxImages) throw new RangeError(`Documento Word oltre ${policy.maxImages} immagini.`)
  const totalMediaBytes = mediaInventory.reduce((total, entry) => total + entry.originalSize, 0)
  if (totalMediaBytes > policy.maxTotalImageBytes) throw new RangeError(`Media Word oltre ${policy.maxTotalImageBytes} byte complessivi.`)
  if (mediaInventory.some((entry) => entry.originalSize > policy.maxImageBytes)) throw new RangeError(`Un’immagine Word supera ${policy.maxImageBytes} byte.`)

  const sha256 = await sha256Hex(new Uint8Array(buffer))
  const images: OfficeImageAsset[] = []
  const imageWarnings: string[] = []
  let extractedImageBytes = 0
  const mammothModule = await safeDynamicImport(() => import('mammoth/mammoth.browser'))
  const mammoth = mammothModule.default as unknown as {
    readonly images: { imgElement(converter: (image: { readonly contentType: string; readAsBase64String(): Promise<string> }) => Promise<{ readonly src: string }>): unknown }
    convertToHtml(input: { readonly arrayBuffer: ArrayBuffer }, options: Readonly<Record<string, unknown>>): Promise<{ readonly value: string; readonly messages: readonly { readonly type: string; readonly message: string }[] }>
  }
  const converter = mammoth.images.imgElement(async (image) => {
    const index = images.length
    if (index >= policy.maxImages) {
      imageWarnings.push('Ulteriori immagini DOCX omesse dal limite configurato.')
      return { src: '' }
    }
    const mime = image.contentType.toLowerCase()
    const base64 = await image.readAsBase64String()
    const bytes = decodeBase64(base64)
    let omittedReason: string | null = null
    let retained: Uint8Array | null = bytes
    if (!SUPPORTED_IMAGE_MIME.has(mime)) {
      omittedReason = `Formato immagine ${mime || 'sconosciuto'} non incorporabile nella preview.`
      retained = null
    } else if (bytes.byteLength > policy.maxImageBytes) {
      omittedReason = `Immagine oltre ${policy.maxImageBytes} byte.`
      retained = null
    } else if (extractedImageBytes + bytes.byteLength > policy.maxTotalImageBytes) {
      omittedReason = `Budget cumulativo immagini oltre ${policy.maxTotalImageBytes} byte.`
      retained = null
    }
    if (retained) extractedImageBytes += retained.byteLength
    images.push({ name: `image-${index + 1}`, mime, bytes: retained, byteLength: bytes.byteLength, alt: `Immagine ${index + 1} dal documento Word`, omittedReason })
    if (omittedReason) imageWarnings.push(omittedReason)
    return { src: `ai-bundle-image:${index}` }
  })

  const result = await mammoth.convertToHtml(
    { arrayBuffer: buffer },
    {
      externalFileAccess: false,
      idPrefix: `ai-bundle-${manifestFile.fileId}-`,
      convertImage: converter,
      styleMap: ['comment-reference => sup'],
    },
  )
  if (result.value.length > policy.maxHtmlCharacters * 4) throw new RangeError('HTML DOCX intermedio oltre il limite difensivo.')
  const sanitized = sanitizeOfficeHtml(result.value, policy.maxHtmlCharacters)
  let markdown = sanitized.markdown
  let truncated = false
  const warnings = [
    'Resa DOCX semantica derivata: layout, font, interruzioni e paginazione possono differire da Microsoft Word.',
    ...result.messages.map((message) => `Mammoth ${message.type}: ${message.message}`),
    ...sanitized.warnings,
    ...imageWarnings,
  ]
  if (markdown.length > policy.maxTextCharacters) {
    markdown = markdown.slice(0, policy.maxTextCharacters)
    truncated = true
    warnings.push(`Contenuto DOCX troncato a ${policy.maxTextCharacters} caratteri.`)
  }
  const macros = manifestFile.extension === 'docm' || packageData.entryNames.some((name) => /(?:^|\/)vbaProject\.bin$/iu.test(name))
  if (macros) warnings.push('Macro VBA rilevate e mai aperte o eseguite.')
  const externalRelationships = countExternalRelationships(packageData)
  if (externalRelationships > 0) warnings.push(`${externalRelationships} relazioni esterne rilevate e non caricate.`)
  const omittedImages = images.filter((image) => image.omittedReason).length
  const status = truncated || omittedImages > 0 ? 'partial' : 'completed'
  const asset: DocxDocumentAsset = {
    kind: 'docx',
    adapterId: DOCX_ADAPTER_ID,
    adapterVersion: DOCX_ADAPTER_VERSION,
    fileId: manifestFile.fileId,
    path: manifestFile.normalizedPath,
    status,
    sanitizedHtml: sanitized.html,
    markdown,
    plainText: sanitized.plainText.slice(0, policy.maxTextCharacters),
    metadata: readOfficeMetadata(packageData),
    images,
    macros,
    externalRelationships,
    messages: result.messages.map((message) => `${message.type}: ${message.message}`),
    warnings: [...new Set(warnings)],
    truncated,
    sha256,
  }
  const content = renderMetadata(asset)
  return {
    record: {
      adapterId: DOCX_ADAPTER_ID,
      adapterVersion: DOCX_ADAPTER_VERSION,
      contentKind: 'document',
      fileId: manifestFile.fileId,
      path: manifestFile.normalizedPath,
      status,
      encoding: null,
      usedFallback: false,
      replacementCharacters: 0,
      originalBytes: manifestFile.size,
      extractedBytes: buffer.byteLength,
      extractedCharacters: content.length,
      lineCount: content.split('\n').length,
      truncated,
      truncationReason: truncated ? 'office-limit' : null,
      newlineNormalization: 'lf',
      anchors: [],
      parts: [],
      warnings: asset.warnings,
      error: null,
      sha256,
    },
    content,
    language: 'markdown',
    asset,
  }
}
