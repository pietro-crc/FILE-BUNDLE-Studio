import { classifyFileSample } from '../../src/core/preflight/classify'
import { detectFileSignature } from '../../src/core/preflight/signatures'
import { inspectTextSample } from '../../src/core/preflight/text'
import type { VirtualFile } from '../../src/core/vfs/types'

function fileStub(overrides: Partial<VirtualFile> = {}): VirtualFile {
  return {
    id: 'file:1',
    path: 'sample.bin',
    normalizedPath: 'sample.bin',
    name: 'sample.bin',
    extension: 'bin',
    kind: 'file',
    size: 8,
    source: 'file-picker',
    status: 'pending',
    warnings: [],
    errors: [],
    bytes: { size: 8, read: async () => new ArrayBuffer(0), readPrefix: async () => new ArrayBuffer(0), dispose() {} },
    ...overrides,
  }
}

describe('preflight classification', () => {
  it('recognizes common binary signatures without trusting the extension', () => {
    expect(detectFileSignature(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]))).toMatchObject({ mime: 'application/pdf' })
    expect(detectFileSignature(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toMatchObject({ mime: 'image/png' })
    expect(detectFileSignature(new Uint8Array([0x4d, 0x5a, 0, 0]))).toMatchObject({ executable: true })
  })

  it('treats valid UTF-8 and BOM variants as text while rejecting null-heavy binary samples', () => {
    expect(inspectTextSample(new TextEncoder().encode('ciao\nmondo'))).toMatchObject({ isText: true, encoding: 'utf-8' })
    expect(inspectTextSample(new Uint8Array([0xef, 0xbb, 0xbf, 0x61]))).toMatchObject({ isText: true, encoding: 'utf-8-bom' })
    expect(inspectTextSample(new Uint8Array([0x00, 0x01, 0x02]))).toEqual({ isText: false })
  })

  it('refines OOXML ZIP containers using the extension but blocks executable signatures', () => {
    const zipHeader = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0])
    const docx = classifyFileSample(fileStub({ name: 'report.docx', extension: 'docx' }), zipHeader)
    expect(docx).toMatchObject({ mimeDetected: expect.stringContaining('wordprocessingml'), detectionMethod: 'container-extension' })

    const disguised = classifyFileSample(fileStub({ name: 'notes.txt', extension: 'txt' }), new Uint8Array([0x4d, 0x5a, 0, 0]))
    expect(disguised.descriptor).toMatchObject({ level: 'E', executable: true })
  })

  it('does not trust a text extension when the bounded sample is binary', () => {
    const result = classifyFileSample(
      fileStub({ name: 'payload.txt', extension: 'txt' }),
      new Uint8Array([0x01, 0x00, 0x02, 0x03]),
    )

    expect(result).toMatchObject({ mimeDetected: 'application/octet-stream', detectionMethod: 'unknown', isText: false })
    expect(result.descriptor.level).toBe('D')
  })
})
