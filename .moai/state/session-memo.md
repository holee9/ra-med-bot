# Session Memo

> 세션 연결용. 상세 맥락은 auto-memory `project-state.md`가 1차 진실원. 본 파일은 빠른 시작 요약.

## 현재 세션 (2026-06-26) — Knowledge/RAG 그룹 자율 순차 루프 완료 (ultracode)

사용자: `/moai ultracode "남은 작업 모두 완료까지 계속 가자"` → **Knowledge/RAG 그룹(#50→#51→#62) × 자율 순차 루프** → **3/3 전부 MERGED**.

### ✅ 루프 완료 — 3 tier1 머지
| 이슈 | PR | main HEAD | 회귀 | migration | audit | 권한 |
|---|---|---|---|---|---|---|
| #50 KNOWLEDGE-PROMO | #274 | `62a4e8c` | 4399 (+54) | 0086 | 196 | 73 |
| #51 PROJECT-MEMORY | #276 | `a86c2b7` | 4472 (+73) | 0087 | 199 | 75 |
| #62 STANDARDS MVP | #277 | `50b0545` | 4505 (+33) | 0088 | 203 | 77 |

**main HEAD 최종: `50b0545`**. 오픈 PR 0건. 회귀 **4505 passed** | 8 skipped. Inngest 5.

### ✅ #62 STANDARDS MVP — MERGED PR #277 (본 세션)
- 4 표준 테이블(standards_org_*) + 매핑 엔진(applicability-engine 351 LOC 재사용, citation REQ-021) + transition-calculator + revision-detector(graceful stub) + recognition-check(FDA fallback) + Inngest cron(audit step) + API 5종 + UI.
- **★ 직검**: 카운트 단언 잔존 0(grep, #50 교훈) · AC dead-code 방지(mapping-engine route 호출 + Inngest registry test). sync 0.55 expert-security PASS-WITH-CONDITIONS → H-1(countActiveAlerts delete) + M-3(cron audit, lazy import).
- MVP: AC-01/02 PARTIAL(seeded core + API), AC-03/04/05/06 PASS. DEFER → **#278**(라이브 크롤러 + alert wiring) + #62-B~G.

### ✅ #51 PROJECT-MEMORY — MERGED PR #276 (본 세션, 이전 세션 fix 후)
- project_memory + 시스템 프롬프트 자동 주입(AC-02) + AI 감지→pending(AC-03, REQ-005) + RA Lead 관리 UI + audit.
- **★ fix(이전 세션 리뷰 결함 5종)**: H-1 approveSuggestedMemory idempotency(`WHERE status='pending'`) · AC-02/03 통합 테스트 부재(#50 dead-code) → 실제 행위 테스트(injector/extractor) · permissions EXPECTED_ACTIONS · 23505→409.

### 🎯 다음 세션 시작 지점 (2026-06-26) — 전략 그룹 등 루프 계속
Knowledge/RAG 그룹 완료. **남은 OPEN priority/high**:
- **전략 Killer Features**: #40 STRATEGY(멀티 관할권 규제 전략) · #42 CROSSMARKET(갭 분석) · #43 BATCH(배치 Q&A) — LLM 환각·인젝션 리스크 최대, [지양-2/4] 설계 부담 큼.
- **기술부채**: #39 WORKFLOWS-LLM-002(510(k)/CER/PCCP executor 실구현) — 기존 도메인 강화, 회귀 낮음.
- **제출/검토**: #37 SUBMISSION-LIFECYCLE · #36 REVIEW-OPS.
- **시스템/외부**: #49 VALIDATION(IQ/OQ/PQ) · #1 ADR · #202 hybrid E2E(외부).
- **DEFER 누적**: #275(REQ-002 messages embedding) · #278(=#62-A 라이브 크롤러) · #264·#65·#244·#245·#249·#57·#236·#238 · #62-B~G.

### 추천 다음 작업
1. **#39 WORKFLOWS-LLM-002** (기술부채, 회귀 낮음, 레버리지 즉각) 또는
2. **#40 STRATEGY** (Killer Feature, 차별화 최대 — 단 LLM 리스크, #50/#51 풀 리뷰 필요).

### 핵심 교훈 누적 (Knowledge/RAG 3사이클)
- **AC ↔ 실제 호출 dead-code** (8회): retriever registry 등록(#50) / 주석 참조 테스트 없음(#51) / mapping-engine은 route 호출 확증(#62 성공). evaluator + 오케스트레이터 직검(call site + 파일 존재)이 정오탐 확인.
- **분산 카운트 단언**: cyberdevice/capa/labeling 등 도메인 integration test에도 audit/perm 카운트. #50은 15 failures(full test 포착), #51/#62는 strategy 사전 주입→0 실패.
- **retriever/lib import 함정**: db/client top-level = parseEnv 부작용. lazy import(#50 retriever, #62 cron audit).
- **보안 idempotency**: approveSuggestedMemory RETURNING post-Set dead guard(#51) · countActiveAlerts org filter 누락(#62, 호출자 0 → delete). UPDATE WHERE 상태 조건 + rowCount.
- **에이전트 lint "pre-existing" 오탐**: #51/#62 에이전트가 신규 파일 format/import 에러를 "pre-existing"으로 치부 → biome --write 직검 fix. 오케스트레이터 lint 직검 필수.
- **MVP phasing**: 대형 SPEC(#62 4 테이블 + 크롤러)은 strategy가 MVP/DEFER 분할 → 단일 세션 가능. DEFER는 follow-up 이슈 + @MX:TODO 문서화.

## 이전 세션 히스토리
- 2026-06-26 전반: #239 RLS Phase 1~4 + runbook 종료(PR #267~#273).
- 2026-06-25: #269·#270·#266·#268. 2026-06-24~25: 7-PR 파이프라인. 2026-06-23: tier0 #35 · tier1 #59·#47.
