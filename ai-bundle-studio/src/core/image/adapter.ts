import { sha256Hex } from '../hash/sha256'
import type { ManifestFileRecord } from '../manifest/types'
import type { TextExtractionRecord } from '../markdown/types'
import type { VirtualFile } from '../vfs/types'
import { decodeImageToPng } from './decode'
import { inspectImageBytes } from './inspect'
import type { ImageAsset, ImageDecoder, ImagePolicy } from './types'

export const IMAGE_ADAPTER_ID = 'image' as const
export const IMAGE_ADAPTER_VERSION = '1.0.0' as const

export const DEFAULT_IMAGE_POLICY: ImagePolicy = {
  maxImageBytes: 64 * 1024 * 1024,
  maxMegapixels: 40,
  maxDimension: 12_000,
  targetMegapixels: 12,
}

function validatePolicy(overrides?: Partial<ImagePolicy>): ImagePolicy {
  const policy = { ...DEFAULT_IMAGE_POLICY, ...overrides }
  for (const [key, value] of Object.entries(policy)) {
    if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${key} deve essere positivo.`)
  }
  if (policy.targetMegapixels > policy.maxMegapixels) throw new RangeError('targetMegapixels non può superare maxMegapixels.')
  return policy
}

function orientedDimensions(width: number, height: number, orientation: number): { width: number; height: number } {
  return orientation >= 5 ? { width: height, height: width } : { width, height }
}

function targetDimensions(width: number, height: number, policy: ImagePolicy): { width: number; height: number; downsampled: boolean } {
  const scaleByPixels = Math.sqrt((policy.targetMegapixels * 1_000_000) / (width * height))
  const scaleByDimension = policy.maxDimension / Math.max(width, height)
  const scale = Math.min(1, scaleByPixels, scaleByDimension)
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    downsampled: scale < 0.999,
  }
}

function renderImageMarkdown(asset: ImageAsset): string {
  return [
    '### Immagine',
    '',
    `- Formato originale: ${asset.originalMime}`,
    `- Dimensioni originali: ${asset.width} × ${asset.height} px`,
    `- Orientamento EXIF/TIFF: ${asset.orientation}`,
    `- Trasparenza rilevata: ${asset.hasTransparency ? 'sì' : 'no'}`,
    `- Animazione rilevata: ${asset.animated ? 'sì — nel PDF viene usato solo il primo frame' : 'no'}`,
    `- Rappresentazione PDF: ${asset.embeddedMime ? `${asset.outputWidth} × ${asset.outputHeight} px, ${asset.embeddedMime}` : 'non disponibile'}`,
    `- Downsampling: ${asset.downsampled ? 'applicato' : 'non necessario'}`,
  ].join('\n')
}

export interface ExtractedImageFile {
  readonly record: TextExtractionRecord
  readonly content: string
  readonly language: 'markdown'
  readonly asset: ImageAsset
}

export async function extractImageFile(
  file: VirtualFile,
  manifestFile: ManifestFileRecord,
  overrides?: Partial<ImagePolicy>,
  signal?: AbortSignal,
  decoder: ImageDecoder = decodeImageToPng,
): Promise<ExtractedImageFile> {
  const policy = validatePolicy(overrides)
  if (file.size > policy.maxImageBytes) throw new RangeError(`Immagine oltre il limite di ${policy.maxImageBytes} byte.`)
  if (manifestFile.mimeDetected === 'image/svg+xml') throw new Error('SVG attivo non renderizzato prima della sanitizzazione prevista nello STEP-008/009.')
  const bytes = new Uint8Array(await file.bytes.read(signal))
  const sha256 = await sha256Hex(bytes)
  const metadata = inspectImageBytes(bytes, manifestFile.mimeDetected)
  if (metadata.megapixels > policy.maxMegapixels) throw new RangeError(`Immagine da ${metadata.megapixels.toFixed(2)} MP oltre il limite di ${policy.maxMegapixels} MP.`)
  if (Math.max(metadata.width, metadata.height) > policy.maxDimension) throw new RangeError(`Dimensione immagine oltre il limite di ${policy.maxDimension} px.`)

  const oriented = orientedDimensions(metadata.width, metadata.height, metadata.orientation)
  const target = targetDimensions(oriented.width, oriented.height, policy)
  const directEmbed = !target.downsampled && metadata.orientation === 1 && (metadata.mime === 'image/png' || metadata.mime === 'image/jpeg')
  const warnings: string[] = []
  if (metadata.animated) warnings.push('Immagine animata: la rappresentazione PDF usa soltanto il primo frame.')
  let outputBytes: Uint8Array | null = null
  let embeddedMime: 'image/png' | 'image/jpeg' | null = null
  let status: 'completed' | 'partial' = 'completed'

  if (directEmbed) {
    outputBytes = bytes
    embeddedMime = metadata.mime
  } else {
    try {
      outputBytes = await decoder({ bytes, mime: metadata.mime, outputWidth: target.width, outputHeight: target.height }, signal)
      embeddedMime = 'image/png'
      if (target.downsampled) warnings.push(`Immagine ridimensionata a ${target.width} × ${target.height} px per il PDF derivato.`)
      if (metadata.orientation !== 1) warnings.push(`Orientamento ${metadata.orientation} corretto durante la conversione browser-native.`)
    } catch (error) {
      status = 'partial'
      warnings.push(error instanceof Error ? `Preview visuale non disponibile: ${error.message}` : 'Preview visuale non disponibile.')
    }
  }

  const asset: ImageAsset = {
    adapterId: IMAGE_ADAPTER_ID,
    adapterVersion: IMAGE_ADAPTER_VERSION,
    fileId: manifestFile.fileId,
    path: manifestFile.normalizedPath,
    originalMime: metadata.mime,
    embeddedMime,
    bytes: outputBytes,
    originalBytes: bytes.byteLength,
    outputBytes: outputBytes?.byteLength ?? 0,
    width: metadata.width,
    height: metadata.height,
    outputWidth: target.width,
    outputHeight: target.height,
    orientation: metadata.orientation,
    hasTransparency: metadata.hasTransparency,
    animated: metadata.animated,
    downsampled: target.downsampled,
    status,
    warnings,
    sha256,
  }
  const content = renderImageMarkdown(asset)
  return {
    record: {
      adapterId: IMAGE_ADAPTER_ID,
      adapterVersion: IMAGE_ADAPTER_VERSION,
      contentKind: 'image',
      fileId: manifestFile.fileId,
      path: manifestFile.normalizedPath,
      status,
      encoding: null,
      usedFallback: false,
      replacementCharacters: 0,
      originalBytes: manifestFile.size,
      extractedBytes: bytes.byteLength,
      extractedCharacters: content.length,
      lineCount: content.split('\n').length,
      truncated: status === 'partial',
      truncationReason: status === 'partial' ? 'image-rendering-unavailable' : null,
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
}
