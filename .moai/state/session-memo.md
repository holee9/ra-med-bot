# Session Memo — 2026-07-02 (v3 Phase A 아카이브 종료 완료)

> 세션 연결용. 상세 맥락은 auto-memory `project-state.md`가 1차 진실원. 본 파일은 빠른 시작 요약.

## 현재 상태 (main 안정 — v3 Phase A 아카이브 종료)
- main HEAD `587d223` (origin 동기화 완료). Phase A(아카이브) **종료 선언**.
- 본 세션: **pms SHRINK 완료** + **SHRINK 2종·고의존성 4종 직검 → 전부 KEEP 확정**(dead 0건).
- 아카이브 누적: QMS 4종(C-2) + 저의존성 3종(A1) + pms = **8 도메인**.
- KEEP 6종(직검 확정): rlhf / knowledge-gap / corpus-license / model-governance / knowledge-promo / project-memory — v3 핵심 인프라.
- 게이트 직검: typecheck 0 / lint 0 err(warning 1=model-gov-eval-gate pre-existing) / test **4229 passed 0 failed**.

## 본 세션 작업

### 1. pms SHRINK 완료 (main `1fd97f1`, push 됨)
- `assertPmsProjectAccess` lib/pms→lib/cer 이동(git mv **R100**), cer route.ts import 정렬(organizeImports), cer-persist test mock 동기화, `lib/pms/` 제거.
- L-014 직검: 활성 참조 2곳 모두 CER 컨텍스트, 동적 import 0건.
- 별개 hardening(`431279d`): injector.test.ts unused suppression 제거(pre-existing). route.ts organizeImports는 `1fd97f1`에 amend.

### 2. SHRINK 2종 + 고의존성 4종 직검 → 전부 KEEP (L-014 전수 매핑)
| 도메인 | dead 파일 | live 근거 |
|---|---|---|
| rlhf | 0 | 4 API(feedback/calibration/aggregate/heatmap) + RAG merge 핵심 |
| knowledge-gap | 0 | 최중앙 — RAG consult(detector) + delta-sync gap-replay + hybrid 3라우트 + RLHF + Inngest |
| corpus-license | 0 | 3 API + RAG consult(usage-notice/audit) + docingest license-gate + traceability export-gate |
| model-governance | 0 | 6 API + RAG consult(runtime-guard/audit-metadata/audit 동적) + rlhf |
| knowledge-promo | 0 | 4 API(library/promote/search) + RAG retriever |
| project-memory | 0 | 4 API + RAG consult(injector 동적) + 프론트 ProjectMemoryClient |
- 세션 메모 기존 "SHRINK 2종" 분류가 L-014 직검으로 **전부 KEEP 정정** — 과소평가.

## ★ L-014 최종 정식화 (5종 직검)
도메인 아카이브/제거 전 매트릭스 맹신 금지. 5종 grep 병행:
1. **alias import**: `@/lib/<domain>`
2. **상대경로 import** (본 세션 신규 포착): `../<domain>` / `../../lib/<domain>` — alias grep에 누락 (예: `lib/ai/consult.ts:20 ../knowledge-gap/detector`, `ChatShell.tsx ../../lib/rlhf/regenerate`)
3. **동적 import**: `await import('...<domain>...')`
4. **함수명 호출처**: export 심볼명 직접 grep
5. **내부 체인 추적**: dead 후보도 도메인 내부 참조 확인(예: runtime-types→permitted-use, combination-resolver→runtime-guard)
- **stash 대조 함정**: WIP를 stash로 빼고 main HEAD lint 대조 시 WIP 변경이 만들 에러가 stash에 숨겨 미검 → "pre-existing" 오판. pre-existing 판정은 **변경 파일 자체를 lint 범위에 넣고 직검**.

## 🎯 다음 세션 시작점 (Phase A 종료 후, main `587d223`)
0. **✅ pms SHRINK 완료** (본 세션)
1. **✅ SHRINK 2종 + 고의존성 4종 = 전부 KEEP 확정** (L-014 직검, dead 0건)
2. **✅ Phase A(아카이브) 종료 선언** — 아카이브 가능 도메인 소진
3. **다음 Phase (사용자 선택 대기)**:
   - Phase B: kernel 추출(lib/kernel/ 경계 + schema.ts 분할, schema-docingest.ts 선례)
   - Phase C: v3 신규 기능(SPEC-V3-INBOX-001 / TRIAGE-001 / IMPACT-001 — 현재 전무)
   - Phase D/E: 3-tier PersonaBar UI + audit hash chain / lib/bff/
4. **schema.ts @deprecated 주석** (아카이브 8도메인 테이블 표시용, DROP 금지)

## 핵심 문서
- 마스터 계획: `docs/proposals/v3-architecture-revamp-plan-2026-07-02.md` (676줄)
- project 문서: `.moai/project/{product,structure,tech}.md`
- v3 원본: `docs/v3/` (README + 01-05 + reference/data.jsx)
- 아카이브: `archive/qms-pms/` (8 도메인, README 복원 방법)

## 아키텍처 (Regula 정체성 — v3 정합)
- **정체성**: RA 게이트웨이(전사 인허가 도우미 + RA 워크벤치). **내부 개발 제품 자료만 취급(환자/임상 데이터 X)**. QMS 아님(Charter [지양-3]).
- **chat**: gx10 Ollama gpt-oss:120b. **embedding**: gx10 qwen3-embedding(dimensions:1536 MRL truncate).
- 인프라 재사용(초과달성 보존): per-corpus RAG, delta-sync, audit append-only, Auth.js v5, consult 스트리밍, radar. **전면 재작성 금지**.

## 환경 주의사항 (직검 최신)
- **DB**: `regula-test-db`(pg16, localhost:5432/regula_test). migration 최신 0103.
- **gx10 LLM**: `http://192.168.100.1:11434` (online). LIVE.
- **.env.local**: gx10 단일(LLM_PROVIDER=ollama). Anthropic/OpenAI 키 주석 보존.
- **배포**: 로컬 Next.js(:3000) + Cloudflare Tunnel. **next dev 구동 중 → pnpm build 금지(L-012)**.
- **git_workflow**: `main_direct`.
- **archive/**: tsconfig/vitest/biome 제외 설정 완료.

## 이전 세션 히스토리
- **2026-07-02 (직전)**: v3 아키텍처 개편 착수. Phase A(마스터계획)/B(project문서)/C-2(QMS 4종 아카이브)/A1(dhf·samd·esubmit 3종).
- **2026-07-01**: gx10 Ollama 단일화 + 환자정보 도메인 제거(SPEC-PHI-REMOVAL, 10 테이블). 회귀 4510.
- **2026-06-30**: Phase D 완결(#313/#314). main 685fea8.
