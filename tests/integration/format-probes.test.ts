import { runDocxProbe, runXlsxProbe, runZipProbe } from '../../spikes/browser/probes'

describe('STEP-000 non-rendering format feasibility', () => {
  it('passes ZIP, DOCX, and XLSX probes in the test DOM', async () => {
    const results = [runZipProbe(), await runDocxProbe(), runXlsxProbe()]

    expect(results.map((result) => result.id)).toEqual(['zip', 'docx', 'xlsx'])
    expect(results.every((result) => result.ok)).toBe(true)
  }, 20_000)
})
