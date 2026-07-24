import type { ImportIssueCode } from './types'

export interface PathPolicy {
  readonly maxDepth: number
  readonly maxLength: number
}

export interface NormalizedVirtualPath {
  readonly originalPath: string
  readonly normalizedPath: string
  readonly name: string
  readonly extension: string
  readonly depth: number
}

export const DEFAULT_PATH_POLICY: PathPolicy = {
  maxDepth: 64,
  maxLength: 4096,
}

export class PathValidationError extends Error {
  readonly code: ImportIssueCode
  readonly path: string

  constructor(code: ImportIssueCode, path: string, message: string) {
    super(message)
    this.name = 'PathValidationError'
    this.code = code
    this.path = path
  }
}

const WINDOWS_DRIVE_PATH = /^[a-zA-Z]:($|\/)/

function containsControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return codePoint <= 0x1f || codePoint === 0x7f
  })
}

export function normalizeVirtualPath(input: string, policy: PathPolicy = DEFAULT_PATH_POLICY): NormalizedVirtualPath {
  const originalPath = input
  const slashNormalized = input.normalize('NFC').replaceAll('\\', '/')

  if (slashNormalized.length === 0) {
    throw new PathValidationError('path-empty', originalPath, 'Il percorso è vuoto.')
  }

  if (slashNormalized.startsWith('/') || slashNormalized.startsWith('//') || WINDOWS_DRIVE_PATH.test(slashNormalized)) {
    throw new PathValidationError('path-absolute', originalPath, 'I percorsi assoluti non sono consentiti.')
  }

  if (containsControlCharacter(slashNormalized)) {
    throw new PathValidationError(
      'path-control-character',
      originalPath,
      'Il percorso contiene caratteri di controllo non consentiti.',
    )
  }

  const segments = slashNormalized.split('/').filter((segment) => segment !== '' && segment !== '.')

  if (segments.some((segment) => segment === '..')) {
    throw new PathValidationError('path-traversal', originalPath, 'Il percorso tenta di uscire dalla radice virtuale.')
  }

  if (segments.length === 0) {
    throw new PathValidationError('path-empty', originalPath, 'Il percorso non contiene un nome utilizzabile.')
  }

  if (segments.length > policy.maxDepth) {
    throw new PathValidationError(
      'path-depth',
      originalPath,
      `Il percorso supera la profondità massima di ${policy.maxDepth} livelli.`,
    )
  }

  const normalizedPath = segments.join('/')
  if (normalizedPath.length > policy.maxLength) {
    throw new PathValidationError(
      'path-length',
      originalPath,
      `Il percorso supera la lunghezza massima di ${policy.maxLength} caratteri.`,
    )
  }

  const name = segments.at(-1) ?? normalizedPath
  const extensionIndex = name.lastIndexOf('.')
  const extension = extensionIndex > 0 && extensionIndex < name.length - 1 ? name.slice(extensionIndex + 1).toLowerCase() : ''

  return {
    originalPath,
    normalizedPath,
    name,
    extension,
    depth: segments.length,
  }
}


export function findVirtualPathConflict(knownPaths: ReadonlySet<string>, candidatePath: string): string | null {
  const segments = candidatePath.split('/')
  for (let index = 1; index < segments.length; index += 1) {
    const ancestor = segments.slice(0, index).join('/')
    if (knownPaths.has(ancestor)) {
      return ancestor
    }
  }

  const descendantPrefix = `${candidatePath}/`
  for (const knownPath of knownPaths) {
    if (knownPath.startsWith(descendantPrefix)) {
      return knownPath
    }
  }

  return null
}
