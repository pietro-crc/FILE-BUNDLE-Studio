const FILE_ID_PATTERN = /^file_[a-f0-9]{64}$/u

export function createMarkdownAnchor(fileId: string, segment = 1): string {
  if (!FILE_ID_PATTERN.test(fileId)) {
    throw new Error('ID file manifest non valido per la creazione dell’anchor Markdown.')
  }
  const base = `ai-bundle-${fileId}`
  return segment === 1 ? base : `${base}-segment-${String(segment).padStart(3, '0')}`
}

export function renderMarkdownAnchor(anchor: string): string {
  if (!/^ai-bundle-file_[a-f0-9]{64}(?:-segment-[0-9]{3})?$/u.test(anchor)) {
    throw new Error('Anchor Markdown non valido.')
  }
  return `<!-- ai-bundle-anchor:${anchor} -->`
}
