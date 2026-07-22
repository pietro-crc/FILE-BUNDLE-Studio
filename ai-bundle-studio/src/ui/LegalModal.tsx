import { useEffect, useState } from 'react'
import { Button } from './Button'

export type LegalTab = 'privacy' | 'terms'

interface LegalModalProps {
  readonly isOpen: boolean
  readonly initialTab?: LegalTab
  readonly onClose: () => void
}

export function LegalModal({ isOpen, initialTab = 'privacy', onClose }: LegalModalProps) {
  const [activeTab, setActiveTab] = useState<LegalTab>(initialTab)

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="legal-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="legal-modal-title">
      <div className="legal-modal" onClick={(e) => e.stopPropagation()}>
        <header className="legal-modal__header">
          <div className="legal-modal__title-group">
            <h2 id="legal-modal-title" className="legal-modal__title">Legal & Compliance</h2>
            <div className="legal-modal__tabs" role="tablist">
              <button
                aria-selected={activeTab === 'privacy'}
                className={`legal-tab-btn ${activeTab === 'privacy' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('privacy')}
                role="tab"
                type="button"
              >
                Privacy Policy
              </button>
              <button
                aria-selected={activeTab === 'terms'}
                className={`legal-tab-btn ${activeTab === 'terms' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('terms')}
                role="tab"
                type="button"
              >
                Terms of Service
              </button>
            </div>
          </div>

          <Button onClick={onClose} variant="secondary" className="legal-close-btn">
            ← Close
          </Button>
        </header>

        <div className="legal-modal__body">
          {activeTab === 'privacy' ? (
            <div className="legal-document">
              <h3>Privacy Policy & Local Data Guarantee</h3>
              <p className="legal-effective-date">Effective Date: July 2026</p>

              <h4>1. 100% Client-Side Processing Architecture</h4>
              <p>
                AI Bundle Studio is engineered with a strict <strong>Privacy-First Architecture</strong>. All file parsing, code ingestion, Virtual File System operations, Markdown recombining, and PDF generation occur <strong>100% locally inside your web browser</strong> via Web Workers and WebAssembly.
              </p>
              <p>
                <strong>Zero File Uploads:</strong> No source code, text files, document content, or generated artifacts are ever transmitted to or stored on external servers or third-party cloud infrastructure.
              </p>

              <h4>2. Server Access Logs</h4>
              <p>
                When you visit the application, the web hosting network (e.g., Cloudflare / Vercel) automatically processes standard technical HTTP server logs (such as your IP address, browser user-agent, and requested page assets) solely for technical delivery, network security, and DDoS mitigation. These technical network logs are not tied to your processed files.
              </p>

              <h4>3. Cookies and Local Storage</h4>
              <p>
                AI Bundle Studio uses <strong>zero tracking or profiling cookies</strong> (no Google Analytics, Meta Pixels, or third-party marketing scripts). The application only utilizes browser <code>localStorage</code> to persist your preferred theme (Light/Dark/System). This is a strictly technical preference storage exempt from consent banner requirements under the ePrivacy Directive and GDPR.
              </p>

              <h4>4. Data Subject Rights (GDPR)</h4>
              <p>
                Because your files remain strictly within your local browser runtime memory, you retain total control over your data. Closing or refreshing your browser tab immediately purges all transient session files from memory.
              </p>
            </div>
          ) : (
            <div className="legal-document">
              <h3>Terms of Service & Disclaimer</h3>
              <p className="legal-effective-date">Effective Date: July 2026</p>

              <h4>1. Software License & Provided "AS IS"</h4>
              <p>
                AI Bundle Studio is provided on an "AS IS" and "AS AVAILABLE" basis without warranties of any kind, whether express or implied. The publisher makes no guarantees regarding uninterrupted availability, accuracy of generated document structure, or fitness for a particular purpose.
              </p>

              <h4>2. Intellectual Property & Code Ownership</h4>
              <p>
                <strong>You retain 100% ownership</strong> and copyright of all source code, text, spreadsheets, documents, and assets you process through AI Bundle Studio. The application publisher claims zero ownership, license rights, or implied rights over any user content ingested or synthesized by the tool.
              </p>

              <h4>3. Limitation of Liability</h4>
              <p>
                In no event shall the publisher or contributors be liable for any direct, indirect, incidental, or consequential damages (including data loss, code corruption, or misuse of generated bundles with third-party Large Language Model APIs). Users assume full responsibility for verifying generated Markdown and PDF bundles prior to commercial or production use.
              </p>

              <h4>4. Governing Law</h4>
              <p>
                These terms are governed by and construed in accordance with European Union web e-commerce regulations and local laws.
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
