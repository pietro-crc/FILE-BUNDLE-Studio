const FORBIDDEN_XML = /<!DOCTYPE|<!ENTITY/iu

export function parseXmlDocument(xml: string, label: string): XMLDocument {
  if (FORBIDDEN_XML.test(xml)) throw new Error(`${label}: DTD ed entità XML non sono consentite.`)
  if (typeof DOMParser === 'undefined') throw new Error(`${label}: DOMParser non disponibile nell’ambiente corrente.`)
  const document = new DOMParser().parseFromString(xml, 'application/xml')
  const parserError = [...document.getElementsByTagName('*')].find((node) => node.localName === 'parsererror')
  if (parserError) throw new Error(`${label}: XML non valido.`)
  return document
}

export function elementsByLocalName(parent: Document | Element, localName: string): Element[] {
  return [...parent.getElementsByTagName('*')].filter((element) => element.localName === localName)
}

export function firstByLocalName(parent: Document | Element, localName: string): Element | null {
  return elementsByLocalName(parent, localName)[0] ?? null
}

export function directChildrenByLocalName(parent: Element, localName: string): Element[] {
  return [...parent.children].filter((element) => element.localName === localName)
}

export function textContentNormalized(element: Element | null): string {
  return element?.textContent?.replaceAll('\r\n', '\n').replaceAll('\r', '\n') ?? ''
}
