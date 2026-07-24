import type { ManifestConversionStatus } from '../manifest/types'

export type ImageOrientation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
export type EmbeddableImageMime = 'image/jpeg' | 'image/png'

export interface ImagePolicy {
  readonly maxImageBytes: number
  readonly maxMegapixels: number
  readonly maxDimension: number
  readonly targetMegapixels: number
}

export interface ImageMetadata {
  readonly mime: string
  readonly width: number
  readonly height: number
  readonly megapixels: number
  readonly orientation: ImageOrientation
  readonly hasTransparency: boolean
  readonly animated: boolean
  readonly formatLabel: string
}

export interface ImageAsset {
  readonly adapterId: 'image'
  readonly adapterVersion: '1.0.0'
  readonly fileId: string
  readonly path: string
  readonly originalMime: string
  readonly embeddedMime: EmbeddableImageMime | null
  readonly bytes: Uint8Array | null
  readonly originalBytes: number
  readonly outputBytes: number
  readonly width: number
  readonly height: number
  readonly outputWidth: number
  readonly outputHeight: number
  readonly orientation: ImageOrientation
  readonly hasTransparency: boolean
  readonly animated: boolean
  readonly downsampled: boolean
  readonly status: ManifestConversionStatus
  readonly warnings: readonly string[]
  readonly sha256: string
}

export interface ImageDecodeRequest {
  readonly bytes: Uint8Array
  readonly mime: string
  readonly outputWidth: number
  readonly outputHeight: number
}

export type ImageDecoder = (request: ImageDecodeRequest, signal?: AbortSignal) => Promise<Uint8Array>
