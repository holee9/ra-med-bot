# Session Memo

## P1: Session Context

session_id: bd4f5533-22cf-4b7b-981d-5256e54fcb4e
cwd: /home/abyz-lab/work/workspace-github/holee9/ra-med-bot
branch: feat/spec-v3-ui-001 (SPEC 문서 커밋, run 대기)
spec: SPEC-V3-UI-001 (v3 Phase D, RA Inbox 4-column Kanban UI)
issue: #326 (OPEN)
pr: (대기 — run 완료 후)
issues: #321 (inbox 보안 follow-up)
last_updated: 2026-07-03

## P2: Current Progress (SPEC-V3-UI-001 plan 완료)

### SPEC-V3-UI-001 plan 산출물 생성 완료
- **research.md**: 백엔드 inbox 도메인 심층 분석 (L-013 코드 직검으로 types.ts VALID_TRANSITIONS 확인)
- **plan.md**: 5 module / 28 REQ (Kanban · Detail+ESIG · Triage · Role/viewer · Cross-cutting)
- **spec.md/acceptance.md/spec-compact.md**: EARS 요구사항 + 13 Given/When/Then + DoD
- **코드 권위 확정**: `lib/domains/inbox/types.ts:33-40` VALID_TRANSITIONS, `lib/domains/inbox/approve/route.ts:18-22` approve body `{password, esigSignature}`
- **plan-auditor 독립 감사**: Critical 0, Major D1-D7 정정 완료 후 PASS
- **GitHub Issue #326 양방향 연결**: SPEC ↔ Issue reference
- **main CI green 유지**: plan 단계라 코드 변경 없음 (5145197 기반)

## P3: Next Session 시작점

1. **`/moai run SPEC-V3-UI-001`** (Phase D UI 구현) — feat/spec-v3-ui-001 branch에서 진행. M1 Foundation→M2 Kanban→M3 Triage action→M4 Detail+ESIG→M5 i18n/WCAG 순서. L-013 주의: 코드 권위 계약(types.ts VALID_TRANSITIONS, approve body) 엄수. 컨벤션: tanstack-query 5.51, zustand 4.5, next-intl, Radix. i18n inbox namespace 신규 추가 필요.
2. **follow-up #321** 처리 (백엔드 보안) — H-1/H-3/M-1/HMAC/rate-limit/migration 자동화.
3. **SPEC-V3-INBOX-001 §4.3/§4.5 오기 정정** — VALID_TRANSITIONS 범위와 approve body 불일치 (코드가 권위, SPEC 텍스트 정정 필요). #321 또는 별도 sync에서.
4. **SPEC-V3-TRIAGE-001** (Phase C-2) — AC-06 citation 검증 + auto_answer 주입 훅.

## P4: 주의사항 (L-007/L-008/L-010/L-013/L-014/L-015 교훈 + SPEC-V3-UI-001 코드 권위)

- **★ SPEC-V3-UI-001 코드 권위**: UI 구현 시 `lib/domains/inbox/types.ts:33-40` VALID_TRANSITIONS와 approve body `{password, esigSignature}`를 단일 진실원으로 사용 — research.md나 백엔드 SPEC 텍스트(types.ts가 `auto→escalated/closed` 허용, approve body에 final_answer/citations 포함이라고 기술)는 오기이므로 맹신 금지.
- **★ L-008/L-013 CI 맹점**: (1) 로컬 biome 1.9.4는 noUnusedVariables를 warning, CI는 error(임계값 차이) → 로컬 EXIT 0이어도 CI FAIL. (2) ci:audit는 route body `writeAudit(` literal만 인식 — lib 내부 tx audit 못 봄 → override 필요. (3) **audit-check-ignore 정규식 `/audit-check-ignore[^*]*\*\//`이 `[^*]*`라 주석 내 `*`(wildcard) 불가** — `memory_*` → `memory action` 등으로 수정 필수.
- **★ L-015 CI Gates 4중 맹점**: (1) `audit-check-ignore` 주석에 `*` 금지(정규식 `[^*]*` 깨짐), (2) ci:audit는 lib 내부 tx audit 못 봄→route override, (3) 로컬 biome 1.9.4 noUnusedVariables warning vs CI error, (4) **main 머지 전 `pnpm ci:*` 전 단계 로컬 직검**(일부 green=전체 green 아님).
- **★ ci:build = next build** (L-012): next dev 구동 중 로컬 build 금지. CI 환경에서 확인.
- **expert-backend self-report 맹신 금지**: "EXIT 0/완료" 보고해도 git status로 실제 변경 직검.
- migration ALTER TYPE ADD VALUE(0105)는 drizzle-kit push로 자동 적용 안 됨 → 수동 psql.
- route test 필수 패턴: `vi.mock('@/lib/db/client')` + select-chain mock camelCase 별칭 + withPermission mock role 게이트.
