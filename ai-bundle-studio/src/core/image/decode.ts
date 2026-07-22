import type { ImageDecodeRequest, ImageDecoder } from './types'

function abortError(signal?: AbortSignal): DOMException {
  return new DOMException(signal?.reason ? String(signal.reason) : 'Operazione annullata.', 'AbortError')
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError(signal)
}

async function canvasToPng(canvas: OffscreenCanvas | HTMLCanvasElement): Promise<Uint8Array> {
  if ('convertToBlob' in canvas) {
    const blob = await canvas.convertToBlob({ type: 'image/png' })
    return new Uint8Array(await blob.arrayBuffer())
  }
  return new Promise<Uint8Array>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Il browser non ha prodotto il PNG derivato.'))
        return
      }
      blob.arrayBuffer().then((buffer) => resolve(new Uint8Array(buffer)), reject)
    }, 'image/png')
  })
}

export const decodeImageToPng: ImageDecoder = async (request: ImageDecodeRequest, signal?: AbortSignal): Promise<Uint8Array> => {
  assertNotAborted(signal)
  if (typeof createImageBitmap !== 'function') throw new Error('Il browser non espone createImageBitmap per questo formato.')
  const blob = new Blob([request.bytes.slice()], { type: request.mime })
  const bitmap = await createImageBitmap(blob, {
    imageOrientation: 'from-image',
    resizeWidth: request.outputWidth,
    resizeHeight: request.outputHeight,
    resizeQuality: 'high',
  })
  try {
    assertNotAborted(signal)
    const canvas: OffscreenCanvas | HTMLCanvasElement = typeof OffscreenCanvas === 'function'
      ? new OffscreenCanvas(request.outputWidth, request.outputHeight)
      : Object.assign(document.createElement('canvas'), { width: request.outputWidth, height: request.outputHeight })
    const context = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null
    if (!context) throw new Error('Contesto canvas 2D non disponibile.')
    context.drawImage(bitmap, 0, 0, request.outputWidth, request.outputHeight)
    assertNotAborted(signal)
    return await canvasToPng(canvas)
  } finally {
    bitmap.close()
  }
}
