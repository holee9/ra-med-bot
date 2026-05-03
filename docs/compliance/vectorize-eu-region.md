# Vectorize EU Region Availability

SPEC: SPEC-REGULA-CLOUDFLARE-001
Status: **Pending Item #2** — NOT YET GA
Last Updated: 2026-04-22

---

## Status

**Pending Item #2**: Cloudflare Vectorize EU region is NOT generally available (GA) as of Phase 7 implementation date (2026-04-22).

This document will be updated when Cloudflare announces GA availability of Vectorize EU region.

## Impact

Until this item is resolved:

- `VECTORIZE_EU_GA` environment variable MUST remain `"false"` in all environments.
- EU MDR corpus queries (`eu-mdr` scope) route to the default Vectorize region.
- Organizations with `data_region = 'eu'` do not receive EU-resident Vectorize lookups.
- EU data residency for vector embeddings is NOT guaranteed in this period.

## Activation Procedure

When Cloudflare announces Vectorize EU GA:

1. Verify that `regula-eu-mdr-public` Vectorize index can be created in EU region.
2. Re-create or migrate the index to the EU region.
3. Update `VECTORIZE_EU_GA=true` in:
   - Cloudflare Workers production environment variables
   - Cloudflare Workers preview environment variables
4. Update the `VectorizeEuMdrRetriever` to enforce EU region routing.
5. Remove this "Pending" status and update document with GA date.

## Reference

- Cloudflare Vectorize regions: https://developers.cloudflare.com/vectorize/
- EU MDR retriever: `lib/ai/retrievers/vectorize-eu-mdr.ts`
- Env binding: `EU_MDR_PUBLIC` in `wrangler.toml`
