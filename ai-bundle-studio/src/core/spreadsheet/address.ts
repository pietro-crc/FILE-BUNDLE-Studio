import type { SpreadsheetRange } from './types'

const CELL_REFERENCE = /^\$?([A-Z]{1,4})\$?([1-9][0-9]*)$/u

export function columnIndexFromLetters(letters: string): number {
  let value = 0
  for (const character of letters.toUpperCase()) value = value * 26 + character.charCodeAt(0) - 64
  return value
}

export function columnLettersFromIndex(index: number): string {
  if (!Number.isSafeInteger(index) || index < 1) throw new RangeError('Indice colonna non valido.')
  let current = index
  let result = ''
  while (current > 0) {
    current -= 1
    result = String.fromCharCode(65 + (current % 26)) + result
    current = Math.floor(current / 26)
  }
  return result
}

export function parseCellAddress(address: string): { readonly row: number; readonly column: number } | null {
  const match = CELL_REFERENCE.exec(address.toUpperCase())
  if (!match) return null
  return { column: columnIndexFromLetters(match[1] ?? ''), row: Number(match[2]) }
}

export function parseRange(reference: string): SpreadsheetRange | null {
  const [startText, endText = startText] = reference.split(':', 2)
  const start = startText ? parseCellAddress(startText) : null
  const end = endText ? parseCellAddress(endText) : null
  if (!start || !end) return null
  return {
    ref: reference,
    startRow: Math.min(start.row, end.row),
    startColumn: Math.min(start.column, end.column),
    endRow: Math.max(start.row, end.row),
    endColumn: Math.max(start.column, end.column),
  }
}
