# Regula 코드베이스 중간점검 및 개선안 — 2026-07-07

| 항목 | 내용 |
|---|---|
| 상태 | 분석·검증 완료, 개선안 도출 |
| 범위 | 전면 딥 오딧(6차원) · 전체 정책 기준 · 코드 126,831 LOC |
| 방법론 | 6차원 병렬 분석(Explore very thorough) → 종합(xhigh) → 적대적 검증(xhigh), 총 8 에이전트 / 697K 토큰 / 565 툴사용 |
| 산출 | findings 63건 → 통합 개선안 9건 → 검증(수치·순서 정정) |
| 후속 | 본 문서 + GitHub 이슈 등록(Issue-First Protocol) |

> 본 문서는 검증 에이전트의 **수치 정정·v3 순서 재정렬**을 적극 반영한다. 종합(synthesis) 원본의 과잉·오측정 항목은 §6에서 명시적으로 정정한다.

---

## 1. 요약 진단

종합 건전도 **~59/100**. v3 아키텍처 개편 Phase A(도메인 아카이브)가 부분 진행 중이나, 구조적 부채가 광범위하게 누적된 상태다.

### 3대 병목 (3개 차원에서 동시 1순위)

1. **`lib/db/schema.ts` 집중** — 직검 3,515줄, pgTable **94개**, 179개 파일이 직접 import. 모든 도메인 수정이 이 파일로 수렴하여 merge conflict 폭발 지점.
2. **kernel 경계 부재** — `lib/kernel/` 디렉토리 미존재(직검). `@/lib/auth`(171)·`@/lib/db/client`(151)·`@/lib/audit`(114)가 367개 파일(전체 ~50%)에 직접 참조. v3 Phase C(도메인 구현) 진입의 선행 조건.
3. **SPEC 부채 + CI gate 직검 신뢰 부족** — draft SPEC 22개, `ci:audit`가 route literal만 검사, `ci:module-boundaries`가 1개 결합만 검사, E2E full suite가 `if: false`로 비활성화. L-007/L-013/L-015 교훈이 실제 게이트로 구현되지 않음.

### 권고 방향 (검증 반영)

- **즉시(quick-win)**: Husky pre-commit(`lint`+`typecheck`만, `test`는 pre-push) + `pnpm preflight` 로컬 일괄 실행 + VALIDATION-002 코드-SPEC 불일치 정정 + `lib/impact/` shim 제거 + POLICY 부채 정리.
- **단기(short-term)**: integration 테스트 real-db 전환(L-013 해소), consult.ts RAG 파이프라인 분할 + 프론트 대형 컴포넌트 분해, writeAudit tx AST 감사.
- **구조개편(structural)**: schema.ts 분할 · kernel 추출 · 도메인 이전 완결은 **별도 SPEC이 아닌 `SPEC-V3-RESTRUCTURE-001` tasks.md로 흡수** (v3 마스터 계획과 중복). 순서는 v3 계획(Phase A 잔여 → Phase B kernel → schema 분할)을 따른다.

---

## 2. 건전도 스코어카드

| 차원 | 점수 | 핵심 진단 |
|---|---|---|
| architecture-modularity | **42** | lib/ 최상위 45개 중 `domains/` 이전 4개(8.9%). `lib/kernel/` 미존재. 도메인 `index.ts` 부재로 캡슐화 붕괴. |
| spaghetti (거대 파일) | **65** | schema.ts 3,515줄이 핵심 병목. permissions.ts 646/audit.ts 645는 단일 책임 원칙 준수로 양호. consult.ts 830 RAG·프론트 7개 대형 컴포넌트(3,736줄) 분해 필요. |
| policy (정책 준수) | **72** | CLAUDE.md 28K(40K 제한 내), emoji 금지 완전 준수. 그러나 CI 스크립트 thin command 위반, `ci:audit` route literal만, archive 334파일 `@MX:LEGACY` 누락. |
| spec 워크플로 | **42** | draft 22개(29%). Plan-Run-Sync 산출물 39%만 충족. VALIDATION-002 선행 SPEC 거짓 CLOSED 주장. v3 Phase B(kernel) `SPEC-V3-RESTRUCTURE-001` planned로 지연. |
| infra (결합도) | **62** | auth/db/audit 367파일(50%) 참조. service-role bypass 1곳 제한(안전). schema.ts 분할 시급. Part 11 tx 내 writeAudit 불일치 위험. |
| test (신뢰성) | **72** | 4,815+ 테스트(verify 직검 baseline). integration mock 과다(L-013 재현), E2E `if:false` 비활, unit 편중. CI gate 수동 실행 의존(L-015). |

---

## 3. 3대 병목 상세 (직검 증거)

### 3.1 `lib/db/schema.ts` 중앙 집중

- **직검**: `wc -l` = 3,515줄, `grep -c pgTable\(` = **94개** (보고서 93 → 94 정정). `schema-docingest.ts`(199줄, 3 테이블) 분할 선례 존재.
- **import 영향**: `@/lib/db/schema` 참조 179개 파일. `drizzle.config.ts` 직검 시 `schema: './lib/db/schema.ts'` 단일 파일 하드코딩 → 분할 시 glob 패턴 수정 필요.
- **회귀 위험(verify)**: 122개 migration + 261개 FK 보존 필요. RLS GUC `app.current_org_id()` 2곳 명시(`lib/db/schema.ts:1309, 2885`). **drizzle-kit 0.31+ multi-file schema 생성 마이그레이션 호환성 사전 검증 필수**(공백 diff migration 생성 위험) — L-010 실DB 테스트 동반.

### 3.2 kernel 경계 부재

- **직검**: `lib/kernel/` = 존재하지 않음(ENOENT). `@/lib/auth` 171 / `@/lib/db/client` 151 / `@/lib/audit` 114 파일 참조(총 367, 전체 ~50%). (보고서 178/173/116은 v3 마스터 계획 인용값과 사소 차이 — 본 문서는 직검값 채택.)
- **도메인 현황**: `lib/domains/` 4개만 이전(`consult/impact/inbox/triage`). lib/ 최상위 45개 중 41개 미이전.
- **v3 계획 정합**: `docs/proposals/v3-architecture-revamp-plan-2026-07-02.md` 라인 60-227 및 `SPEC-V3-RESTRUCTURE-001` tasks.md Phase A/B에 명시된 작업. **kernel 추출은 schema 분할과 병렬 또는 선행 가능** (보고서 Rank 3→2 의존성 설정은 v3 순서와 모순 — 의존성 역전 검토).

### 3.3 SPEC 부채 + CI gate 신뢰

- **SPEC**: draft 22개(직검 `status: draft`). 그중 stale >60일: CLOUDFLARE-001(76일), PCCP-001/COEDIT-001(64일). VALIDATION-002 spec.md가 선행 SPEC #71/#48을 "모두 CLOSED"로 기술 → 실제 #71(MODEL-GOVERNANCE-001)/#48(SOURCE-GOVERNANCE-001)은 코드 구현 완료·SPEC 문서 draft 상태(불일치).
- **`ci:audit`**: `scripts/qa/audit-completeness.ts` 직검 — `collectRouteFiles()`가 `app/api/**/route.ts`만 재귀 스캔(라인 144-155). lib/ 도메인 audit wrapper 미검사. `APPROVED_AUDIT_WRAPPER_NAMES`(14개 래퍼) 리스트 존재.
- **`ci:module-boundaries`**: `scripts/ci/module-boundaries.ts` 직검 — `lib/observability` → `lib/audit` 1개 결합만 검사.
- **E2E**: `.github/workflows/e2e.yml:66` `if: false` 직검(라인 62 주석 "remove if:false"). 24개 spec 중 3개 smoke만 실행. `continue-on-error: true` 다수(ci.yml 라인 47/51/61/129, deploy.yml, security.yml).

---

## 4. 검증된 개선안 로드맵 (9건)

> phase 분류: **quick-win**(즉시/저회귀) · **short-term**(단기/중회귀) · **structural**(구조개편/고회귀, v3 RESTRUCTURE-001 흡수). verdict는 검증 에이전트 판정.

### 4.1 Quick-win (즉시 실행 권고)

#### #4 CI gate 직검 신뢰성 강화 — `verdict: confirmed`
- **범위**: (a) Husky pre-commit 도입 — `lint-staged` + `biome check --write` + `ci:typecheck`만(**test는 pre-push로 분리**, 4,815 테스트 실행 시간으로 개발자 경험 악화 방지). (b) `pnpm preflight` 스크립트로 `ci:*` 12종 로컬 일괄 실행 자동화. (c) `ci:audit` 확장 — lib/ 도메인 audit wrapper(`lib/domains/*/audit*.ts`, `lib/cer/audit.ts`, `lib/model-governance/audit.ts`) 패턴 추가(기존 `APPROVED_AUDIT_WRAPPER_NAMES` 확장). (d) `ci:module-boundaries` 확장 — madge/dependency-cruiser로 domain→domain, domain→kernel 의존 검사. (e) QA gate(gate-0~5)를 `.github/workflows/qa.yml` 통합, PR 필수 체크. (f) CI 스크립트(contrast-check 120줄 등)를 routing wrapper(20LOC) + `lib/qa/` 구현 분리(thin command pattern 준수).
- **회귀**: low. 단, `ci:audit` 확장 시 기존 `audit-check-ignore` 주석 호환성·14개 래퍼 리스트 확장 시 기존 route 통과 케이스 회귀 확인.
- **정책 기여**: L-015(전 단계 로컬 직검) 교훈의 실제 게이트 구현.

#### #8 POLICY 부채 정리 — `verdict: confirmed`
- **범위**: (a) CLAUDE.md 코드블록 6개 제거 → `.claude/rules/moai/`로 이동(`@import` 확대). (b) `archive/qms-pms/` 파일에 `@MX:LEGACY` 서브라인 일괄 추가(`scripts/qa/check-mx-legacy.mjs` 신설). (c) `.claude/rules/agency/constitution.md` redirect stub 삭제(2 minor version 경과). (d) 중첩 CLAUDE.md(`/home/abyz-lab/`, `/home/abyz-lab/work/`, project-local 3곳) 통합 — project-local만 유지. (e) CLAUDE.md 40K 임계 경고 스크립트(현재 28K/673줄).
- **정책 메모**: `@MX` tag 한국어 전환(POLICY-010)은 `code_comments: ko` 설정에서 기술 식별자 예외 허용 여부 사전 확인 필요. archive 파일 수는 "수백 개"로 표기(334개 직검 미수행).

#### #1(축소) SPEC 부채 최소 정리 — `verdict: modified`
- **범위(verify 축소)**: (a) VALIDATION-002 `#71/#48 모두 CLOSED` 주장을 "코드 구현 완료, SPEC 문서는 보완 예정"으로 정정(PR #360 반영). (b) `archive/qms-pms/specs/` 4개 SPEC 중 draft 3개를 `status: archived` 통일. (c) stale >60일 draft(CLOUDFLARE/COEDIT 등)만 명시적 폐기 검토.
- **정정(verify)**: 보고서 "draft 22개 중 15개(68%) 폐기 후보"는 **근거 부족** — dhf/samd/esubmit 등 아카이브 도메인과 직접 이름 매핑되는 SPEC 부재 → 폐기 15개 보류, 3-5개로 축소. 매핑 재조사 선행.

#### #6(축소) 도메인 shim 제거 + index.ts barrel — `verdict: confirmed`
- **범위(저회귀 부분만)**: (a) `lib/impact/` shim 파일 6개(action-queue/analyzer/audit-queue/portfolio-scanner/section-mapper/types) 즉시 제거 — `lib/domains/impact/` 실구현과 중복(직검). (b) 8개 도메인(classification/risk/standards/radar/knowledge-sources/traceability/export/signature)에 `index.ts` barrel 추가 — 공개 API만 export, 내부 모듈은 `internal.ts` 격리.
- **정정(verify)**: 8.5% → 직검 8.9%(4/45). 도메인 간 직접 import 차단(`ci:module-boundaries` 확장)은 #4와 중복 → 통합.

### 4.2 Short-term (단기)

#### #5 integration 테스트 real-db 전환 — `verdict: modified`
- **범위**: (a) `tests/integration/real-db/` 신설(`migrations-real-db.test.ts` 선례 확장). (b) Docker Compose test DB 활용, `vi.mock('@/lib/db/client')` 제거. (c) `tests/fixtures/database.ts` 신설 — `setupTestDB/teardownTestDB/truncateTables`, `beforeEach` TRUNCATE CASCADE로 테스트 격리(TEST-009). (d) `skipIf(!DATABASE_URL)` 패턴 확장. (e) `vitest --coverage` 도입(85%+ 측정, POLICY-007).
- **정정(verify, 중요)**: 보고서 "integration 테스트 29개"는 **과잉** — 직검 `find tests -name '*integration*'` 결과 **2개**. real-db 전환 대상은 "integration 29개"가 아닌 **"mock db 57개 파일 중 스키마/FK 의존 시나리오"**로 재정의. **테스트 피라미드 목표치(unit 208→150 등) 삭제** — Charter 지양-1(과잉 enterprise) 위반. L-013 해소 방향은 타당, 순차적 전환 명시.
- **회귀(verify)**: Docker Compose test DB 구동 시간, 122 migration 순차 적용, CI 실행 시간 증가(현재 `continue-on-error: true` 다수) → CI 파이프라인 타임아웃 위험. 순차적 전환 필수.

#### #7 consult.ts RAG 분할 + 프론트 대형 컴포넌트 분해 — `verdict: modified`
- **범위**: (a) `lib/ai/consult.ts`(830줄) → PipelineOrchestrator + Stage별 handler(Intent/Retrieval/LLM/Persist) + StreamEventEmitter 분할. 함수 시그니처 유지 시 `app/api/consult/route.ts` 변경 불필요. (b) 프론트 대형 컴포넌트 분해 — StandardsClient(744) → Filter+List+Detail, ProjectMemoryClient(623)·ClassificationWizard(527) 동일 패턴(평균 150-200줄). (c) 동적 import 65개 중 빌드 타임 로드 가능 분량은 정적 import 전환(Inngest functions 내부만 동적 허용 문서화).
- **정정(verify)**: 파일 경로 정정 — `components/standards/StandardsClient.tsx`(보고서) → 실제 `app/(app)/workflows/standards/_components/StandardsClient.tsx`, `components/shell/Sidebar.tsx`. **"동적 import 65개(Inngest)"·"10단계 RAG async generator"는 미검증 → 추정 표기**. `lib/ai/consult.ts` → `lib/domains/consult/` 이동은 `lib/domains/consult/` 이미 존재(직검)하므로 **이미 완료된 이동**, 제외.
- **Charter 정합**: 지양-4(AI 자동 판단 금지) — RAG 단계 분리만, confidence gating 로직 건드리지 않음.

### 4.3 Structural (v3 RESTRUCTURE-001 흡수 — 별도 이슈 X)

> verify 권고: 이 영역은 **별도 SPEC/이슈로 진행하지 말고 `SPEC-V3-RESTRUCTURE-001` tasks.md 체크리스트로 통합**. 순서는 v3 마스터 계획(Phase A 잔여 아카이브 → Phase B kernel 추출 → schema 분할)을 따른다. 보고서 Rank 순서(schema 선행)는 의존성 역전 위험.

#### #2 schema.ts 도메인별 분할 — `verdict: confirmed`
- **목표**: 3,515줄(94 테이블) → 4-5개 `schema-{domain}.ts` (kernel/ai/workflow/governance/reference 그룹, **4-5개로 제한 — Charter 지양-1).
- **전략**: `lib/db/index.ts`에서 `export * from './schema-*'` re-export 패턴으로 179개 파일 일괄 import 수정 회피. `drizzle.config.ts` glob 패턴 수정.
- **선행 조건(verify)**: drizzle-kit 0.31+ multi-file schema 지원 사전 검증(drizzle docs). 공백 diff migration 생성 위험 → L-010 실DB 적용 테스트 필수.
- **v3 매핑**: `SPEC-V3-RESTRUCTURE-001` tasks.md Phase B 후반.

#### #3 kernel 추출 — `verdict: confirmed`
- **목표**: `lib/kernel/{auth,db,audit}/` 생성, 공개 API만 re-export. `@/lib/auth` → `@/lib/kernel/auth` 등 import 경로 일괄 변경(367파일).
- **전략**: codemod 자동화 스크립트로 수작업 회피. `AuditAction` 타입(73 액션) 별도 `audit-actions.ts` 분리. `permissions.ts`(646줄)는 도메인별 분할 검토(단순 데이터 구조 분할에 머물 것 — Charter 지양-1, 과도한 adapter/factory 금지). `ci:module-boundaries`에 kernel→domains 역방향 의존 금지 추가.
- **v3 매핑**: `SPEC-V3-RESTRUCTURE-001` Phase B. v3 계획 라인 197-201(kernel 공개 API 명시)과 정렬.
- **의존성(verify)**: 보고서 Rank 3 dependsOn Rank 2(schema) 설정은 v3 순서(kernel 선행/병렬)와 모순 → 의존성 재검토.

#### #9 E2E 순차 활성화 + Part 11 + RLS 감사 — `verdict: confirmed (축소)`
- **E2E**: `if: false` 제거는 **issue #81(Wave 1 E2E Gate) 종료 조건 정의 후**. DB 의존 시나리오 6개(auth/consultation/expert-review/export-hub/predicate/risk) 순차 추가. Docker test DB 서비스 활용.
- **Part 11 atomicity**: writeAudit tx 외부 패턴 감사. **verify 정정**: 단순 grep `writeAudit({` 54곳 식별이나, 이들 중 상당수는 `db.transaction` 블록 내부일 가능성. **AST 기반 call graph 분석(madge/dependency-cruiser) 선행 도입 후** Part 11 위반 단정. 레거시 도메인(`lib/impact`·`lib/export`·`lib/cer`) 집중.
- **RLS 잔여 도메인**: cyberdevice/model-governance/traceability `withTenantScope` 점검. `psql \d <table>`로 USING 정책 확인. 기존 이슈 **#317**(sources/source_sections RLS)과 협력 — #317은 sources 계열, 본 감사는 타 도메인으로 확장.

---

## 5. 위험 영역 (방치 시 악화)

1. **Part 11 audit atomicity** (INFRA-007) — tx 외부 writeAudit이 레거시 도메인에 잔존 시 21 CFR Part 11 §11.10(e) 감사 추적 보장 실패. **규제 리스크 직결**. AST 도구 선행 후 도메인 단위 일괄 점검.
2. **`lib/db/schema.ts` 단일 파일** — 수정 시마다 merge conflict, PR diff 가독성 붕괴. 팀 전체 생산성 저하.
3. **RLS #239 잔여 도메인** (INFRA-006) — cyberdevice/model-governance/traceability. org_id denormalization 누락 시 cross-org 데이터 누출 가능.
4. **E2E full suite 비활성화** — real-world 사용자 시나리오 회귀 포착 불가. 프로덕션 결함 누적.
5. **kernel 추출 지연** — Phase B 미시작으로 Phase C 진입 불가. v3 개편이 Phase A partial에서 멈춰 구조적 부채 누적.

---

## 6. 검증 정정 (hallucination flags · 보고서 원본 대비)

본 보고서는 검증 에이전트가 지적한 7건의 수치·경로 정정을 반영했다. 원본 synthesis 대비 주요 정정:

| 항목 | 보고서 원본 | 검증 정정 |
|---|---|---|
| SPEC 폐기 후보 | draft 22개 중 15개(68%) | 근거 부족, **3-5개로 축소**, 매핑 재조사 선행 |
| integration 테스트 수 | 29개 | 직검 **2개**(mock db 57파일로 대상 재정의) |
| pgTable 수 | 93개 | 직검 **94개** |
| auth/db/audit 참조 | 178/173/116(v3 계획 인용) | 직검 **171/151/114** |
| 프론트 컴포넌트 경로 | `components/standards/...` | 실제 `app/(app)/workflows/...`·`components/shell/` |
| 동적 import 65개/async generator | 단정 | **미검증, 추정 표기** |
| writeAudit tx 외부 94곳 | 단순 grep | grep 불가, **AST 분석 선행** |
| 테스트 피라미드 목표치 | unit 208→150 등 | **삭제**(Charter 지양-1 위반) |
| baseline 테스트 수 | 4,700+ | v3 공식 baseline **4,815+** 채택 |

---

## 7. v3 마스터 계획 정합성

- **중복 확인**: Rank 2(schema 분할)·Rank 3(kernel 추출)·Rank 6(도메인 이전)은 모두 `docs/proposals/v3-architecture-revamp-plan-2026-07-02.md` 라인 60-227 및 `SPEC-V3-RESTRUCTURE-001` tasks.md Phase A/B에 명시. **별도 SPEC/이슈 중복 위험 → 해당 SPEC 체크리스트로 통합**.
- **순서 정렬**: v3 계획 순서(Phase A 잔여 14도메인 아카이브 → Phase B kernel → schema 분할). 보고서 Rank 순서(schema 선행)는 v3 순서와 상이 → **v3 계획 우선**.
- **PHI 의존**: `SPEC-V3-RESTRUCTURE-001` depends_on `SPEC-REGULA-PHI-REMOVAL-001`. Rank 1(SPEC 부채 정리)이 PHI 도메인 포함 시 Charter 지양-3(PHI 금지) 정합성 검증 선행.
- **kernel 공개 API**: v3 계획 라인 197-201이 `db/withTenantScope`, `getSession/requireRole`, `writeAudit/verifyHashChain`, `rateLimit`, `uploadAsset` 명시 → Rank 3 권고와 정렬. `AuditAction` 73개 분리는 v3 계획에 미명시(추가 검토).

---

## 8. 이슈 매핑 (Issue-First Protocol)

| 개선안 | phase | 이슈 처리 |
|---|---|---|
| #4 CI gate 강화 | quick-win | **신규 이슈** [qa/infra, priority/high] |
| #8 POLICY 부채 정리 | quick-win | **신규 이슈** [docs/policy, priority/medium] |
| #1(축소) SPEC 부채 최소 정리 | quick-win | VALIDATION-002 정정은 **PR #360 반영**, archive status는 동 이슈 또는 docs PR |
| #6(축소) shim 제거 + barrel | quick-win | **신규 이슈** [refactor, priority/medium] |
| #5 integration real-db 전환 | short-term | **신규 이슈** [test, priority/high] |
| #7 consult.ts/프론트 분해 | short-term | **신규 이슈** [refactor, priority/medium] |
| #9(축소) writeAudit AST 감사 + RLS | short-term | **신규 이슈** [security, priority/high], 기존 **#317 협력** |
| #2 schema.ts 분할 | structural | `SPEC-V3-RESTRUCTURE-001` tasks.md 흡수(별도 이슈 X) |
| #3 kernel 추출 | structural | `SPEC-V3-RESTRUCTURE-001` tasks.md 흡수(별도 이슈 X) |

---

## 9. 다음 단계 권고

1. **즉시(본 세션 후반)**: 신규 이슈 6건 등록(§8) — quick-win 3건(#4, #8, #6 축소) + short-term 3건(#5, #7, #9 축소). structural 2건(#2, #3)은 `SPEC-V3-RESTRUCTURE-001` tasks.md에 체크리스트 항목으로 추가.
2. **PR #360(VALIDATION-002 plan) 처리**: #1(축소)의 VALIDATION-002 코드-SPEC 불일치 정정을 PR 본문에 반영하거나 머지 후 docs PR.
3. **실행 순서(verify 권고)**:
   - Quick-win 먼저(#4 Husky pre-commit + #8 POLICY 정리 + #6 shim 제거) — 회귀 낮고 L-015 교훈 즉각 구현.
   - Short-term(#5, #7, #9) — 별도 브랜치·SPEC 기반 순차.
   - Structural은 v3 마스터 계획 Phase A 잔여 → Phase B(kernel) → schema 분할 순서로 `SPEC-V3-RESTRUCTURE-001` 진행 시 흡수.
4. **비파괴 원칙**: 모든 structural 변경은 4,815+ passed baseline 유지. schema 분할·kernel 추출 시 L-010(실DB 테스트)·L-013(직검)·L-015(ci:* 전 단계) 적용.
5. **Charter 준수**: 지양-1(과잉 enterprise) — 테스트 피라미드 목표치·과도한 factory/adapter 배제. 지양-4(AI 자동 판단 금지) — consult.ts 분할 시 confidence gating 불변. 지양-5(검증 문서 자동화) — 본 개선안이 VALIDATION-002 정식 연동 전제에 기여.

---

## 부록: 분산 추적

- **워크플로우 Run ID**: `wf_a1f170e9-42f` (스크립트: `.claude/projects/.../workflows/scripts/regula-midcheck-audit-wf_a1f170e9-42f.js`)
- **6차원 findings 상세**: `.claude/projects/.../subagents/workflows/` 트랜스크립트(63 findings 전체)
- **스카우팅 데이터**: context-mode 인덱스(lib 구조/결합도/SPEC/정책 인벤토리)

---

버전: 1.0.0 (2026-07-07)
작성: MoAI orchestrator (regula-midcheck-audit 워크플로우)
검증: 적대적 검증 에이전트(수치·순서·hallucination 필터링 적용)
