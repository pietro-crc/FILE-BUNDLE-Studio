import { useEffect, useRef, useState } from 'react'
import { useProjectWorkflow } from './useProjectWorkflow'
import { UploadLanding } from '../features/landing/UploadLanding'
import { ProcessingView } from '../features/processing/ProcessingView'
import { ResultsDashboard } from '../features/results/ResultsDashboard'
import { Brand } from '../ui/Brand'
import { PrivacyStatus } from '../ui/PrivacyStatus'
import { ThemeSwitcher } from '../ui/ThemeSwitcher'
import { ErrorBoundary } from '../ui/ErrorBoundary'
import { Button } from '../ui/Button'
import { LegalFooter } from '../ui/LegalFooter'
import { LegalModal, type LegalTab } from '../ui/LegalModal'
import { Analytics } from '../ui/Analytics'
import './app.css'

export function App() {
  const workflow = useProjectWorkflow()
  const previousState = useRef(workflow.state)
  const [legalModalTab, setLegalModalTab] = useState<LegalTab>('privacy')
  const [isLegalOpen, setIsLegalOpen] = useState(false)

  const handleOpenLegal = (tab: LegalTab) => {
    setLegalModalTab(tab)
    setIsLegalOpen(true)
  }

  useEffect(() => {
    document.title = `AI Bundle Studio · ${
      workflow.state === 'idle'
        ? 'Browser-Only Ingestion'
        : workflow.state === 'processing'
        ? 'Processing in progress'
        : workflow.state === 'completed'
        ? 'Results'
        : 'Project Selection'
    }`

    if (previousState.current !== workflow.state) {
      window.scrollTo({ left: 0, top: 0, behavior: 'auto' })
      document.querySelector<HTMLElement>('[data-screen-heading]')?.focus()
      previousState.current = workflow.state
    }
  }, [workflow.state])

  const renderCurrentStateScreen = () => {
    switch (workflow.state) {
      case 'idle':
      case 'file-selected':
      case 'ready-to-process':
        return (
          <UploadLanding
            isBusy={false}
            onClear={workflow.resetAll}
            onError={(msg) => workflow.setErrorMessage(msg)}
            onImport={workflow.handleImport}
            onStartProcessing={() => void workflow.startProcessing()}
            snapshot={workflow.importSnapshot}
            statusMessage={workflow.statusMessage}
          />
        )

      case 'processing':
        return (
          <ProcessingView
            isProcessing={true}
            onCancel={workflow.cancelProcessing}
            phase={workflow.phase}
            progress={workflow.progress}
            statusMessage={workflow.statusMessage}
          />
        )

      case 'completed':
        return (
          <ResultsDashboard
            manifestArtifact={workflow.manifestArtifact}
            markdownSnapshot={workflow.markdownSnapshot}
            onNewProject={workflow.resetAll}
            projectBundle={workflow.projectBundle}
          />
        )

      case 'error':
        return (
          <div className="screen screen-error" data-screen-heading tabIndex={-1}>
            <div className="error-banner">
              <h2>An error occurred during processing</h2>
              <p>{workflow.errorMessage || 'Unexpected error.'}</p>
              <div className="error-banner__actions">
                <Button onClick={workflow.resetAll} variant="primary">
                  Return to Home
                </Button>
              </div>
            </div>
          </div>
        )
    }
  }

  const isViewportLocked =
    workflow.state === 'idle' ||
    workflow.state === 'file-selected' ||
    workflow.state === 'ready-to-process' ||
    workflow.state === 'processing' ||
    workflow.state === 'completed'

  return (
    <div
      className={`application-shell ${isViewportLocked ? 'application-shell--landing' : ''} ${
        workflow.state === 'completed' ? 'application-shell--results' : ''
      }`}
    >
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <header className="app-header">
        <Brand />
        <div className="app-header__tools">
          <PrivacyStatus />
          <ThemeSwitcher />
        </div>
      </header>

      <main className="app-main" id="main-content">
        <ErrorBoundary onReset={workflow.resetAll}>
          {renderCurrentStateScreen()}
        </ErrorBoundary>
      </main>

      <LegalFooter onOpenLegal={handleOpenLegal} />

      <LegalModal
        initialTab={legalModalTab}
        isOpen={isLegalOpen}
        onClose={() => setIsLegalOpen(false)}
      />

      <Analytics />
    </div>
  )
}
