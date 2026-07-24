import { NETWORK_POLICY } from '../core/security/network-policy'

export function PrivacyStatus() {
  const isLocalOnly = !NETWORK_POLICY.userContentUploads

  return (
    <div className="privacy-status" role="status" aria-label="Privacy status">
      <span className="privacy-status__indicator" />
      <span className="privacy-status__text">
        {isLocalOnly ? 'LOCAL ONLY · No files leave your browser' : 'NETWORK ENABLED'}
      </span>
    </div>
  )
}
