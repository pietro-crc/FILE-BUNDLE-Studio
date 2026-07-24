export const WORKFLOW_STEPS = [
  {
    id: 'introduction',
    number: '01',
    label: 'Introduction',
    shortLabel: 'Start',
    description: 'Purpose, privacy and scope of the studio.',
  },
  {
    id: 'import',
    number: '02',
    label: 'Import',
    shortLabel: 'Import',
    description: 'ZIP, folders and local files.',
  },
  {
    id: 'preflight',
    number: '03',
    label: 'Preflight',
    shortLabel: 'Analyze',
    description: 'Inventory, risks and capabilities.',
  },
  {
    id: 'configuration',
    number: '04',
    label: 'Configuration',
    shortLabel: 'Configure',
    description: 'Modes, limits and policies.',
  },
  {
    id: 'processing',
    number: '05',
    label: 'Processing',
    shortLabel: 'Process',
    description: 'Pipeline, progress and cancellation.',
  },
  {
    id: 'results',
    number: '06',
    label: 'Results',
    shortLabel: 'Download',
    description: 'Outputs, validation and report.',
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
