import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from './Button'

interface ErrorBoundaryProps {
  readonly children: ReactNode
  readonly onReset: () => void
}

interface ErrorBoundaryState {
  readonly failed: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { failed: false }

  public static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true }
  }

  public componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Deliberately do not log exception details: parsed content and paths may be sensitive.
  }

  private reset = (): void => {
    this.setState({ failed: false })
    this.props.onReset()
  }

  public render(): ReactNode {
    if (!this.state.failed) return this.props.children
    return (
      <section className="error-boundary" role="alert" aria-labelledby="error-boundary-title">
        <p className="eyebrow">Errore isolato</p>
        <h1 id="error-boundary-title" tabIndex={-1}>La schermata corrente non può essere mostrata.</h1>
        <p>I dettagli tecnici non vengono registrati per evitare di esporre nomi o contenuti dei file. Il progetto in memoria verrà rilasciato tornando all’inizio.</p>
        <Button onClick={this.reset}>Azzera la sessione locale</Button>
      </section>
    )
  }
}
