declare module 'mammoth/mammoth.browser' {
  export interface MammothMessage {
    readonly type: string
    readonly message: string
  }

  export interface MammothResult {
    readonly value: string
    readonly messages: readonly MammothMessage[]
  }

  export interface MammothImage {
    readonly contentType: string
    readAsBase64String(): Promise<string>
  }

  export interface MammothImageAttributes {
    readonly src: string
  }

  export interface MammothOptions {
    readonly externalFileAccess?: boolean
    readonly idPrefix?: string
    readonly ignoreEmptyParagraphs?: boolean
    readonly styleMap?: readonly string[]
    readonly convertImage?: unknown
  }

  export interface MammothBrowserApi {
    readonly images: {
      imgElement(converter: (image: MammothImage) => Promise<MammothImageAttributes>): unknown
    }
    convertToHtml(input: { readonly arrayBuffer: ArrayBuffer }, options?: MammothOptions): Promise<MammothResult>
    extractRawText(input: { readonly arrayBuffer: ArrayBuffer }): Promise<MammothResult>
  }

  const mammoth: MammothBrowserApi
  export default mammoth
}
