export interface SanitizedOfficeHtml {
  readonly html: string
  readonly markdown: string
  readonly plainText: string
  readonly imageCount: number
  readonly removedElements: number
  readonly removedAttributes: number
  readonly warnings: readonly string[]
}

const ALLOWED = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'sup', 'sub', 'br', 'hr', 'blockquote', 'code', 'pre', 'span', 'div', 'img'])
const DROP_WITH_CONTENT = new Set(['script', 'style', 'iframe', 'object', 'embed', 'form', 'meta', 'link', 'svg', 'math', 'template'])
const SAFE_DATA_IMAGE = /^data:image\/(?:png|jpeg|gif|webp|bmp);base64,[a-z0-9+/=]*$/iu
const SAFE_IMAGE_REFERENCE = /^ai-bundle-image:\d+$/u
const SAFE_LINK_TEXT = /^(?:https?:|mailto:|#)/iu

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}

function escapeMarkdown(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll(/([*_[\]`#|])/gu, '\\$1').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function normalizedText(node: Node): string {
  return (node.textContent ?? '').replaceAll('\r\n', '\n').replaceAll('\r', '\n').replaceAll(/[ \t]+/gu, ' ')
}

function serialize(node: Node): string {
  if (node.nodeType === 3) return escapeHtml(node.nodeValue ?? '')
  if (node.nodeType !== 1) return ''
  const element = node as Element
  const tag = element.localName.toLowerCase()
  const attributes = [...element.attributes].map((attribute) => ` ${attribute.name}="${escapeHtml(attribute.value)}"`).join('')
  if (tag === 'br' || tag === 'hr' || tag === 'img') return `<${tag}${attributes}>`
  return `<${tag}${attributes}>${[...element.childNodes].map(serialize).join('')}</${tag}>`
}

function tableMarkdown(table: Element): string {
  const rows = [...table.querySelectorAll('tr')].map((row) => [...row.querySelectorAll(':scope > th, :scope > td')].map((cell) => escapeMarkdown(normalizedText(cell).trim()).replaceAll('\n', '<br>')))
  if (rows.length === 0) return ''
  const width = Math.max(...rows.map((row) => row.length), 1)
  const normalized = rows.map((row) => [...row, ...Array.from({ length: width - row.length }, () => '')])
  const header = normalized[0] ?? Array.from({ length: width }, () => '')
  const body = normalized.slice(1)
  return [`| ${header.join(' | ')} |`, `| ${header.map(() => '---').join(' | ')} |`, ...body.map((row) => `| ${row.join(' | ')} |`)].join('\n')
}

function markdownNode(node: Node, depth = 0): string {
  if (node.nodeType === 3) return escapeMarkdown(node.nodeValue ?? '')
  if (node.nodeType !== 1) return ''
  const element = node as Element
  const tag = element.localName.toLowerCase()
  const children = [...element.childNodes].map((child) => markdownNode(child, depth + 1)).join('')
  if (/^h[1-6]$/u.test(tag)) return `${'#'.repeat(Number(tag[1]))} ${children.trim()}\n\n`
  if (tag === 'p' || tag === 'div') return `${children.trim()}\n\n`
  if (tag === 'strong' || tag === 'b') return `**${children}**`
  if (tag === 'em' || tag === 'i' || tag === 'u') return `*${children}*`
  if (tag === 's' || tag === 'del') return `~~${children}~~`
  if (tag === 'code' && element.parentElement?.localName !== 'pre') return `\`${children.replaceAll('`', '\\`')}\``
  if (tag === 'pre') return `\n~~~text\n${normalizedText(element).trim()}\n~~~\n\n`
  if (tag === 'br') return '\n'
  if (tag === 'hr') return '\n---\n\n'
  if (tag === 'blockquote') return `${normalizedText(element).split('\n').map((line) => `> ${escapeMarkdown(line)}`).join('\n')}\n\n`
  if (tag === 'li') return `${'  '.repeat(Math.max(0, depth - 2))}- ${children.trim()}\n`
  if (tag === 'ul' || tag === 'ol') return `${children}\n`
  if (tag === 'table') return `${tableMarkdown(element)}\n\n`
  if (tag === 'img') return `[Immagine: ${escapeMarkdown(element.getAttribute('alt') || 'senza descrizione')}]`
  if (tag === 'span' && element.hasAttribute('data-ai-bundle-link')) {
    const target = escapeMarkdown(element.getAttribute('data-ai-bundle-link') ?? '')
    return `${children}${target ? ` (destinazione: ${target})` : ''}`
  }
  return children
}

export function sanitizeOfficeHtml(source: string, maxHtmlCharacters: number): SanitizedOfficeHtml {
  if (typeof DOMParser === 'undefined') throw new Error('DOMParser non disponibile per la sanitizzazione Office.')
  const sourceDocument = new DOMParser().parseFromString(source, 'text/html')
  const outputDocument = document.implementation.createHTMLDocument('office-sanitized')
  let removedElements = 0
  let removedAttributes = 0
  let imageCount = 0

  const clean = (node: Node): Node[] => {
    if (node.nodeType === 3) return [outputDocument.createTextNode(node.nodeValue ?? '')]
    if (node.nodeType !== 1) return []
    const input = node as Element
    const tag = input.localName.toLowerCase()
    if (DROP_WITH_CONTENT.has(tag)) {
      removedElements += 1
      return []
    }
    if (tag === 'a') {
      const span = outputDocument.createElement('span')
      const href = input.getAttribute('href')?.trim() ?? ''
      if (href && SAFE_LINK_TEXT.test(href)) span.setAttribute('data-ai-bundle-link', href.slice(0, 2048))
      else if (href) removedAttributes += 1
      input.childNodes.forEach((child) => clean(child).forEach((cleaned) => span.append(cleaned)))
      return [span]
    }
    if (!ALLOWED.has(tag)) {
      removedElements += 1
      return [...input.childNodes].flatMap(clean)
    }
    const output = outputDocument.createElement(tag)
    for (const attribute of input.attributes) {
      const name = attribute.name.toLowerCase()
      const value = attribute.value
      if ((tag === 'td' || tag === 'th') && (name === 'colspan' || name === 'rowspan') && /^\d{1,3}$/u.test(value) && Number(value) > 0) output.setAttribute(name, value)
      else if (tag === 'img' && name === 'alt') output.setAttribute('alt', value.slice(0, 1000))
      else if (tag === 'img' && name === 'src' && SAFE_DATA_IMAGE.test(value) && value.length <= maxHtmlCharacters) output.setAttribute('src', value)
      else if (tag === 'img' && name === 'src' && SAFE_IMAGE_REFERENCE.test(value)) output.setAttribute('data-ai-bundle-image-ref', value.slice('ai-bundle-image:'.length))
      else removedAttributes += 1
    }
    if (tag === 'img') {
      imageCount += 1
      if (!output.hasAttribute('src')) output.setAttribute('data-ai-bundle-image-omitted', 'true')
    }
    input.childNodes.forEach((child) => clean(child).forEach((cleaned) => output.append(cleaned)))
    return [output]
  }

  sourceDocument.body.childNodes.forEach((node) => clean(node).forEach((cleaned) => outputDocument.body.append(cleaned)))
  let html = [...outputDocument.body.childNodes].map(serialize).join('')
  const warnings: string[] = []
  if (html.length > maxHtmlCharacters) {
    html = html.slice(0, maxHtmlCharacters)
    warnings.push(`HTML sanitizzato troncato a ${maxHtmlCharacters} caratteri.`)
  }
  const markdown = [...outputDocument.body.childNodes].map((node) => markdownNode(node)).join('').replaceAll(/\n{3,}/gu, '\n\n').trim()
  const plainText = normalizedText(outputDocument.body).replaceAll(/\n{3,}/gu, '\n\n').trim()
  if (removedElements > 0) warnings.push(`${removedElements} elementi HTML non consentiti rimossi o appiattiti.`)
  if (removedAttributes > 0) warnings.push(`${removedAttributes} attributi HTML non consentiti rimossi.`)
  return { html, markdown, plainText, imageCount, removedElements, removedAttributes, warnings }
}
