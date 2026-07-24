import { strToU8, zipSync } from 'fflate'
import { createPngFixture } from './media'

const xml = (value: string) => strToU8(value)

function coreProperties(title: string): Uint8Array {
  return xml(`<?xml version="1.0" encoding="UTF-8"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/">
  <dc:title>${title}</dc:title><dc:creator>Alice</dc:creator><dc:description>Local fixture</dc:description>
  <dcterms:created>2026-07-21T10:00:00Z</dcterms:created><dcterms:modified>2026-07-21T11:00:00Z</dcterms:modified>
</cp:coreProperties>`)
}

export function createDocxProductionFixture(options: { macroEnabled?: boolean; hostileXml?: boolean; includeImage?: boolean; imageReferences?: number } = {}): Uint8Array {
  const imageReferences = options.includeImage ? Math.max(1, options.imageReferences ?? 1) : 0
  const imageParagraphs = Array.from({ length: imageReferences }, (_, index) => `<w:p><w:r><w:drawing><wp:inline><wp:docPr id="${index + 1}" name="Fixture image ${index + 1}" descr="Local fixture image"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="image1.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdImage"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="9525" cy="9525"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`).join('\n')
  const documentXml = options.hostileXml
    ? '<?xml version="1.0"?><!DOCTYPE w:document [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>&xxe;</w:t></w:r></w:p></w:body></w:document>'
    : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>AI Bundle Studio DOCX</w:t></w:r></w:p>
    <w:p><w:r><w:t>Semantic paragraph with </w:t></w:r><w:hyperlink r:id="rIdLink"><w:r><w:t>unsafe link</w:t></w:r></w:hyperlink></w:p>
    <w:tbl><w:tr><w:tc><w:p><w:r><w:t>Name</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Value</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>Files</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>12</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
    ${imageParagraphs}
    <w:sectPr/>
  </w:body>
</w:document>`
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': xml(`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`),
    '_rels/.rels': xml(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`),
    'docProps/core.xml': coreProperties('DOCX fixture'),
    'word/document.xml': xml(documentXml),
    'word/_rels/document.xml.rels': xml(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdLink" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="javascript:alert(1)" TargetMode="External"/>${options.includeImage ? '<Relationship Id="rIdImage" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>' : ''}</Relationships>`),
  }
  if (options.includeImage) files['word/media/image1.png'] = createPngFixture()
  if (options.macroEnabled) files['word/vbaProject.bin'] = new Uint8Array([0, 1, 2, 3])
  return zipSync(files, { level: 6 })
}

export function createPptxProductionFixture(options: { macroEnabled?: boolean; advancedFeatures?: boolean; imageCount?: number } = {}): Uint8Array {
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': xml(`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/></Types>`),
    '_rels/.rels': xml(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`),
    'docProps/core.xml': coreProperties('PPTX fixture'),
    'ppt/presentation.xml': xml(`<?xml version="1.0" encoding="UTF-8"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId id="256" r:id="rId1"/><p:sldId id="257" r:id="rId2"/></p:sldIdLst></p:presentation>`),
    'ppt/_rels/presentation.xml.rels': xml(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/></Relationships>`),
    'ppt/slides/slide1.xml': xml(`<?xml version="1.0" encoding="UTF-8"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Launch plan</a:t></a:r></a:p><a:p><a:r><a:t>Local only processing</a:t></a:r></a:p></p:txBody></p:sp><a:graphic><a:graphicData><a:tbl><a:tr><a:tc><a:txBody><a:p><a:r><a:t>Phase</a:t></a:r></a:p></a:txBody></a:tc><a:tc><a:txBody><a:p><a:r><a:t>Status</a:t></a:r></a:p></a:txBody></a:tc></a:tr><a:tr><a:tc><a:txBody><a:p><a:r><a:t>008</a:t></a:r></a:p></a:txBody></a:tc><a:tc><a:txBody><a:p><a:r><a:t>Active</a:t></a:r></a:p></a:txBody></a:tc></a:tr></a:tbl></a:graphicData></a:graphic></p:spTree></p:cSld></p:sld>`),
    'ppt/slides/_rels/slide1.xml.rels': xml(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdNote" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide1.xml"/><Relationship Id="rIdImage" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/><Relationship Id="rIdExternal" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.invalid" TargetMode="External"/></Relationships>`),
    'ppt/notesSlides/notesSlide1.xml': xml(`<?xml version="1.0" encoding="UTF-8"?><p:notes xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Speaker note: emphasize privacy.</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:notes>`),
    'ppt/slides/slide2.xml': xml(`<?xml version="1.0" encoding="UTF-8"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Second slide</a:t></a:r></a:p><a:p><a:r><a:t>Summary</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`),
    'ppt/media/image1.png': createPngFixture(),
  }
  for (let index = 2; index <= (options.imageCount ?? 1); index += 1) {
    files[`ppt/media/image${index}.png`] = createPngFixture()
  }
  if (options.advancedFeatures) {
    files['ppt/charts/chart1.xml'] = xml('<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"/>')
    files['ppt/embeddings/object1.bin'] = new Uint8Array([9, 8, 7])
    files['ppt/media/video1.mp4'] = new Uint8Array([0, 0, 0, 20, 102, 116, 121, 112])
  }
  if (options.macroEnabled) files['ppt/vbaProject.bin'] = new Uint8Array([1, 2, 3])
  return zipSync(files, { level: 6 })
}
