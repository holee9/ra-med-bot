---
id: SPEC-V3-UI-001
version: 0.2.0
status: draft
created: 2026-07-03
updated: 2026-07-05
author: abyz-lab
priority: high
issue_number: 0
labels:
  - component/frontend
  - component/ui
  - domain/inbox
  - type/v3-new
---

# SPEC-V3-UI-001 — Acceptance Criteria

> 본 문서는 SPEC-V3-UI-001 spec.md의 모든 REQ-V3-UI-XXX에 대한 Given/When/Then 시나리오, 엣지 케이스, 품질 게이트, Definition of Done를 정의한다. 각 시나리오는 관련 REQ ID와 AC 번호로 추적 가능하다.

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-07-03 | abyz-lab | Initial acceptance criteria (10 GWT scenarios + edge cases + quality gates + DoD). Derived from spec.md REQ-V3-UI-001..045 and plan.md §12 test strategy. |
| 1.0.0 | 2026-07-03 | abyz-lab | Post-PASS polish per plan-audit review-1: added AC-UI-011 (SLA badge, REQ-004), AC-UI-012 (archived filter, REQ-005), AC-UI-013 (reason prompt, REQ-024); fixed REQ count 25→28 in DoD; added `labels` to frontmatter (D7); removed inaccurate `:118` cite (D3). No semantic scope change. |

---

## 1. Acceptance Criteria (Given/When/Then)

### AC-UI-001: Kanban 렌더링 및 역할 게이팅 (REQ-V3-UI-001, REQ-V3-UI-030, REQ-V3-UI-031)

**Given** `ra-lead` 역할의 사용자가 로그인되어 있다.
**When** 사용자가 `/inbox` 라우트로 이동한다.
**Then** 4개 작업 칼럼(`auto`, `needs-review`, `escalated`, `waiting`)이 렌더링된다.
**And** 종료 상태(`closed`, `rejected`)는 칼럼으로 렌더링되지 않는다.
**And** Sidebar에 "Inbox" 엔트리가 표시된다(`showInbox=true`).

**Given** `viewer` 역할의 사용자가 로그인되어 있다.
**When** 사용자가 브라우저에서 `/inbox`로 직접 이동한다.
**Then** 서버 사이드 가드가 사용자를 `/chat`으로 리다이렉트한다.
**And** Sidebar에 "Inbox" 엔트리가 표시되지 않는다(`showInbox=false`).

---

### AC-UI-002: 병렬 데이터 페칭 및 새로고침 (REQ-V3-UI-002, REQ-V3-UI-045)

**Given** `ra-member+` 사용자가 `/inbox`에 있다.
**When** 페이지가 마운트된다.
**Then** 4개의 `GET /api/inbox?state=<state>&limit=50` 요청이 병렬로 발생한다(auto, needs-review, escalated, waiting 각각).
**And** 각 칼럼은 로딩 중 skeleton loader를 표시한다.
**And** 응답 도착 후 해당 상태의 티켓이 렌더링된다.

**Given** 사용자가 `/inbox`에 있고 쿼리가 이미 로드된 상태다.
**When** 사용자가 브라우저 탭을 벗어났다가 다시 포커스한다.
**Then** `revalidateOnFocus: true`에 의해 4개 쿼리가 재검증된다.
**And** `staleTime: 60_000`(60초) 내의 데이터는 재요청하지 않는다.

**Given** Kanban 헤더에 "새로고침" 버튼이 있다.
**When** 사용자가 버튼을 클릭한다.
**Then** 모든 inbox 쿼리가 무효화되고 재페칭된다.

---

### AC-UI-003: TriageActionMenu VALID_TRANSITIONS 준수 (REQ-V3-UI-020)

**Given** `ra-lead` 사용자가 `auto` 상태의 티켓 카드를 보고 있다.
**When** 액션 메뉴를 연다.
**Then** 오직 "Needs Review" 전이 옵션만 표시된다(`VALID_TRANSITIONS['auto'] = ['needs-review']`, types.ts:33-40 기준).
**And** "Reject", "Escalate", "Close" 옵션은 표시되지 않는다.

**Given** `ra-lead` 사용자가 `waiting` 상태의 티켓 카드를 보고 있다.
**When** 액션 메뉴를 연다.
**Then** "Needs Review"와 "Closed" 옵션만 표시된다.
**And** "Reject" 옵션은 표시되지 않는다(`waiting` → `rejected` 직접 전이 불가, types.ts:37).

**Given** `ra-lead` 사용자가 `needs-review` 상태의 티켓 카드를 보고 있다.
**When** 액션 메뉴를 연다.
**Then** "Escalated", "Waiting", "Closed", "Rejected" 옵션이 모두 표시된다.

**Given** `ra-member`(ra-lead 아님) 사용자가 임의 칸반 카드를 보고 있다.
**When** 카드를 확인한다.
**Then** 액션 메뉴 트리거가 렌더링되지 않는다(읽기 전용).

---

### AC-UI-004: Optimistic 전이 + 409 롤백 (REQ-V3-UI-021, REQ-V3-UI-022)

**Given** `ra-lead` 사용자가 `needs-review` 칼럼의 티켓을 보고 있다.
**When** 사용자가 액션 메뉴에서 "Escalated"를 선택한다.
**Then** UI가 즉시 optimistic update로 카드를 `needs-review` 칼럼에서 `escalated` 칼럼으로 이동시킨다.
**And** `PATCH /api/inbox/[id]/triage`가 `{toState: 'escalated'}`로 호출된다.

**Given** 위 상황에서 두 RA Lead가 동시에 같은 티켓을 전이시켰다.
**When** 두 번째 요청이 409 Conflict를 반환한다.
**Then** optimistic update가 롤백되어 카드가 원래 칼럼으로 돌아간다.
**And** "상태 전이 실패 — 새로고침 후 다시 시도하세요" toast가 표시된다.

**Given** 200 응답이 반환된 경우.
**When** 전이가 성공한다.
**Then** 양쪽 칼럼 쿼리(old state, new state)가 무효화되어 서버 truth와 재동기화된다.

---

### AC-UI-005: IDOR 방어 — 404 처리 (REQ-V3-UI-023)

**Given** 사용자가 타 조직의 티켓 ID로 직접 `PATCH /api/inbox/[id]/triage`를 시도한다(IDOR 시도).
**When** 백엔드가 `assertTicketInOrg` 검사로 404를 반환한다.
**Then** UI가 로컬 캐시에서 해당 카드를 제거한다.
**And** 콘솔에 경고 로그가 출력된다.
**And** 사용자에게 원본 에러 JSON이 노출되지 않는다.

---

### AC-UI-006: ESIG 승인 — 2-step 다이얼로그 + 401 인라인 (REQ-V3-UI-012, REQ-V3-UI-013, REQ-V3-UI-014)

**Given** `ra-lead` 사용자가 `triageState: 'needs-review'`이고 `finalAnswer`가 설정된 티켓 상세 페이지에 있다.
**When** "Approve (ESIG)" 버튼을 클릭한다.
**Then** ApproveDialog가 열린다(Step 1: finalAnswer 존재 확인 메시지, Step 2: password + esigSignature 입력 필드).

**Given** 다이얼로그에서 잘못된 비밀번호를 입력했다.
**When** 제출 버튼을 클릭한다.
**Then** `POST /api/inbox/[id]/approve`가 `{password, esigSignature}` body로 호출된다.
**And** 401 응답 시 비밀번호 필드에 인라인 "비밀번호가 올바르지 않습니다" 에러가 표시된다(approve/route.ts:82).
**And** 사용자가 다른 페이지로 이동하지 않는다.
**And** 일반 toast가 표시되지 않는다(SHALL NOT).
**And** 제출 버튼이 "서명 중..." pending 중 비활성화된다.

---

### AC-UI-007: ESIG 승인 — 400 finalAnswer 누락 차단 (REQ-V3-UI-015)

**Given** `ra-lead` 사용자가 `finalAnswer`가 누락된 티켓(또는 외부 경로로 승인을 시도)을 본다.
**When** 승인 엔드포인트가 400 "Cannot promote"(missing `final_answer`)을 반환한다(approve/route.ts:134-136).
**Then** 차단 메시지가 표시된다: "먼저 최종 답변을 설정하세요."
**And** 자동 재시도가 발생하지 않는다(SHALL NOT).
**And** 사용자가 명시적으로 행동해야 한다(닫기 또는 finalAnswer 설정 — Phase D는 후자 UI 미제공, Q2 decision).

---

### AC-UI-008: ESIG 승인 성공 — 캐시 무효화 + 이동 (REQ-V3-UI-016)

**Given** 승인 다이얼로그에서 올바른 비밀번호 + esigSignature를 입력했다.
**When** 200 응답이 반환된다.
**Then** `/inbox` 관련 tanstack-query 캐시가 무효화된다.
**And** 사용자가 Kanban(`/inbox`)으로 이동한다.
**And** 성공 toast가 표시된다.
**And** 승인된 티켓은 활성 칼럼에서 사라지고 `archived` 필터에서 `closed`로 보인다.

---

### AC-UI-009: 뷰어 "내 질문" 인라인 패널 (REQ-V3-UI-033, REQ-V3-UI-034)

**Given** `viewer`/`employee` 역할의 사용자가 `/chat`에 있다.
**When** 질문을 입력하고 제출한다.
**Then** `POST /api/ask`가 호출된다.
**And** 성공 응답의 `ticket_id`와 `triage_state`가 "내 질문 상태" 인라인 패널에 표시된다.
**And** 패널은 별도 라우트가 아닌 기존 `/chat` 페이지 내에 렌더링된다(Q4 decision).

**Given** viewer가 자신이 소유한 티켓 상세 URL(`/inbox/[own-id]`)을 방문한다.
**When** 페이지가 로드된다.
**Then** "내 질문 상세" 최소 보기가 렌더링된다(자신의 question + 현재 triageState + 승인된 답변 있는 경우 approved_answer).
**And** RA 전용 필드(raAssignee, escalateTo, audit timeline 등)는 게이트되어 표시되지 않는다(REQ-V3-INBOX-010 own-ticket query layer).

**Given** viewer가 타인의 티켓 URL(`/inbox/[other-id]`)을 방문한다.
**When** 페이지가 로드된다.
**Then** 404가 반환된다(REQ-V3-INBOX-010 IDOR defense via access.ts).

---

### AC-UI-010: i18n + WCAG (REQ-V3-UI-040, REQ-V3-UI-041, REQ-V3-UI-042, REQ-V3-UI-043)

**Given** `messages/ko.json`과 `messages/en.json`에 `inbox` 네임스페이스가 추가되었다.
**When** 한국어 로케일 사용자가 `/inbox`를 본다.
**Then** 모든 가시 문자열이 next-intl을 통해 `inbox.*` 네임스페이스에서 렌더링된다.
**And** 원시 키(예: `inbox.columns.needsReview`)가 노출되지 않는다.

**Given** 영어 로케일 사용자가 동일 페이지를 본다.
**Then** 동일 키의 영어 번역이 렌더링된다.

**Given** WCAG axe 스캔(`@axe-core/playwright`)이 `/inbox`와 `/inbox/[id]` 및 ApproveDialog에서 실행된다.
**When** 스캔이 완료된다.
**Then** critical 위반이 0개다.
**And** 모든 액션 버튼이 키보드로 접근 가능하다(Tab 순서).
**And** 아이콘 전용 버튼에 ARIA 라벨이 있다.
**And** 텍스트 색상 대비가 4.5:1 이상이다.
**And** 모든 인터랙티브 요소에 focus 표시가 있다.

**Given** triage-state별 디자인 토큰이 적용되었다.
**When** 4개 칼럼을 본다.
**Then** auto=brand-300, needs-review=amber-500, escalated=orange-500, waiting=blue-500가 카드 테두리, 배지, 칼럼 헤더 액센트에 일관되게 적용된다.

**Given** 403 Forbidden이 inbox 엔드포인트에서 반환된다.
**When** UI가 이를 처리한다.
**Then** 인라인 "접근 권한이 없습니다" 빈 상태가 표시된다.
**And** 앱이 크래시되지 않는다(SHALL NOT).
**And** 원본 에러 JSON이 노출되지 않는다(SHALL NOT).

---

### AC-UI-011: SLA 배지 렌더링 (REQ-V3-UI-004)

**Given** `ra-member+` 사용자가 칸반 카드(또는 상세 페이지)를 본다.
**And** 티켓에 `slaDeadline` 필드가 설정되어 있다.
**When** 카드/상세가 렌더링된다.
**Then** SLA 배지가 상대 시간(예: "3시간 남음", "2일 남음")으로 표시된다.

**Given** 위 상황에서 `slaDeadline < now`(이미 지난 경우).
**When** 배지가 렌더링된다.
**Then** "overdue" 스타일(예: 빨간 배경, `inbox.sla.overdue` 라벨)이 적용된다.
**And** overdue 스타일이 미래 deadline과 시각적으로 구분된다.

**Given** 티켓에 `slaDeadline`이 없는 경우(`null`/`undefined`).
**When** 카드가 렌더링된다.
**Then** SLA 배지가 렌더링되지 않는다.

---

### AC-UI-012: 종료 상태 "archived" 필터 (REQ-V3-UI-005)

**Given** `ra-member+` 사용자가 `/inbox` 칸반 기본 보기에 있다.
**And** `showArchived` 토글이 `false`(기본값)이다.
**When** 4개 작업 칼럼(`auto`/`needs-review`/`escalated`/`waiting`)이 렌더링된다.
**Then** 종료 상태 티켓(`closed`, `rejected`)은 어떤 칼럼에도 나타나지 않는다.

**Given** 사용자가 `showArchived` 토글을 `true`로 전환한다.
**When** archived 보기가 렌더링된다.
**Then** 종료 상태 티켓(`closed`, `rejected`)이 별도의 "archived" 섹션/필터 결과에 표시된다.
**And** 종료 티켓은 4개 작업 칼럼에는 여전히 나타나지 않는다.

**Given** `showArchived` 토글이 다시 `false`로 전환된다.
**When** 칸반이 재렌더링된다.
**Then** 종료 상태 티켓이 다시 숨겨진다.

---

### AC-UI-013: reason 프롬프트 (REQ-V3-UI-024)

**Given** `ra-lead`/`admin` 사용자가 트리아주 액션 메뉴에서 `rejected` 또는 `escalated`를 전이 대상으로 선택한다.
**When** 전이가 확인되기 전.
**Then** 선택적 `reason` 입력 프롬프트(최대 500자)가 표시된다.

**Given** 사용자가 reason을 입력하지 않고 빈 칸으로 둔다.
**When** 확인 버튼을 클릭한다.
**Then** 전이가 진행된다(reason은 optional이므로 빈 값 허용).

**Given** 사용자가 500자를 초과하는 텍스트를 입력한다.
**When** 입력 필드가 검증된다.
**Then** 500자 초과 입력이 차단되거나 잘린다(maxLength 제약).
**And** `PATCH /api/inbox/[id]/triage` body에 `{toState, reason}` 형태로 전송된다(reason 값이 있는 경우).

**Given** 전이 대상이 `closed`(또는 `rejected`/`escalated`가 아닌 다른 상태)인 경우.
**When** 전이가 트리거된다.
**Then** reason 프롬프트가 표시되지 않는다(프롬프트는 `rejected`/`escalated` 대상에만 해당).

---

### AC-CONS-UI-001: Consult 세션 목록 렌더링 (REQ-V3-UI-050, REQ-V3-UI-051, REQ-V3-UI-062)

**Given** `ra-member` 역할의 사용자가 로그인되어 있다.
**When** 사용자가 `/consult` 라우트로 이동한다.
**Then** consult 세션 목록 페이지가 렌더링된다.
**And** 사용자가 생성한 세션들만 표시된다(ra-member는 자신의 세션만).
**And** "새 세션" 버튼이 표시된다.
**And** Sidebar에 "Consult" 엔트리가 표시된다(`showConsult=true`).

**Given** `ra-lead` 역할의 사용자가 로그인되어 있다.
**When** 사용자가 `/consult` 라우트로 이동한다.
**Then** consult 세션 목록 페이지가 렌더링된다.
**And** org 전체의 모든 세션이 표시된다.

**Given** consult 세션 목록 페이지에 있다.
**When** 페이지가 마운트된다.
**Then** `GET /api/consult/sessions?limit=50&offset=0`이 호출된다.
**And** 세션 카드 그리드가 표시된다(각 카드: title, createdAt, updatedAt).

**Given** consult 세션 목록이 50개 이상 있는 경우.
**When** 사용자가 페이지 하단의 "Load More" 버튼을 클릭한다.
**Then** `GET /api/consult/sessions?limit=50&offset=50`이 호출된다.
**And** 추가 세션들이 목록에 append된다.

---

### AC-CONS-UI-002: Consult 세션 생성 (REQ-V3-UI-052, REQ-V3-UI-053)

**Given** consult 세션 목록 페이지에 있다.
**When** 사용자가 "새 세션" 버튼을 클릭한다.
**Then** 세션 생성 다이얼로그가 표시된다.
**And** 다이얼로그에 title 입력 필드(1-200자), projectId 선택(선택적), locale 선택(선택적, 기본값 'ko')가 있다.

**Given** 세션 생성 다이얼로그가 열려 있다.
**When** 사용자가 title(예: "Regula Submission Guide")을 입력하고 "생성"을 클릭한다.
**Then** `POST /api/consult/sessions`가 `{title, projectId?, locale?}` 본문으로 호출된다.
**And** 201 응답 시 `/consult/[sessionId]` 상세 페이지로 네비게이션한다.

**Given** 세션 생성 다이얼로그가 열려 있다.
**When** 사용자가 201자 이상의 title을 입력하고 "생성"을 클릭한다.
**Then** 400 Invalid input 응답 처리 + 인라인 유효성 에러 표시.

---

### AC-CONS-UI-003: Consult 세션 상세 및 turns 히스토리 (REQ-V3-UI-054, REQ-V3-UI-060)

**Given** consult 세션 목록에 있다.
**When** 사용자가 세션 카드를 클릭한다.
**Then** `/consult/[sessionId]` 라우트로 네비게이션한다.
**And** `GET /api/consult/sessions/[sessionId]`가 호출된다.
**And** 세션 메타데이터(title, createdAt, locale)와 turns 배열이 표시된다.
**And** turns는 turnNumber 오름차순으로 렌더링된다.

**Given** consult 세션 상세 페이지에 있다.
**When** 페이지가 마운트된다.
**Then** turns 히스토리가 turnNumber 오름차순으로 렌더링된다.
**And** 각 turn은 question, answer, citations(재사용 컴포넌트), confidence, timestamp를 포함한다.

**Given** `ra-member` 역할의 사용자가 다른 ra-member의 세션 URL로 직접 이동한다.
**When** `GET /api/consult/sessions/[sessionId]`가 호출된다.
**Then** 404 Session not found 응답이 반환된다.
**And** "세션을 찾을 수 없습니다" 메시지가 표시되고 `/consult` 목록으로 리다이렉트된다(IDOR 방지).

---

### AC-CONS-UI-004: Consult turn 생성 및 히스토리 추가 (REQ-V3-UI-056, REQ-V3-UI-057, REQ-V3-UI-058)

**Given** consult 세션 상세 페이지에 있다.
**When** 사용자가 질문 입력 필드에 질문(1-5000자)을 입력하고 "전송"을 클릭한다.
**Then** `POST /api/consult/sessions/[sessionId]/turns`가 `{question}` 본문으로 호출된다.
**And** submit 버튼이 비활성화된다.
**And** 로딩 인디케이터("답변 생성 중...")가 표시된다.
**And** 히스토리에는 새 turn이 추가되지 않는다(아직 응답 없음).

**Given** turn 생성이 진행 중이다.
**When** 201 응답이 반환된다.
**Then** 새 turn이 히스토리에 추가된다.
**And** turn의 answer, citations(재사용 `Citation`/`SourcesGrid`), confidence가 렌더링된다.
**And** 로딩 인디케이터가 제거된다.
**And** 질문 입력 필드가 다시 활성화된다.

**Given** turn 생성이 진행 중이다.
**When** 400 응답이 `{error, turn}` 본문으로 반환된다(RAG 실패: citation 부족, 타임아웃, 런타임 에러).
**Then** error 메시지가 사용자에게 표시된다(예: "답변 생성 실패: citation 80% 미달").
**And** turn도 히스토리에 표시된다(RA member가 실패 피드백 확인 가능).
**And** 로딩 인디케이터가 제거된다.

---

### AC-CONS-UI-005: Citations 컴포넌트 재사용 (REQ-V3-UI-061)

**Given** consult 세션 상세 페이지에 있다.
**When** turn에 citations가 있는 경우.
**Then** 기존 `components/chat/Citation.tsx`, `SourcesGrid.tsx`, `ConfidenceBadge.tsx` 컴포넌트가 재사용된다.
**And** citations JSONB 배열이 파싱되어 렌더링된다.
**And** ConfidenceBadge가 confidence score(0.00~1.00)를 렌더링한다.

---

## 2. Edge Cases

| # | Edge Case | Expected Behavior | Related REQ |
|---|-----------|-------------------|-------------|
| E1 | **빈 보드**: 모든 칼럼에 티켓이 0개 | 각 칼럼에 빈 상태 일러스트레이션 + i18n `inbox.empty` 메시지 표시 | REQ-V3-UI-044 |
| E2 | **네트워크 에러**: 칼럼 쿼리 실패 | 칼럼별 에러 상태 + 재시도 버튼 표시; 다른 칼럼은 정상 동작 | REQ-V3-UI-003 |
| E3 | **동시 RA-lead 트리아주**: 두 Lead가 같은 티켓을 동시에 전이 | 두 번째 요청 409 → optimistic update 롤백 + toast 표시 | REQ-V3-UI-022 |
| E4 | **세션 만료(ESIG 중)**: 승인 다이얼로그 제출 중 세션 만료 | 401 응답 처리; 비밀번호 필드 인라인 에러; 재로그인 유도 | REQ-V3-UI-014 |
| E5 | **Stale cache(focus 반환)**: 오래된 캐시로 돌아온 사용자 | `staleTime: 60s` 초과 시 `revalidateOnFocus`가 재검증; 60s 내는 재요청 생략 | REQ-V3-UI-045 |
| E6 | **IDOR 시도**: 타 조직 티켓 ID로 직접 API 호출 | 404 반환 → 카드 캐시에서 제거 + 콘솔 경고 | REQ-V3-UI-023 |
| E7 | **승인 중 브라우저 종료**: 승인 제출 후 응답 전 종료 | 서버 트랜잭션은 원자적(approve/route.ts:94-98); 재접속 시 쿼리 재동기화로 최종 상태 반영 | REQ-V3-UI-016 |
| E8 | **final_answer 누락 승인 시도**: `finalAnswer`가 없는 티켓에서 승인 | 400 "Cannot promote" 차단 메시지; 자동 재시도 없음 | REQ-V3-UI-015 |
| E9 | **viewer 강제 이동**: viewer가 `/inbox`로 직접 이동 | 서버 사이드 리다이렉트 → `/chat` | REQ-V3-UI-030 |
| E10 | **대량 티켓(50+)**: 단일 칼럼에 50개 초과 티켓 | 페이지네이션(limit=50); 51번째부터는 표시 안 됨(Phase D는 페이지네이션 UI 미제공, 한계 명시) | REQ-V3-UI-002 |
| E11 | **활동 피드 데이터 소스 없음**: audit-log 읽기 엔드포인트가 없는 경우 | run phase ANALYZE에서 확인; 필요시 `GET /api/inbox/[id]/audit` 최소 래퍼 추가(Q3, potential scope expansion) | REQ-V3-UI-011 |
| E12 | **Consult 빈 세션 목록**: consult에 0개 세션 | 빈 상태 일러스트레이션 + i18n `consult.empty` 메시지 표시 | REQ-V3-UI-051 |
| E13 | **Consult 질문 5000자 초과**: turn 생성 시 질문이 너무 김 | 입력 차단(maxLength) 또는 400 유효성 에러 | REQ-V3-UI-055 |
| E14 | **Consult turn RAG 타임아웃**: turn 생성이 15초 초과 | 400 `{error: "timeout"}` 반환 + error 표시 + turn 히스토리 표시(REQ-V3-UI-059) | REQ-V3-UI-059 |
| E15 | **Consult cross-user 접근**: ra-member가 다른 ra-member의 세션 접근 | 404 → "세션을 찾을 수 없습니다" + `/consult` 리다이렉트(IDOR 방지, REQ-V3-UI-060) | REQ-V3-UI-060 |

---

## 3. Quality Gates

### 3.1 Lighthouse / Performance

| Gate | Threshold | Tool |
|------|-----------|------|
| Lighthouse Accessibility | ≥ 90 | `lhci` 또는 Playwright lighthouse plugin |
| Lighthouse Performance | ≥ 70 (Phase D baseline; 의료 소프트웨어는 a11y 우선) | 동일 |
| First Contentful Paint (Kanban) | < 2s | Playwright performance trace |

### 3.2 TypeScript / Lint (L-008, L-013, L-015)

| Gate | Threshold | Tool | Lesson |
|------|-----------|------|--------|
| TypeScript errors | 0 new errors | `pnpm ci:typecheck` | L-013: 정적 테스트만으로는 불충분; 실DB/`\d`/grep 병용 |
| Biome lint | CI threshold 통과 | `pnpm ci:lint`(lint:hex full) | L-008: 로컬 biome 1.9.4는 noUnusedVariables를 warning으로, CI는 error로 처리 → 로컬 직접 `ci:lint` 실행 |
| 모든 `pnpm ci:*` 단계 | 로컬 green | main 머지 전 전 단계 로컬 직검 | L-015: 일부 green=전체 green 아님 |

### 3.3 tanstack-query 캐시 정확성

| Gate | Verification |
|------|--------------|
| 승인 성공 시 `/inbox` 캐시 무효화 | `queryClient.invalidateQueries({ queryKey: ['inbox'] })` 호출 확인 |
| 트리아주 200 시 양쪽 칼럼 쿼리 무효화 | old state + new state 칼럼 모두 재페칭 확인 |
| 409 시 optimistic update 롤백 | snapshot 복원 확인 |
| 404 시 카드 캐시 제거 | `queryClient.setQueryData`로 카드 제거 확인 |

### 3.4 WCAG / axe

| Gate | Threshold | Scope |
|------|-----------|-------|
| axe critical violations | 0 | `/inbox`, `/inbox/[id]`, ApproveDialog |
| 키보드 탐색 | 모든 액션 접근 가능 | Tab/Shift+Tab/Enter/Escape |
| ARIA 라벨 | 아이콘 전용 버튼 100% | all icon-only buttons |
| 색상 대비 | ≥ 4.5:1 (text), ≥ 3:1 (UI components) | all visible text |

### 3.5 빌드 (L-012)

| Gate | Rule |
|------|------|
| `next dev` 중 `pnpm build` 금지 | `.next` chunk 충돌 → 페이지 500 (L-012) |
| 빌드 전 `next dev` 중지 | 항상 확인 후 빌드 |

---

## 4. Definition of Done

본 SPEC이 "Done"으로 간주되려면 다음 조건이 모두 충족되어야 한다:

### 4.1 기능 완성도

- [ ] 모든 **41개** REQ-V3-UI-XXX(001..005, 010..016, 020..024, 030..034, 040..045, 050..062)가 구현되었다.
- [ ] 모든 **18개** AC 시나리오(AC-UI-001..013, AC-CONS-UI-001..005)가 통과한다.
- [ ] 모든 **15개** 엣지 케이스(E1..E15)가 처리된다.

### 4.2 코드 품질

- [ ] TypeScript: 0 new errors(`pnpm ci:typecheck`).
- [ ] Biome lint: CI threshold 통과(`pnpm ci:lint` 로컬 직검, L-008/L-015).
- [ ] 단위/컴포넌트 테스트: 새 컴포넌트/훅 80%+ 커버리지.
- [ ] 통합 테스트: 역할 게이팅, IDOR, 409/404/401/400/403 핸들링.
- [ ] Playwright E2E: 승인 happy path, 뷰어 리다이렉트.
- [ ] WCAG axe 스캔: critical 위반 0개.

### 4.3 계약 준수

- [ ] `VALID_TRANSITIONS`를 `lib/domains/inbox/types.ts`에서 import하여 사용(§7.1 DISCREPANCY-1 해결).
- [ ] Approve body가 정확히 `{password, esigSignature}`(approve/route.ts:19-22, §7.2 DISCREPANCY-2 해결).
- [ ] Charter 지양-2(가짜 신뢰 금지): autoAnswer는 citations 있을 때만 표시.
- [ ] Charter 지양-4(AI 판단 금지): 모든 전이 사람 시작, 버튼 기반.
- [ ] 21 CFR Part 11 §11.10(e): audit 타임라인 append-only.
- [ ] 21 CFR Part 11 §11.50/§11.70: ESIG = 비밀번호 + 서명; 일괄 승인 제외.

### 4.4 i18n / 접근성

- [ ] `messages/ko.json` + `messages/en.json`에 `inbox` 네임스페이스 추가(REQ-V3-UI-040).
- [ ] 모든 가시 문자열이 next-intl 통과(원시 키 노출 없음).
- [ ] 디자인 토큰 4상태 + 2종료 일관 적용(REQ-V3-UI-041).
- [ ] Lighthouse a11y ≥ 90.

### 4.5 범위 준수

- [ ] 제외 항목 12개(§3 Exclusions)가 구현되지 않았음을 확인.
- [ ] 새 백엔드 API 추가 없음(예외: Q3 audit 래퍼 필요시에 한함, scope expansion 플래그).
- [ ] 새 권한 키 추가 없음.
- [ ] DnD, WebSocket, 폴링, 일괄 작업 미구현 확인.

### 4.6 MX 태그

- [ ] `@MX:ANCHOR`: `lib/queries/useInbox.ts` (fan_in ≥ 3 예상), `components/inbox/TriageActionMenu.tsx` (VALID_TRANSITIONS 비즈니스 불변식).
- [ ] `@MX:WARN`: `components/inbox/ApproveDialog.tsx` (21 CFR Part 11 규제 critical), `useTriageTransition` (optimistic update + 409 동시성).
- [ ] `@MX:NOTE`: 새 페이지 라우트, 새 Zustand 스토어.

### 4.7 산출물

- [ ] 코드가 `main` 브랜치에 병합되었다.
- [ ] PR 설명에 모든 REQ-V3-UI-XXX가 추적 가능하다.
- [ ] session-memo.md / project-state.md가 업데이트되었다(L-007, feedback-session-continuity).
