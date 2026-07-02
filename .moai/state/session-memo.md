# Session Memo

## P1: Session Context

session_id: bd4f5533-22cf-4b7b-981d-5256e54fcb4e
cwd: /home/abyz-lab/work/workspace-github/holee9/ra-med-bot
branch: feat/spec-v3-inbox-001
spec: SPEC-V3-INBOX-001 (v3 Phase C-1, RA Inbox 4-column Kanban)
issue: #320
last_updated: 2026-07-03

## P2: Current Progress (Step 2-3 백엔드 완료)

- Step 1 ✅ caeb466 — migration 0104 + schema.ts (inbox_tickets + approved_answers, 실DB 검증)
- Step 2 ✅ 78e9f02 — lib/domains/inbox/ 8파일 (state-machine, promote tx, access IDOR, sla, queries)
- Step 2 테스트 ✅ 848f3c5 — 5파일/72 cases, AC-02/04/05/08/09/11/13 입증, FULL 4343 pass
- Step 3 ✅ 359db95 — API route 5종 (POST /api/ask, GET/PATCH /api/inbox, POST approve ESIG) + 42 test cases
- **FULL test 4343 passed / lint:hex / typecheck 전부 EXIT 0**

## P3: Next Session 시작점

- **Step 4 (UI)**: RA Inbox 4-column Kanban 페이지. 사용자 명시적으로 다음 세션 분리.
  - 참조: lib/domains/inbox/ (queries.listByTriageState → 칸반 column 데이터), /api/inbox GET
  - 권한: inbox.view (ra-member+ 조회), inbox.manage (ra-lead만 triage/approve)
- **Step 5**: 통합테스트 + expert-security 감사(OWASP, RLS org-isolation, IDOR) + PR

## P4: 주의사항 (L-007/L-013/L-014 교훈)

- manager-ddd 3차 실수: 게이트 미실행, 허구 참조(capa-idor-runtime.test.ts 존재 안 함), Drizzle mock 붕괴, route test db-client mock 누락 → OOM. orchestrator 직검으로 전부 수정.
- **route test 필수 패턴**: `vi.mock('@/lib/db/client', () => ({ db: {} }))` 누락 시 route import가 실제 pg pool 생성 → worker OOM. domain mock만으로는 부족.
- withPermission mock는 role 체크 무시 → inbox.manage 케이스는 mock에 `MANAGE_ROLES = new Set(['ra-lead','admin'])` 체크 추가 필요.
- 다음 세션에서도 게이트/참조/패턴 직검 필수.
