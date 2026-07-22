import { WORKFLOW_STEPS, type WorkflowStepId } from '../app/workflow'

interface WorkflowNavigationProps {
  activeStep: WorkflowStepId
  onStepChange: (step: WorkflowStepId) => void
}

export function WorkflowNavigation({ activeStep, onStepChange }: WorkflowNavigationProps) {
  return (
    <nav aria-label="Fasi di AI Bundle Studio" className="workflow-navigation">
      <p className="workflow-navigation__label">Flusso di lavoro</p>
      <ol className="workflow-navigation__list">
        {WORKFLOW_STEPS.map((step) => {
          const isActive = step.id === activeStep

          return (
            <li key={step.id}>
              <button
                aria-current={isActive ? 'step' : undefined}
                className="workflow-navigation__button"
                onClick={() => onStepChange(step.id)}
                type="button"
              >
                <span className="workflow-navigation__number" aria-hidden="true">
                  {step.number}
                </span>
                <span className="workflow-navigation__copy">
                  <strong>{step.label}</strong>
                  <span>{step.description}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
      <p className="workflow-navigation__note">Anteprima della shell · Le funzioni vengono abilitate nei prossimi step.</p>
    </nav>
  )
}
