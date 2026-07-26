import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import type { ManifestArtifact } from '../../src/core/manifest/types'
import type { MarkdownPart } from '../../src/core/markdown/types'
import type { ProjectBundle } from '../../src/core/output/types'
import { prepareMarkdownDownload, prepareProjectPackage } from '../../src/features/results/downloads'

const parts: readonly MarkdownPart[] = [
  {
    name: 'demo-content.part-001.md',
    content: '# Part one',
    byteLength: 10,
    anchors: [],
  },
  {
    name: 'demo-content.part-002.md',
    content: '# Part two',
    byteLength: 10,
    anchors: [],
  },
]

describe('results download preparation', () => {
  it('downloads one Markdown part directly with its declared artifact name', () => {
    const result = prepareMarkdownDownload('demo', [parts[0]!])

    expect(result.filename).toBe('demo-content.part-001.md')
    expect(result.mediaType).toContain('text/markdown')
    expect(strFromU8(result.bytes)).toBe('# Part one')
  })

  it('preserves multipart Markdown filenames in a dedicated ZIP', () => {
    const result = prepareMarkdownDownload('demo', parts)
    const files = unzipSync(result.bytes)

    expect(result.filename).toBe('demo-markdown-parts.zip')
    expect(Object.keys(files).sort()).toEqual([
      'demo-content.part-001.md',
      'demo-content.part-002.md',
    ])
    expect(strFromU8(files['demo-content.part-002.md']!)).toBe('# Part two')
  })

  it('keeps every declared Markdown part separate in the complete package', () => {
    const projectBundle = {
      markdown: { parts },
      documents: {
        name: 'demo-documents.pdf',
        bytes: new Uint8Array([37, 80, 68, 70]),
      },
    } as unknown as ProjectBundle
    const manifestArtifact = {
      json: '{"projectName":"demo"}',
    } as unknown as ManifestArtifact

    const result = prepareProjectPackage('demo', projectBundle, manifestArtifact)
    const files = unzipSync(result.bytes)

    expect(Object.keys(files).sort()).toEqual([
      'demo-content.part-001.md',
      'demo-content.part-002.md',
      'demo-documents.pdf',
      'demo-manifest.json',
    ])
    expect(files['demo-content.part-001.md']).toBeDefined()
    expect(files['demo-content.part-002.md']).toBeDefined()
    expect(files['demo_bundle.md']).toBeUndefined()
  })
})
