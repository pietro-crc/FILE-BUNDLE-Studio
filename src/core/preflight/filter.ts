import type { CapabilityLevel } from '../vfs/types'
import { matchesAnyGlob } from './glob'
import type { PreflightFileRecord, PreflightSelection, RiskLevel } from './types'

export interface PreflightViewFilter {
  readonly query: string
  readonly capability: CapabilityLevel | 'all'
  readonly risk: RiskLevel | 'all'
  readonly selection: PreflightSelection
  readonly selectedOnly: boolean
}

export function isFileSelected(record: PreflightFileRecord, selection: PreflightSelection): boolean {
  return record.defaultIncluded &&
    !selection.excludedFileIds.has(record.fileId) &&
    !matchesAnyGlob(record.path, selection.exclusionGlobs)
}

export function filterPreflightFiles(
  records: readonly PreflightFileRecord[],
  filter: PreflightViewFilter,
): readonly PreflightFileRecord[] {
  const query = filter.query.trim().toLocaleLowerCase('it-IT')
  return records.filter((record) => {
    const selected = isFileSelected(record, filter.selection)
    return (!query || record.path.toLocaleLowerCase('it-IT').includes(query)) &&
      (filter.capability === 'all' || record.capabilityLevel === filter.capability) &&
      (filter.risk === 'all' || record.riskLevel === filter.risk) &&
      (!filter.selectedOnly || selected)
  })
}
