export interface GlobCompilation {
  readonly patterns: readonly string[]
  readonly errors: readonly string[]
}

const MAX_GLOBS = 100
const MAX_GLOB_LENGTH = 256
const CACHE_LIMIT = 200
const regexCache = new Map<string, RegExp>()

function escapeRegex(character: string): string {
  return /[\\^$.*+?()[\]{}|]/.test(character) ? `\\${character}` : character
}

export function globToRegExp(pattern: string): RegExp {
  const normalized = pattern.trim().replaceAll('\\', '/')
  if (normalized.length === 0) {
    throw new Error('Il pattern glob è vuoto.')
  }
  if (normalized.length > MAX_GLOB_LENGTH) {
    throw new Error(`Il pattern supera ${MAX_GLOB_LENGTH} caratteri.`)
  }

  let expression = '^'
  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index] ?? ''
    if (character === '*') {
      if (normalized[index + 1] === '*') {
        while (normalized[index + 1] === '*') index += 1
        if (normalized[index + 1] === '/') {
          index += 1
          expression += '(?:.*/)?'
        } else {
          expression += '.*'
        }
      } else {
        expression += '[^/]*'
      }
    } else if (character === '?') {
      expression += '[^/]'
    } else {
      expression += escapeRegex(character)
    }
  }
  return new RegExp(`${expression}$`, 'u')
}

export function parseGlobInput(input: string): GlobCompilation {
  const candidates = input
    .split(/[\n,]/u)
    .map((pattern) => pattern.trim())
    .filter(Boolean)

  const patterns: string[] = []
  const errors: string[] = []
  if (candidates.length > MAX_GLOBS) {
    errors.push(`Sono consentiti al massimo ${MAX_GLOBS} pattern.`)
  }

  candidates.slice(0, MAX_GLOBS).forEach((pattern) => {
    try {
      globToRegExp(pattern)
      patterns.push(pattern)
    } catch (error) {
      errors.push(`${pattern}: ${error instanceof Error ? error.message : 'pattern non valido'}`)
    }
  })
  return { patterns, errors }
}

export function matchesGlob(path: string, pattern: string): boolean {
  let regex = regexCache.get(pattern)
  if (!regex) {
    regex = globToRegExp(pattern)
    if (regexCache.size >= CACHE_LIMIT) {
      const oldestKey = regexCache.keys().next().value
      if (typeof oldestKey === 'string') regexCache.delete(oldestKey)
    }
    regexCache.set(pattern, regex)
  }
  return regex.test(path)
}

export function matchesAnyGlob(path: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => matchesGlob(path, pattern))
}
