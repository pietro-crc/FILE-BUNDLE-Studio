import { generateMarkdownBundle, type GenerateMarkdownOptions } from '../markdown/generate'
import type { ManifestArtifact } from '../manifest/types'
import type { VirtualFileSystem } from '../vfs/types'
import { renderDocumentsPdf } from './documents'
import { updateManifestWithDocuments } from './manifest-update'
import type { DocumentsPolicy, ProjectBundle } from './types'
import { validateDocumentsArtifact } from './validate'

export interface GenerateProjectOptions extends GenerateMarkdownOptions {
  readonly documentsPolicy?: Partial<DocumentsPolicy>
}

export async function generateProjectBundle(
  fileSystem: VirtualFileSystem,
  manifestArtifact: ManifestArtifact,
  options: GenerateProjectOptions = {},
): Promise<ProjectBundle> {
  const content = await generateMarkdownBundle(fileSystem, manifestArtifact, options)
  const draft = await renderDocumentsPdf(content.manifest, content.markdown, options.documentsPolicy)
  const manifest = updateManifestWithDocuments(content.manifest, draft)
  const validation = validateDocumentsArtifact(draft, manifest)
  return { markdown: content.markdown, documents: { ...draft, validation }, manifest }
}
