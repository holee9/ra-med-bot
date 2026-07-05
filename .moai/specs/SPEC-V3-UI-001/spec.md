---
id: SPEC-V3-UI-001
version: 0.2.0
status: draft
created: 2026-07-03
updated: 2026-07-05
author: abyz-lab
priority: high
issue_number: 326
depends_on:
  - SPEC-V3-INBOX-001
blocks:
  - SPEC-V3-TRIAGE-001
  - SPEC-V3-CONSULT-001
lifecycle_level: spec-anchored
labels:
  - component/frontend
  - component/ui
  - domain/inbox
  - type/v3-new
---

# SPEC-V3-UI-001 — RA Inbox 4-column Kanban UI (Phase D)

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1.0 | 2026-07-03 | manager-spec | Initial plan + research.md. Brownfield UI consuming SPEC-V3-INBOX-001 (PR #322). 2 contract discrepancies flagged. |
| 1.0.0 | 2026-07-03 | abyz-lab | Plan Review Gate approved. spec.md / acceptance.md / spec-compact.md generated. Code-authoritative decisions applied (VALID_TRANSITIONS from types.ts:33-40; approve body {password, esigSignature} from approve/route.ts:19-22). Q1-Q5 resolved (see §8 Contract Discrepancies). issue_number=0 placeholder (Phase 2.5 updates post-Issue creation). |
| 0.2.0 | 2026-07-05 | manager-spec | M6 Consult UI 추가. PR #343 백엔드(SPEC-V3-CONSULT-001) 소비. REQ-V3-UI-050~062 (13종), AC-CONS-UI-01~05 (5종). 백엔드 코드 직검 완료(`:sessionId` 파라미터, role 필드 제거, citations 재사용). Exclusions: DELETE UI, 실시간 streaming, 세션 제목 편집, 검색/필터링 고급 기능. 총 REQ: 28 → 41. |
| 0.2.1 | 2026-07-05 | manager-spec | plan-auditor 감사(Critical 1 + Medium 6 + Low 1) 개정. D-1 turnCount 의존 제거(백엔드 미반환), D-4 E14 error string 'timeout' 정정, D-2/D-3 stale 'Not in this SPEC' 모순 해소, D-5 trace 표 REQ-057/061 보충, D-6 DoD 카운트 갱신(41 REQ/18 AC/15 E), D-7 frontmatter 0.2.0/draft 통일, D-8 REQ-050 shall 복원. |

---

## 1. Overview

본 SPEC은 RA Inbox 4-column Kanban UI(Phase D 프론트엔드 슬라이스)를 정의한다. 이 UI는 **이미 구현 완료된** 백엔드(SPEC-V3-INBOX-001, PR #322)의 API를 소비하여 RA Lead의 일일 트리아주 워크플로우를 지원한다. Phase D MVP는 4개 칸반 컬럼(`auto` / `needs-review` / `escalated` / `waiting`) 읽기 렌더링, 티켓 상세 라우트, 버튼 기반 트리아주 액션 메뉴, ESIG 승인 다이얼로그(21 CFR Part 11), 뷰어 "내 질문" 인라인 패널을 포함한다. 드래그-앤-드롭, WebSocket 실시간, 폴링, 일괄 작업, final_answer 편집 UI는 명시적으로 제외된다(§3 Exclusions).

이 SPEC의 단일 신뢰 출처는 **백엔드 코드**다. research.md와 SPEC-V3-INBOX-001 본문 중 코드와 충돌하는 서술은 모두 코드가 우선한다(§7 Contract Authoritative Source 참조).

---

## 2. Scope

### 2.1 In Scope (Phase D MVP slice)

| Slice | Detail | Source |
|-------|--------|--------|
| 4-column Kanban (읽기) | 컬럼: `auto`, `needs-review`, `escalated`, `waiting`. 종료 상태(`closed`, `rejected`)는 칸반 컬럼이 아닌 "archived" 필터로 렌더링. | plan §2.1; types.ts:33-40 |
| 티켓 상세 라우트 | 독립 라우트 `app/(app)/inbox/[id]/page.tsx`. URL 공유 가능, 인쇄 친화적(21 CFR Part 11 감사 증거). | plan §2.1 |
| 트리아주 상태 전이 | 카드별 버튼 액션 메뉴(드래그-앤-드롭 아님). `PATCH /api/inbox/[id]/triage` 호출. | plan §2.1; Charter 지양-4 |
| ESIG 승인/거부 | 승인 다이얼로그: 비밀번호 재입력 + ESIG 서명. `POST /api/inbox/[id]/approve` 호출. | approve/route.ts:19-22 |
| 뷰어 "내 질문" 보기 | 뷰어는 기존 `/chat`에서 질문(ask.create → inbox 티켓 자동 생성). `/chat` 인라인 패널에서 자신의 질문 상태를 확인. RA Kanban은 뷰어에게 노출되지 않는다. | plan §2.1 (Q4 decision) |
| 새로고침 전략 | tanstack-query `revalidateOnFocus` + 수동 새로고침 버튼 + `staleTime: 60s`. 자동 폴링 없음. | plan §2.1 |
| 활동 피드 | 상세 페이지에 audit 기반 타임라인 표시(append-only `audit_logs`, 21 CFR Part 11). | plan §2.1 (Q3 decision) |
| Consult 세션 목록(M6) | `/consult` 라우트. ra-member는 자신의 세션만, ra-lead/admin는 org 전체. "새 세션" 버튼으로 생성 다이얼로그 표시. | plan §2.1 (M6 추가) |
| Consult 세션 상세 + turns(M6) | `/consult/[sessionId]` 라우트. 세션 메타데이터 + turns 히스토리(turnNumber ASC). 질문 입력 폼(1-5000자). citations 재사용. | plan §2.1 (M6 추가) |
| Consult turn 생성(M6) | `POST /api/consult/sessions/[sessionId]/turns`로 non-streaming 질문-답변 생성. 201=turn 추가, 400=error 표시하나 turn도 히스토리에 표시(RA 피드백). | plan §2.1 (M6 추가) |

### 2.2 Exclusions (What NOT to Build) — Phase D

> Each exclusion cites rationale. These are HARD scope boundaries.

1. **WebSocket 실시간** (`/api/inbox/subscribe`) — 후속 Phase로 연기. 근거: Phase D MVP 범위 통제.
2. **드래그-앤-드롭 컬럼 이동** — 명시적 제외. ESIG 승인은 비밀번호 재입력 필요(DnD로 불가); 21 CFR Part 11 감사; WCAG 접근성 위반(Charter 지양-4).
3. **일괄 작업** (다중 선택 트리아주/승인) — 제외. 근거: ESIG는 개별 승인만 허용(§11.70).
4. **자동 폴링** (interval-based refetch) — 제외. 수동 + focus 새로고침만. 근거: 서버 부하 +_tokens.
5. **새 백엔드 API** — 기존 API만 소비(`/api/inbox`, `/api/inbox/[id]`, `/api/inbox/[id]/triage`, `/api/inbox/[id]/approve`, `/api/ask`). 예외: 활동 피드용 `GET /api/inbox/[id]/audit` 래퍼는 run phase ANALYZE에서 확인 후 필요시 최소 추가(Q3 potential scope expansion).
6. **새 권한** — 기존 `inbox.view`(ra-member+), `inbox.manage`(ra-lead), `ask.create`(viewer/employee) 재사용. `lib/auth/permissions.ts` 변경 없음.
7. **TRIAGE 자동 응답 주입 UI** — SPEC-V3-TRIAGE-001(C-2) 의존. UI는 `autoAnswer`가 존재하면 표시만 하고 생성하지 않는다.
8. **Consult (Power Chat) — Power Chat 세션 기본 UI** — `SPEC-V3-CONSULT-001`(C-5). 본 SPEC M6에 편입. 세션 목록, 상세, 새 turn 생성 UI 포함. DELETE soft-delete UI, 실시간 streaming, 세션 제목 편집, 검색/필터링 고급 기능은 제외됨.
9. **Consult DELETE soft-delete UI** — ra-lead+ 전용, M6 제외. 별도 SPEC 권장.
10. **Consult 실시간 streaming UI** — 기존 `/api/ra/consult` SSE 흐름과 무관. consult turn은 non-streaming POST.
11. **Consult WebSocket, 폴링, 일괄 작업** — M6 제외.
12. **Consult 세션 제목 편집 UI** — M6 제외. 생성 시 title만 설정.
13. **Consult 세션 검색/필터링 고급 기능** — M6 제외. 기본 목록 + role 필터만.
14. **어드민 감사 로그 뷰어** — 별도 어드민 서피스(기존 `app/(app)/audit/`). 본 SPEC은 상세 페이지의 per-ticket 활동 피드만 표시.
10. **칸반 리스트-뷰 토글** — MVP는 Kanban-only. 리스트 뷰는 연기.
11. **final_answer 편집 UI** — Phase D는 `finalAnswer`가 이미 truthy일 때만 승인을 활성화(Q2 decision). final_answer 편집은 TRIAGE C-2 또는 Phase D.2로 연기.
12. **담당자 필터(assignee filter)** — MVP는 필터 없음, `showArchived` 토글만(Q5 decision). Phase D.2로 연기.

---

## 3. Requirements (EARS Format)

> 6개 모듈, 총 41개 REQ(M1=5 + M2=7 + M3=5 + M4=5 + M5=6 + M6=13). 각 UI REQ는 소비하는 백엔드 REQ로 추적 가능(INBOX: REQ-V3-INBOX-XXX, CONSULT: REQ-CONS-XXX) (§4 Traceability). EARS 키워드(WHEN/WHILE/WHERE/IF/SHALL/SHALL NOT)는 영어로 유지; 서술은 한국어.

### Module 1 — Kanban Board Rendering & Data Fetching

#### REQ-V3-UI-001 (Ubiquitous)
The system **shall** `inbox.view` 권한(ra-member+)을 가진 사용자를 위해 `/inbox` 라우트에서 4-칼럼 Kanban 보드(`auto` / `needs-review` / `escalated` / `waiting`)를 렌더링한다. 종료 상태(`closed`, `rejected`)는 칼럼으로 렌더링하지 않는다.
- **Backend trace**: REQ-V3-INBOX-002 (6값 enum → 4 작업 칼럼 + 2 종료 상태).

#### REQ-V3-UI-002 (Event-Driven)
**When** Kanban 페이지가 마운트되거나 포커스를 되찾으면, the system **shall** 4개 작업 칼럼 각각에 대해 `GET /api/inbox?state=<state>&limit=50`을 병렬로 호출하여 티켓을 가져온다.
- **Backend trace**: REQ-V3-INBOX-019, REQ-V3-INBOX-020 (app/api/inbox/route.ts:20-55).

#### REQ-V3-UI-003 (State-Driven)
**While** 특정 칼럼 쿼리가 로딩 중이면, the system **shall** 칼럼별 skeleton loader를 표시한다; **while** 쿼리가 에러면, the system **shall** 재시도 버튼이 있는 에러 상태를 표시한다.

#### REQ-V3-UI-004 (Optional)
**Where** 티켓에 `slaDeadline`이 있으면, the system **shall** 상대 시간을 보여주는 SLA 배지를 렌더링하며, `slaDeadline < now`인 경우 "overdue" 스타일을 적용한다.
- **Backend trace**: REQ-V3-INBOX-017 (lib/domains/inbox/sla.ts).

#### REQ-V3-UI-005 (Ubiquitous)
The system **shall** 종료 상태 티켓(`closed`, `rejected`)을 사용자가 명시적으로 "archived" 필터를 선택했을 때만 렌더링하며, Kanban 칼럼으로는 표시하지 않는다.
- **Backend trace**: REQ-V3-INBOX-002.

### Module 2 — Ticket Detail View & ESIG Approve Flow

#### REQ-V3-UI-010 (Event-Driven)
**When** 사용자가 Kanban 카드를 클릭하면, the system **shall** `/inbox/[id]` 독립 라우트로 이동하며 `GET /api/inbox/[id]`를 호출한다.
- **Backend trace**: REQ-V3-INBOX-019 (app/api/inbox/[id]/route.ts:11-43).

#### REQ-V3-UI-011 (Ubiquitous)
The detail page **shall** 다음 필드를 표시한다: question, autoAnswer(citations 포함), raAssignee, escalateTo, slaDeadline, triageState, approvedBy/At, finalAnswer, 그리고 audit 기반 활동 타임라인.
- **Backend trace**: REQ-V3-INBOX-001 (필드 세트), REQ-V3-INBOX-021 (audit actions).

#### REQ-V3-UI-012 (State-Driven)
**While** 사용자가 `ra-lead`/`admin` **AND** 티켓에 `finalAnswer`가 설정됨 **AND** `triageState`가 `closed`/`rejected`가 아님, the system **shall** "Approve (ESIG)" 액션을 표시한다.
- **Backend trace**: REQ-V3-INBOX-012, REQ-V3-INBOX-014.
- **Note (Q2 decision)**: Phase D는 final_answer 편집 UI를 포함하지 않는다. 승인은 `finalAnswer`가 이미 truthy일 때만 활성화된다.

#### REQ-V3-UI-013 (Event-Driven)
**When** 사용자가 승인 폼을 제출하면, the system **shall** `POST /api/inbox/[id]/approve`를 body `{password, esigSignature}`로 호출하고, 응답이 올 때까지 제출 버튼을 비활성화 + "서명 중..." pending 상태를 표시한다.
- **Backend trace**: REQ-V3-INBOX-012 (approve/route.ts:19-22, 25-144).
- **Contract (code-authoritative)**: body는 `{password, esigSignature}`만 허용(approve/route.ts:19-22 Zod schema). `{final_answer, citations[], esig:{...}}` 형태는 코드에 존재하지 않는다(§7 DISCREPANCY-2).

#### REQ-V3-UI-014 (Unwanted)
**If** 승인 엔드포인트가 401(잘못된 비밀번호)을 반환하면, the system **shall** 비밀번호 필드에 인라인 "비밀번호가 올바르지 않습니다" 에러를 표시하며 **SHALL NOT** 다른 페이지로 이동하거나 일반 toast를 표시한다.
- **Backend trace**: approve/route.ts:82.

#### REQ-V3-UI-015 (Unwanted)
**If** 승인 엔드포인트가 400 "Cannot promote"(`final_answer` 누락)을 반환하면, the system **shall** 사용자에게 먼저 `finalAnswer`를 설정하라는 차단 메시지를 표시하며 **SHALL NOT** 자동으로 재시도한다.
- **Backend trace**: approve/route.ts:134-136 (400 "Cannot promote" return; `:118` is the audit `meta_json` block, not the 400 path).

#### REQ-V3-UI-016 (Event-Driven)
**When** 승인 엔드포인트가 200을 반환하면, the system **shall** tanstack-query의 `/inbox` 쿼리 캐시를 무효화하고 **AND** 사용자를 Kanban으로 이동시키며 성공 toast를 표시한다.

### Module 3 — Triage Action UI (Button Menu, State Transition, 409 Handling)

#### REQ-V3-UI-020 (State-Driven)
**While** 사용자가 `ra-lead`/`admin` **AND** 티켓이 비-종료 상태, the system **shall** 카드별 액션 메뉴를 렌더링하며, 해당 티켓의 현재 `triageState`에 대해 `VALID_TRANSITIONS`가 허용하는 전이만 제공한다.
- **Backend trace**: REQ-V3-INBOX-006.
- **Contract (code-authoritative)**: `VALID_TRANSITIONS`는 `lib/domains/inbox/types.ts:33-40`의 상수가 단일 신뢰 출처다(§7 DISCREPANCY-1). 구체적으로: (1) `auto` 상태 카드는 오직 "Needs Review"만 제안; (2) `waiting` 상태 카드는 "Reject"를 제안하지 않음(needs-review를 거쳐야 함); (3) 범용 "any→rejected" 경로는 존재하지 않는다.

#### REQ-V3-UI-021 (Event-Driven)
**When** 사용자가 전이 대상을 선택하면, the system **shall** 로컬 Kanban 캐시를 optimistic update하고 **AND** `PATCH /api/inbox/[id]/triage`를 `{toState, reason?}`로 호출한다.
- **Backend trace**: REQ-V3-INBOX-006 (triage/route.ts:23-131).

#### REQ-V3-UI-022 (Unwanted)
**If** 트리아주 엔드포인트가 409 Conflict(잘못된 전이)를 반환하면, the system **shall** optimistic update를 롤백하고 **AND** "상태 전이 실패 — 새로고침 후 다시 시도하세요" toast를 표시한다.
- **Backend trace**: triage/route.ts:74-93.

#### REQ-V3-UI-023 (Unwanted)
**If** 트리아주 엔드포인트가 404(티켓이 org에 없음 / IDOR 시도)를 반환하면, the system **shall** 로컬 캐시에서 카드를 제거하고 **AND** 콘솔에 경고를 로그한다.
- **Backend trace**: triage/route.ts (IDOR defense via assertTicketInOrg).

#### REQ-V3-UI-024 (Optional)
**Where** 전이 대상이 `rejected` 또는 `escalated`이면, the system **shall** 확인 전에 선택적 `reason`(최대 500자)을 입력하라는 프롬프트를 표시한다.
- **Backend trace**: triage/route.ts:19.

### Module 4 — Role-Based Access & Viewer "My Questions"

#### REQ-V3-UI-030 (Ubiquitous)
The system **shall** `/inbox` 라우트를 서버 사이드(`app/(app)/layout.tsx`)에서 게이트하여 `ra-member`/`ra-lead`/`admin`만 접근할 수 있게 한다; `viewer`/`employee`는 `/chat`으로 리다이렉트된다.
- **Backend trace**: REQ-V3-INBOX-008, REQ-V3-INBOX-009.

#### REQ-V3-UI-031 (Ubiquitous)
The Sidebar nav **shall** "Inbox" 엔트리를 해결된 역할이 `ra-member`+일 때만 표시한다(`app/(app)/layout.tsx`에서 `showInbox` prop으로 전달, 기존 패턴 준수).
- **Convention**: Sidebar.tsx L33-75 showX prop pattern.

#### REQ-V3-UI-032 (State-Driven)
**While** 사용자가 `ra-member`(`ra-lead` 아님), the system **shall** 모든 `inbox.manage` 액션(트리아주 메뉴, 승인 버튼, 거부)을 숨기고 Kanban을 읽기 전용으로 렌더링한다.
- **Backend trace**: REQ-V3-INBOX-008.

#### REQ-V3-UI-033 (Event-Driven)
**When** viewer/employee가 `/chat`에서 질문을 제출하면, the system **shall** `POST /api/ask`를 호출하고, 성공 시 결과 `ticket_id` + `triage_state`를 "내 질문 상태" 인라인 패널로 뷰어에게 표시한다.
- **Backend trace**: REQ-V3-INBOX-030 (ask/route.ts).
- **Note (Q4 decision)**: 별도 라우트가 아닌 기존 `/chat` 페이지의 인라인 패널.

#### REQ-V3-UI-034 (Optional)
**Where** viewer가 자신이 소유한 티켓 상세 URL을 방문하면, the system **shall** 최소한의 "내 질문 상세" 보기(자신의 질문 + 현재 triage 상태 + 승인된 답변이 있는 경우)를 렌더링하며, 모든 RA 전용 필드를 게이트한다.
- **Backend trace**: REQ-V3-INBOX-010 (own-ticket query layer, lib/domains/inbox/access.ts).

### Module 5 — Cross-Cutting: i18n, Accessibility, Design Tokens, Error/Empty/Loading

#### REQ-V3-UI-040 (Ubiquitous)
The system **shall** `messages/ko.json` 및 `messages/en.json` 양쪽에 새 `inbox` i18n 네임스페이스를 추가한다. 키: title, columns.{auto,needsReview,escalated,waiting,closed,rejected}, actions.{approve,reject,assign,escalate,refresh}, sla.{overdue,remaining}, empty, loading, errors.{transitionFailed,approveFailed,passwordInvalid,missingFinalAnswer}.

#### REQ-V3-UI-041 (Ubiquitous)
The system **shall** triage-state 디자인 토큰을 research.md §5.5에 따라 일관되게 적용한다(auto=brand-300, needs-review=amber-500, escalated=orange-500, waiting=blue-500, closed=ink-300, rejected=red-500). 카드 테두리, 배지, 칼럼 헤더 액센트에 동일 토큰 사용.
- **Source**: styles/tokens.css, tailwind.config.ts.

#### REQ-V3-UI-042 (Ubiquitous)
The system **shall** WCAG 2.1 AA를 충족한다: 모든 액션 버튼이 키보드 접근 가능, 아이콘 전용 버튼에 ARIA 라벨, 텍스트 색상 대비 ≥ 4.5:1, 모든 인터랙티브 요소에 focus 표시.
- **Rationale**: Charter — medical device software.

#### REQ-V3-UI-043 (Unwanted)
**If** inbox 엔드포인트에서 403 Forbidden이 반환되면, the system **shall** 인라인 "접근 권한이 없습니다" 빈 상태를 표시하며 **SHALL NOT** 크래시되거나 원본 에러 JSON을 표시한다.
- **Backend trace**: REQ-V3-INBOX-009.

#### REQ-V3-UI-044 (Optional)
**Where** 칼럼에 티켓이 0개이면, the system **shall** 빈 상태 일러스트레이션 + i18n `inbox.empty` 메시지를 렌더링한다.

#### REQ-V3-UI-045 (Ubiquitous)
The system **shall** 모든 inbox 읽기에 `tanstack-query`를 사용하며 `staleTime: 60_000`과 `revalidateOnFocus: true`를 적용하고, **AND** Kanban 헤더에 수동 "새로고침" 버튼을 제공한다.
- **Source**: research.md §5.1.

### Module 6 — Consult (Power Chat) Session History UI

#### REQ-V3-UI-050 (Ubiquitous)
The system **shall** `consult.session.view` 권한(ra-member+)을 가진 사용자를 위해 `/consult` 라우트에서 RA Power Chat 세션 목록을 렌더링한다. ra-member는 자신의 세션만, ra-lead/admin는 org 전체 세션을 본다.
- **Backend trace**: REQ-CONS-002 (app/api/consult/sessions/route.ts:86-118, role-based filtering).
- **백엔드 제약사항**: `GET /api/consult/sessions`는 `turnCount`를 반환하지 않음(스키마에 컬럼 없음, `lib/db/schema.ts:3346-3371`). UI는 `title`, `createdAt`, `updatedAt`만 표시. `turnCount`가 필요하면 별도 백엔드 SPEC에서 computed 필드 확장 필요(M6 범위 外).

#### REQ-V3-UI-051 (Event-Driven)
**When** consult 세션 목록 페이지가 마운트되거나 포커스를 되찾으면, the system **shall** `GET /api/consult/sessions?limit=50&offset=0`을 호출하여 세션 목록을 가져온다. 페이지네이션은 "Load More" 버튼으로 구현한다.
- **Backend trace**: REQ-CONS-002 (app/api/consult/sessions/route.ts:80-118).

#### REQ-V3-UI-052 (Event-Driven)
**When** 사용자가 "새 세션" 버튼을 클릭하면, the system **shall** 세션 생성 다이얼로그를 표시하고, `POST /api/consult/sessions`를 `{title:1-200, projectId?, locale?}` 본문으로 호출한다.
- **Backend trace**: REQ-CONS-001 (app/api/consult/sessions/route.ts:23-77).

#### REQ-V3-UI-053 (Event-Driven)
**When** 세션 생성이 성공(201)하면, the system **shall** 새로 생성된 세션의 상세 페이지 `/consult/[sessionId]`로 네비게이션한다.
- **Backend trace**: REQ-CONS-001 (app/api/consult/sessions/route.ts:76).

#### REQ-V3-UI-054 (Event-Driven)
**When** 사용자가 세션 카드를 클릭하면, the system **shall** `/consult/[sessionId]` 라우트로 네비게이션하고 `GET /api/consult/sessions/[sessionId]`를 호출하여 세션 상세와 turns 목록을 가져온다. turns는 turnNumber 오름차순으로 렌더링한다.
- **Backend trace**: REQ-CONS-003 (app/api/consult/sessions/[sessionId]/route.ts:14-52).

#### REQ-V3-UI-055 (State-Driven)
**While** 세션 상세 페이지에서 사용자가 질문을 입력 중이면, the system **shall** 질문 입력 필드(1-5000자)와 "전송" 버튼을 표시한다.
- **Backend trace**: REQ-CONS-004 (app/api/consult/sessions/[sessionId]/turns/route.ts:19-21).

#### REQ-V3-UI-056 (Event-Driven)
**When** 사용자가 질문을 제출하면, the system **shall** `POST /api/consult/sessions/[sessionId]/turns`를 `{question: "..."}` 본문으로 호출하고, 제출 버튼을 비활성화한다.
- **Backend trace**: REQ-CONS-004 (app/api/consult/sessions/[sessionId]/turns/route.ts:23-133).

#### REQ-V3-UI-057 (State-Driven)
**While** turn 생성이 진행 중이면, the system **shall** 로딩 인디케이터("답변 생성 중...")를 표시하고, 새 turn을 히스토리에 추가하지 않는다.
- **Backend trace**: REQ-CONS-004 (RAG pipeline outside tx).

#### REQ-V3-UI-058 (Event-Driven)
**When** turn 생성이 성공(201)하면, the system **shall** 새 turn을 세션 히스토리에 추가(append)하고, 답변(answer), 인용(citations), 신뢰도(confidence)를 렌더링한다.
- **Backend trace**: REQ-CONS-004, REQ-CONS-008 (app/api/consult/sessions/[sessionId]/turns/route.ts:132).

#### REQ-V3-UI-059 (Unwanted)
**If** turn 생성이 400을 반환하고 error 필드가 있으면, the system **shall** error를 사용자에게 표시하되 turn도 히스토리에 표시한다(RA member가 실패 피드백 확인 가능).
- **Backend trace**: REQ-CONS-005, REQ-CONS-010 (app/api/consult/sessions/[sessionId]/turns/route.ts:127-128).

#### REQ-V3-UI-060 (Unwanted)
**If** 세션 조회가 404를 반환하면(존재하지 않거나 cross-user 접근), the system **shall** "세션을 찾을 수 없습니다" 메시지를 표시하고 `/consult` 목록으로 리다이렉트한다.
- **Backend trace**: REQ-CONS-003, RBAC (app/api/consult/sessions/[sessionId]/route.ts:40-42).

#### REQ-V3-UI-061 (Optional)
**Where** turn에 citations가 있으면, the system **shall** 인용 렌더링 컴포넌트(`Citation`, `SourcesGrid`)를 재사용하여 표시한다. 기존 `/api/ra/consult` streaming용 컴포넌트를 재활용한다.
- **Backend trace**: REQ-CONS-004 (citations JSONB array, 재사용).

#### REQ-V3-UI-062 (Ubiquitous)
The system **shall** Sidebar에 "Consult" 엔트리를 추가하고, `showConsult` prop(ra-member+)로 게이팅한다. 기존 `showInbox` 패턴을 준수한다.
- **Backend trace**: consult.session.view minRole (lib/auth/permissions.ts).

---

## 4. Backend Traceability (UI REQ ↔ Backend REQ ↔ AC)

| UI REQ | Backend REQ | Backend AC Implemented by UI | Backend Source (file:line) |
|--------|-------------|------------------------------|----------------------------|
| REQ-V3-UI-001 | REQ-V3-INBOX-002 | AC-02 (triage_state enum rendering) | lib/domains/inbox/types.ts:17 |
| REQ-V3-UI-002 | REQ-V3-INBOX-019, REQ-V3-INBOX-020 | AC-09 (filter by state) | app/api/inbox/route.ts:20-55 |
| REQ-V3-UI-004 | REQ-V3-INBOX-017 | (SLA deadline display) | lib/domains/inbox/sla.ts |
| REQ-V3-UI-010 | REQ-V3-INBOX-019 | AC-09 (detail fetch) | app/api/inbox/[id]/route.ts:11-43 |
| REQ-V3-UI-011 | REQ-V3-INBOX-001, REQ-V3-INBOX-021 | (detail field set + audit actions) | app/api/inbox/[id]/route.ts:11-43, audit_logs |
| REQ-V3-UI-012, REQ-V3-UI-013 | REQ-V3-INBOX-012, REQ-V3-INBOX-014 | AC-05 (ESIG approve flow) | app/api/inbox/[id]/approve/route.ts:19-22, 25-144 |
| REQ-V3-UI-014, REQ-V3-UI-015 | (error handling) | AC-05 failure paths | approve/route.ts:82, :134-136 |
| REQ-V3-UI-020, REQ-V3-UI-021 | REQ-V3-INBOX-006 | AC-04 (409 on invalid transition) | lib/domains/inbox/types.ts:33-40, app/api/inbox/[id]/triage/route.ts:23-131 |
| REQ-V3-UI-022, REQ-V3-UI-023 | (error handling) | AC-04, AC-10 (IDOR) | triage/route.ts:74-93 |
| REQ-V3-UI-030, REQ-V3-UI-032 | REQ-V3-INBOX-008, REQ-V3-INBOX-009 | AC-03 (403 + audit), AC-07 (RBAC) | lib/auth/permissions.ts:172-177 |
| REQ-V3-UI-033 | REQ-V3-INBOX-030 | AC-13 (ask→ticket creation) | app/api/ask/route.ts |
| REQ-V3-UI-034 | REQ-V3-INBOX-010 | AC-03 (own-ticket query) | lib/domains/inbox/access.ts |
| REQ-V3-UI-043 | REQ-V3-INBOX-009 | AC-03 (403 handling) | lib/auth/with-permission.ts |
| **Consult UI (M6)** | | | |
| REQ-V3-UI-050 | REQ-CONS-002 | AC-CONS-02 (session list, role filter) | app/api/consult/sessions/route.ts:86-118 |
| REQ-V3-UI-051 | REQ-CONS-002 | AC-CONS-02 (pagination) | app/api/consult/sessions/route.ts:80-118 |
| REQ-V3-UI-052 | REQ-CONS-001 | AC-CONS-01 (session create) | app/api/consult/sessions/route.ts:23-77 |
| REQ-V3-UI-053 | REQ-CONS-001 | AC-CONS-01 (201 navigate) | app/api/consult/sessions/route.ts:76 |
| REQ-V3-UI-054 | REQ-CONS-003 | AC-CONS-02b (detail + turns) | app/api/consult/sessions/[sessionId]/route.ts:14-52 |
| REQ-V3-UI-055 | REQ-CONS-004 | (question input 1-5000) | app/api/consult/sessions/[sessionId]/turns/route.ts:19-21 |
| REQ-V3-UI-056 | REQ-CONS-004 | AC-CONS-03 (turn create) | app/api/consult/sessions/[sessionId]/turns/route.ts:23-133 |
| REQ-V3-UI-057 | REQ-CONS-004 | (loading state, outside tx) | app/api/consult/sessions/[sessionId]/turns/route.ts:60 |
| REQ-V3-UI-058 | REQ-CONS-004, REQ-CONS-008 | AC-CONS-03 (success + citations) | app/api/consult/sessions/[sessionId]/turns/route.ts:132 |
| REQ-V3-UI-059 | REQ-CONS-005, REQ-CONS-010 | AC-CONS-05 (error + turn persisted) | app/api/consult/sessions/[sessionId]/turns/route.ts:127-128 |
| REQ-V3-UI-060 | REQ-CONS-003, RBAC | AC-CONS-07 (404 cross-user) | app/api/consult/sessions/[sessionId]/route.ts:40-42 |
| REQ-V3-UI-061 | REQ-CONS-004 | (citations JSONB reuse) | lib/db/schema.ts:3386 |
| REQ-V3-UI-062 | consult.session.view | (RBAC ra-member+) | lib/auth/permissions.ts |

**Backend AC NOT implemented by UI** (backend-only, out of UI scope): AC-01, AC-06, AC-08, AC-10, AC-11, AC-12 (all migration / DB-level / audit-log assertions). Consult UI: AC-CONS-04 (citation coverage), AC-CONS-06 (DELETE soft-delete), AC-CONS-07 (5-year retention), AC-CONS-08 (audit log — backend only).

---

## 5. Affected Files (Delta Markers — Brownfield)

> 모든 경로는 프로젝트 루트 상대(root-level `app/`, NOT `src/app/`). 2026-07-03 파일시스템 검증 완료.

### 5.1 `[NEW]` Files to Create

| Path | Purpose |
|------|---------|
| `app/(app)/inbox/page.tsx` | Kanban 보드 페이지(클라이언트 컴포넌트, 4 칼럼 + 필터 + 수동 새로고침). |
| `app/(app)/inbox/[id]/page.tsx` | 티켓 상세 라우트(question, citations, assignee, ESIG 승인 다이얼로그, audit 타임라인). |
| `components/inbox/InboxKanban.tsx` | Kanban 보드 셸(칼럼 레이아웃, drag-free). |
| `components/inbox/KanbanColumn.tsx` | 단일 칼럼 렌더러(헤더 + 티켓 목록 + 빈 상태). |
| `components/inbox/TicketCard.tsx` | 컴팩트 카드(question 발췌, triage 배지, SLA 배지, assignee 아바타, 액션 메뉴 트리거). |
| `components/inbox/TriageActionMenu.tsx` | Radix DropdownMenu — `VALID_TRANSITIONS[currentState]` 대상만 제공. |
| `components/inbox/ApproveDialog.tsx` | Radix Dialog — password + esigSignature 필드, 인라인 401 처리, 원자 제출. |
| `components/inbox/ActivityTimeline.tsx` | Append-only audit log 타임라인(per-ticket). |
| `components/inbox/SlaBadge.tsx` | SLA 상대 시간 배지 + overdue 스타일. |
| `components/inbox/ViewerTicketSummary.tsx` | 뷰어용 최소 자기 티켓 보기(REQ-V3-UI-034). |
| `lib/queries/useInbox.ts` | tanstack-query 훅: `useInboxTickets(state)`, `useInboxTicket(id)`, `useTriageTransition()`, `useApproveTicket()`. |
| `stores/inbox.ts` | Zustand 스토어(selectedTicketId, showArchived). `stores/project.ts` 패턴 준수. `viewMode`(Kanban-vs-list)는 Exclusion #10(리스트-뷰 제외)으로 인해 명시적으로 미포함. |
| `app/(app)/consult/page.tsx` | Consult 세션 목록 페이지(M6, 세션 카드 그리드 + "새 세션" 버튼). |
| `app/(app)/consult/[sessionId]/page.tsx` | Consult 세션 상세 페이지(M6, turns 히스토리 + 질문 입력). |
| `components/consult/ConsultSessionCard.tsx` | 세션 카드(title, createdAt, updatedAt, 클릭 시 상세 이동). |
| `components/consult/ConsultSessionList.tsx` | 세션 목록 그리드(무한 스크롤 아님, "Load More" 버튼). |
| `components/consult/ConsultSessionDetail.tsx` | 세션 상세 레이아웃(turns 히스토리 + 질문 입력 폼). |
| `components/consult/TurnHistoryItem.tsx` | 단일 turn 렌더러(question + answer + citations + confidence + timestamp). |
| `components/consult/NewSessionDialog.tsx` | 새 세션 생성 다이얼로그(title 1-200, projectId 선택, locale 선택). |
| `components/consult/QuestionComposer.tsx` | 질문 입력 컴포넌트(1-5000자, submit 중 비활성화). |
| `lib/queries/useConsult.ts` | tanstack-query 훅: `useConsultSessions()`, `useConsultSession()`, `useCreateConsultSession()`, `useCreateTurn()`. |
| `stores/consult.ts` | Zustand 스토어(selectedSessionId). `stores/inbox.ts` 패턴 준수. |

> **컴포넌트 디렉토리 결정**: 새 `components/inbox/` 디렉토리 생성(`components/dashboard/` 하위 아님). 근거: (1) `components/dashboard/`는 다른 기능 서피스; (2) inbox는 8개 전용 컴포넌트(자체 디렉토리에 충분); (3) 기존 per-domain 관례 준수(`components/chat/`, `components/expert-review/`, `components/knowledge-gap/`).

### 5.2 `[MODIFY]` Files

| Path | Change | Convention Evidence |
|------|--------|---------------------|
| `components/shell/Sidebar.tsx` | `showInbox?: boolean` prop 추가 + true일 때 "Inbox" NavItem 렌더링. `showConsult?: boolean` prop 추가 + true일 때 "Consult" NavItem 렌더링(M6). | Sidebar.tsx L33-75 (`showPredicate`, `showKnowledgeGap`, ... pattern). consult 엔트리는 inbox 다음 삽입. |
| `app/(app)/layout.tsx` | 서버 사이드에서 `showInbox = hasRole(userRole, 'ra-member')` 해결 + `<Sidebar showInbox={showInbox}>` 전달. `showConsult = hasRole(userRole, 'ra-member')` 해결 + `<Sidebar showConsult={showConsult}>` 전달(M6). | layout.tsx L21-60 (server-side `showX` pattern). |
| `app/(app)/chat/page.tsx` | ask.create 성공 후 결과 `ticket_id` + `triage_state`를 뷰어에게 노출(작은 "내 질문 상태" 패널/toast, 소유한 경우 `/inbox/[id]` 링크). | (기존 chat 서피스; 최소 증강) |
| `messages/ko.json` | 최상위 `inbox` 네임스페이스 추가. `consult` 네임스페이스 추가(M6, keys: title, newSession, loadMore, empty, errors.sessionNotFound, errors.createFailed, errors.turnFailed, questionPlaceholder, submitButton, loadingAnswer, errorDisplay). | (2026-07-03 누락 확인됨) |
| `messages/en.json` | 최상위 `inbox` 네임스페이스 추가. `consult` 네임스페이스 추가(M6, same keys as ko.json). | (2026-07-03 누락 확인됨) |

### 5.3 `[EXISTING]` Files (Consume, DO NOT Modify)

| Path | Why Touched (read-only) |
|------|-------------------------|
| `app/api/inbox/route.ts` | GET list (소비). |
| `app/api/inbox/[id]/route.ts` | GET detail (소비). |
| `app/api/inbox/[id]/triage/route.ts` | PATCH transition (소비). |
| `app/api/inbox/[id]/approve/route.ts` | POST approve (소비). |
| `app/api/ask/route.ts` | POST viewer question (소비). |
| `app/api/consult/sessions/route.ts` | GET list, POST create (소비, M6). |
| `app/api/consult/sessions/[sessionId]/route.ts` | GET detail + turns (소비, M6). |
| `app/api/consult/sessions/[sessionId]/turns/route.ts` | POST turn create (소비, M6). |
| `lib/domains/inbox/**` (types.ts, state-machine.ts, queries.ts, access.ts, promote.ts, audit.ts, sla.ts) | 타입 + 클라이언트 사이드 전이 검증 재사용(예: `VALID_TRANSITIONS`를 액션 메뉴 게이팅용 import). |
| `lib/auth/permissions.ts` | 권한 키(읽기 전용 import; consult.session.* 키 추가됨, M6). |
| `lib/auth/with-permission.ts` | 서버 사이드 가드 래퍼(읽기 전용). |
| `lib/auth/rbac.ts` | `hasRole()` 헬퍼(읽기 전용). |
| `components/chat/*` (ChatShell, Composer, AnswerBlock, Citation, SourcesGrid, ConfidenceBadge, Timeline) | 기존 `/api/ra/consult` 1-shot streaming 전용 — consult UI와 별개 흐름(M6). Citation, SourcesGrid, ConfidenceBadge는 재사용 가능. |

---

## 6. Non-Functional Requirements

| Constraint | Source | How Addressed |
|-----------|--------|---------------|
| **WCAG 2.1 AA** | Charter (medical device software) | REQ-V3-UI-042; `@axe-core/playwright` E2E 스캔. 키보드 탐색, ARIA 라벨, 색상 대비 ≥ 4.5:1, focus 표시. |
| **21 CFR Part 11 §11.10(e)** (audit records) | SPEC-V3-INBOX-001 §1.3 | REQ-V3-UI-011: 활동 타임라인은 append-only audit log 표시. |
| **21 CFR Part 11 §11.50/§11.70** (ESIG) | SPEC-V3-INBOX-001 §1.3 | REQ-V3-UI-013: ESIG = 비밀번호 재인증 + 서명; 일괄 승인 제외(§11.70). |
| **Charter 지양-2 (가짜 신뢰 금지)** | product-charter.md | 승인은 ESIG 필요; autoAnswer는 citations가 있는 경우만 표시(citation 없음 = 표시 안 함); REQ-V3-UI-011, REQ-V3-UI-013. |
| **Charter 지양-4 (AI 판단 금지)** | product-charter.md | 자동 승인 없음; 모든 전이는 사람이 시작; 감사 명확성을 위해 버튼 기반(DnD 아님); REQ-V3-UI-020. |
| **i18n (ko/en)** | language.yaml | REQ-V3-UI-040: `inbox.*` 네임스페이스 next-intl 통합. |
| **ISO 13485 §4.2.5** (7-year retention) | SPEC-V3-INBOX-001 §1.3 | 백엔드 관심사; UI는 표시만(삭제 UI 없음). |

---

## 7. Contract Authoritative Source (Code over Text)

> 백엔드 코드는 **authoritative**하다(PR #322 병합, PR #343 consult 백엔드). research.md와 SPEC 본문 중 코드와 충돌하는 서술은 모두 코드가 우선한다.

### 7.1 DISCREPANCY-1: VALID_TRANSITIONS matrix (Q1 decision: cite code as authoritative)

- **research.md §2 주장**: `auto → {needs-review, escalated, closed}` and `*(any) → rejected (ra-lead only)`.
- **SPEC-V3-INBOX-001 §4.3 주장**: research.md와 동일(auto→escalated, auto→closed, *(any)→rejected).
- **실제 코드** (`lib/domains/inbox/types.ts:33-40`, verified 2026-07-03):
  ```ts
  auto: ['needs-review'],                              // ONLY needs-review
  'needs-review': ['escalated', 'waiting', 'closed', 'rejected'],
  escalated: ['waiting', 'closed', 'rejected'],
  waiting: ['needs-review', 'closed'],                 // NO rejected from waiting
  closed: [],
  rejected: [],
  ```
- **UI에 미치는 영향**: `TriageActionMenu`(REQ-V3-UI-020)는 옵션을 실제 `VALID_TRANSITIONS` 상수에서 도출한다. 구체적으로: (1) `auto` 상태 카드는 오직 "Needs Review"만 제안; (2) `waiting` 상태 카드는 "Reject"를 제안하지 않음(needs-review를 거쳐야 함); (3) 범용 "any→rejected" 경로는 존재하지 않는다.
- **Resolution (user-approved)**: UI는 `lib/domains/inbox/types.ts`의 `VALID_TRANSITIONS`를 단일 신뢰 출처로 import. SPEC-V3-INBOX-001 §4.3는 후속 이슈(또는 sync phase)에서 코드에 맞게 수정 필요(follow-up #321 또는 sync).

### 7.2 DISCREPANCY-2: Approve endpoint request body (Q2 decision: Phase D excludes final_answer UI)

- **SPEC-V3-INBOX-001 §4.5 주장**: body = `{final_answer, citations[], esig: {password, meaning}}`.
- **research.md §3.4 주장**: body = `{password, esigSignature}`.
- **실제 코드** (`app/api/inbox/[id]/approve/route.ts:19-22`, verified 2026-07-03):
  ```ts
  const approveTicketInputSchema = z.object({
    password: z.string().min(1, 'Password is required for re-authentication'),
    esigSignature: z.string().min(1, 'ESIG signature is required'),
  });
  ```
- **UI에 미치는 영향**: `ApproveDialog`(REQ-V3-UI-013)는 오직 `{password, esigSignature}`만 전송. `final_answer`는 별도 UI 메커니즘을 통해 티켓에 이미 설정되어 있어야 한다. `final_answer`가 누락된 경우 승인 호출은 400 "Cannot promote" 반환(REQ-V3-UI-015 처리).
- **Resolution (user-approved)**: Phase D는 final_answer 편집 UI를 추가하지 않는다. 승인은 `ticket.finalAnswer`가 truthy일 때만 활성화(REQ-V3-UI-012). final_answer 편집은 TRIAGE C-2 또는 Phase D.2로 연기.

### 7.3 CONSULT-CONTRACT-1: Session route parameter naming (code-authoritative, verified 2026-07-05)

- **User instruction original**: 라우트 파라미터는 `:id`로 명시됨.
- **실제 코드** (`app/api/consult/sessions/[sessionId]/route.ts`, verified 2026-07-05): 파라미터는 `sessionId` (NOT `id`). URL: `/api/consult/sessions/:sessionId`.
- **UI에 미치는 영향**: consult UI 컴포넌트는 `sessionId` 파라미터 이름을 사용해야 한다.
- **Resolution**: 코드 우선. 모든 consult UI는 `sessionId` 명명 사용.

### 7.4 CONSULT-CONTRACT-2: Turn request body (code-authoritative, verified 2026-07-05)

- **User instruction original**: body에 `{question, locale?}` 포함.
- **실제 코드** (`app/api/consult/sessions/[sessionId]/turns/route.ts:19-21`, verified 2026-07-05): body = `{question}` (1-5000 chars). `locale`는 세션에서 상속되며 body에 없다.
- **UI에 미치는 영향**: `QuestionComposer`는 오직 `question` 필드만 전송한다. `locale`은 세션 생성 시에만 설정.
- **Resolution**: 코드 우선. turn 생성은 `question`만 전송.

### 7.5 CONSULT-CONTRACT-3: Citations component reuse (code-authoritative, verified 2026-07-05)

- **User instruction**: 기존 `components/chat/*` (ChatShell, Composer, AnswerBlock, Citation, SourcesGrid, ConfidenceBadge, Timeline)는 `/api/ra/consult` 1-shot streaming 전용.
- **실제 코드** (`lib/db/schema.ts`, verified 2026-07-05): consultTurns 테이블의 `citations` 컬럼은 JSONB 배열로, 기존 Citation/SourcesGrid 컴포넌트와 호환된다.
- **UI에 미치는 영향**: consult UI에서 `Citation`, `SourcesGrid`, `ConfidenceBadge` 컴포넌트를 재사용할 수 있다.
- **Resolution**: 코드 구조 확인. 인용 렌더링 컴포넌트 재사용(REQ-V3-UI-061).

### 7.6 CONSULT-CONTRACT-4: Turn error handling (code-authoritative, verified 2026-07-05)

- **실제 코드** (`app/api/consult/sessions/[sessionId]/turns/route.ts:127-128`, verified 2026-07-05): RAG 실패 시 400 `{error, turn}` 반환. turn은 항상 persist됨(RA member가 피드백 확인 가능).
- **UI에 미치는 영향**: 400 응답 시 error를 표시하되 turn도 히스토리에 추가해야 한다(REQ-V3-UI-059).
- **Resolution**: 코드 우선. error 표시 + turn 히스토리 추가.

---

## 8. Open Questions Resolved (Plan Review Gate — DO NOT Re-litigate)

| # | Question | Resolution |
|---|----------|-----------|
| Q1 | VALID_TRANSITIONS matrix 충돌 | 코드(types.ts:33-40)를 authoritative로 인용. SPEC-V3-INBOX-001 §4.3는 후속 수정 필요. |
| Q2 | Phase D의 final_answer 편집 UI 포함 여부 | 미포함. 승인은 `finalAnswer`가 이미 truthy일 때만 활성화. final_answer 편집은 TRIAGE C-2 / Phase D.2로 연기. |
| Q3 | 활동 피드 데이터 소스 | run phase ANALYZE에서 audit-log 데이터 소스 검증. 읽기 엔드포인트가 없으면 최소 `GET /api/inbox/[id]/audit` 래퍼 추가(potential scope expansion 플래그). |
| Q4 | 뷰어 "내 질문" 서피스 | 기존 `app/(app)/chat`의 인라인 패널(새 라우트 아님). |
| Q5 | 담당자 필터 | Phase D.2로 연기(MVP = 필터 없음, `showArchived` 토글만). |

---

## 9. Dependencies

- **SPEC-V3-INBOX-001** (backend, DONE — PR #322): 본 UI SPEC이 소비하는 모든 API/타입/권한/상태 머신을 제공.
- **SPEC-V3-RESTRUCTURE-001** (v3 architecture): root-level `app/` 구조, route group `(app)/`, per-domain 컴포넌트 디렉토리 관례의 기반.

---

## 10. References

- **Plan**: `.moai/specs/SPEC-V3-UI-001/plan.md` (approved implementation plan, 5 modules, 28 REQs, traceability, risks, discrepancies, MX plan, milestones).
- **Research**: `.moai/specs/SPEC-V3-UI-001/research.md` (deep backend contract verification, 2026-07-03).
- **Backend SPEC**: `.moai/specs/SPEC-V3-INBOX-001/spec.md` v1.1.1 (PR #322, implemented).
- **Backend source of truth** (code-authoritative):
  - `lib/domains/inbox/types.ts:17` (TriageState), `:33-40` (VALID_TRANSITIONS).
  - `lib/domains/inbox/state-machine.ts:19-48` (canTransition, assertValidTransition).
  - `app/api/inbox/route.ts:20-55` (GET list).
  - `app/api/inbox/[id]/route.ts:11-43` (GET detail).
  - `app/api/inbox/[id]/triage/route.ts:23-131` (PATCH triage).
  - `app/api/inbox/[id]/approve/route.ts:19-22` (Zod body schema), `:25-144` (POST approve ESIG).
  - `app/api/ask/route.ts` (POST viewer question).
  - `lib/auth/permissions.ts:172-177` (inbox.view, inbox.manage, ask.create).
- **Convention evidence**:
  - `components/shell/Sidebar.tsx:24-29,33-75` (NAV_ITEMS + showX prop pattern).
  - `app/(app)/layout.tsx:21-60` (server-side role resolution + showX passing).
  - `lib/queries/useDashboardStats.ts`, `stores/project.ts`, `stores/ui.ts` (query + store conventions).
- **Charter**: `~/.claude/projects/-home-abyz-lab-work-workspace-github-holee9-ra-med-bot/memory/product-charter.md` (지양-2 가짜 신뢰 금지, 지양-4 AI 판단 금지).
- **Lessons**: L-007 (직검), L-008 (noUnusedVariables CI=error), L-009 (full test + staged scope), L-010 (migration 실DB), L-012 (next dev build 금지), L-013 (3중 맹점), L-015 (ci:* local direct check).
