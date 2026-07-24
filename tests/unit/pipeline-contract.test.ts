import { PIPELINE_PHASES } from '../../src/core/pipeline/types'

it('keeps the mandated pipeline phases explicit and ordered', () => {
  expect(PIPELINE_PHASES).toHaveLength(17)
  expect(PIPELINE_PHASES[0]).toBe('acquisition')
  expect(PIPELINE_PHASES.at(-1)).toBe('download')
  expect(new Set(PIPELINE_PHASES).size).toBe(PIPELINE_PHASES.length)
})
