import type { InputSource, VirtualDirectory, VirtualFile, VirtualNode } from './types'

export interface VirtualDirectorySeed {
  readonly path: string
  readonly normalizedPath: string
  readonly name: string
  readonly source: InputSource
}

interface MutableDirectory {
  readonly id: string
  readonly path: string
  readonly normalizedPath: string
  readonly name: string
  readonly kind: 'directory'
  readonly source: InputSource | 'virtual'
  readonly children: Map<string, MutableDirectory | VirtualFile>
}

function directoryId(path: string): string {
  return path.length === 0 ? 'directory:root' : `directory:${path}`
}

function createMutableDirectory(
  path: string,
  normalizedPath: string,
  name: string,
  source: InputSource | 'virtual',
): MutableDirectory {
  return {
    id: directoryId(normalizedPath),
    path,
    normalizedPath,
    name,
    kind: 'directory',
    source,
    children: new Map(),
  }
}

function ensureDirectory(root: MutableDirectory, seed: VirtualDirectorySeed): MutableDirectory {
  const segments = seed.normalizedPath.split('/')
  let currentDirectory = root

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]
    if (!segment) {
      continue
    }
    const normalizedPath = segments.slice(0, index + 1).join('/')
    const existing = currentDirectory.children.get(segment)

    if (existing?.kind === 'directory') {
      currentDirectory = existing
      continue
    }

    const isExplicitDirectory = index === segments.length - 1
    const directory = createMutableDirectory(
      isExplicitDirectory ? seed.path : normalizedPath,
      normalizedPath,
      segment,
      seed.source,
    )
    currentDirectory.children.set(segment, directory)
    currentDirectory = directory
  }

  return currentDirectory
}

function freezeDirectory(directory: MutableDirectory): VirtualDirectory {
  const children = [...directory.children.values()]
    // eslint-disable-next-line unicorn/no-array-sort -- The array is a fresh copy and ES2022 lacks toSorted.
    .sort((left, right) => {
      if (left.kind !== right.kind) {
        return left.kind === 'directory' ? -1 : 1
      }
      return left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' })
    })
    .map((child): VirtualNode => (child.kind === 'directory' ? freezeDirectory(child) : child))

  return {
    id: directory.id,
    path: directory.path,
    normalizedPath: directory.normalizedPath,
    name: directory.name,
    kind: 'directory',
    source: directory.source,
    children,
  }
}

export function buildVirtualTree(
  files: readonly VirtualFile[],
  explicitDirectories: readonly VirtualDirectorySeed[] = [],
): {
  readonly root: VirtualDirectory
  readonly directories: readonly VirtualDirectory[]
} {
  const root = createMutableDirectory('', '', 'Progetto', 'virtual')

  const sortedDirectories = [...explicitDirectories]
    // eslint-disable-next-line unicorn/no-array-sort -- The array is a fresh copy and ES2022 lacks toSorted.
    .sort((left, right) => left.normalizedPath.split('/').length - right.normalizedPath.split('/').length)
  sortedDirectories.forEach((directory) => ensureDirectory(root, directory))

  for (const file of files) {
    const segments = file.normalizedPath.split('/')
    const parentPath = segments.slice(0, -1).join('/')
    const parentDirectory = parentPath
      ? ensureDirectory(root, {
          path: parentPath,
          normalizedPath: parentPath,
          name: segments.at(-2) ?? parentPath,
          source: file.source,
        })
      : root
    parentDirectory.children.set(file.name, file)
  }

  const frozenRoot = freezeDirectory(root)
  const directories: VirtualDirectory[] = []

  const visit = (node: VirtualNode): void => {
    if (node.kind !== 'directory') {
      return
    }
    directories.push(node)
    node.children.forEach(visit)
  }
  visit(frozenRoot)

  return { root: frozenRoot, directories }
}
