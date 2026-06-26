# Session Memo

> 세션 연결용. 상세 맥락은 auto-memory `project-state.md`가 1차 진실원. 본 파일은 빠른 시작 요약.

## 현재 세션 (2026-06-26) — Knowledge/RAG 그룹 자동 순차 루프 (ultracode)

사용자: `/moai ultracode "남은 작업 모두 완료까지 계속 가자"` → **Knowledge/RAG 그룹(#50→#51→#62) × 자동 순차 루프** 확정.

### ✅ #50 KNOWLEDGE-PROMO tier1 — MERGED PR #274 (`62a4e8c`, #50 CLOSED) [완료]
- main HEAD `62a4e8c`. 회귀 **4399 passed** (+54). migration 0086, audit 196, 권한 73.
- promoted_answers + 시맨틱/풀텍스트 검색 + 승격/취소 + RAG 통합(router org_promoted wiring) + 팀 지식 library 뷰.
- 직검 캡처: 분산 카운트 단언(cyberdevice/capa)·retriever lazy import·**AC-04 dead-code**(evaluator 정오탐, router wiring fix).
- DEFER → **#275**(REQ-002 messages embedding backfill).

### ⏸️ #51 PROJECT-MEMORY tier1 — 백엔드+프론트 완료, 보안 리뷰 fix 대기 (미머지)
- **브랜치 `feat/issue-51-project-memory`** (base main `62a4e8c`, 미머지). 회귀 브랜치 기준 **4439 passed** (+40).
- migration 0087(project_memory + 2 enum + RLS + audit +3) + lib/project-memory 4모듈 + **AC-02/03 consult.ts 실제 wiring**(200-208 inject, 749-771 detect) + API 5종 + UI(projects/[id]/memory + ProjectMemoryClient).
- 카운트: audit 196→199, 권한 73→75, migration 0087. **분산 단언 8개 파일 사전 주입으로 0 실패**(#50 교훈).
- **★ 보안 리뷰 fix 대기 결함 4종 (머지 전 필수)**:
  1. **H-1 보안**: `manager.ts:295-313 approveSuggestedMemory` idempotency dead-code(RETURNING post-SET → guard 절대 false). invalidated 재승인 = REQ-012/[지양-4] 우회. **fix: `WHERE status='pending'` + rowCount=0→409**.
  2. **High (#50 dead-code 패턴)**: AC-02/03 통합 테스트 **없음**. 주석이 존재 안 하는 injector/extractor test 파일 참조. **fix: 실제 통합 테스트**(AC-02 prompt memory 포함, AC-03 detect→pending row). select-chain mock no-op이므로 실 행위 테스트 필수.
  3. **Med**: `permissions.test.ts EXPECTED_ACTIONS`에 `projectmemory.manage/view` 누락. 추가.
  4. **M-1**: 동일 key 동시 POST 23505 → 409.
  5. Low: audit comment labels(projectmemory.*→memory_*) · extractor error log.
- 게이트(현상태): typecheck 0 / lint full 0 / test FULL 4439 / build 0. **하지만 위 결함 fix 전 머지 금지**.

### 🎯 다음 세션 시작 지점 (2026-06-26) — #51 fix → 머지 → #62
1. **#51 백엔드 fix 위임**(결함 1-5 위 목록). ★결함 2(AC-02/03 통합 테스트)는 #50 교훈 — claim 아닌 실제 증명.
2. 오케스트레이터 full test 직검 + lint full + build.
3. staged 범위 직검(migrations/ 0087 포함) + PR + squash 머지(admin) + main ls-tree.
4. #51 CLOSED 후 → **#62 STANDARDS tier1** 착수(ISO/IEC/EN/ASTM 표준 매핑). 같은 tier1 파이프라인.
5. 루프 계속: 전략(#40/#42/#43)·기술부채(#39)·제출/검토(#37/#36)·시스템(#49/#1)·#202.
- DEFER 누적: #275(REQ-002)·#264·#65·#244·#245·#249·#57·#236·#238.

### 핵심 교훈 (본 세션 — dead-code 7-8회 + 분산 단언 + 보안 idempotency)
- **AC ↔ 실제 호출 dead-code**: retriever registry 등록(#50) / 주석 참조 테스트 없음(#51) — claim≠증명. evaluator가 wiring/테스트 부재 포착. 오케스트레이터 직검(call site + 파일 존재)으로 정오탐 확인.
- **분산 카운트 단언**: cyberdevice/capa 등 도메인 integration test에도 audit/perm 카운트 단언. #51은 strategy에 사전 주입→0 실패(#50은 15 failures).
- **retriever import 함정**: db/client top-level = parseEnv 부작용. lazy import.
- **approveSuggestedMemory idempotency**: RETURNING post-Set dead guard 패턴(신규 캡처). UPDATE WHERE 상태 조건 + rowCount로 검증.
- **컨텍스트 한계 시 정확한 인계**: 결함 있는 코드 머지 X. state에 fix 대기 결함 명시 후 다음 세션.

## 이전 세션 히스토리
- 2026-06-26 전반: #239 RLS Phase 1~4 + runbook 종료(PR #267~#273).
- 2026-06-25: #269·#270·#266·#268. 2026-06-24~25: 7-PR 파이프라인. 2026-06-23: tier0 #35 · tier1 #59·#47.
