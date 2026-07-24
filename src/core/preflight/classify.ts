import type { VirtualFile } from '../vfs/types'
import { descriptorForFile, unknownBinaryDescriptor, unknownTextDescriptor, type FormatDescriptor } from './registry'
import { detectFileSignature, type SignatureMatch } from './signatures'
import { inspectTextSample } from './text'
import type { DetectionMethod, FileCategory, TextEncoding } from './types'

export interface ClassificationResult {
  readonly descriptor: FormatDescriptor
  readonly mimeDetected: string
  readonly detectionMethod: DetectionMethod
  readonly category: FileCategory
  readonly isText: boolean
  readonly encoding?: TextEncoding
  readonly warning?: string
  readonly signature?: SignatureMatch
}

const GENERIC_DECLARED_TYPES = new Set(['', 'application/octet-stream', 'binary/octet-stream'])
const ZIP_CONTAINER_EXTENSIONS = new Set(['docx', 'docm', 'xlsx', 'xlsm', 'pptx', 'pptm', 'odt', 'ods'])
const OLE_EXTENSIONS = new Set(['doc', 'xls', 'ppt'])

function descriptorFromDeclared(mime: string): FormatDescriptor | undefined {
  if (mime.startsWith('text/')) {
    return {
      mime,
      category: mime.includes('javascript') || mime.includes('css') ? 'code' : 'text',
      level: 'B',
      adapterId: 'text',
      reason: 'Tipo testuale dichiarato dal browser; verrà trattato in modo generico.',
    }
  }
  if (mime.startsWith('image/')) {
    return {
      mime,
      category: 'image',
      level: 'C',
      adapterId: 'image',
      reason: 'Tipo immagine dichiarato dal browser; decodifica da confermare.',
    }
  }
  return undefined
}

export function classifyFileSample(file: VirtualFile, bytes: Uint8Array): ClassificationResult {
  const extensionDescriptor = descriptorForFile(file)
  const signature = detectFileSignature(bytes)
  const text = inspectTextSample(bytes)

  if (signature?.executable) {
    return {
      descriptor: {
        mime: signature.mime,
        category: signature.category,
        level: 'E',
        adapterId: 'blocked',
        reason: 'Contenuto eseguibile rilevato dalla firma binaria e bloccato.',
        executable: true,
      },
      mimeDetected: signature.mime,
      detectionMethod: 'signature',
      category: signature.category,
      isText: false,
      signature,
    }
  }

  if (signature?.mime === 'application/zip' && extensionDescriptor && ZIP_CONTAINER_EXTENSIONS.has(file.extension)) {
    return {
      descriptor: extensionDescriptor,
      mimeDetected: extensionDescriptor.mime,
      detectionMethod: 'container-extension',
      category: extensionDescriptor.category,
      isText: false,
      signature,
    }
  }

  if (signature?.mime === 'application/x-ole-storage' && extensionDescriptor && OLE_EXTENSIONS.has(file.extension)) {
    return {
      descriptor: extensionDescriptor,
      mimeDetected: extensionDescriptor.mime,
      detectionMethod: 'container-extension',
      category: extensionDescriptor.category,
      isText: false,
      signature,
    }
  }

  if (signature) {
    const signatureDescriptor = extensionDescriptor?.mime === signature.mime
      ? extensionDescriptor
      : {
          mime: signature.mime,
          category: signature.category,
          level: signature.category === 'image' ? 'C' : 'D',
          adapterId: signature.category === 'image' ? 'image' : 'inventory',
          reason: signature.category === 'image'
            ? 'Formato immagine riconosciuto dalla firma binaria.'
            : 'Formato riconosciuto dalla firma; supporto prudente di inventario.',
        } satisfies FormatDescriptor
    return {
      descriptor: signatureDescriptor,
      mimeDetected: signature.mime,
      detectionMethod: 'signature',
      category: signature.category,
      isText: false,
      signature,
    }
  }

  if (extensionDescriptor) {
    if (extensionDescriptor.adapterId === 'text' && !text.isText) {
      const descriptor = unknownBinaryDescriptor()
      return {
        descriptor,
        mimeDetected: descriptor.mime,
        detectionMethod: 'unknown',
        category: descriptor.category,
        isText: false,
        warning: `L’estensione .${file.extension || file.name} indica testo, ma il campione appare binario.`,
      }
    }
    return {
      descriptor: extensionDescriptor,
      mimeDetected: extensionDescriptor.mime,
      detectionMethod: 'extension',
      category: extensionDescriptor.category,
      isText: text.isText,
      ...(text.encoding ? { encoding: text.encoding } : {}),
      ...(text.warning ? { warning: text.warning } : {}),
    }
  }

  if (text.isText) {
    const descriptor = unknownTextDescriptor()
    return {
      descriptor,
      mimeDetected: descriptor.mime,
      detectionMethod: 'text-heuristic',
      category: descriptor.category,
      isText: true,
      ...(text.encoding ? { encoding: text.encoding } : {}),
      ...(text.warning ? { warning: text.warning } : {}),
    }
  }

  const declared = file.mimeDeclared?.trim().toLowerCase() ?? ''
  if (!GENERIC_DECLARED_TYPES.has(declared)) {
    const descriptor = descriptorFromDeclared(declared)
    if (descriptor) {
      return {
        descriptor,
        mimeDetected: descriptor.mime,
        detectionMethod: 'declared',
        category: descriptor.category,
        isText: descriptor.category === 'text' || descriptor.category === 'code',
      }
    }
  }

  const descriptor = unknownBinaryDescriptor()
  return {
    descriptor,
    mimeDetected: descriptor.mime,
    detectionMethod: 'unknown',
    category: descriptor.category,
    isText: false,
  }
}

export function isMeaningfulMimeMismatch(declared: string | undefined, detected: string, method: DetectionMethod): boolean {
  if (!declared || method === 'declared' || method === 'extension' || method === 'text-heuristic' || method === 'unknown') {
    return false
  }
  const normalized = declared.toLowerCase().trim()
  if (GENERIC_DECLARED_TYPES.has(normalized)) {
    return false
  }
  if (normalized === detected) {
    return false
  }
  if (normalized === 'application/zip' && detected.includes('officedocument')) {
    return false
  }
  return true
}
