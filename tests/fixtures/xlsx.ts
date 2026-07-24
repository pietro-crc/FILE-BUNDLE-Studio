import { strToU8, zipSync } from 'fflate'

function xml(value: string): Uint8Array {
  return strToU8(value)
}

export function createSpreadsheetFixture(options: { macroEnabled?: boolean } = {}): Uint8Array {
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': xml(`<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
</Types>`),
    'xl/workbook.xml': xml(`<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <workbookPr date1904="0"/>
  <sheets>
    <sheet name="Data" sheetId="1" r:id="rId1"/>
    <sheet name="Hidden model" sheetId="2" state="veryHidden" r:id="rId2"/>
  </sheets>
  <definedNames><definedName name="Revenue" comment="Example">Data!$B$1:$B$2</definedName></definedNames>
</workbook>`),
    'xl/_rels/workbook.xml.rels': xml(`<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/externalLink" Target="https://example.invalid/data.xlsx" TargetMode="External"/>
</Relationships>`),
    'xl/sharedStrings.xml': xml(`<?xml version="1.0" encoding="UTF-8"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="2" uniqueCount="2">
  <si><t>=WEBSERVICE(&quot;https://example.invalid&quot;)</t></si>
  <si><t>Hello</t></si>
</sst>`),
    'xl/styles.xml': xml(`<?xml version="1.0" encoding="UTF-8"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/></numFmts>
  <cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="164" applyNumberFormat="1"/></cellXfs>
</styleSheet>`),
    'xl/worksheets/sheet1.xml': xml(`<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:H3"/>
  <cols><col min="3" max="3" hidden="1"/></cols>
  <sheetData>
    <row r="1">
      <c r="A1" t="s"><v>1</v></c>
      <c r="B1"><v>42</v></c>
      <c r="C1"><f>SUM(B1:B2)</f><v>50</v></c>
      <c r="D1" s="1"><v>45292</v></c>
      <c r="E1" t="s"><v>0</v></c>
      <c r="F1"><v>6</v></c><c r="G1"><v>7</v></c><c r="H1"><v>8</v></c>
    </row>
    <row r="2" hidden="1"><c r="B2"><v>8</v></c></row>
    <row r="3"><c r="A3" t="inlineStr"><is><t>Merged</t></is></c></row>
  </sheetData>
  <mergeCells count="1"><mergeCell ref="A3:B3"/></mergeCells>
</worksheet>`),
    'xl/worksheets/_rels/sheet1.xml.rels': xml(`<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="../comments1.xml"/>
</Relationships>`),
    'xl/comments1.xml': xml(`<?xml version="1.0" encoding="UTF-8"?>
<comments xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <authors><author>Alice</author></authors>
  <commentList><comment ref="B1" authorId="0"><text><t>Verified total</t></text></comment></commentList>
</comments>`),
    'xl/worksheets/sheet2.xml': xml(`<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:A1"/><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Secret assumptions</t></is></c></row></sheetData></worksheet>`),
    'xl/charts/chart1.xml': xml('<chart/>'),
    'xl/pivotCache/pivotCacheDefinition1.xml': xml('<pivotCacheDefinition/>'),
    'xl/externalLinks/externalLink1.xml': xml('<externalLink/>'),
    'xl/tables/table1.xml': xml('<table/>'),
    'xl/connections.xml': xml('<connections/>'),
    'xl/calcChain.xml': xml('<calcChain/>'),
  }
  if (options.macroEnabled) files['xl/vbaProject.bin'] = new Uint8Array([0, 1, 2, 3])
  return zipSync(files, { level: 6 })
}
