import type { ImportIssue, InputSource, VirtualDirectory, VirtualFileSystem, VirtualNode } from './types'

export interface VirtualNodeSnapshot {
  readonly id: string
  readonly name: string
  readonly normalizedPath: string
  readonly kind: 'file' | 'directory'
  readonly size?: number
  readonly children?: readonly VirtualNodeSnapshot[]
}

export interface ImportSessionSnapshot {
  readonly source: InputSource
  readonly fileCount: number
  readonly directoryCount: number
  readonly totalBytes: number
  readonly sourceBytes: number
  readonly root: VirtualNodeSnapshot
  readonly issues: readonly ImportIssue[]
}

function snapshotNode(node: VirtualNode): VirtualNodeSnapshot {
  if (node.kind === 'file') {
    return {
      id: node.id,
      name: node.name,
      normalizedPath: node.normalizedPath,
      kind: 'file',
      size: node.size,
    }
  }

  return snapshotDirectory(node)
}

function snapshotDirectory(directory: VirtualDirectory): VirtualNodeSnapshot {
  return {
    id: directory.id,
    name: directory.name,
    normalizedPath: directory.normalizedPath,
    kind: 'directory',
    children: directory.children.map(snapshotNode),
  }
}

export function createImportSessionSnapshot(
  fileSystem: VirtualFileSystem,
  issues: readonly ImportIssue[],
): ImportSessionSnapshot {
  return {
    source: fileSystem.summary.source,
    fileCount: fileSystem.summary.fileCount,
    directoryCount: fileSystem.summary.directoryCount,
    totalBytes: fileSystem.summary.totalBytes,
    sourceBytes: fileSystem.summary.sourceBytes,
    root: snapshotDirectory(fileSystem.root),
    issues,
  }
}
