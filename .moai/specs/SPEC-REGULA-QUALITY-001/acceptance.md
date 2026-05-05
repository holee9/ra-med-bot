# Acceptance Criteria — SPEC-REGULA-QUALITY-001

본 문서는 SPEC-REGULA-QUALITY-001 의 25개 EARS 요구사항이 만족되었는지 검증할 수 있는 Given–When–Then 시나리오, 엣지 케이스, 품질 게이트, Definition of Done 을 정의한다.

---

## 1. Given–When–Then Scenarios

### Scenario A1 — Corpus Seed Loads Successfully (REQ-QUAL-001 ~ 004)

**Given** a fresh PostgreSQL database with `source_sections` table created via Drizzle migrations and `pgvector` extension enabled,  
**When** the developer runs `pnpm db:seed:corpus`,  
**Then**
- The script exits with code 0
- `SELECT COUNT(*) FROM source_sections` returns at least 100
- `SELECT COUNT(*) FROM source_sections WHERE embedding IS NOT NULL` equals total row count
- `SELECT corpus, COUNT(*) FROM source_sections GROUP BY corpus` shows ≥ 20 rows for each of `fda`, `eu-mdr`, `mfds`, `nmpa`, `pmda`
- Re-running the same command produces identical chunk ids (deterministic seed)

### Scenario A2 — Hybrid Search Returns Results on Canonical Queries (REQ-QUAL-005)

**Given** the corpus seeded per Scenario A1,  
**When** the hybrid retriever receives query `"510(k) submission requirements"`,  
**Then**
- At least one result is returned with corpus=`fda` and similarity score above the configured cosine threshold
- Equivalent canonical queries succeed for each of EU-MDR, MFDS, NMPA, PMDA corpora

### Scenario B1 — Eval Pipeline Passes in CI (REQ-QUAL-006 ~ 008)

**Given** a CI environment with a database seeded per Scenario A1 and `tests/eval/promptfoo.config.yaml` referencing 6 datasets (55 scenarios total),  
**When** the CI job runs `pnpm eval:ci`,  
**Then**
- The command exits with code 0
- ≥ 80% of 55 scenarios meet their confidence threshold
- A timestamped result file is written to `tests/eval/results/<timestamp>.json`
- A baseline file (`tests/eval/results/baseline.json`) is committed to the repository

### Scenario B2 — Failing Scenarios Are Classified (REQ-QUAL-009)

**Given** the eval pipeline run in Scenario B1 with at least one failing scenario,  
**When** results are emitted,  
**Then**
- Each failing record contains a `rootCause` field with one of `corpus-gap`, `retrieval-gap`, `model-error`, `evaluator-flake`
- A summary aggregates failures by root cause for human review

### Scenario B3 — Eval Respects CI Budget (REQ-QUAL-010)

**Given** the CI runner enforces a 30-minute timeout on the eval job,  
**When** `pnpm eval:ci` runs,  
**Then**
- Total runtime is below 30 minutes
- **Or** if runtime would exceed the budget, the runner terminates gracefully with a partial result file and a non-zero exit code identifying timeout

### Scenario C1 — pgvector Fallback Active Without Cloudflare Env (REQ-QUAL-011 ~ 014)

**Given** a Node.js test environment without `CLOUDFLARE_VECTORIZE_INDEX_NAME` set,  
**When** the test invokes the hybrid router for a public-corpus query,  
**Then**
- The router executes the pgvector path
- `lib/ai/hybrid-router.ts` contains zero matches for `TODO.*Vectorize` or `wire up Vectorize`
- The integration test `tests/integration/hybrid-router-fallback.test.ts` asserts non-empty retrieval against the seeded corpus
- `.env.example` contains a documented `CLOUDFLARE_VECTORIZE_INDEX_NAME=` line with a comment describing the fallback behavior

### Scenario D1 — Admin Uploads Document and Search Returns It (REQ-QUAL-015 ~ 017)

**Given** an authenticated admin session and a corpus seeded per Scenario A1,  
**When** the admin uploads a fixture regulatory document via `/admin/documents/upload`,  
**Then**
- The HTTP response indicates success
- A new row appears in `sources` with the upload metadata
- ≥ 1 row with non-null `embedding` appears in `source_sections` referencing that source
- The uploaded document appears in the admin documents list within the same browser session
- A subsequent knowledge-base search using a unique term from the uploaded document returns the document among top-K results

### Scenario D2 — Non-Admin Forbidden From Admin Routes (REQ-QUAL-018)

**Given** an authenticated user with role `member` (not `admin` or `ra-member`),  
**When** the user attempts to GET `/admin/documents`, `/admin/documents/upload`, `/admin/documents/[id]`, or to POST to the upload endpoint,  
**Then**
- The HTTP response status is `403`
- An audit log entry is recorded with `action=forbidden_access` and the requested route

### Scenario D3 — Invalid Upload Rejected Atomically (REQ-QUAL-019)

**Given** an authenticated admin session,  
**When** the admin attempts to upload (a) a file exceeding the configured size limit, OR (b) a file in an unsupported format, OR (c) a file that triggers PII detection failure,  
**Then**
- The upload returns a structured error response (status 4xx with a JSON error body)
- No row is inserted into `sources`
- No row is inserted into `source_sections`
- An error log entry identifies the rejection reason

### Scenario E1 — Security Headers Present on /api/ra/* Routes (REQ-QUAL-020 ~ 022)

**Given** a production-representative build of the application running in CI,  
**When** the Playwright security-headers test sends a request to a `/api/ra/*` route on the chromium project,  
**Then**
- Response includes `Content-Security-Policy` with a nonce value
- Response includes `X-Frame-Options: DENY`
- Response includes `Strict-Transport-Security` with `max-age` ≥ `31536000`
- Response includes `X-Content-Type-Options: nosniff`
- For HTML responses, the CSP header nonce equals the `nonce` attribute of every inline `<script>` tag

### Scenario E2 — Missing Header Fails CI (REQ-QUAL-023)

**Given** a hypothetical build where one of the four required headers is omitted on a protected route,  
**When** the Playwright security-headers test runs,  
**Then**
- The test asserts the missing header and fails
- CI marks the job as failed and blocks the merge

### Scenario F1 — RBAC Coverage Includes Admin Doc Routes (REQ-QUAL-024 ~ 025)

**Given** the application router exposes `/admin/documents`, `/admin/documents/upload`, `/admin/documents/[id]`, and `/admin/radar`,  
**When** the developer runs `pnpm ci:rbac`,  
**Then**
- The script exits with code 0
- The RBAC matrix output explicitly lists each of the four admin routes with their allowed roles
- If a developer later adds an admin route without updating the whitelist, `pnpm ci:rbac` fails and names the missing route

---

## 2. Edge Cases

| Case                                                                                  | Expected Behavior                                                                |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Seed run on a database that already contains seed rows                                | Idempotent: same chunk ids, no duplicate inserts (use upsert or pre-check)        |
| Seed run with embedding model unreachable                                              | Script fails fast with explicit error; no partial inserts                        |
| Eval scenario references a corpus that has < 20 chunks after seed                     | Eval flags `corpus-gap` for those scenarios; threshold check still applies       |
| `CLOUDFLARE_VECTORIZE_INDEX_NAME` set but Workers binding unavailable in test runtime | Router falls back to pgvector and emits a breadcrumb (no exception)              |
| Admin uploads a document containing PII that the redactor masks                        | Upload succeeds with redacted content; `source_sections.text` excludes PII       |
| Admin uploads a 0-byte file                                                            | Reject as unsupported (Scenario D3)                                              |
| Non-admin attempts to access `/api/ra/sources/[id]` for an admin-restricted source     | Returns 403 (existing route-level RBAC)                                          |
| CSP nonce regenerated per response but cached at CDN                                   | Test must use cache-busting; CDN caching of HTML with nonces is out of scope here |
| RBAC whitelist contains a route that no longer exists in the router                    | `pnpm ci:rbac` warns (not fail) about stale entries; cleanup is recommended       |
| Eval baseline JSON conflicts with another PR's baseline                               | Latest merged commit wins; rerun on the target branch updates baseline           |

---

## 3. Quality Gate Criteria

| Gate                | Criterion                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| Tested              | All Group A–F additions have corresponding integration or E2E tests; coverage ≥ existing baseline |
| Readable            | No unresolved TODOs in modified files; new code respects project lint rules (biome)              |
| Unified             | TypeScript types correct (`pnpm typecheck` clean); biome formatting applied                       |
| Secured             | Security headers verified end-to-end; no admin route exposed without RBAC entry                   |
| Trackable           | Conventional commits referencing `SPEC-REGULA-QUALITY-001`; baseline eval committed              |

---

## 4. Definition of Done

- [ ] `spec.md`, `plan.md`, `acceptance.md` 모두 작성/검토 완료
- [ ] GitHub Issue 생성 및 SPEC frontmatter `issue_number` 갱신
- [ ] REQ-QUAL-001 ~ 025 전 항목에 대응하는 테스트/스크립트 존재
- [ ] `pnpm db:seed:corpus` 가 결정적으로 ≥ 100 행 적재
- [ ] `pnpm eval:ci` ≥ 80% 통과율로 CI 통과
- [ ] `lib/ai/hybrid-router.ts` 의 Vectorize 관련 TODO 0건
- [ ] `tests/integration/hybrid-router-fallback.test.ts` 통과
- [ ] 관리자 문서 업로드 E2E (`tests/e2e/admin-document-upload.spec.ts`) 통과
- [ ] 보안 헤더 E2E (`tests/e2e/security-headers.spec.ts`) chromium 통과
- [ ] `pnpm ci:rbac` 통과 (admin 문서 라우트 4종 포함)
- [ ] CI 워크플로우에 eval 잡 추가 및 30분 timeout 적용
- [ ] PR 본문에 SPEC ID, 검증 명령어, 예상 결과 명시
- [ ] manager-quality 또는 evaluator-active 의 TRUST 5 검증 통과
- [ ] 의존 SPEC(`SPEC-REGULA-RELEASE-GATE-001`, `SPEC-REGULA-RELEASE-HARDENING-001`) 의 status 가 `completed` 인지 확인 (현재 미완 시 plan-auditor 또는 사용자에게 차단 보고)
