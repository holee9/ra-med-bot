## SPEC-V3-UI-001 Progress

- Started: 2026-07-03
- Branch: feat/spec-v3-ui-001
- Execution Mode: sub-agent sequential (milestone 단위 + checkpoint)
- Development Mode: tdd (RED-GREEN-REFACTOR)
- Harness: thorough
- Language: TypeScript — Next.js 15.5 App Router
- Backend Status: FULLY IMPLEMENTED (SPEC-V3-INBOX-001, PR #322)
- Issue: #326

## Code-Authoritative Contract (DO NOT trust research.md / backend SPEC text)
- `VALID_TRANSITIONS` — `lib/domains/inbox/types.ts:33-40`
- Approve body — `app/api/inbox/[id]/approve/route.ts:18-22`: `{password, esigSignature}`
- `listByTriageState(db, orgId, filters)` — `lib/domains/inbox/queries.ts:26`

## Phase Log
- **M1 Foundation COMPLETE (T-001~009)**: manager-tdd 위임 + orchestrator 직검 4종 결함 직접 수정 (layout showInbox prop 누락, useInbox throw plain object, page.test 빈 it, biome format)
- **M2 Kanban Board COMPLETE (T-010~014)**: manager-tdd 위임(2회) + orchestrator 직검 3종 결함 직접 수정 (InboxKanban React Hook 규칙 위반 → KanbanColumnContainer 분리, biome 3 errors, page.test Unhandled Rejection 5건)
- **M3 Triage Action COMPLETE (T-015~017)**: manager-tdd 위임 + orchestrator 직검 13 tests 실패 직접 해결
  - TriageActionMenu.tsx (167줄) + test (6 tests) — VALID_TRANSITIONS 게이팅, ra-lead 전용, reason prompt
  - TicketCard.tsx 수정: userRole 기본 'viewer' + `{userRole === 'ra-lead' && <TriageActionMenu/>}` (M2 회귀 해결 — Provider 없는 테스트에서 TriageActionMenu 마운트 방지)
  - **삭제**: TriageActionMenu.reason.test.tsx (vi.mock in it() 구조 버그 + 컴포넌트-테스트 불일치), TriageActionMenu.integration.test.tsx (placeholder 3개 + 결함 1개)
  - TicketCard.test.tsx 2개 단언 수정 (Link 2개 구조 → getAllByRole, border div → firstElementChild)
- **Verification (orchestrator 직접 실행 2026-07-04)**: tsc EXIT 0 / biome 0 errors / vitest 45/45 Errors 0

## Pattern Observation (진행 방식 전환 근거)
M1/M2/M3 모두 "manager-tdd 위임 → self-report COMPLETE → orchestrator 직검에서 runtime/CI 결함 포착 → 직접 수정" 패턴 반복. 결함 유형: Hook 규칙 위반, prop 누락, 테스트-구현 불일치, vi.mock 오용, biome 자의적 "허용" 판단. 매 milestone 위임+검증/수정 비용 누적.

**사용자 결정 (2026-07-04, Checkpoint 3)**: M4-M6는 **orchestrator 직접 구현** (MoAI 원칙 예외, 위임-수정 루프 제거, 일관된 품질, 토큰 절약).

## Resume Instructions (next session)
- Branch: feat/spec-v3-ui-001 (uncommitted: M1+M2+M3 완료 변경셋 — 커밋 아직 안 함)
- **M1-M3 COMPLETE (T-001~017) orchestrator 직검 완료, 45 tests GREEN**
- Next: M4 (Detail+ESIG T-018..022) → M5 (Viewer+WCAG T-023..029) → M6 (Quality T-030..034)
- Execution: **orchestrator 직접 구현** (사용자 승인). TDD 엄격, 각 컴포넌트 단순하게, milestone 끝에 직검.
- Contract reminders: VALID_TRANSITIONS types.ts:33-40, approve body {password, esigSignature}
- L-013 필수: tsc EXIT 0, biome "Found 0 errors" (허용 판단 금지), vitest "Errors 0" (Unhandled Rejection 금지), React Hook 규칙 grep
