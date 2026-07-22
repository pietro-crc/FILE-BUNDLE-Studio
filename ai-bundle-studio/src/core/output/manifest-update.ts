import { serializeManifestV1 } from '../manifest/serialize'
import type { ManifestArtifact, ManifestConversionStatus, ManifestFileRecord, ManifestV1 } from '../manifest/types'
import { validateManifestV1 } from '../manifest/validate'
import type { DocumentsArtifact, DocumentsFileRecord } from './types'

const encoder = new TextEncoder()

function combineStatus(current: ManifestConversionStatus, visual: ManifestConversionStatus): ManifestConversionStatus {
  if (current === 'failed' && visual === 'failed') return 'failed'
  if (current === 'not-applicable') return current
  if (current === 'completed' && visual === 'completed') return 'completed'
  if (visual === 'failed' && current === 'not-started') return 'failed'
  return 'partial'
}

function updateFile(file: ManifestFileRecord, record: DocumentsFileRecord | undefined, partName: string): ManifestFileRecord {
  if (!record) return file
  return {
    ...file,
    warnings: [...new Set([...file.warnings, ...record.warnings])],
    errors: record.error ? [...new Set([...file.errors, record.error])] : file.errors,
    adapter: {
      id: record.adapterId,
      version: record.adapterVersion,
      conversionStatus: combineStatus(file.adapter.conversionStatus, record.status),
    },
    representations: {
      ...file.representations,
      pdf: {
        status: record.status,
        pages: record.pages,
        parts: [partName],
      },
    },
  }
}

export function updateManifestWithDocuments(
  artifact: ManifestArtifact,
  documents: Omit<DocumentsArtifact, 'validation'>,
): ManifestArtifact {
  const records = new Map(documents.records.map((record) => [record.fileId, record]))
  const manifest: ManifestV1 = {
    ...artifact.manifest,
    application: { ...artifact.manifest.application, version: '0.0.0-step-009' },
    generatedAt: documents.generatedAt,
    files: artifact.manifest.files.map((file) => updateFile(file, records.get(file.fileId), documents.name)),
    outputs: artifact.manifest.outputs.map((output) => output.family === 'documents'
      ? { ...output, status: 'generated', parts: [documents.name], sha256: null }
      : output),
  }
  const validation = validateManifestV1(manifest)
  const json = serializeManifestV1(manifest)
  return { manifest, json, byteLength: encoder.encode(json).byteLength, validation }
}
