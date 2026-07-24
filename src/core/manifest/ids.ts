import { sha256Hex } from '../hash/sha256'
import type { ManifestNodeKind } from './types'

const ID_PREFIX: Readonly<Record<ManifestNodeKind, string>> = {
  directory: 'dir',
  file: 'file',
}

export async function createManifestNodeId(kind: ManifestNodeKind, normalizedPath: string): Promise<string> {
  const digest = await sha256Hex(`ai-bundle-studio\u0000manifest-v1\u0000${kind}\u0000${normalizedPath}`)
  return `${ID_PREFIX[kind]}_${digest}`
}
