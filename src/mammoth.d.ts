declare module 'mammoth' {
  export interface ConvertToHtmlMessage {
    type: string
    message: string
  }

  export interface ConvertToHtmlResult {
    value: string
    messages: ConvertToHtmlMessage[]
  }

  export function convertToHtml(input: { arrayBuffer: ArrayBuffer }): Promise<ConvertToHtmlResult>
}
