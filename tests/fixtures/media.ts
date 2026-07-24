import { Buffer } from 'node:buffer'
import { PDFDocument, StandardFonts, degrees } from 'pdf-lib'

const ENCRYPTED_PDF_BASE64 = 'JVBERi0xLjMKJeLjz9MKMSAwIG9iago8PAovUHJvZHVjZXIgPGFiNjNkODIxMTE+Cj4+CmVuZG9iagoyIDAgb2JqCjw8Ci9UeXBlIC9QYWdlcwovQ291bnQgMQovS2lkcyBbIDQgMCBSIF0KPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL0NhdGFsb2cKL1BhZ2VzIDIgMCBSCj4+CmVuZG9iago0IDAgb2JqCjw8Ci9UeXBlIC9QYWdlCi9SZXNvdXJjZXMgPDwKPj4KL01lZGlhQm94IFsgMC4wIDAuMCAyMDAgMjAwIF0KL1BhcmVudCAyIDAgUgo+PgplbmRvYmoKNSAwIG9iago8PAovViAyCi9SIDMKL0xlbmd0aCAxMjgKL1AgNDI5NDk2NzI5MgovRmlsdGVyIC9TdGFuZGFyZAovTyA8MGU1MjI5MjVhM2U0ZTg3NGMzY2ZhY2JlZjUxMWE3M2FjNGVjMmJkODY1ZGNkM2Q0NjI3NjE0OTE3YWJmZDdlND4KL1UgPDk1N2M0M2M2NTcyYmU3ZjM2ZTE2YWVmMzJiYTBlZGI4MjhiZjRlNWU0ZTc1OGE0MTY0MDA0ZTU2ZmZmYTAxMDg+Cj4+CmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMTUgMDAwMDAgbiAKMDAwMDAwMDA1OSAwMDAwMCBuIAowMDAwMDAwMTE4IDAwMDAwIG4gCjAwMDAwMDAxNjcgMDAwMDAgbiAKMDAwMDAwMDI2MSAwMDAwMCBuIAp0cmFpbGVyCjw8Ci9TaXplIDYKL1Jvb3QgMyAwIFIKL0luZm8gMSAwIFIKL0lEIFsgPDM1Mzk2MzMyMzA2MjYyNjE2NTYzMzgzMjY1MzE2MjM1NjMzNjMzNjM2MTYyNjU2NjYzNTYxNjY2MTY1NjYzMTMxMzE+IDwzNTM5NjMzMjMwNjI2MjYxNjU2MzM4MzI2NTMxNjIzNTYzMzYzMzYzNjE2MjY1NjYzNTYxNjY2MTY1NjYzMTMxPiBdCi9FbmNyeXB0IDUgMCBSCj4+CnN0YXJ0eHJlZgo0NzYKJSVFT0YK'
const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEUlEQVR4nGP8z8DQwMDAwAAACooBge1WxT4AAAAASUVORK5CYII='

export function createEncryptedPdfFixture(): Uint8Array {
  return new Uint8Array(Buffer.from(ENCRYPTED_PDF_BASE64, 'base64'))
}

export function createPngFixture(): Uint8Array {
  return new Uint8Array(Buffer.from(PNG_BASE64, 'base64'))
}

export function createHugePngHeader(width = 50_000, height = 50_000): Uint8Array {
  const bytes = createPngFixture()
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  view.setUint32(16, width, false)
  view.setUint32(20, height, false)
  return bytes
}

export function createVp8lHeader(width = 513, height = 257): Uint8Array {
  const bytes = new Uint8Array(30)
  bytes.set(new TextEncoder().encode('RIFF'), 0)
  bytes.set(new TextEncoder().encode('WEBP'), 8)
  bytes.set(new TextEncoder().encode('VP8L'), 12)
  bytes[20] = 0x2f
  const widthMinusOne = width - 1
  const heightMinusOne = height - 1
  bytes[21] = widthMinusOne & 0xff
  bytes[22] = ((widthMinusOne >> 8) & 0x3f) | ((heightMinusOne & 0x03) << 6)
  bytes[23] = (heightMinusOne >> 2) & 0xff
  bytes[24] = (heightMinusOne >> 10) & 0x0f
  return bytes
}

export async function createPdfFixture(pageCount = 2): Promise<Uint8Array> {
  const document = await PDFDocument.create()
  const font = await document.embedFont(StandardFonts.Helvetica)
  for (let index = 0; index < pageCount; index += 1) {
    const page = document.addPage(index % 2 === 0 ? [595.28, 841.89] : [841.89, 595.28])
    if (index === 1) page.setRotation(degrees(90))
    page.drawText(`AI Bundle PDF page ${index + 1}`, { x: 48, y: page.getHeight() - 72, size: 18, font })
  }
  return document.save({ useObjectStreams: false, addDefaultPage: false })
}
