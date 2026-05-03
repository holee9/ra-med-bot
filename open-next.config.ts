// @MX:NOTE [AUTO] OpenNext.js v3 adapter config for Cloudflare Workers runtime.
// @MX:SPEC SPEC-REGULA-CLOUDFLARE-001 (REQ-CF-001, REQ-CF-002, REQ-CF-003)

export default {
  default: {
    override: {
      wrapper: 'cloudflare-node',
      converter: 'edge',
      incrementalCache: async () => {
        const { R2IncrementalCache } = await import(
          '@opennextjs/cloudflare/kv-cache'
        );
        return new R2IncrementalCache({ bucketBinding: 'OPENNEXT_CACHE' });
      },
    },
  },
};
