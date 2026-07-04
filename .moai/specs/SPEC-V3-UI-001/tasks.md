## Task Decomposition

SPEC: SPEC-V3-UI-001
Development Mode: tdd | Execution: sub-agent sequential | Harness: thorough

> **Code-Authoritative Contract (verified against source 2026-07-03)**:
> - `VALID_TRANSITIONS` at `lib/domains/inbox/types.ts:33-40` — `auto:['needs-review']`, `needs-review:['escalated','waiting','closed','rejected']`, `escalated:['waiting','closed','rejected']`, `waiting:['needs-review','closed']`, `closed:[]`, `rejected:[]`. NO universal `*→rejected`.
> - Approve body `{password, esigSignature}` at `app/api/inbox/[id]/approve/route.ts:19-22`.
> - Triage body `{toState, reason?}` at `app/api/inbox/[id]/triage/route.ts:17-20`. 409 on invalid, 404 on IDOR.
> - Sidebar `showX` prop pattern at `components/shell/Sidebar.tsx:33-77` (15 conditional nav links, `data-testid="sidebar-*"`).
> - Layout resolves `showX = hasRole(userRole, 'ra-member')` server-side at `app/(app)/layout.tsx:60-93`.
> - `listByTriageState(db, orgId, {state, limit, offset})` at `lib/domains/inbox/queries.ts:26`.

> **TDD discipline**: Each task = RED (failing test) → GREEN (minimal code) → REFACTOR. For `[MODIFY]` brownfield files, run a characterization-test task FIRST (DDD safety net) before any TDD cycle that changes behavior.

### M1 — Foundation (Priority: High)

| Task ID | Description | Requirement | Dependencies | Planned Files | Status |
|---------|-------------|-------------|--------------|---------------|--------|
| T-001 | i18n `inbox` namespace 추가 (ko) — RED: ko.json에 inbox namespace가 없음을 단언; GREEN: REQ-V3-UI-040에 명시된 모든 키(title, columns.{auto,needsReview,escalated,waiting,closed,rejected}, actions.{approve,reject,assign,escalate,refresh}, sla.{overdue,remaining}, empty, loading, errors.{transitionFailed,approveFailed,passwordInvalid,missingFinalAnswer}) 추가 | REQ-V3-UI-040 | - | `messages/ko.json` [MODIFY] | pending |
| T-002 | i18n `inbox` namespace 추가 (en) — 동일 키셋 영문 번역; RED: en.json 누락 단언; GREEN: 키 추가; next-intl loader 통과 검증 | REQ-V3-UI-040 | T-001 | `messages/en.json` [MODIFY] | pending |
| T-003 | `stores/inbox.ts` Zustand store 생성 — RED: store 미존재 단언 + `selectedTicketId`, `showArchived`, setter 동작 테스트; GREEN: 최소 store 구현(devtools만, persist는 선택). `viewMode`/`assigneeFilter`는 제외(Exclusion #10/#12) | REQ-V3-UI-005 | - | `stores/inbox.ts` [NEW], `stores/inbox.test.ts` [NEW] | pending |
| T-004 | `lib/queries/useInbox.ts` read hooks — RED: `useInboxTickets('auto')`, `useInboxTicket('id')` hook 동작 단언(queryKey, fetch URL, staleTime:60_000, revalidateOnFocus:true); GREEN: hooks 구현. fetch는 `/api/inbox?state=<state>&limit=50` 호출. `@MX:ANCHOR` 부착 예정(fan_in ≥3 예상) | REQ-V3-UI-002, REQ-V3-UI-045 | - | `lib/queries/useInbox.ts` [NEW], `lib/queries/useInbox.test.ts` [NEW] | pending |
| T-005 | `lib/queries/useInbox.ts` mutation hooks — RED: `useTriageTransition()`(409/404 핸들링 + 캐시 무효화), `useApproveTicket()`(401/400 핸들링 + 캐시 무효화) 단언; GREEN: mutation hooks 구현. optimistic update + rollback 로직 포함(REQ-V3-UI-021/022) | REQ-V3-UI-013, REQ-V3-UI-021, REQ-V3-UI-022, REQ-V3-UI-023 | T-004 | `lib/queries/useInbox.ts` [MODIFY], `lib/queries/useInbox.test.ts` [MODIFY] | pending |
| T-006 | Sidebar characterization test (brownfield 안전망) — 기존 `components/shell/Sidebar.tsx` 렌더링 동작 스냅샷 캡처(NAV_ITEMS 순서, showX prop 처리, project switcher). 이 테스트는 T-007 수정 후에도 통과해야 함 | (DDD safety) | - | `components/shell/Sidebar.test.tsx` [NEW or MODIFY] | pending |
| T-007 | Sidebar `showInbox` prop + Inbox NavItem 추가 — RED: `showInbox=true`일 때 `data-testid="sidebar-inbox-link"` 링크가 렌더링됨을 단언, `false`일 때 미렌더링 단언; GREEN: prop 추가 + `hasRole(userRole,'ra-member')` 게이팅(NAV_ITEMS 동적 섹션, "히스토리" 이후 삽입); 기존 테스트(T-006) 회귀 없음 확인 | REQ-V3-UI-031 | T-006 | `components/shell/Sidebar.tsx` [MODIFY] | pending |
| T-008 | Layout `showInbox` 서버 해석 — RED: layout이 `showInbox = hasRole(userRole,'ra-member')`을 Sidebar에 전달함을 단언; GREEN: layout.tsx에 showInbox 변수 + 전달 추가(`app/(app)/layout.tsx:60-93` 패턴 준수) | REQ-V3-UI-030, REQ-V3-UI-031 | T-007 | `app/(app)/layout.tsx` [MODIFY] | pending |
| T-009 | `/inbox` route stub + viewer redirect 가드 — RED: viewer가 `/inbox` 방문 시 `/chat`으로 리다이렉트 단언; ra-member+는 정상 렌더 단언; GREEN: `app/(app)/inbox/page.tsx` 서버 컴포넌트 래퍼(권한 체크 + redirect) + 클라이언트 자리표시자. E2E 테스트 기반 | REQ-V3-UI-030 | T-008 | `app/(app)/inbox/page.tsx` [NEW], `app/(app)/inbox/page.test.tsx` [NEW] | pending |

### M2 — Kanban Board Rendering (Priority: High)

| Task ID | Description | Requirement | Dependencies | Planned Files | Status |
|---------|-------------|-------------|--------------|---------------|--------|
| T-010 | `SlaBadge` 컴포넌트 — RED: `slaDeadline` 있을 때 상대시간 렌더 단언, 과거일 때 overdue 스타일 단언, null일 때 미렌더 단언; GREEN: `Intl.RelativeTimeFormat` 기반 구현. i18n `inbox.sla.{overdue,remaining}` 사용 | REQ-V3-UI-004, AC-UI-011 | T-001, T-002 | `components/inbox/SlaBadge.tsx` [NEW], `components/inbox/SlaBadge.test.tsx` [NEW] | pending |
| T-011 | `TicketCard` 컴포넌트 — RED: question 발췌, triageState 배지, assignee 표시, SLA 배지 렌더 단언; 카드 클릭 시 `/inbox/[id]` 네비게이션 단언; GREEN: 최소 카드 구현. 디자인 토큰(triageState별 border/badge 색상) 적용 | REQ-V3-UI-001, REQ-V3-UI-004 | T-010 | `components/inbox/TicketCard.tsx` [NEW], `components/inbox/TicketCard.test.tsx` [NEW] | pending |
| T-012 | `KanbanColumn` 컴포넌트 — RED: 헤더(column명 + 카운트) + 티켓 리스트 렌더 단언; 빈 칼럼 시 empty-state 단언(REQ-V3-UI-044); loading 시 skeleton 단언; error 시 재시도 버튼 단언; GREEN: 최소 칼럼 구현 | REQ-V3-UI-001, REQ-V3-UI-003, REQ-V3-UI-044 | T-011 | `components/inbox/KanbanColumn.tsx` [NEW], `components/inbox/KanbanColumn.test.tsx` [NEW] | pending |
| T-013 | `InboxKanban` 셸 — RED: 4개 칼럼(auto/needs-review/escalated/waiting) 병렬 렌더 단언; `showArchived` 토글 시 종료 상태(closed/rejected) 별도 섹션 표시 단언; 토글 false 시 종료 상태 미표시 단언; manual "새로고침" 버튼(쿼리 무효화) 단언; GREEN: Kanban 셸 + Zustand store 통합 | REQ-V3-UI-001, REQ-V3-UI-005, REQ-V3-UI-045, AC-UI-012 | T-003, T-004, T-012 | `components/inbox/InboxKanban.tsx` [NEW], `components/inbox/InboxKanban.test.tsx` [NEW] | pending |
| T-014 | `/inbox` 페이지 통합 — RED: 페이지 마운트 시 4개 병렬 `GET /api/inbox?state=<state>&limit=50` 발생 단언; ra-member(비 ra-lead) 읽기 전용(액션 메뉴 없음) 단언; 403 시 인라인 "접근 권한이 없습니다" 단언; GREEN: `InboxKanban` 조립 + `useInboxTickets` 연결. T-009 stub 대체 | REQ-V3-UI-001, REQ-V3-UI-002, REQ-V3-UI-032, REQ-V3-UI-043, AC-UI-002 | T-009, T-013 | `app/(app)/inbox/page.tsx` [MODIFY], `app/(app)/inbox/page.test.tsx` [MODIFY] | pending |

### M3 — Triage Action UI (Priority: High)

| Task ID | Description | Requirement | Dependencies | Planned Files | Status |
|---------|-------------|-------------|--------------|---------------|--------|
| T-015 | `TriageActionMenu` VALID_TRANSITIONS 준수 — RED: `auto` 상태 카드는 메뉴에 "Needs Review"만 단언; `waiting`은 "Needs Review"+"Closed"만(rejected 없음); `needs-review`는 4개 옵션; ra-member(비 ra-lead)는 메뉴 미렌더 단언; GREEN: `lib/domains/inbox/types.ts`에서 `VALID_TRANSITIONS` import하여 동적 메뉴 구성. `@MX:ANCHOR` 부착(비즈니스 불변식). AC-UI-003 시나리오 3개全覆盖 | REQ-V3-UI-020, REQ-V3-UI-032, AC-UI-003 | T-011 | `components/inbox/TriageActionMenu.tsx` [NEW], `components/inbox/TriageActionMenu.test.tsx` [NEW] | pending |
| T-016 | Optimistic 전이 + 409/404 핸들링 — RED: 전이 선택 시 optimistic update(카드 이동) 단언; 409 시 롤백 + toast("상태 전이 실패 — 새로고침 후 다시 시도하세요") 단언; 404 시 카드 제거 + 콘솔 경고 단언; 200 시 양쪽 칼럼 쿼리 무효화 단언; GREEN: `useTriageTransition` 완성 + `TicketCard`에 메뉴 통합. AC-UI-004/005 시나리오 | REQ-V3-UI-021, REQ-V3-UI-022, REQ-V3-UI-023, AC-UI-004, AC-UI-005 | T-005, T-015 | `components/inbox/TriageActionMenu.tsx` [MODIFY], `components/inbox/TicketCard.tsx` [MODIFY], `components/inbox/TriageActionMenu.test.tsx` [MODIFY] | pending |
| T-017 | reason 프롬프트 (rejected/escalated 대상) — RED: 전이 대상이 `rejected`/`escalated`일 때 reason 입력 프롬프트(최대 500자, optional) 단언; 다른 대상(closed/waiting/needs-review) 시 프롬프트 미표시 단언; 빈 값 허용 단언; GREEN: Radix Dialog/Sub-form으로 reason 입력 추가. body에 `{toState, reason}` 전송 | REQ-V3-UI-024, AC-UI-013 | T-016 | `components/inbox/TriageActionMenu.tsx` [MODIFY], `components/inbox/TriageActionMenu.test.tsx` [MODIFY] | pending |

### M4 — Ticket Detail + ESIG Approve (Priority: High)

| Task ID | Description | Requirement | Dependencies | Planned Files | Status |
|---------|-------------|-------------|--------------|---------------|--------|
| T-018 | `/inbox/[id]` 상세 페이지 라우트 + 데이터 페칭 — RED: 카드 클릭 시 `/inbox/[id]` 네비게이션 단언; `GET /api/inbox/[id]` 호출 단언; 필드 세트(question, autoAnswer+citations, raAssignee, escalateTo, slaDeadline, triageState, approvedBy/At, finalAnswer) 렌더 단언; 404(타 조직) 시 "찾을 수 없음" 단언; GREEN: 상세 페이지 구현 | REQ-V3-UI-010, REQ-V3-UI-011 | T-004 | `app/(app)/inbox/[id]/page.tsx` [NEW], `app/(app)/inbox/[id]/page.test.tsx` [NEW] | pending |
| T-019 | `ActivityTimeline` (audit 기반) — RED: audit 액션 타임라인 렌더 단언(append-only, 21 CFR Part 11 §11.10(e)); GREEN: audit 데이터 페칭 + 타임라인 렌더. **Q3 해결**: run phase ANALYZE에서 audit 읽기 엔드포인트 확인; 없으면 최소 `GET /api/inbox/[id]/audit` 래퍼 추가(백엔드 수정 = scope expansion 플래그 — 즉시 보고) | REQ-V3-UI-011 | T-018 | `components/inbox/ActivityTimeline.tsx` [NEW], `components/inbox/ActivityTimeline.test.tsx` [NEW] | pending |
| T-020 | `ApproveDialog` 2-step + 401 인라인 — RED: `ra-lead`/`admin` + `finalAnswer` truthy + 비종료 상태일 때만 "Approve (ESIG)" 버튼 렌더 단언(REQ-V3-UI-012); 다이얼로그 열림 단언; body `{password, esigSignature}`(approve/route.ts:19-22 준수) 전송 단언; 401 시 비밀번호 필드 인라인 에러("비밀번호가 올바르지 않습니다") + 네비게이션 없음 + generic toast 없음 단언; submit 중 비활성화 단언; GREEN: Radix Dialog 2-step 구현. `@MX:WARN` 부착(21 CFR Part 11 규제). AC-UI-006 | REQ-V3-UI-012, REQ-V3-UI-013, REQ-V3-UI-014, AC-UI-006 | T-018 | `components/inbox/ApproveDialog.tsx` [NEW], `components/inbox/ApproveDialog.test.tsx` [NEW] | pending |
| T-021 | Approve 400 차단 + 200 성공 — RED: 400 "Cannot promote"(missing final_answer) 시 차단 메시지("먼저 최종 답변을 설정하세요") + 자동 재시도 없음 단언(REQ-V3-UI-015, AC-UI-007); 200 시 `/inbox` 캐시 무효화 + Kanban 이동 + 성공 toast 단언(REQ-V3-UI-016, AC-UI-008); GREEN: 에러 매핑 + 성공 핸들러. AC-UI-007/008 | REQ-V3-UI-015, REQ-V3-UI-016, AC-UI-007, AC-UI-008 | T-020 | `components/inbox/ApproveDialog.tsx` [MODIFY], `components/inbox/ApproveDialog.test.tsx` [MODIFY] | pending |
| T-022 | Playwright E2E — 승인 happy path — RA Lead 로그인 → Kanban 렌더 → 카드 클릭 → triage 전이 → ESIG 승인(올바른 비밀번호) → 티켓이 활성 칼럼에서 사라지고 archived에 closed로 표시. 실DB/실세션 기반(L-013) | REQ-V3-UI-016, AC-UI-008 | T-021 | `e2e/inbox-approve.spec.ts` [NEW] | pending |

### M5 — Viewer Integration + Cross-Cutting (Priority: Medium)

| Task ID | Description | Requirement | Dependencies | Planned Files | Status |
|---------|-------------|-------------|--------------|---------------|--------|
| T-023 | `/chat` characterization test (brownfield 안전망) — 기존 `app/(app)/chat/page.tsx` 동작 스냅샷. ask.create 호출 후 응답 처리 패턴 캡처. T-024 수정 전 안전망 | (DDD safety) | - | `app/(app)/chat/page.test.tsx` [NEW or MODIFY], `components/chat/__tests__/ChatShell.ticketId.test.tsx` [NEW] | done |
| T-024 | `/chat` ask.create → ticket_id surfacing — RED: `/chat`에서 질문 제출 성공 시 `POST /api/ask` 호출 후 응답의 `ticket_id` + `triage_state`가 인라인 "내 질문 상태" 패널에 표시 단언; GREEN: 최소 패널 추가(별도 라우트 아님, Q4 decision). 기존 chat 동작 회귀 없음(T-023 통과) — **구현 PR 331 머지, 회귀 단언 본 PR에서 추가(REQ-V3-UI-033)** | REQ-V3-UI-033 | T-023 | `components/chat/ChatShell.tsx` [PR331 머지], `hooks/useStreamingAnswer.ts` [PR331 머지], `components/chat/__tests__/ChatShell.ticketId.test.tsx` [NEW 회귀 단언] | done |
| T-025 | `ViewerTicketSummary` (viewer own-ticket 최소 보기) — RED: viewer가 자신 소유 티켓 URL(`/inbox/[own-id]`) 방문 시 "내 질문 상세" 최소 보기(question + triageState + approved answer 있는 경우) 렌더 단언; RA 전용 필드(raAssignee, escalateTo, audit timeline) 게이트 단언; 타인 티켓 URL 시 404 단언(IDOR via access.ts); GREEN: viewer 전용 최소 보기 구현 | REQ-V3-UI-034, AC-UI-009 | T-018 | `components/inbox/ViewerTicketSummary.tsx` [NEW], `components/inbox/ViewerTicketSummary.test.tsx` [NEW] | pending |
| T-026 | ra-member 읽기 전용 렌더링 통합 — RED: `ra-member`(비 ra-lead) 사용자는 Kanban 카드에 액션 메뉴 없음 + 상세 페이지에 Approve 버튼 없음 단언; GREEN: `session.user.role` 클라이언트 게이팅(T-015/T-020에서 이미 부분 구현 — 통합 검증). 서버 `withPermission`이 궁극 가드임을 주석 명시 | REQ-V3-UI-032 | T-015, T-020 | (통합 검증 — 새 파일 없음, 기존 테스트 보강) | pending |
| T-027 | 디자인 토큰 일관 적용 — RED: 4상태 + 2종료 triageState별 토큰(auto=brand-300, needs-review=amber-500, escalated=orange-500, waiting=blue-500, closed=ink-300, rejected=red-500)가 카드 border + badge + column header accent에 일관 적용 단언(스냅샷 또는 클래스 검증); GREEN: 토큰 유틸/매핑 추가. AC-UI-010 토큰 부분 | REQ-V3-UI-041, AC-UI-010 | T-013, T-018 | `components/inbox/state-tokens.ts` [NEW] (또는 styles/tokens.css 매핑), 관련 컴포넌트 [MODIFY] | pending |
| T-028 | WCAG axe 스캔 통합 — RED: `@axe-core/playwright`가 `/inbox`, `/inbox/[id]`, ApproveDialog에서 critical 위반 0 단언; 키보드 탐색(Tab/Shift+Tab/Enter/Escape) 단언; 아이콘 전용 버튼 ARIA 라벨 단언; GREEN: 접근성 수정(aria-label, focus-visible, role). AC-UI-010 WCAG 부분 | REQ-V3-UI-042, AC-UI-010 | T-014, T-018, T-020 | `e2e/inbox-a11y.spec.ts` [NEW], 관련 컴포넌트 [MODIFY] | pending |
| T-029 | Playwright E2E — viewer redirect — viewer가 `/inbox` 직접 방문 시 `/chat` 리다이렉트 단언(REQ-V3-UI-030 강제). E9 엣지 케이스 | REQ-V3-UI-030 | T-009 | `e2e/inbox-viewer-redirect.spec.ts` [NEW] | pending |

### M6 — Quality Gates (Priority: High)

| Task ID | Description | Requirement | Dependencies | Planned Files | Status |
|---------|-------------|-------------|--------------|---------------|--------|
| T-030 | `pnpm ci:lint` 로컬 직검 (L-008/L-015) — `pnpm ci:lint`(lint:hex full) 로컬 실행; noUnusedVariables 등 CI=error 항목 0 위반; unused import/vars 제거; 코드 줄에 `#NNN` 금지(L-008) | (L-008, L-015) | T-001..T-029 | (수정만, 새 파일 없음) | pending |
| T-031 | `pnpm ci:typecheck` + 전 `pnpm ci:*` 단계 로컬 직검 (L-015) — TypeScript 0 신규 에러; ci:audit, ci:rbac, ci:migrations(해당 시), ci:tokens, ci:i18n, ci:glossary, ci:contrast, ci:module-boundaries 전 단계 로컬 green. 일부 green=전체 green 아님(L-015) | (L-015) | T-030 | (수정만) | pending |
| T-032 | `pnpm build` 로컬 직검 (L-012) — `next dev` 중지 확인 후 `pnpm build` 실행; `.next` chunk 충돌(페이지 500) 방지; 빌드 성공 단언 | (L-012) | T-031 | (수정만) | pending |
| T-033 | 전체 `pnpm test` 실행 (L-009) — 타깃만이 아닌 전체 `pnpm test` 실행; staged 범위 직검; 커버리지 80%+ 신규 컴포넌트/훅 단언; 11 엣지 케이스(E1..E11) 처리 확인 | (L-009) | T-032 | (수정만) | pending |
| T-034 | Pre-submission self-review — 전체 변경셋 단순성 검토("더 단순한 접근인가?", "제거해도 SPEC 만족하는가?"); @MX 태그 최종 검증(ANCHOR: useInbox.ts/TriageActionMenu, WARN: ApproveDialog/useTriageTransition, NOTE: 페이지/스토어); 불필요한 추상화 제거 | (workflow-modes Pre-submission) | T-033 | (수정만) | pending |

---

## Coverage Verification

### REQ Coverage (28 REQs → Tasks)

| REQ ID | Covered By | Status |
|--------|------------|--------|
| REQ-V3-UI-001 | T-011, T-013, T-014 | ✅ |
| REQ-V3-UI-002 | T-004, T-014, AC-UI-002 | ✅ |
| REQ-V3-UI-003 | T-012 | ✅ |
| REQ-V3-UI-004 | T-010, AC-UI-011 | ✅ |
| REQ-V3-UI-005 | T-013, AC-UI-012 | ✅ |
| REQ-V3-UI-010 | T-018 | ✅ |
| REQ-V3-UI-011 | T-018, T-019 | ✅ |
| REQ-V3-UI-012 | T-020 | ✅ |
| REQ-V3-UI-013 | T-005, T-020 | ✅ |
| REQ-V3-UI-014 | T-020, AC-UI-006 | ✅ |
| REQ-V3-UI-015 | T-021, AC-UI-007 | ✅ |
| REQ-V3-UI-016 | T-021, AC-UI-008 | ✅ |
| REQ-V3-UI-020 | T-015, AC-UI-003 | ✅ |
| REQ-V3-UI-021 | T-005, T-016, AC-UI-004 | ✅ |
| REQ-V3-UI-022 | T-005, T-016, AC-UI-004 | ✅ |
| REQ-V3-UI-023 | T-005, T-016, AC-UI-005 | ✅ |
| REQ-V3-UI-024 | T-017, AC-UI-013 | ✅ |
| REQ-V3-UI-030 | T-008, T-009, T-029 | ✅ |
| REQ-V3-UI-031 | T-007, T-008 | ✅ |
| REQ-V3-UI-032 | T-014, T-015, T-026 | ✅ |
| REQ-V3-UI-033 | T-024, AC-UI-009 | ✅ |
| REQ-V3-UI-034 | T-025, AC-UI-009 | ✅ |
| REQ-V3-UI-040 | T-001, T-002 | ✅ |
| REQ-V3-UI-041 | T-027, AC-UI-010 | ✅ |
| REQ-V3-UI-042 | T-028, AC-UI-010 | ✅ |
| REQ-V3-UI-043 | T-014 | ✅ |
| REQ-V3-UI-044 | T-012 | ✅ |
| REQ-V3-UI-045 | T-004, T-013, AC-UI-002 | ✅ |

**28/28 REQs covered.** ✅

### AC Coverage (13 ACs → Tasks)

| AC ID | Covered By | Status |
|-------|------------|--------|
| AC-UI-001 | T-013, T-014, T-007, T-009 | ✅ |
| AC-UI-002 | T-004, T-013, T-014 | ✅ |
| AC-UI-003 | T-015 | ✅ |
| AC-UI-004 | T-016 | ✅ |
| AC-UI-005 | T-016 | ✅ |
| AC-UI-006 | T-020 | ✅ |
| AC-UI-007 | T-021 | ✅ |
| AC-UI-008 | T-021, T-022 | ✅ |
| AC-UI-009 | T-024, T-025 | ✅ |
| AC-UI-010 | T-027, T-028 | ✅ |
| AC-UI-011 | T-010 | ✅ |
| AC-UI-012 | T-013 | ✅ |
| AC-UI-013 | T-017 | ✅ |

**13/13 ACs covered.** ✅

### Edge Cases Coverage (11 → Tasks)

| Edge Case | Covered By |
|-----------|------------|
| E1 빈 보드 | T-012 (empty-state) |
| E2 네트워크 에러 | T-012 (error + retry) |
| E3 동시 409 | T-016 |
| E4 세션 만료(ESIG 중) | T-020 (401 path) |
| E5 Stale cache(focus) | T-004 (staleTime + revalidateOnFocus) |
| E6 IDOR | T-016, T-025 |
| E7 승인 중 브라우저 종료 | T-022 (E2E happy path) |
| E8 final_answer 누락 | T-021 |
| E9 viewer 강제 이동 | T-029 |
| E10 대량 티켓(50+) | T-004 (limit=50, 한계 명시) |
| E11 활동 피드 데이터 소스 없음 | T-019 (Q3 scope-expansion 플래그) |

**11/11 edge cases addressed.** ✅

### File Delta Summary

- **[NEW]** (12 files): `stores/inbox.ts`, `lib/queries/useInbox.ts`, `components/inbox/{InboxKanban,KanbanColumn,TicketCard,TriageActionMenu,ApproveDialog,ActivityTimeline,SlaBadge,ViewerTicketSummary,state-tokens}.tsx`, `app/(app)/inbox/[id]/page.tsx`
- **[NEW] test files**: 각 컴포넌트/훅/페이지 + 2 E2E + 2 characterization
- **[MODIFY]** (5 source): `components/shell/Sidebar.tsx`, `app/(app)/layout.tsx`, `app/(app)/chat/page.tsx`, `messages/ko.json`, `messages/en.json`
- **[NEW] route**: `app/(app)/inbox/page.tsx` (T-009 stub → T-014 통합)
- **[EXISTING] consume-only**: `app/api/inbox/**`, `lib/domains/inbox/**`, `lib/auth/**`

### MX Tag Plan (acceptance.md §4.6)

- `@MX:ANCHOR`: `lib/queries/useInbox.ts` (T-004/005, fan_in ≥3), `components/inbox/TriageActionMenu.tsx` (T-015, VALID_TRANSITIONS 불변식)
- `@MX:WARN`: `components/inbox/ApproveDialog.tsx` (T-020, 21 CFR Part 11), `useTriageTransition` (T-005, optimistic + 409 동시성)
- `@MX:NOTE`: `app/(app)/inbox/page.tsx`, `app/(app)/inbox/[id]/page.tsx`, `stores/inbox.ts`
