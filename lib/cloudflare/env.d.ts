// Minimal Cloudflare Workers binding declarations used by the Cloudflare runtime
// adapter files and their unit tests. Keep this local until the project adopts
// the official Workers type package end-to-end.

declare global {
  interface KVNamespace {
    get(key: string): Promise<string | null>;
    put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
    delete(key: string): Promise<void>;
  }

  interface R2HTTPMetadata {
    contentType?: string;
    contentLanguage?: string;
    contentDisposition?: string;
    contentEncoding?: string;
    cacheControl?: string;
    cacheExpiry?: Date;
  }

  interface R2PutOptions {
    httpMetadata?: R2HTTPMetadata;
    customMetadata?: Record<string, string>;
    md5?: string;
  }

  interface R2ListOptions {
    prefix?: string;
    cursor?: string;
    limit?: number;
    delimiter?: string;
  }

  interface R2Object {
    key: string;
    size?: number;
    uploaded?: Date;
    httpMetadata?: R2HTTPMetadata;
    customMetadata?: Record<string, string>;
  }

  interface R2ObjectBody extends R2Object {
    body?: ReadableStream;
    text(): Promise<string>;
    arrayBuffer(): Promise<ArrayBuffer>;
  }

  interface R2Objects {
    objects: R2Object[];
    truncated: boolean;
    cursor?: string;
  }

  interface R2Bucket {
    put(
      key: string,
      value: string | ArrayBuffer | ReadableStream,
      options?: R2PutOptions,
    ): Promise<R2Object>;
    get(key: string): Promise<R2ObjectBody | null>;
    delete(key: string): Promise<void>;
    list(options?: R2ListOptions): Promise<R2Objects>;
  }

  interface VectorizeMatch {
    id: string;
    score: number;
    metadata?: Record<string, unknown>;
    values?: number[];
  }

  interface VectorizeQueryOptions {
    topK?: number;
    returnMetadata?: boolean | 'all';
  }

  interface VectorizeIndex {
    query(
      vector: number[],
      options?: VectorizeQueryOptions,
    ): Promise<{ matches: VectorizeMatch[] }>;
  }

  interface AnalyticsEngineDataset {
    writeDataPoint(point: {
      blobs?: string[];
      doubles?: number[];
      indexes?: string[];
    }): void;
  }

  interface Queue {
    send(message: unknown): Promise<void>;
    sendBatch?(messages: Array<{ body: unknown }>): Promise<void>;
  }

  interface CloudflareEnv {
    SESSION_KV: KVNamespace;
    RATELIMIT_KV: KVNamespace;
    FLAGS_KV: KVNamespace;
    LOCALE_KV: KVNamespace;
    CORPUS_PUBLIC: R2Bucket;
    CORPUS_INTERNAL: R2Bucket;
    AUDIT_COLD: R2Bucket;
    ASSETS: R2Bucket;
    OPENNEXT_CACHE: R2Bucket;
    FDA_PUBLIC: VectorizeIndex;
    EU_MDR_PUBLIC: VectorizeIndex;
    MFDS_PUBLIC: VectorizeIndex;
    NMPA_PUBLIC: VectorizeIndex;
    PMDA_PUBLIC: VectorizeIndex;
    AUDIT_ARCHIVE_QUEUE: Queue;
    CORPUS_UPDATE_QUEUE: Queue;
    NOTIFICATION_QUEUE: Queue;
    LANGFUSE_FLUSH_QUEUE: Queue;
    ANALYTICS: AnalyticsEngineDataset;
    HIPAA_BAA_CONFIRMED: string;
  }
}

export {};
