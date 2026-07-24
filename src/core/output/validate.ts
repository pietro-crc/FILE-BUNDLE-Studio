import type { ManifestArtifact } from '../manifest/types'
import type { DocumentsArtifact, DocumentsValidationError, DocumentsValidationResult } from './types'

function add(errors: DocumentsValidationError[], code: string, path: string, message: string): void {
  errors.push({ code, path, message })
}

export function validateDocumentsArtifact(
  artifact: Omit<DocumentsArtifact, 'validation'>,
  manifest: ManifestArtifact,
): DocumentsValidationResult {
  const errors: DocumentsValidationError[] = []
  if (artifact.pageCount !== artifact.pages.length) add(errors, 'page-count', '/pageCount', 'Conteggio pagine non coerente con la mappatura.')
  if (artifact.pages.some((page, index) => page.outputPage !== index + 1)) add(errors, 'page-sequence', '/pages', 'La numerazione delle pagine non è contigua.')
  if (artifact.byteLength !== artifact.bytes.byteLength) add(errors, 'byte-length', '/byteLength', 'Dimensione PDF non coerente.')
  if (artifact.pageCount > artifact.policy.maxOutputPages) add(errors, 'page-limit', '/pageCount', 'Il PDF supera il limite configurato.')

  const pageNumbers = new Set(artifact.pages.map((page) => page.outputPage))
  const manifestFiles = new Map(manifest.manifest.files.map((file) => [file.fileId, file]))
  artifact.records.forEach((record, index) => {
    const path = `/records/${index}`
    if (record.pages.some((page) => !pageNumbers.has(page))) add(errors, 'record-page', `${path}/pages`, 'Pagina dichiarata inesistente.')
    const file = manifestFiles.get(record.fileId)
    if (!file) {
      add(errors, 'record-file', `${path}/fileId`, 'File manifest inesistente.')
      return
    }
    if (file.representations.pdf.status !== record.status) add(errors, 'manifest-status', path, 'Stato PDF diverso dal manifest.')
    if (file.representations.pdf.pages.join('\0') !== record.pages.join('\0')) add(errors, 'manifest-pages', path, 'Pagine PDF diverse dal manifest.')
    if (!file.representations.pdf.parts.includes(artifact.name)) add(errors, 'manifest-part', path, 'Parte PDF non dichiarata nel manifest.')
    if ((file.security.excluded || file.security.visualOmitted) && record.pages.length > 0) add(errors, 'security-visual-pages', path, 'Un file escluso o omesso dalla policy sicurezza non deve avere pagine visuali.')
  })

  const output = manifest.manifest.outputs.find((candidate) => candidate.family === 'documents')
  if (!output || output.status !== 'generated') add(errors, 'output-status', '/manifest/outputs', 'Output documenti non marcato come generato.')
  else if (output.parts.join('\0') !== artifact.name) add(errors, 'output-parts', '/manifest/outputs', 'Nome PDF non coerente.')
  if (!manifest.validation.valid) add(errors, 'manifest-invalid', '/manifest', 'Il manifest aggiornato non è valido.')
  return { valid: errors.length === 0, errors }
}
