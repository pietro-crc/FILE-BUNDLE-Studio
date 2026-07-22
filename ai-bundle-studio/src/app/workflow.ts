export const WORKFLOW_STEPS = [
  {
    id: 'introduction',
    number: '01',
    label: 'Introduzione',
    shortLabel: 'Inizio',
    description: 'Scopo, privacy e limiti del prodotto.',
  },
  {
    id: 'import',
    number: '02',
    label: 'Importazione',
    shortLabel: 'Importa',
    description: 'ZIP, cartelle e file locali.',
  },
  {
    id: 'preflight',
    number: '03',
    label: 'Preflight',
    shortLabel: 'Analizza',
    description: 'Inventario, rischi e capacità.',
  },
  {
    id: 'configuration',
    number: '04',
    label: 'Configurazione',
    shortLabel: 'Configura',
    description: 'Modalità, limiti e strategie.',
  },
  {
    id: 'processing',
    number: '05',
    label: 'Elaborazione',
    shortLabel: 'Elabora',
    description: 'Pipeline, progresso e annullamento.',
  },
  {
    id: 'results',
    number: '06',
    label: 'Risultati',
    shortLabel: 'Scarica',
    description: 'Output, validazione e report.',
  },
] as const

export type WorkflowStep = (typeof WORKFLOW_STEPS)[number]
export type WorkflowStepId = WorkflowStep['id']

export function getWorkflowStep(stepId: WorkflowStepId): WorkflowStep {
  const step = WORKFLOW_STEPS.find(({ id }) => id === stepId)

  if (!step) {
    throw new Error(`Unknown workflow step: ${stepId}`)
  }

  return step
}
