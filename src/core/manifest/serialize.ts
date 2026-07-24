import type { ManifestV1 } from './types'

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableValue)
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        // eslint-disable-next-line unicorn/no-array-sort -- Fresh key array; ES2022 lacks toSorted.
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableValue(item)]),
    )
  }
  return value
}

export function serializeManifestV1(manifest: ManifestV1): string {
  return `${JSON.stringify(stableValue(manifest), null, 2)}\n`
}
