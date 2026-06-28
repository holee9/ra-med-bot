# Session Memo

> 세션 연결용. 상세 맥락은 auto-memory `project-state.md`가 1차 진실원. 본 파일은 빠른 시작 요약.

## 현재 세션 (2026-06-27~28) — 자율 순차 6종 + 발견 2종 = 8종 완료

사용자 `/moai ultracode "남은 작업 완료까지 계속 가자"` → "자율 순차 6종" → 발견 이슈 #296/#300까지 연장 처리. main `582c41b` → **`44eb47f`**. `next dev`(pid 1662627) 구동 중 → L-012 build skip.

### ✅ 8종 전부 MERGED · 회귀 4656 → **4772 passed** (+116) · migration 0089→0098 (+9)
| 이슈 | PR | 핵심 |
|---|---|---|
| #264 sub 2/3 RLHF calibration | #295 | migration 0095 calibration_candidates + detector/proposal(Part 11) + GET API. [지양-2/4] 자동 반영 0. |
| #264 sub 3/3 alternate answers | #297 | migration 0096 feedback_source enum + 3-col unique + audit + regenerate wiring + bridge defense-in-depth. ★ 실DB unique 결함 fix. |
| #244 PMCF 워크벤치 | #298 | PmcfEvaluationBuilder + PmsWorkbench 5탭. pure frontend. |
| #245 PMS E2E + CER | #299 | pms-workflow.spec.ts(6) + CER linkage integration +2. E2E CI 위임. |
| #238 supersession write path | #301 | applyOutdateOperations + retriever [지양-2] 필터 + hook wiring. ★ dead-code 한계 → #300로 해소. |
| #249 eSubmit labeling | #302 | forwardLabelingToESubmit stub→real + migration 0097 + AC-07 ✅. ★ 이슈 전제 시대착오(#65 실제 구현). |
| **#296** 0077 DB fix | **#303** | ★ 0077 `ON DELETE 'set null'` 따옴표 구문 에러(10곳) → 프로덕션 DB model-gov 테이블 4개 부재 → **#71 라우트 6종 런타임 500 해소**. CI mock DB가 놓침(L-010). |
| **#300** delta-sync 진입점 | **#304** | runDeltaSync orchestrator + 수동 API + M-1(org-scope)/M-2(section_superseded audit migration 0098). ★ applyOutdateOperations(#238) **live call site 확보 → AC-05 자동 stale 전파 실제 작동**. |

audit enum +4 (rlhf.calibration_proposed, rlhf.implicit_feedback_recorded, label.esubmit_forwarded, traceability.section_superseded).

### ★ 핵심 패턴 / 발견 (본 세션)
- **직견이 만든 차이 (L-007/010)**: (a) #296 — 0077 따옴표 구문 에러로 프로덕션 DB 테이블 부재 → #71 라우트 500. CI mock DB + 정적 테스트 통과, **실DB 직견 + 마이그레이션 재적용**만 포착. (b) #297 — 0082 auto-name unique 잔존 → 실DB 직견. (c) #300 — applyOutdateOperations dead-code → 프로덕션 호출부 grep으로 포착(7회 패턴), live call site 구현으로 폐쇄.
- **이슈 전제 시대착오 정정**: #249 "#65 미구현 블로커" → 직견 #65 실제 구현됨. #238/#300 "wiring만" → write path 자체/dead-code. 코드 직견이 이슈 본문보다 진실.
- 매 PR 게이트 직견(typecheck/lint+hex/full test/실DB/main ls-tree) + expert-security(RLHF/regulative/RAG 필수).

### 🎯 다음 세션 시작 지점 (2026-06-28)
- **외부 의존 4종 (코드만으로 자율 완료 불가)**: #236(CLASSIFY deterministic + FDA Product Code DB 외부 seed) · #278(Standards 라이브 크롤러 외부 API/ToS) · #39(WORKFLOWS-LLM executor large+의존 미구현) · #202(Hybrid RA E2E 외부 배포).
- **전략 Killer Features (LLM 리스크)**: #40 STRATEGY · #42 CROSSMARKET · #43 BATCH.
- 회귀 **4772 passed**. main HEAD `44eb47f`. migration 최신 0098.

## 이전 세션 히스토리
- 2026-06-27: #264 sub 1/3(PR #293) + #284/#280 fix-up + #283 test debt + #158 백엔드 7개. 회귀 4656.
- 2026-06-26: #239 RLS Phase 1~4 + Knowledge/RAG #50/#51/#62 + DB fix-up #279/#281.
