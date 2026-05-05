# Plan — SPEC-REGULA-QUALITY-001

## 1. Implementation Strategy

품질 향상 작업을 6개 그룹(A~F)으로 분리하고, 그룹 내부는 의존성 순서대로, 그룹 간은 가능한 병렬로 진행한다. Group A(코퍼스 시드)가 Group B(평가 파이프라인)의 전제이므로 A→B 순서는 고정이며, 나머지는 독립 트랙이다.

### Dependency Graph

```
Group A (Corpus Seed) ──► Group B (Eval Pipeline)
Group C (Cloudflare Fallback) ── independent
Group D (DocIngest E2E) ──► (uses A's seeded schema)
Group E (Security Headers) ── independent
Group F (Admin RBAC)       ── independent (verifies after D)
```

---

## 2. Milestones (Priority-Based)

### Milestone M1 — Corpus Foundation (Priority: High, Group A)

순서적 선행 조건. 다른 모든 그룹의 검증 가능성을 좌우한다.

작업:
- 시드 데이터 큐레이션: 5개 코퍼스 × 20+ 청크 (실제 규제 텍스트, 라이선스 확인)
- `scripts/seed/corpus.ts` 스크립트 작성 — 청크 → 임베딩 → `source_sections` insert
- 결정성(deterministic chunk id) 보장 — 입력 텍스트 해시 기반 id
- `pnpm db:seed:corpus` package.json 스크립트 등록
- 캐노니컬 쿼리 5건에 대한 smoke test 추가

산출물:
- `scripts/seed/corpus.ts`
- `scripts/seed/data/{fda,eu-mdr,mfds,nmpa,pmda}.json`
- `tests/integration/seed-smoke.test.ts`
- `package.json` 스크립트 갱신

검증: REQ-QUAL-001 ~ 005

### Milestone M2 — Eval Pipeline Activation (Priority: High, Group B)

M1 완료 후 즉시 시작. 시드된 코퍼스 위에서 promptfoo 평가가 실제 통과해야 한다.

작업:
- `tests/eval/promptfoo.config.yaml` 검토 — 시드 데이터에 부합하는 시나리오 확인
- 통과 임계값 튜닝(scenarios/datasets별 confidence threshold)
- 결과 저장 디렉토리 구조 (`tests/eval/results/<timestamp>.json`) 도입
- 실패 시나리오 분류 스키마(corpus-gap | retrieval-gap | model-error | evaluator-flake) 적용
- CI 워크플로우(GH Actions)에 `eval:ci` 잡 추가, 30분 timeout 설정
- 베이스라인 결과 커밋

산출물:
- `tests/eval/results/baseline.json`
- `.github/workflows/eval-ci.yml` (또는 기존 워크플로우 확장)
- `tests/eval/scorers/root-cause-classifier.ts`

검증: REQ-QUAL-006 ~ 010

### Milestone M3 — Cloudflare Fallback Documentation (Priority: Medium, Group C)

M1과 병렬 가능. 코드 변경은 작지만 문서화/테스트 보강이 핵심.

작업:
- `lib/ai/hybrid-router.ts:142` TODO 제거 — 명시적 `// [AUTO] @MX:NOTE: pgvector fallback path; Vectorize binding deferred to Workers runtime` 주석으로 대체
- `lib/ai/hybrid-router.ts` 모듈 doc-comment에 폴백 동작 명세 추가
- `.env.example` 에 `CLOUDFLARE_VECTORIZE_INDEX_NAME` 키와 폴백 설명 주석 추가
- 통합 테스트 `tests/integration/hybrid-router-fallback.test.ts` — env 미설정 시 pgvector 경로 통과 검증 (M1의 시드 활용)

산출물:
- `lib/ai/hybrid-router.ts` 수정
- `.env.example` 갱신
- `tests/integration/hybrid-router-fallback.test.ts`

검증: REQ-QUAL-011 ~ 014

### Milestone M4 — Document Ingestion E2E (Priority: High, Group D)

M1과 병렬 가능. 업로드 → 검색 흐름 배선 검증.

작업:
- `app/(app)/admin/documents/upload/page.tsx` Server Action / API route 추적
- `lib/ingest/{extract,pii,chunkers,embed,sources}` 와의 연결 지점 확인
- 누락된 경우 배선 (기존 컴포넌트 재사용, 신규 UI 금지)
- E2E 테스트(Playwright) 추가:
  1. admin 로그인
  2. 테스트 픽스처 PDF 업로드
  3. `sources` + `source_sections` insert 검증
  4. 같은 세션에서 검색 → 업로드한 문서 등장 확인
  5. non-admin 접근 시 403 검증
  6. 크기 초과 / 미지원 포맷 / PII 실패 케이스 검증

산출물:
- (필요 시) Server Action 배선 코드
- `tests/e2e/admin-document-upload.spec.ts`
- 테스트 픽스처: `tests/fixtures/sample-regulatory.pdf`

검증: REQ-QUAL-015 ~ 019

### Milestone M5 — Security Headers CI Pass (Priority: Medium, Group E)

독립 트랙. 기존 E2E 테스트 안정화 중심.

작업:
- 현재 보안 헤더 E2E 테스트 위치/상태 점검
- 4개 헤더 + nonce 일치 검증 케이스 보강
- middleware (edge runtime) 에서 헤더 적용 경로 확인
- CI 환경에서 chromium 프로젝트 통과 확인 (필요 시 빌드 산출물 사용 옵션 도입)
- 누락 헤더가 있으면 미들웨어 측 수정

산출물:
- `tests/e2e/security-headers.spec.ts` (기존 보강)
- (필요 시) `middleware.ts` 또는 보안 헤더 모듈 수정

검증: REQ-QUAL-020 ~ 023

### Milestone M6 — RBAC Coverage Audit (Priority: Medium, Group F)

M4 이후. RBAC 매트릭스에 admin 문서 라우트 포함 확인.

작업:
- `scripts/qa/check-rbac.mjs` 와 `scripts/qa/rbac-whitelist.json` 검토
- admin 문서 라우트 4종(`/admin/documents`, `/admin/documents/upload`, `/admin/documents/[id]`, `/admin/radar`) 포함 확인
- 누락 라우트 자동 탐지 로직 보강 (App Router 스캔 → whitelist 비교)
- CI 잡 `pnpm ci:rbac` 통과

산출물:
- `scripts/qa/check-rbac.mjs` 또는 `rbac-coverage.ts` 수정
- `scripts/qa/rbac-whitelist.json` 갱신

검증: REQ-QUAL-024 ~ 025

---

## 3. Technical Approach

### 3.1 Corpus Seed Architecture (Group A)

- 데이터 출처: 공개 규제 문서(FDA 21 CFR Part 820, EU MDR 텍스트 등)에서 직접 추출한 텍스트 청크
- 청크 크기: 기존 `lib/ingest/chunkers/` 정책과 정합 (의미 단위, 1500~2500자 권장)
- 임베딩 모델: 기존 1536차원 벡터 모델 그대로 사용 (스키마 호환)
- 결정성: `chunk_id = sha256(corpus + anchor + text).slice(0, 12)` — 재실행 시 동일 id
- 저장 형식: 시드 데이터는 JSON으로 커밋, 임베딩은 시드 시점 생성 (모델 변경 시 재시드 필요)

### 3.2 Eval Pipeline (Group B)

- promptfoo 결과 JSON을 `tests/eval/results/baseline.json` 으로 커밋, PR마다 diff 추적
- 시나리오 분류는 promptfoo 메타데이터 또는 별도 scorer로 부착
- CI 잡 분리: PR 트리거에서는 sample subset, main 머지 시 full suite
- 실패 시나리오는 issue 자동 생성 대신 PR 댓글로 요약 (별도 자동화는 본 SPEC 범위 밖)

### 3.3 Cloudflare Fallback (Group C)

- 단일 변경: `retrieveVectorize` 스텁의 TODO 주석을 정식 fallback 노트로 교체
- 향후 실제 Vectorize binding은 별도 SPEC에서 처리 — 현재는 "intentional fallback" 상태를 코드/문서/테스트로 명시화
- @MX 태그: `// [AUTO] @MX:NOTE: pgvector fallback active when CLOUDFLARE_VECTORIZE_INDEX_NAME unset`

### 3.4 DocIngest Wiring (Group D)

- 기존 `lib/ingest/` 모듈은 그대로 두고, UI ↔ ingest pipeline ↔ DB 의 연결 지점만 검증/보강
- Server Action 또는 API route 신규 생성은 최소화, 기존 흐름 재사용 우선
- E2E 테스트는 실제 DB(테스트용 Postgres) 연결 — Cloudflare 의존 없음

### 3.5 Security Headers (Group E)

- middleware/edge 에서의 헤더 주입 경로 일원화
- nonce 생성 로직 중앙화 (이미 존재한다면 검증만)
- CSP/HSTS 값은 기존 정책 유지 — 본 SPEC 에서 정책 변경 금지

### 3.6 RBAC Coverage (Group F)

- App Router 디렉토리 스캔 → whitelist 누락 라우트 자동 식별
- 신규 admin 라우트 추가 시 `rbac-whitelist.json` 갱신을 강제하는 lint 규칙 추가 검토

---

## 4. Risks and Mitigations

| Risk                                                       | Likelihood | Impact | Mitigation                                                                                  |
| ---------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------- |
| 규제 원문 라이선스 / 인용 범위 모호                        | Medium     | High   | 공개 문서만 사용; 인용 출처 메타데이터 필수; 법무 검토 필요 시 사용자에게 보고               |
| 80% 통과율 미달                                            | Medium     | High   | 실패 시나리오 분류로 corpus-gap vs model-issue 식별; 시드 보강으로 재달성                    |
| 임베딩 생성 시간 과다 (≥ 100 청크)                         | Low        | Medium | 시드 시점에 1회 생성 후 JSON에 임베딩 동봉(선택), 또는 CI에서 캐시 활용                      |
| Cloudflare 환경에서 fallback 의도치 않은 활성화            | Low        | Medium | 통합 테스트에서 env 분기 명시 검증; 운영 모니터링 알림 추가는 별도 SPEC                      |
| E2E 보안 헤더 테스트가 `next dev` 와 production build에서 다름 | Medium     | Medium | CI에서 production build 사용; dev 모드 테스트는 분리                                          |
| 업로드 E2E 테스트의 비결정성 (PII/임베딩 비동기)            | Medium     | Medium | 테스트에 명시적 polling/await 적용; 결정적 픽스처 사용                                       |

---

## 5. Out of Scope (See spec.md §4 Exclusions)

본 plan은 spec.md §4 의 Exclusions(EXC-1 ~ EXC-7)를 그대로 준수한다. 신규 코퍼스, 모델 변경, Vectorize 실제 구현, UI 개편, 권한 모델 확장, 성능 최적화, 멀티테넌트 격리 강화는 모두 별도 SPEC 으로 분리.
