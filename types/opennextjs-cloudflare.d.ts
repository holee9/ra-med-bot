declare module '@opennextjs/cloudflare/kv-cache' {
  export class R2IncrementalCache {
    constructor(options: { bucketBinding: string });
  }
}
