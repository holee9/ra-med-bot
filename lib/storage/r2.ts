// @MX:ANCHOR [AUTO] R2Client — single-point abstraction for all R2 object storage access.
// @MX:REASON REQ-CF-055: all R2 access must go through this class. No direct R2 binding
// calls elsewhere in the codebase. fan_in >= 3: audit cold storage, corpus loader, assets.
// @MX:SPEC SPEC-REGULA-CLOUDFLARE-001 (REQ-CF-055)
//
// No public R2 URLs. Workers Bindings only.

export interface R2PutOptions {
  httpMetadata?: R2HTTPMetadata;
  customMetadata?: Record<string, string>;
  /** If provided, object is only stored if MD5 matches. */
  md5?: string;
}

export interface R2ListOptions {
  prefix?: string;
  cursor?: string;
  limit?: number;
  delimiter?: string;
}

export interface R2ListResult {
  objects: Array<{ key: string; size?: number; uploaded?: Date }>;
  truncated: boolean;
  cursor?: string;
}

/**
 * Single-point abstraction for R2 object storage.
 *
 * All code that needs to read or write R2 MUST use this class.
 * Direct binding calls (env.CORPUS_PUBLIC.put(...)) are prohibited outside this module.
 *
 * @example
 *   const r2 = new R2Client(env.AUDIT_COLD);
 *   await r2.put('audit/2026/01/batch-001.json', payload);
 */
export class R2Client {
  constructor(private readonly bucket: R2Bucket) {}

  /**
   * Stores an object in R2.
   * @param key - R2 object key (no leading slash)
   * @param body - Content to store
   * @param opts - Optional HTTP metadata and custom metadata
   */
  async put(
    key: string,
    body: string | ArrayBuffer | ReadableStream,
    opts: R2PutOptions = {},
  ): Promise<R2Object> {
    return this.bucket.put(key, body, {
      httpMetadata: opts.httpMetadata,
      customMetadata: opts.customMetadata,
    });
  }

  /**
   * Retrieves an object from R2.
   * Returns null if the object does not exist.
   */
  async get(key: string): Promise<R2ObjectBody | null> {
    return this.bucket.get(key);
  }

  /**
   * Deletes an object from R2.
   * Silently succeeds if the object does not exist.
   */
  async delete(key: string): Promise<void> {
    return this.bucket.delete(key);
  }

  /**
   * Lists objects in R2 with optional prefix filtering.
   */
  async list(opts: R2ListOptions = {}): Promise<R2ListResult> {
    const result = await this.bucket.list({
      prefix: opts.prefix,
      cursor: opts.cursor,
      limit: opts.limit,
      delimiter: opts.delimiter,
    });

    return {
      objects: result.objects.map((obj) => ({
        key: obj.key,
        size: obj.size,
        uploaded: obj.uploaded,
      })),
      truncated: result.truncated,
      cursor: result.truncated ? (result as R2Objects & { cursor?: string }).cursor : undefined,
    };
  }
}
