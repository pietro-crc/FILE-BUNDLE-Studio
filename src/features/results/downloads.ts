import { strToU8, zipSync } from 'fflate'
import type { ManifestArtifact } from '../../core/manifest/types'
import type { MarkdownPart } from '../../core/markdown/types'
import type { ProjectBundle } from '../../core/output/types'

export interface PreparedDownload {
  readonly bytes: Uint8Array
  readonly filename: string
  readonly mediaType: string
}

function zipEntries(entries: Readonly<Record<string, Uint8Array>>): Uint8Array {
  if (Object.keys(entries).length === 0) {
    throw new Error('No generated output is available for download.')
  }
  return zipSync(entries)
}

export function prepareMarkdownDownload(
  projectName: string,
  parts: readonly MarkdownPart[],
): PreparedDownload {
  if (parts.length === 0) {
    throw new Error('No Markdown output is available for download.')
  }

  if (parts.length === 1) {
    const part = parts[0]!
    return {
      bytes: strToU8(part.content),
      filename: part.name,
      mediaType: 'text/markdown;charset=utf-8',
    }
  }

  const entries = Object.fromEntries(parts.map((part) => [part.name, strToU8(part.content)]))
  return {
    bytes: zipEntries(entries),
    filename: `${projectName}-markdown-parts.zip`,
    mediaType: 'application/zip',
  }
}

export function prepareProjectPackage(
  projectName: string,
  projectBundle: ProjectBundle,
  manifestArtifact: ManifestArtifact,
): PreparedDownload {
  const entries: Record<string, Uint8Array> = {}

  projectBundle.markdown.parts.forEach((part) => {
    entries[part.name] = strToU8(part.content)
  })
  entries[projectBundle.documents.name] = new Uint8Array(projectBundle.documents.bytes)
  entries[`${projectName}-manifest.json`] = strToU8(manifestArtifact.json)

  return {
    bytes: zipEntries(entries),
    filename: `${projectName}-package.zip`,
    mediaType: 'application/zip',
  }
}
