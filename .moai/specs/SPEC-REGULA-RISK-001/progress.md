# SPEC-REGULA-RISK-001 Progress

Updated: 2026-06-20 KST
Issue: #46
Status: Completed and merged
Baseline: PR #195 + `8065cc8 fix(ci): restore gates after risk workflow merge`

---

## Merge Summary

- PR #194: Issue #46 branch integration path merged.
- PR #195: ISO 14971 Risk Management implementation merged into `main`.
- Follow-up commit `8065cc8`: restored CI/E2E/build gates after PR #195.

## Implemented Surface

| Layer | Files / modules |
|---|---|
| UI | `/workflows/risk`, `/workflows/risk/[runId]`, `components/risk/*` |
| API | `app/api/ra/risk/*` route handlers |
| Domain | `lib/risk/risk-evaluation.ts`, `residual-risk.ts`, `hazard-identification.ts`, `control-recommendation.ts`, `report-builder.ts` |
| DB | `risk_items`, `risk_controls`, `risk_gspr_mappings`, risk enums |
| Auth | `risk.generate`, `risk.view`, `risk.update`, `risk.approve` |
| Audit | `risk.hazard_identified`, `risk.matrix_evaluated`, `risk.item_deleted`, `risk.control_adopted`, `risk.residual_accepted`, `risk.gspr_mapped`, `risk.report_approved` |

## Verification

```bash
corepack pnpm typecheck
corepack pnpm exec biome check .
corepack pnpm run lint:hex
corepack pnpm test
SKIP_ENV_VALIDATION=1 REGULA_ALLOW_ENV_VALIDATION_SKIP=build corepack pnpm build
```

Result:

- TypeScript: pass
- Biome lint/format: pass
- Unit/integration tests: 2,536 passed / 7 skipped
- Next build: pass
- GitHub Actions on `8065cc8`: `CI`, `E2E Tests`, `Security Scan`, `Deploy` all success
