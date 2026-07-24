import { safeDynamicImport } from '../utils/dynamic-import'
import type { OfficeMetadata, OfficePolicy } from './types'

export interface OfficePackageInventoryEntry {
  readonly name: string
  readonly compressedSize: number
  readonly originalSize: number
  readonly compression: number
}

export interface OfficePackage {
  readonly bytes: Uint8Array
  readonly entries: ReadonlyMap<string, Uint8Array>
  readonly inventory: readonly OfficePackageInventoryEntry[]
  readonly entryNames: readonly string[]
  readonly totalUncompressedBytes: number
}

const utf8 = new TextDecoder('utf-8', { fatal: true })
const FORBIDDEN_XML = /<!DOCTYPE|<!ENTITY/iu

function isSafePath(name: string): boolean {
  return name.length > 0
    && !name.startsWith('/')
    && !name.startsWith('\\')
    && !name.includes('\\')
    && !name.includes('\0')
    && !name.split('/').includes('..')
}

export async function readOfficePackage(
  buffer: ArrayBuffer,
  policy: OfficePolicy,
  select: (name: string) => boolean,
): Promise<OfficePackage> {
  if (buffer.byteLength > policy.maxDocumentBytes) throw new RangeError(`Documento Office oltre ${policy.maxDocumentBytes} byte.`)
  const bytes = new Uint8Array(buffer)
  const { unzipSync } = await safeDynamicImport(() => import('fflate'))
  const inventory: OfficePackageInventoryEntry[] = []
  let totalUncompressedBytes = 0
  let output: Record<string, Uint8Array>
  try {
    output = unzipSync(bytes, {
      filter: (entry) => {
        if (!isSafePath(entry.name)) throw new Error(`Percorso OOXML non sicuro: ${entry.name}.`)
        if (entry.compression !== 0 && entry.compression !== 8) throw new Error(`Compressione OOXML non supportata per ${entry.name}.`)
        inventory.push({ name: entry.name, compressedSize: entry.size, originalSize: entry.originalSize, compression: entry.compression })
        if (inventory.length > policy.maxArchiveEntries) throw new RangeError(`Pacchetto Office oltre ${policy.maxArchiveEntries} entry.`)
        if (entry.originalSize > policy.maxEntryBytes) throw new RangeError(`Entry ${entry.name} oltre ${policy.maxEntryBytes} byte.`)
        totalUncompressedBytes += entry.originalSize
        if (totalUncompressedBytes > policy.maxTotalUncompressedBytes) throw new RangeError(`Pacchetto Office oltre ${policy.maxTotalUncompressedBytes} byte non compressi.`)
        return select(entry.name)
      },
    })
  } catch (error) {
    throw new Error(`Pacchetto Office non leggibile: ${error instanceof Error ? error.message : 'errore ZIP sconosciuto'}`, { cause: error })
  }
  const entryNames = inventory.map((entry) => entry.name)
  entryNames.sort((left, right) => left.localeCompare(right))
  return { bytes, entries: new Map(Object.entries(output)), inventory, entryNames, totalUncompressedBytes }
}

export function readOfficeXml(packageData: OfficePackage, path: string, required = true): string | null {
  const bytes = packageData.entries.get(path)
  if (!bytes) {
    if (required) throw new Error(`Parte Office obbligatoria mancante: ${path}.`)
    return null
  }
  let xml: string
  try {
    xml = utf8.decode(bytes)
  } catch {
    throw new Error(`Parte Office ${path} non codificata in UTF-8 valido.`)
  }
  if (FORBIDDEN_XML.test(xml)) throw new Error(`${path}: DTD ed entità XML non sono consentite.`)
  return xml
}

export function parseOfficeXml(xml: string, label: string): XMLDocument {
  if (FORBIDDEN_XML.test(xml)) throw new Error(`${label}: DTD ed entità XML non sono consentite.`)
  if (typeof DOMParser === 'undefined') throw new Error(`${label}: DOMParser non disponibile.`)
  const document = new DOMParser().parseFromString(xml, 'application/xml')
  if ([...document.getElementsByTagName('*')].some((node) => node.localName === 'parsererror')) throw new Error(`${label}: XML non valido.`)
  return document
}

export function elementsByLocalName(parent: Document | Element, name: string): Element[] {
  return [...parent.getElementsByTagName('*')].filter((element) => element.localName === name)
}

export function directChildrenByLocalName(parent: Element, name: string): Element[] {
  return [...parent.children].filter((element) => element.localName === name)
}

export function resolvePackageTarget(basePart: string, target: string): string {
  if (target.includes('\\') || target.startsWith('/') || target.includes('\0')) throw new Error(`Target OOXML non sicuro: ${target}.`)
  const base = basePart.split('/').slice(0, -1)
  for (const segment of target.split('/')) {
    if (segment === '' || segment === '.') continue
    if (segment === '..') {
      if (base.length === 0) throw new Error(`Target OOXML fuori dal pacchetto: ${target}.`)
      base.pop()
    } else base.push(segment)
  }
  return base.join('/')
}

function textByLocalName(document: XMLDocument, name: string): string | null {
  const value = elementsByLocalName(document, name)[0]?.textContent?.trim()
  return value ? value : null
}

export function readOfficeMetadata(packageData: OfficePackage): OfficeMetadata {
  const xml = readOfficeXml(packageData, 'docProps/core.xml', false)
  if (!xml) return { title: null, creator: null, description: null, created: null, modified: null }
  const document = parseOfficeXml(xml, 'docProps/core.xml')
  return {
    title: textByLocalName(document, 'title'),
    creator: textByLocalName(document, 'creator'),
    description: textByLocalName(document, 'description'),
    created: textByLocalName(document, 'created'),
    modified: textByLocalName(document, 'modified'),
  }
}

export function countExternalRelationships(packageData: OfficePackage): number {
  let total = 0
  for (const [name] of packageData.entries) {
    if (!name.endsWith('.rels')) continue
    const xml = readOfficeXml(packageData, name, false)
    if (!xml) continue
    const document = parseOfficeXml(xml, name)
    total += elementsByLocalName(document, 'Relationship').filter((relationship) => relationship.getAttribute('TargetMode')?.toLowerCase() === 'external').length
  }
  return total
}
