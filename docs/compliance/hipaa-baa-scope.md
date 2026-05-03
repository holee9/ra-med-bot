# HIPAA BAA Scope — Workers AI / AutoRAG

SPEC: SPEC-REGULA-CLOUDFLARE-001
Status: **Pending Item #1** — NOT YET CONFIRMED
Last Updated: 2026-04-22

---

## Status

**Pending Item #1**: Cloudflare Workers AI HIPAA BAA scope has NOT been confirmed as of Phase 7 implementation date (2026-04-22).

This document will be updated when Cloudflare confirms BAA coverage for Workers AI / AutoRAG services.

## Impact

Until this item is resolved:

- `HIPAA_BAA_CONFIRMED` environment variable MUST remain `"false"` in all environments.
- `AutoRAGRetriever` will throw `HIPAABAAScopeError` for all retrieval requests.
- The `hybridRetrieve` function routes all queries to Vectorize (non-BAA path) or pgvector.

## Activation Procedure

When Cloudflare confirms HIPAA BAA coverage for Workers AI:

1. Obtain signed BAA from Cloudflare legal team.
2. Store BAA document in legal records system.
3. Update `HIPAA_BAA_CONFIRMED=true` in:
   - Cloudflare Workers production environment variables
   - Cloudflare Workers preview environment variables
4. Remove this "Pending" status and update document with BAA confirmation date.

## Reference

- Cloudflare Trust Hub: https://www.cloudflare.com/trust-hub/
- HIPAA BAA inquiry: Contact Cloudflare enterprise sales or account manager.
- Regula HIPAA compliance framework: `docs/compliance/part-11-extended.md`
