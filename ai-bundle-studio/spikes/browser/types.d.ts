declare module 'mammoth/mammoth.browser' {
  interface MammothMessage {
    readonly type: string
    readonly message: string
  }

  interface MammothResult {
    readonly value: string
    readonly messages: readonly MammothMessage[]
  }

  interface MammothBrowserApi {
    readonly images: {
      imgElement(converter: (image: { readonly contentType: string; readAsBase64String(): Promise<string> }) => Promise<{ readonly src: string }>): unknown
    }
    convertToHtml(input: { readonly arrayBuffer: ArrayBuffer }, options?: Readonly<Record<string, unknown>>): Promise<MammothResult>
  }

  const mammoth: MammothBrowserApi
  export default mammoth
}
