import { useEffect, useRef, useState } from 'react'
import { Button } from './Button'

export type LegalTab = 'privacy' | 'terms'

interface LegalModalProps {
  readonly isOpen: boolean
  readonly initialTab?: LegalTab
  readonly onClose: () => void
}

export function LegalModal({ isOpen, initialTab = 'privacy', onClose }: LegalModalProps) {
  const [activeTab, setActiveTab] = useState<LegalTab>(initialTab)
  const modalRef = useRef<HTMLDivElement>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  useEffect(() => {
    if (!isOpen) return

    // Store trigger element to restore focus when closing
    previousActiveElement.current = document.activeElement as HTMLElement

    // Apply inert to main layout for accessibility
    const mainShell = document.querySelector('.application-shell')
    if (mainShell) {
      mainShell.setAttribute('aria-hidden', 'true')
    }

    // Set initial focus inside modal
    const focusTimer = setTimeout(() => {
      const firstFocusable = modalRef.current?.querySelector<HTMLElement>(
        'button, [tabindex]:not([tabindex="-1"])'
      )
      firstFocusable?.focus()
    }, 50)

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }

      // Focus trap implementation
      if (e.key === 'Tab' && modalRef.current) {
        const focusables = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        )
        if (focusables.length === 0) return

        const firstElement = focusables[0]
        const lastElement = focusables[focusables.length - 1]

        if (e.shiftKey) {
          if (firstElement && document.activeElement === firstElement) {
            e.preventDefault()
            lastElement?.focus()
          }
        } else {
          if (lastElement && document.activeElement === lastElement) {
            e.preventDefault()
            firstElement?.focus()
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      clearTimeout(focusTimer)
      window.removeEventListener('keydown', handleKeyDown)
      if (mainShell) {
        mainShell.removeAttribute('aria-hidden')
      }
      // Restore focus to trigger element
      if (previousActiveElement.current) {
        previousActiveElement.current.focus()
      }
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="legal-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-modal-title"
    >
      <div
        ref={modalRef}
        className="legal-modal"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <header className="legal-modal__header">
          <div className="legal-modal__title-group">
            <h2 id="legal-modal-title" className="legal-modal__title">
              Legal & Privacy Notice
            </h2>
            <div className="legal-modal__tabs" role="tablist" aria-label="Legal Documents">
              <button
                aria-selected={activeTab === 'privacy'}
                className={`legal-tab-btn ${activeTab === 'privacy' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('privacy')}
                role="tab"
                type="button"
                id="tab-privacy"
                aria-controls="panel-privacy"
              >
                Privacy Policy (GDPR)
              </button>
              <button
                aria-selected={activeTab === 'terms'}
                className={`legal-tab-btn ${activeTab === 'terms' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('terms')}
                role="tab"
                type="button"
                id="tab-terms"
                aria-controls="panel-terms"
              >
                Terms of Service
              </button>
            </div>
          </div>

          <Button onClick={onClose} variant="secondary" className="legal-close-btn" aria-label="Close legal notice window">
            ← Close
          </Button>
        </header>

        <div className="legal-modal__body">
          {activeTab === 'privacy' ? (
            <div className="legal-document" id="panel-privacy" role="tabpanel" aria-labelledby="tab-privacy">
              <h3>Privacy Policy & Data Processing Notice (GDPR Art. 13)</h3>
              <p className="legal-effective-date">Last Updated: July 2026</p>

              <h4>1. Nature of Project & Data Controller</h4>
              <p>
                AI Bundle Studio is a <strong>free, non-commercial, open-source personal project</strong> operated by an independent developer without a corporate entity, VAT registration, or commercial purpose.
              </p>
              <p>
                Under the GDPR, because the application does not collect, process, or store any personal data on remote servers—and all file processing occurs locally on the user's device—technical management is strictly limited to the client-side code delivered over the web. For technical communications or project inquiries, please refer to the official code repository.
              </p>

              <h4>2. 100% In-Browser Architecture & File Handling</h4>
              <p>
                AI Bundle Studio is engineered around strict <strong>Privacy by Design and Privacy by Default</strong> principles. All file parsing, code reading, text/image extraction, Virtual File System operations, and final Markdown/PDF document generation occur <strong>100% locally inside your browser runtime</strong> using standard web APIs (File API, DOMParser, Canvas API).
              </p>
              <p>
                <strong>Zero Uploads:</strong> No source files, code snippets, documents, or generated output artifacts are ever transmitted to, uploaded to, or stored on external servers, cloud providers, or third-party infrastructure.
              </p>

              <h4>3. Cloudflare Web Analytics (Cookie-Free Aggregate Metrics)</h4>
              <p>
                This website uses <strong>Cloudflare Web Analytics</strong> (provided by Cloudflare, Inc.) to collect privacy-friendly, aggregate traffic metrics (e.g., page visit counts, browser type, country of origin).
              </p>
              <p>
                <strong>ePrivacy & GDPR Compliance:</strong> Cloudflare Web Analytics operates <strong>without cookies, localStorage tokens, or persistent device identifiers</strong>. It performs no user profiling, cross-site tracking, or single-user identification. Under the ePrivacy Directive and local ePrivacy regulations, it does not require a consent banner.
              </p>
              <p>
                <strong>Legal Basis:</strong> Legitimate Interest (<em>GDPR Art. 6(1)(f)</em>) in monitoring web application stability and performance. Aggregate metrics are processed in accordance with the EU-U.S. Data Privacy Framework.
              </p>

              <h4>4. Server Network Logs & Infrastructure Security</h4>
              <p>
                Web hosting edge networks (e.g., Cloudflare / Vercel Edge Network) automatically process standard HTTP connection logs (such as temporary IP address, User-Agent, timestamp) solely to deliver application assets, maintain security, and mitigate DDoS attacks (Legal basis: <em>GDPR Art. 6(1)(f)</em>). These network logs are never linked to any files processed within your local browser.
              </p>

              <h4>5. Local Storage (localStorage)</h4>
              <p>
                The application uses browser <code>localStorage</code> exclusively to persist your interface theme preference (Light/Dark/System). This is a strictly technical preference storage exempt from consent requirements.
              </p>

              <h4>6. Data Subject Rights & Supervisory Authority</h4>
              <p>
                As a user, you hold the right to request access, rectification, erasure, restriction, or data portability, as well as object to processing where applicable (GDPR Arts. 15–22). Because your files remain strictly inside your browser's temporary memory, closing or refreshing your browser tab immediately and permanently purges all processed session data.
              </p>
              <p>
                You retain the right to lodge a complaint with your competent Data Protection Authority (e.g., the Italian <em>Garante per la Protezione dei Dati Personali</em> at <a href="https://www.garanteprivacy.it" target="_blank" rel="noopener noreferrer">www.garanteprivacy.it</a> or your local EU supervisory authority).
              </p>
            </div>
          ) : (
            <div className="legal-document" id="panel-terms" role="tabpanel" aria-labelledby="tab-terms">
              <h3>Terms of Service & Disclaimer</h3>
              <p className="legal-effective-date">Last Updated: July 2026</p>

              <h4>1. Scope of Service & "AS IS" License</h4>
              <p>
                AI Bundle Studio is a free utility provided on an "AS IS" and "AS AVAILABLE" basis without warranties of any kind, express or implied, to assist with organizing and converting local files into AI-readable format packages.
              </p>

              <h4>2. Intellectual Property & Content Ownership</h4>
              <p>
                <strong>You retain 100% sole ownership</strong> and copyright over all source code, documents, text, images, and assets processed through the application. The creator of AI Bundle Studio claims zero ownership, license rights, or implied rights over any user-provided content or generated output.
              </p>

              <h4>3. Consumer Protection Safeguard Clause</h4>
              <p>
                <strong>Mandatory Rights:</strong> Nothing in these Terms limits, excludes, or prejudices any non-waivable statutory rights guaranteed to consumers under applicable law, including EU Consumer Rights Directives and applicable local consumer protection acts.
              </p>

              <h4>4. Limitation of Liability & User Responsibility</h4>
              <p>
                This application is provided free of charge as an open-source tool. The developer assumes zero liability for:
              </p>
              <ul>
                <li>Any inaccuracies, text extraction errors, or formatting issues in generated output files.</li>
                <li>The contents of any files uploaded or processed locally by the user on their device.</li>
                <li>The use of generated packages with third-party Large Language Models or external AI services (including API fees, model hallucinations, or third-party data processing).</li>
                <li>Any direct, indirect, incidental, or consequential damages, data loss, or business interruption arising from the use of or inability to use the software.</li>
              </ul>
              <p>
                Users assume sole responsibility for reviewing and verifying the accuracy and security of generated files prior to production or commercial deployment.
              </p>

              <h4>5. Governing Law & Jurisdiction</h4>
              <p>
                These Terms are governed by Italian and European Union law. For consumers residing in the European Union, disputes shall be subject to the jurisdiction of the courts of the consumer's place of residence or domicile.
              </p>
            </div>
          )}
        </div>

        <footer className="legal-modal__footer">
          <Button onClick={onClose} variant="primary">
            Accept & Close
          </Button>
        </footer>
      </div>
    </div>
  )
}

