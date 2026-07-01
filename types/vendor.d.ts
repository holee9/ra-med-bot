/**
 * Type stubs for optional runtime dependencies not in package.json.
 * These packages are loaded dynamically at runtime; stubs silence
 * TS2307 errors when the packages are absent from node_modules.
 */

declare module 'openai' {
  interface EmbeddingItem {
    embedding: number[];
  }

  interface EmbeddingsCreateResponse {
    data: EmbeddingItem[];
  }

  interface EmbeddingsAPI {
    create(params: { model: string; input: string[] }): Promise<EmbeddingsCreateResponse>;
  }

  interface OpenAIOptions {
    apiKey?: string;
    baseURL?: string;
  }

  class OpenAI {
    constructor(options?: OpenAIOptions);
    embeddings: EmbeddingsAPI;
  }

  export default OpenAI;
}

declare module 'pdf-parse' {
  interface PdfData {
    text: string;
    numpages: number;
    info: Record<string, unknown>;
  }
  function pdfParse(buffer: Buffer): Promise<PdfData>;
  export default pdfParse;
}

declare module 'mammoth' {
  interface ConversionResult {
    value: string;
    messages: unknown[];
  }
  function extractRawText(options: { buffer: Buffer }): Promise<ConversionResult>;
  export { extractRawText };
}
