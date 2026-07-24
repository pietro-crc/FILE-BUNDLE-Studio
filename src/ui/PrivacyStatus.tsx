import { NETWORK_POLICY } from '../core/security/network-policy'

export function PrivacyStatus() {
  const isLocalOnly = !NETWORK_POLICY.userContentUploads

  return (
    <div className="privacy-status" role="status" aria-label="Privacy status">
      <span className="privacy-status__indicator" aria-hidden="true">
        <span className="privacy-status__dot" />
        <span className="privacy-status__ping" />
      </span>
      <div className="privacy-status__content">
        <strong className="privacy-status__badge">
          {isLocalOnly ? 'LOCAL ONLY' : 'NETWORK ENABLED'}
        </strong>
        {isLocalOnly && (
          <>
            <span className="privacy-status__dot-sep" aria-hidden="true">•</span>
            <span className="privacy-status__detail">No files leave your browser</span>
          </>
        )}
      </div>
    </div>
  )
}
