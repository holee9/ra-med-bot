# Session Memo — 2026-07-02 (v3 아키텍처 전면 개편 — Phase A1 pms SHRINK 완료)

> 세션 연결용. 상세 맥락은 auto-memory `project-state.md`가 1차 진실원. 본 파일은 빠른 시작 요약. 다음 세션이 가장 먼저 읽을 파일.

## 현재 상태 (main 안정 — Phase A1 pms SHRINK 완료)
- main HEAD `431279d` = lint hardening. 직전 `1fd97f1`(pms SHRINK) ← `c184cac`(Phase A1 3종).
- 본 세션: **pms 도메인 완전 종결** — `assertPmsProjectAccess` lib/pms→lib/cer 이동(git mv **R100**, 이력 보존), cer route.ts import 정렬(organizeImports), cer-persist test mock 경로 동기화. `lib/pms/` 디렉토리 제거.
- 게이트 직검: typecheck exit 0 / lint exit 0(**error 0**, warning 1=`scripts/qa/model-gov-eval-gate.ts` noConsole pre-existing) / test **4229 passed 0 failed**(회귀 0).
- L-014 직검 적용: 활성 참조 2곳(cer route + cer-persist test) 모두 CER 컨텍스트, 동적 import(`await import`) **0건**, 숨은 의존성 없음. `lib/kernel/` 미존재(Phase B 추출 예정)→`lib/cer/`가 응집도·최소변경 양쪽 우위.
- Phase A 잔여: **SHRINK 2종**(rlhf/knowledge-gap) + **고의존성**(사용자 지시 4종: corpus-license/model-governance/knowledge-promo/project-memory).

## 본 세션 작업 — pms SHRINK (오케스트레이터 직접 실행, 사용자 승인)

### 직검 의존성 분석 (L-014)
- `lib/pms/` 파일 단 1개(`project-ownership.ts`). `assertPmsProjectAccess` 활성 참조:
  - `app/api/ra/workflows/cer/route.ts:17,50` (CER 라우트 import+호출)
  - `tests/integration/cer-persist-roundtrip.test.ts:17,238` (주석+vi.mock)
  - 나머지 전부 `archive/qms-pms/` 내부(아카이브 코드, 빌드 무관)
- 동적 import grep(`await import('...pms...')`): **0건** → 깔끔.

### 실행
1. `git mv lib/pms/project-ownership.ts lib/cer/project-ownership.ts` (R100, 빈 lib/pms 디렉토리 제거)
2. cer route.ts import 경로 + organizeImports 자동 정렬(biome --write safe fix)
3. cer-persist test vi.mock 경로 + 주석 동기화(replace_all)
4. staged 직검(L-009): 3 files +3/-3, session-memo.md 정확히 분리

### 게이트 + 별개 hardening
- typecheck/test/lint 직검. lint 도중 2개 이슈 발견:
  - `injector.test.ts:206` unused biome-ignore suppression → **pre-existing**(main HEAD stash 대조 확증, PR #276 project-memory 잔류). biome 최신이 warning→error 승격. **별개 커밋 `431279d`**로 1줄 제거(scope discipline 준수, 사용자 승인 "별개 hardening").
  - `route.ts organizeImports` → **본 pms SHRINK 관련**(import 경로 변경의 직접 결과, stash 대조 시 stash에 숨겨 미검). biome safe fix 후 `1fd97f1`에 amend.
- 최종: lint error 0, warning 1(model-gov-eval-gate pre-existing, 머지 미차단).

## ⚠️ 핵심 교훈 강화 (L-014 정식화)
- **tasks.md 매트릭스 맹신 금지** — 도메인 아카이브/제거 전 `from` grep만으로 동적 import(`await import()`) 놓침.
- 올바른 직검: (1) 키워드 자체 grep(`@/lib/pms`) (2) 함수명 호출처 grep(`assertPmsProjectAccess`) (3) 동적 import grep(`await import.*pms`).
- **stash 대조 함정**: WIP를 stash로 빼고 main HEAD lint 대조 시, WIP 안의 변경(예: route.ts import 경로 변경)이 만들 에러가 stash에 숨겨 미검. → pre-existing 판정 전에는 stash 대조 결과에도 의존 금지, **변경 파일 자체를 lint 범위에 넣고 직검**.
- 본 세션에선 route.ts organizeImports가 stash 대조로 안 보였다가 WIP 복원 후 드러남 → amend로 처리.

## 🎯 다음 세션 시작점 (핵심)

### ✅ 0. pms SHRINK — 완료 (본 세션, `1fd97f1`)
- `assertPmsProjectAccess` lib/pms→lib/cer 이동(git mv R100), cer route.ts import 정렬, cer-persist test mock 동기화. `lib/pms/` 디렉토리 제거. pms 도메인 잔여 0.

### 1. Phase C 잔여 — SHRINK 2종 (최우선)
- **rlhf**: `applyRlhfReranking` → lib/ai/ 추출 후 lib/rlhf/ 아카이브. **직검 선행**(활성 참조처 grep).
- **knowledge-gap**: `markGapResolved`/`replayGapTest` → lib/radar/delta-sync/gap-replay.ts 추출 후 아카이브.
- ⚠️ 각 도메인 `await import()` 동적 import까지 **키워드 grep 직검 선행**(L-014).

### 2. 고의존성 도메인 (직검 필요)
- 사용자 지시 4종: corpus-license(7곳 런타임)·model-governance(rlhf static)·knowledge-promo(RAG+프론트)·project-memory(consult 주입).
- 도메인별 직검 후 stub 교체/import 제거/KEEP 판단 → 이동. 게이트 직검(typecheck/lint/test FULL, L-009).

### 3. schema.ts @deprecated 주석 (이전 누락)
- lib/db/schema.ts 아카이브 도메인 테이블에 @deprecated 마커(표시용, DROP 금지).

### 4. Phase B kernel 추출
- lib/kernel/ 경계(db/auth/audit 공유 인프라). schema.ts 분할(schema-kernel.ts + per-domain, schema-docingest.ts 선례, Drizzle 다중 파일 glob).

### 5. Phase C v3 신규 기능
- SPEC-V3-INBOX-001, TRIAGE-001(Inbox 4-column Kanban + Auto-Triage — 현재 전무).
- SPEC-V3-IMPACT-001(Impact 4-layer wizard, retestMatrix 35셀).

### 6. Phase D/E: UI 재작성 + audit hash chain + lib/bff/
- 3-tier PersonaBar UI(v3 신규). audit hash chain(BK-105: previous_hash BYTEA + SHA-256 + 월간 검증 cron).
- lib/api/ 4 BFF 클라이언트 → lib/bff/ 통합, hybrid-ra-saas 6 integration points.

## 핵심 문서
- 마스터 계획: `docs/proposals/v3-architecture-revamp-plan-2026-07-02.md` (676줄)
- project 문서: `.moai/project/{product,structure,tech}.md`
- v3 원본: `docs/v3/` (README + 01-05 + reference/data.jsx)
- 아카이브: `archive/qms-pms/` (README 복원 방법 + 의존성 정정 참조)

## 아키텍처 (Regula 정체성 — v3 정합)
- **정체성**: RA 게이트웨이(전사 인허가 도우미 + RA 워크벤치). **내부 개발 제품 자료만 취급(환자/임상 데이터 X)**. QMS 아님(Charter [지양-3]).
- **chat**: gx10 Ollama gpt-oss:120b(ollama-ai-provider /api/chat). **embedding**: gx10 qwen3-embedding(@ai-sdk/openai + dimensions:1536 MRL truncate).
- 인프라 재사용(초과달성 보존): per-corpus RAG, delta-sync, audit append-only, Auth.js v5, consult 스트리밍, radar. **전면 재작성 금지**.

## 환경 주의사항 (직검 최신)
- **DB**: `regula-test-db`(pg16, localhost:5432/regula_test). migration 최신 0103(환자정보 10 테이블 제거 반영).
- **gx10 LLM**: `http://192.168.100.1:11434` (online). LIVE 동작.
- **.env.local**: gx10 단일(LLM_PROVIDER=ollama). Anthropic/OpenAI 키 주석 보존.
- **배포**: 로컬 Next.js(:3000) + Cloudflare Tunnel. **next dev 구동 중 → pnpm build 금지(L-012)**. 본 세션 build skip, typecheck+test로 컴파일/행위 검증.
- **git_workflow**: `main_direct`.
- **archive/**: tsconfig/vitest/biome 제외 설정 완료. archive 코드는 게이트 검사 대상 아님.

## 이전 세션 히스토리
- **2026-07-02 (직전)**: v3 아키텍처 개편 착수. Phase A(마스터계획)/B(project문서)/C-2(QMS 4종 아카이브)/A1(dhf·samd·esubmit 3종). main c184cac. 회귀 4229.
- **2026-07-01**: gx10 Ollama 단일화(Phase A/B/C, main 1ca3867) + 환자정보 도메인 제거(SPEC-PHI-REMOVAL, 10 테이블). 회귀 4510.
- **2026-06-30**: Phase D 완결(#313/#314). main 685fea8.
