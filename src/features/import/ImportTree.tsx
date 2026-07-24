import type { VirtualNodeSnapshot } from '../../core/vfs/snapshot'

const MAX_VISIBLE_NODES = 300

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unitIndex = -1
  do {
    value /= 1024
    unitIndex += 1
  } while (value >= 1024 && unitIndex < units.length - 1)
  return `${value.toLocaleString('it-IT', { maximumFractionDigits: value >= 10 ? 1 : 2 })} ${units[unitIndex]}`
}

interface RenderBudget {
  count: number
  truncated: boolean
}

function TreeNode({ budget, node }: { readonly budget: RenderBudget; readonly node: VirtualNodeSnapshot }) {
  if (budget.count >= MAX_VISIBLE_NODES) {
    budget.truncated = true
    return null
  }
  budget.count += 1

  if (node.kind === 'file') {
    return (
      <li className="vfs-tree__file">
        <span aria-hidden="true">·</span>
        <span>{node.name}</span>
        <small>{formatBytes(node.size ?? 0)}</small>
      </li>
    )
  }

  return (
    <li className="vfs-tree__directory">
      <details open={node.normalizedPath === ''}>
        <summary>
          <span>{node.name}</span>
          <small>{node.children?.length ?? 0} elementi</small>
        </summary>
        <ul>
          {node.children?.map((child) => <TreeNode budget={budget} key={child.id} node={child} />)}
        </ul>
      </details>
    </li>
  )
}

export function ImportTree({ root }: { readonly root: VirtualNodeSnapshot }) {
  const budget: RenderBudget = { count: 0, truncated: false }

  return (
    <section className="vfs-panel" aria-labelledby="vfs-tree-title">
      <div className="vfs-panel__header">
        <div>
          <p className="eyebrow">Virtual filesystem</p>
          <h2 id="vfs-tree-title">Struttura normalizzata</h2>
        </div>
        <span>Anteprima locale</span>
      </div>
      <ul className="vfs-tree">
        <TreeNode budget={budget} node={root} />
      </ul>
      {budget.truncated ? (
        <p className="vfs-panel__note">Anteprima limitata ai primi {MAX_VISIBLE_NODES} nodi per mantenere reattiva l’interfaccia.</p>
      ) : null}
    </section>
  )
}
