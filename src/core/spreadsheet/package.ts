import { safeDynamicImport } from '../utils/dynamic-import'
import type { SpreadsheetPolicy } from './types'

export interface SpreadsheetPackage {
  readonly bytes: Uint8Array
  readonly entries: ReadonlyMap<string, Uint8Array>
  readonly entryNames: readonly string[]
}

const decoder = new TextDecoder('utf-8', { fatal: true })
const ALLOWED_PART = /^(?:\[Content_Types\]\.xml|docProps\/(?:core|app)\.xml|xl\/(?:workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|styles\.xml|worksheets\/[^/]+\.xml|worksheets\/_rels\/[^/]+\.xml\.rels|comments[^/]*\.xml|tables\/[^/]+\.xml))$/u

function isSafePackagePath(name: string): boolean {
  return name.length > 0 && !name.startsWith('/') && !name.startsWith('\\') && !name.includes('\\') && !name.split('/').includes('..') && !name.includes('\0')
}

export async function readSpreadsheetPackage(
  buffer: ArrayBuffer,
  policy: SpreadsheetPolicy,
): Promise<SpreadsheetPackage> {
  if (buffer.byteLength > policy.maxWorkbookBytes) {
    throw new RangeError(`Workbook oltre il limite di ${policy.maxWorkbookBytes} byte.`)
  }
  const bytes = new Uint8Array(buffer)
  const { unzipSync } = await safeDynamicImport(() => import('fflate'))
  const inventory: { name: string; originalSize: number }[] = []
  let selectedTotal = 0
  let output: Record<string, Uint8Array>
  try {
    output = unzipSync(bytes, {
      filter: (entry) => {
        if (!isSafePackagePath(entry.name)) throw new Error(`Percorso OOXML non sicuro: ${entry.name}.`)
        inventory.push({ name: entry.name, originalSize: entry.originalSize })
        if (inventory.length > policy.maxArchiveEntries) throw new RangeError(`Pacchetto OOXML oltre ${policy.maxArchiveEntries} entry.`)
        const selected = ALLOWED_PART.test(entry.name)
        if (selected) {
          if (entry.originalSize > policy.maxXmlPartBytes) throw new RangeError(`Parte XML ${entry.name} oltre ${policy.maxXmlPartBytes} byte.`)
          selectedTotal += entry.originalSize
          if (selectedTotal > policy.maxTotalXmlBytes) throw new RangeError(`Parti XML oltre ${policy.maxTotalXmlBytes} byte complessivi.`)
        }
        return selected
      },
    })
  } catch (error) {
    throw new Error(`Pacchetto OOXML non leggibile: ${error instanceof Error ? error.message : 'errore ZIP sconosciuto'}`, { cause: error })
  }
  const entryNames = inventory.map((entry) => entry.name)
  // eslint-disable-next-line unicorn/no-array-sort -- ES2022 target does not expose Array.prototype.toSorted.
  entryNames.sort((left, right) => left.localeCompare(right))
  return {
    bytes,
    entries: new Map(Object.entries(output)),
    entryNames,
  }
}

export function readXmlPart(packageData: SpreadsheetPackage, path: string, required = true): string | null {
  const bytes = packageData.entries.get(path)
  if (!bytes) {
    if (required) throw new Error(`Parte OOXML obbligatoria mancante: ${path}.`)
    return null
  }
  try {
    return decoder.decode(bytes)
  } catch {
    throw new Error(`Parte OOXML ${path} non codificata in UTF-8 valido.`)
  }
}
