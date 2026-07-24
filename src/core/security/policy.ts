import type { SecretScanPolicy } from './types'

export const SECRET_SCAN_POLICY_MAXIMUMS = {
  maxCharactersPerFile: 10_000_000,
  maxFindingsPerFile: 1_000,
  maxCandidateLength: 4_096,
  minHighEntropyLength: 4_096,
} as const

export const DEFAULT_SECRET_SCAN_POLICY: SecretScanPolicy = {
  maxCharactersPerFile: 2_000_000,
  maxFindingsPerFile: 100,
  maxCandidateLength: 512,
  minHighEntropyLength: 24,
  highEntropyThreshold: 4.2,
  scanHighEntropy: true,
}

export function createSecretScanPolicy(overrides?: Partial<SecretScanPolicy>): SecretScanPolicy {
  const policy = { ...DEFAULT_SECRET_SCAN_POLICY, ...overrides }
  const integerKeys: readonly (keyof Pick<SecretScanPolicy, 'maxCharactersPerFile' | 'maxFindingsPerFile' | 'maxCandidateLength' | 'minHighEntropyLength'>)[] = [
    'maxCharactersPerFile',
    'maxFindingsPerFile',
    'maxCandidateLength',
    'minHighEntropyLength',
  ]
  integerKeys.forEach((key) => {
    if (!Number.isSafeInteger(policy[key]) || policy[key] < 1) throw new RangeError(`${key} deve essere un intero positivo.`)
    if (policy[key] > SECRET_SCAN_POLICY_MAXIMUMS[key]) throw new RangeError(`${key} supera il limite massimo di ${SECRET_SCAN_POLICY_MAXIMUMS[key]}.`)
  })
  if (!Number.isFinite(policy.highEntropyThreshold) || policy.highEntropyThreshold < 1 || policy.highEntropyThreshold > 8) {
    throw new RangeError('highEntropyThreshold deve essere compreso tra 1 e 8.')
  }
  if (policy.minHighEntropyLength > policy.maxCandidateLength) {
    throw new RangeError('minHighEntropyLength non può superare maxCandidateLength.')
  }
  return policy
}
