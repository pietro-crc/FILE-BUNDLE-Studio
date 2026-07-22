import type { LegalTab } from './LegalModal'

interface LegalFooterProps {
  readonly onOpenLegal: (tab: LegalTab) => void
}

export function LegalFooter({ onOpenLegal }: LegalFooterProps) {
  return (
    <footer className="app-footer-legal" role="contentinfo" aria-label="Legal & compliance footer">
      <div className="legal-footer__inner">
        <div className="legal-footer__copy">
          <span>© {new Date().getFullYear()} AI Bundle Studio</span>
          <span className="dot-separator">•</span>
          <span>100% In-Browser Local Processing</span>
        </div>

        <div className="legal-footer__links">
          <button
            className="legal-footer-link"
            onClick={() => onOpenLegal('privacy')}
            type="button"
          >
            Privacy Policy
          </button>
          <span className="dot-separator">•</span>
          <button
            className="legal-footer-link"
            onClick={() => onOpenLegal('terms')}
            type="button"
          >
            Terms of Service
          </button>
        </div>
      </div>
    </footer>
  )
}
