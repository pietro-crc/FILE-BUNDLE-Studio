const encoder = new TextEncoder()

export function utf8ByteLength(value: string): number {
  return encoder.encode(value).byteLength
}

function splitOversizedLine(line: string, maxBytes: number): string[] {
  const chunks: string[] = []
  let current = ''
  let currentBytes = 0
  for (const character of line) {
    const characterBytes = utf8ByteLength(character)
    if (current.length > 0 && currentBytes + characterBytes > maxBytes) {
      chunks.push(current)
      current = ''
      currentBytes = 0
    }
    current += character
    currentBytes += characterBytes
  }
  if (current.length > 0 || chunks.length === 0) chunks.push(current)
  return chunks
}

export function splitTextByUtf8Bytes(value: string, maxBytes: number): string[] {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new RangeError('Il limite UTF-8 deve essere un intero positivo.')
  }
  if (utf8ByteLength(value) <= maxBytes) return [value]

  const chunks: string[] = []
  let current = ''
  let currentBytes = 0
  const lines = value.split('\n')

  lines.forEach((line, index) => {
    const suffix = index < lines.length - 1 ? '\n' : ''
    const candidate = `${line}${suffix}`
    const candidateBytes = utf8ByteLength(candidate)
    if (candidateBytes > maxBytes) {
      if (current.length > 0) {
        chunks.push(current)
        current = ''
        currentBytes = 0
      }
      const oversizedChunks = splitOversizedLine(candidate, maxBytes)
      chunks.push(...oversizedChunks.slice(0, -1))
      current = oversizedChunks.at(-1) ?? ''
      currentBytes = utf8ByteLength(current)
      return
    }
    if (current.length > 0 && currentBytes + candidateBytes > maxBytes) {
      chunks.push(current)
      current = candidate
      currentBytes = candidateBytes
      return
    }
    current += candidate
    currentBytes += candidateBytes
  })

  if (current.length > 0) chunks.push(current)
  return chunks
}
