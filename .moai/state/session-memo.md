# Session Memo

## P1: Session Context

session_id: bd4f5533-22cf-4b7b-981d-5256e54fcb4e
cwd: /home/abyz-lab/work/workspace-github/holee9/ra-med-bot
branch: feat/spec-v3-inbox-001
spec: SPEC-V3-INBOX-001 (v3 Phase C-1, RA Inbox 4-column Kanban)
issue: #320
pr: #322 (OPEN, feat/spec-v3-inbox-001 → main, Closes #320)
follow_up_issue: #321
last_updated: 2026-07-03

## P2: Current Progress (Step 5 백엔드 PR #322 OPEN)

사용자 "Step 4 UI" → SPEC §1.5/§6 직검 모순(UI는 Phase D/SPEC-V3-UI-001 이월) → **백엔드 Step 5로 확정**.

- Step 1-3 ✅ (caeb466/78e9f02/848f3c5/359db95) — migration 0104 + lib/domains/inbox 8파일 + API 5라우트
- **Step 5-A 게이트 직검** ✅ — test 4343 / lint / typecheck EXIT 0 / 실DB `\d` AC-01·12 (CHECK/FK/RLS)
- **Step 5-B §4.2 SPEC sync** ✅ — escalate/reject → triage 통합(GAP-03) + As-Built + AC-06/07 follow-up
- **Step 5-C expert-security 감사** ✅ — 판정 BLOCK-MERGE. C-1(ESIG truthy-string, REQ-012 위반) + H-1~H-4 + M/L. **L-013 맹점 재현** — 테스트 4343 passed 상태에서 ESIG 검증 부재 숨김.
- **Step 5-C-fix** ✅ (expert-backend 위임 + MoAI 직검) — C-1(password re-auth bcrypt + 401 + audit) / H-4(ask.create viewer) / H-2(audit-on-failure + migration 0105). MoAI 직검: mock 별칭 누락 + 5 카운트 단언(81→82, 214→215) + 0105 실DB 수동 적용 포착·수정.
- **게이트 최종**: test 4346 passed(+3) | lint/typecheck EXIT 0 | 실DB inbox.approve_failed enum 확인

### 커밋 / PR / Issue
- `f324933` fix(inbox): 보안 감사 C-1/H-4/H-2 수정 + §4.2 sync (15 files +291/-62)
- **PR #322** feat/spec-v3-inbox-001 → main (Closes #320)
- **#321** follow-up 통합 issue (H-1/H-3/M-1/HMAC/rate-limit/migration 자동화/L-1~L-4)

## P3: Next Session 시작점

- **PR #322 리뷰/머지 대기** (admin squash). 머지 후 main ls-tree 직검 + 회귀 재확인.
- **Phase D UI** → SPEC-V3-UI-001 plan (RA Inbox 4-column Kanban). 소비: `lib/domains/inbox/queries.listByTriageState` + `/api/inbox` GET. 권한: `inbox.view`(ra-member+ 조회) / `inbox.manage`(ra-lead triage·approve) / `ask.create`(viewer 질문).
- **follow-up #321** 처리 — H-1(promote tx org_id 재검증) / H-3(audit action 세분화) / C-1 잔여(HMAC §11.70 바인딩) / H-4 잔여(/api/ask rate-limit) / M-1(from_user 정책) / migration 자동화(0105 ALTER TYPE 수동 적용 이슈) / L-1~L-4
- **SPEC-V3-TRIAGE-001** — AC-06 citation 검증 + `/api/ask` auto_answer 주입 훅

## P4: 주의사항 (L-007/L-010/L-013/L-014 교훈)

- **L-013 재현 (결정적)**: 게이트/카운트 self-report("4343 passed, 백엔드 완료")가 SPEC REQ-012 위반(ESIG truthy-string) + migration 0105 실DB 미적용 숨김. 적대적 보안 감사(expert-security) + MoAI 직검(mock 매핑·카운트 단언·실DB enum 3종 각각)만 포착.
- **expert-backend self-report도 맹신 금지**: "로직 정상, mock 탓" → 실제는 mock 별칭(password_hash vs passwordHash camelCase) + 카운트 단언 미동기화 + 0105 실DB 미적용 3종. 위임 결과도 직검.
- **migration ALTER TYPE ADD VALUE** (0105)는 drizzle-kit push로 자동 적용 안 됨 → 수동 psql. enum 값 추가 시 운영 자동화 별도.
- **L-014 재현**: 세션 메모 "Step 4 UI" vs SPEC §1.5/§6 "UI Phase D 이월" 모순 → SPEC 단일 진실원 직검으로 백엔드 PR 확정. 세션 메모/매트릭스 맹신 금지.
- route test 필수 패턴 유지: `vi.mock('@/lib/db/client', () => ({ db: {} }))` + select-chain mock 별칭(camelCase) 매칭 + withPermission mock role 게이트.
