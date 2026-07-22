import type { ByteSource } from './types'

const noOp = () => undefined

function abortError(signal?: AbortSignal): DOMException {
  return new DOMException(signal?.reason ? String(signal.reason) : 'Operazione annullata.', 'AbortError')
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw abortError(signal)
  }
}

async function readBlob(blob: Blob, signal?: AbortSignal): Promise<ArrayBuffer> {
  assertNotAborted(signal)

  if (typeof blob.stream !== 'function') {
    const buffer = await blob.arrayBuffer()
    assertNotAborted(signal)
    return buffer
  }

  const reader = blob.stream().getReader()
  const chunks: Uint8Array[] = []
  let totalLength = 0

  const abortListener = () => {
    void reader.cancel(signal?.reason)
  }
  signal?.addEventListener('abort', abortListener, { once: true })

  try {
    while (true) {
      assertNotAborted(signal)
      // eslint-disable-next-line no-await-in-loop -- A ReadableStream must be consumed in order.
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      chunks.push(value)
      totalLength += value.byteLength
    }
  } finally {
    signal?.removeEventListener('abort', abortListener)
    reader.releaseLock()
  }

  assertNotAborted(signal)
  const merged = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return merged.buffer
}

async function readBlobPrefix(blob: Blob, maxBytes: number, signal?: AbortSignal): Promise<ArrayBuffer> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new RangeError('La dimensione del prefisso deve essere un intero non negativo.')
  }
  return readBlob(blob.slice(0, Math.min(blob.size, maxBytes)), signal)
}

export class BlobByteSource implements ByteSource {
  readonly size: number
  #blob: Blob | null

  constructor(blob: Blob) {
    this.#blob = blob
    this.size = blob.size
  }

  async read(signal?: AbortSignal): Promise<ArrayBuffer> {
    if (!this.#blob) {
      throw new Error('La sorgente byte è stata rilasciata.')
    }
    return readBlob(this.#blob, signal)
  }

  async readPrefix(maxBytes: number, signal?: AbortSignal): Promise<ArrayBuffer> {
    if (!this.#blob) {
      throw new Error('La sorgente byte è stata rilasciata.')
    }
    return readBlobPrefix(this.#blob, maxBytes, signal)
  }

  dispose(): void {
    this.#blob = null
  }
}

export class ZipEntryByteSource implements ByteSource {
  readonly size: number
  readonly #compressedSize: number
  readonly #compressionMethod: number
  readonly #dataOffset: number
  #archive: Blob | null

  constructor(
    archive: Blob,
    size: number,
    compressedSize: number,
    compressionMethod: number,
    dataOffset: number,
  ) {
    this.#archive = archive
    this.size = size
    this.#compressedSize = compressedSize
    this.#compressionMethod = compressionMethod
    this.#dataOffset = dataOffset
  }

  async read(signal?: AbortSignal): Promise<ArrayBuffer> {
    if (!this.#archive) {
      throw new Error('La sorgente ZIP è stata rilasciata.')
    }

    const compressed = new Uint8Array(
      await readBlob(this.#archive.slice(this.#dataOffset, this.#dataOffset + this.#compressedSize), signal),
    )
    assertNotAborted(signal)

    if (this.#compressionMethod === 0) {
      return compressed.slice().buffer
    }
    if (this.#compressionMethod !== 8) {
      throw new Error(`Metodo ZIP non supportato: ${this.#compressionMethod}.`)
    }

    const { inflate } = await import('fflate')
    return new Promise<ArrayBuffer>((resolve, reject) => {
      let settled = false
      let terminate: () => void = noOp
      const abortListener = () => {
        if (settled) {
          return
        }
        settled = true
        terminate()
        reject(abortError(signal))
      }

      signal?.addEventListener('abort', abortListener, { once: true })
      terminate = inflate(compressed, (error, output) => {
        if (settled) {
          return
        }
        settled = true
        signal?.removeEventListener('abort', abortListener)
        if (error) {
          reject(error)
          return
        }
        resolve(output.slice().buffer)
      })
    })
  }

  async readPrefix(maxBytes: number, signal?: AbortSignal): Promise<ArrayBuffer> {
    if (!this.#archive) {
      throw new Error('La sorgente ZIP è stata rilasciata.')
    }
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
      throw new RangeError('La dimensione del prefisso deve essere un intero non negativo.')
    }
    if (maxBytes === 0 || this.size === 0) {
      return new ArrayBuffer(0)
    }

    const requestedBytes = Math.min(maxBytes, this.size)
    if (this.#compressionMethod === 0) {
      return readBlob(
        this.#archive.slice(this.#dataOffset, this.#dataOffset + requestedBytes),
        signal,
      )
    }
    if (this.#compressionMethod !== 8) {
      throw new Error(`Metodo ZIP non supportato: ${this.#compressionMethod}.`)
    }

    const { Inflate } = await import('fflate')
    const chunks: Uint8Array[] = []
    let outputLength = 0
    let compressedOffset = 0
    const compressedChunkSize = 1024
    const inflater = new Inflate((chunk) => {
      if (outputLength >= requestedBytes) {
        return
      }
      const remaining = requestedBytes - outputLength
      const accepted = chunk.subarray(0, remaining).slice()
      chunks.push(accepted)
      outputLength += accepted.byteLength
    })

    while (compressedOffset < this.#compressedSize) {
      if (outputLength >= requestedBytes) {
        break
      }
      assertNotAborted(signal)
      const nextOffset = Math.min(this.#compressedSize, compressedOffset + compressedChunkSize)
      // eslint-disable-next-line no-await-in-loop -- ZIP prefix inflation requires ordered compressed chunks.
      const compressedBuffer = await readBlob(
        this.#archive.slice(this.#dataOffset + compressedOffset, this.#dataOffset + nextOffset),
        signal,
      )
      const compressedChunk = new Uint8Array(compressedBuffer)
      compressedOffset = nextOffset
      inflater.push(compressedChunk, compressedOffset === this.#compressedSize)
    }

    const output = new Uint8Array(outputLength)
    let outputOffset = 0
    for (const chunk of chunks) {
      output.set(chunk, outputOffset)
      outputOffset += chunk.byteLength
    }
    return output.buffer
  }

  dispose(): void {
    this.#archive = null
  }
}
