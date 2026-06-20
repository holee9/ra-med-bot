# ISO 14971 Risk Management Workflow

**SPEC**: `SPEC-REGULA-RISK-001`
**Issue**: #46
**Implemented**: 2026-06-20
**Baseline**: PR #195 + `8065cc8 fix(ci): restore gates after risk workflow merge`

Regula의 Risk Management workflow는 ISO 14971:2019 기반 위험관리 파일(RMF) 작성을 보조한다. LLM/RAG는 draft 생성과 근거 수집을 담당하고, 법적 책임이 있는 최종 판단은 RA lead 승인 게이트를 통과해야 한다.

---

## Scope

| Capability | Status | Notes |
|---|---|---|
| Hazard identification | Implemented | 기기 설명과 device class를 받아 hazard / sequence of events / hazardous situation / harm 구조로 생성 |
| Risk matrix | Implemented | severity 1~5 × probability 1~5, `acc`, `alarp`, `unacc` 분류 |
| Control recommendation | Implemented | ISO 14971 §7.1 hierarchy: inherent, protective, information |
| Residual risk | Implemented | 통제 후 residual severity/probability 재평가, ALARP justification 기록 |
| GSPR mapping | Implemented | EU MDR Annex I GSPR clause mapping table |
| Report export | Implemented | DOCX report, draft watermark, approval status |
| Expert approval | Implemented | `risk.approve` permission, RA lead only |

---

## User Flow

1. RA member creates a risk run from `/workflows/risk`.
2. User enters device description and optional device class.
3. System generates hazard candidates through the risk identification API.
4. User reviews hazards in `HazardTable` and assigns severity/probability.
5. `RiskMatrix` classifies each item into acceptable, ALARP, or unacceptable.
6. User requests control recommendations.
7. `ControlWizard` enforces the ISO 14971 control hierarchy.
8. User records residual risk and ALARP justification where needed.
9. User creates GSPR mappings and exports a draft report.
10. RA lead reviews and approves through `RiskApprovalGate`.

---

## UI Routes and Components

| Surface | Path |
|---|---|
| Risk workflow landing | `app/(app)/workflows/risk/page.tsx` |
| Risk run detail | `app/(app)/workflows/risk/[runId]/page.tsx` |
| Matrix component | `components/risk/RiskMatrix.tsx` |
| Hazard table | `components/risk/HazardTable.tsx` |
| Control wizard | `components/risk/ControlWizard.tsx` |
| Approval gate | `components/risk/RiskApprovalGate.tsx` |

Component behavior:

- `RiskMatrix` uses stable severity/probability keys instead of array index keys.
- `HazardTable` exposes explicit edit/delete buttons with non-submit button types.
- `ControlWizard` requires rationale for information-for-safety controls.
- `RiskApprovalGate` renders approval controls only for RA lead users.

---

## API Surface

All risk endpoints require an Auth.js session and pass through `withPermission`.

| Endpoint | Permission | Purpose |
|---|---|---|
| `POST /api/ra/risk/runs` | `risk.generate` | Create a risk workflow run |
| `GET /api/ra/risk/runs/[id]` | `risk.view` | Load run aggregate |
| `POST /api/ra/risk/identify` | `risk.generate` | Generate hazards from device description |
| `PATCH /api/ra/risk/items/[id]` | `risk.update` | Update hazard item |
| `DELETE /api/ra/risk/items/[id]` | `risk.update` | Delete hazard item |
| `POST /api/ra/risk/items/[id]/evaluate` | `risk.update` | Evaluate severity/probability |
| `POST /api/ra/risk/controls/recommend` | `risk.generate` | Recommend control measures |
| `PATCH /api/ra/risk/controls/[id]` | `risk.update` | Adopt/update control and residual risk |
| `POST /api/ra/risk/runs/[id]/gspr` | `risk.update` | Create GSPR mapping |
| `POST /api/ra/risk/runs/[id]/export` | `risk.generate` | Generate DOCX report |
| `POST /api/ra/risk/runs/[id]/approve` | `risk.approve` | RA lead approval |

---

## Domain Logic

| Module | Responsibility |
|---|---|
| `lib/risk/risk-evaluation.ts` | Default 5×5 matrix, `evaluateRiskLevel`, `validateScale`, `requiresControl` |
| `lib/risk/residual-risk.ts` | Residual risk evaluation and ALARP validity |
| `lib/risk/hazard-identification.ts` | Hazard prompt/response parsing and citation/confidence guard |
| `lib/risk/control-recommendation.ts` | 3-tier control recommendation and hierarchy validation |
| `lib/risk/report-builder.ts` | ISO 14971 DOCX report and GSPR mapping table |

Important invariants:

- `validateScale(value)` accepts only integer values from 1 to 5.
- `evaluateRiskLevel` throws `RangeError` when matrix coordinates are invalid.
- `validateControlHierarchy('information', undefined)` rejects information-only control adoption.
- ALARP residual risk must include a non-empty justification.

---

## Database and Audit

Risk workflow data is stored as child tables of a workflow run.

| Table / enum | Purpose |
|---|---|
| `workflow_type = 'risk'` | Identifies risk workflow runs |
| `risk_items` | Hazard, event sequence, hazardous situation, harm, severity/probability, risk level, citation |
| `risk_controls` | Control tier, description, adoption state, residual risk, ALARP justification |
| `risk_gspr_mappings` | EU MDR Annex I GSPR clause mapping |
| `risk_level` | `acc`, `alarp`, `unacc` |
| `control_tier` | `inherent`, `protective`, `information` |

Audit actions:

- `risk.hazard_identified`
- `risk.matrix_evaluated`
- `risk.item_deleted`
- `risk.control_adopted`
- `risk.residual_accepted`
- `risk.gspr_mapped`
- `risk.report_approved`

---

## RBAC

| Permission | Minimum role | Scope |
|---|---|---|
| `risk.generate` | `ra-member` | `org` |
| `risk.view` | `ra-member` | `org` |
| `risk.update` | `ra-member` | `org` |
| `risk.approve` | `ra-lead` | `org` |

`risk.approve` is the legal responsibility gate. UI gating is implemented for usability, but server-side `withPermission('risk.approve')` is the enforcement point.

---

## Validation Evidence

Local validation after the PR #195 merge and CI recovery:

```bash
corepack pnpm typecheck
corepack pnpm exec biome check .
corepack pnpm run lint:hex
corepack pnpm test
SKIP_ENV_VALIDATION=1 REGULA_ALLOW_ENV_VALIDATION_SKIP=build corepack pnpm build
```

Results:

- TypeScript: pass.
- Biome lint/format: pass.
- Hex color rule: pass.
- Unit/integration tests: 2,536 passed, 7 skipped.
- Next build: pass.
- GitHub Actions on `8065cc8`: `CI`, `E2E Tests`, `Security Scan`, `Deploy` all pass.
