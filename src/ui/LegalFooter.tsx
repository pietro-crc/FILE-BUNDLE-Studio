import type { LegalTab } from './LegalModal'

interface LegalFooterProps {
  readonly onOpenLegal: (tab: LegalTab) => void
}

export function LegalFooter({ onOpenLegal }: LegalFooterProps) {
  return (
    <footer className="app-footer-legal" role="contentinfo" aria-label="Product and legal footer">
      <div className="legal-footer__inner">
        <div className="legal-footer__copy">
          <span>© {new Date().getFullYear()} AI Bundle Studio</span>
          <span className="dot-separator">•</span>
          <span>100% In-Browser Local Processing</span>
        </div>

        <nav className="legal-footer__links" aria-label="Product and legal links">
          <a className="legal-footer-link" href="/how-it-works/">How it works</a>
          <span className="dot-separator">•</span>
          <a className="legal-footer-link" href="/convert-zip-for-ai/">ZIP to AI</a>
          <span className="dot-separator">•</span>
          <a className="legal-footer-link" href="/combine-multiple-files-for-ai/">AI file-limit guide</a>
          <span className="dot-separator">•</span>
          <a className="legal-footer-link" href="/privacy/">Privacy</a>
          <span className="dot-separator">•</span>
          <button
            className="legal-footer-link"
            onClick={() => onOpenLegal('terms')}
            type="button"
          >
            Terms of Service
          </button>
        </nav>
      </div>
    </footer>
  )
}
