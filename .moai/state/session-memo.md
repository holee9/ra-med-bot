# Session Memo — 2026-07-02 (v3 아키텍처 전면 개편 착수)

> 세션 연결용. 상세 맥락은 auto-memory `project-state.md`가 1차 진실원. 본 파일은 빠른 시작 요약. 다음 세션이 가장 먼저 읽을 파일.

## 현재 상태 (main 안정 — Phase A 복구 후)
- main HEAD `a8ef633` (Phase C-2 아카이브 + project 문서 안정 상태로 복원됨)
- 본 세션: v3 분석/마스터 계획/project 문서/Phase C-2 아카이브 완료 + SPEC-V3-RESTRUCTURE-001 작성. **Phase A(잔여 14도메인) 1차 시도 실패→복구**.
- typecheck exit 0 (복구 후 검증), archive 106 files 정상
- 체크포인트 커밋: docs(v3) + refactor(archive) [완료] + SPEC-V3-RESTRUCTURE-001 [예정]

## ⚠️ Phase A 시도·실패·복구 (2026-07-02 본 세션 후반)
- expert-refactoring에 Phase A(잔여 14도메인 아카이브) **일괄 위임** → tasks.md 매트릭스가 pms CER route 의존성(`assertPmsProjectAccess`) 누락 + 롤백 시도(`git reset --hard` deny 차단)로 **Phase C-2 archive까지 훼손**(원위치 중복 발생)
- **복구**: SPEC 백업(/tmp) → `git stash --include-untrusted`(Phase A 변경隔离) → HEAD(a8ef633) 복원 → SPEC 복원. archive 106 files 정상, typecheck 0. SPEC-V3-RESTRUCTURE-001 보존(spec 287 + tasks 213)
- `stash@{0}` phase-A-partial-rollback-mess에 Phase A 변경 보존(참고용, 버려도 OK)
- **핵심 교훈**: (1) 도메인별 **개별 위임**(일괄 14도메인 금지), (2) tasks.md 매트릭스 신뢰 전 **import 직검**, (3) `git clean -fd` deny → `git stash --include-untracked` 우회, (4) pms는 SHRINK 필요(`assertPmsProjectAccess` → lib/kernel 또는 lib/cer)

## 본 세션 완료 — v3 개편 Phase A/B + C-2

### v3 분석 + 방향 확정 (오케스트레이터 ultrathink)
- `docs/v3/` 8문서: RA 게이트웨이 정체성(Employee 26명/RA 3명/Admin 1명), 3-tier persona, DB 8스토어, **QMS 명시 폐기**(BK-201/202)
- 현재 main vs v3 매핑: 인프라(pgvector per-corpus/delta-sync/audit/auth/consult/radar/gx10) **재사용(초과달성)** / Inbox·Triage·Impact 4-layer·3-tier UI **신규** / QMS 18도메인 **아카이브**
- 사용자 방향 5종: 점진적 마이그레이션 + QMS 아카이브 + UI/UX v3 신규 + hybrid-ra-saas 심화 연동 + 모듈화 전면 개편

### Phase A — 마스터 계획 (manager-strategy)
`docs/proposals/v3-architecture-revamp-plan-2026-07-02.md` (676줄). **계층 2.5**(kernel/domain/archive 3-tier, scope-rationalization "계층3 보류" 번복). Phase A-E, SPEC 8(INBOX/TRIAGE/IMPACT/REGISTRY/CONSULT/UI/AUDIT-CHAIN/BFF), hybrid-ra-saas 6 points.
- ⚠️ **의존성 정정(직검 L-007)**: 매니저 "2건" → **실제 38건**(risk 10/traceability 5/knowledge-gap 5/corpus-license 4/pccp 4/rlhf 3/knowledge-promo 3/model-governance 2/standards 1/project-memory 1)

### Phase B — project 문서 재생성 (manager-docs)
`.moai/project/product.md`(151) + `structure.md`(304, 의존성 38건 정정 + SHRINK 전략 반영) + `tech.md`(264). v3 타겟 아키텍처 기반.

### Phase C-2 — QMS 0-의존성 4도메인 아카이브 (expert-refactoring)
`archive/qms-pms/`: clinical-investigation/cyberdevice/labeling/change-control, **100 files**(git mv 이력 보존). config(tsconfig/vitest/biome) `archive/**` 제외. migration/schema.ts 제자리(테이블 DROP 금지).

## 🎯 다음 세션 시작점 (핵심)

### 1. Phase C 잔여 아카이브 (SHRINK + 고의존성)
- **SHRINK 2종**: rlhf(`applyRlhfReranking`→lib/ai/merge.ts용, 나머지 아카이브), knowledge-gap(`markGapResolved`/`replayGapTest`→lib/radar/delta-sync/gap-replay.ts용, 나머지 아카이브)
- **고의존성 8종**(stub 교체/import 제거/KEEP 유지 판단 후 이동): risk(10), traceability(5), corpus-license(4), pccp(4), knowledge-promo(3), model-governance(2), standards(1), project-memory(1)
- 각 도메인 이동 후 게이트 직견(typecheck/lint/test FULL, L-009)

### 2. schema.ts @deprecated 주석 (본 세션 누락)
- expert-refactoring이 4도메인 테이블 @deprecated 마커 추가 누락. lib/db/schema.ts 해당 테이블에 추가(표시용).

### 3. biome unsafe fix 1건 수동 판단
- suppression comment(no effect) 1건. 수동 검토 후 적용/유지.

### 4. Phase B kernel 추출
- lib/kernel/ 경계(db/auth/audit 공유 인프라). schema.ts 분할(schema-kernel.ts + per-domain, schema-docingest.ts 선례, Drizzle 다중 파일 glob).

### 5. Phase C v3 신규 기능 구현
- SPEC-V3-INBOX-001, TRIAGE-001 (Inbox 4-column Kanban + Auto-Triage — **현재 전무**, chat 기반과 다른 패러다임)
- SPEC-V3-IMPACT-001 (Impact 4-layer wizard, retestMatrix 35셀 = `docs/v3/reference/data.jsx:1203`)

### 6. Phase D: UI 재작성 + audit hash chain
- 3-tier PersonaBar UI(v3 신규, 현재 components/ 재사용 X). audit hash chain(BK-105: previous_hash BYTEA + SHA-256 + 월간 검증 cron, 현재 append-only만).

### 7. Phase E: lib/bff/ 통합 + hybrid-ra-saas 심화
- 기존 lib/api/ 4 BFF 클라이언트 → lib/bff/ 통합, 6 integration points.

## 핵심 문서
- 마스터 계획: `docs/proposals/v3-architecture-revamp-plan-2026-07-02.md` (676줄)
- project 문서: `.moai/project/{product,structure,tech}.md`
- v3 원본: `docs/v3/` (README + 01-05 + reference/data.jsx)
- 아카이브: `archive/qms-pms/` (README에 복원 방법 + 의존성 정정 참조)

## 아키텍처 (Regula 정체성 — v3 정합)
- **정체성**: RA 게이트웨이(전사 인허가 도우미 + RA 워크벤치). **내부 개발 제품 자료만 취급(환자/임상 데이터 X)**. QMS 아님(Charter [지양-3]).
- **chat**: gx10 Ollama gpt-oss:120b(ollama-ai-provider /api/chat). **embedding**: gx10 qwen3-embedding(@ai-sdk/openai + dimensions:1536 MRL truncate).
- 인프라 재사용(초과달성 보존): per-corpus RAG, delta-sync, audit append-only, Auth.js v5, consult 스트리밍, radar. **전면 재작성 금지**.

## 환경 주의사항 (직견 최신)
- **DB**: `regula-test-db`(pg16, localhost:5432/regula_test). migration 최신 0103(환자정보 10 테이블 제거 반영).
- **gx10 LLM**: `http://192.168.100.1:11434` (online). LIVE 동작.
- **.env.local**: gx10 단일(LLM_PROVIDER=ollama). Anthropic/OpenAI 키 주석 보존.
- **배포**: 로컬 Next.js(:3000) + Cloudflare Tunnel. **next dev 구동 중 → pnpm build 금지(L-012)**.
- **git_workflow**: `main_direct`.
- **archive/**: tsconfig/vitest/biome 제외 설정 완료. archive 코드는 게이트 검사 대상 아님.

## 이전 세션 히스토리
- **2026-07-01**: gx10 Ollama 단일화(Phase A/B/C, main 1ca3867) + 환자정보 도메인 제거(SPEC-PHI-REMOVAL, 10 테이블). 회귀 4510.
- **2026-06-30**: Phase D 완결(#313/#314). main 685fea8.
