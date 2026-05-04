---
id: SPEC-REGULA-COEDIT-001
version: 0.1.0
status: draft
phase: wave4
priority: Medium
created: 2026-05-04
updated: 2026-05-04
author: manager-spec (Regula harness)
issue_number: null
depends_on:
  - SPEC-REGULA-FOUNDATION-001
  - SPEC-REGULA-ENTERPRISE-001
  - SPEC-REGULA-WORKFLOWS-001
  - SPEC-REGULA-CLOUDFLARE-001
lifecycle_level: spec-anchored
---

# SPEC-REGULA-COEDIT-001 — Real-time Multi-user Document Co-editing (Yjs + Durable Objects)

## HISTORY

| Version | Date       | Author                       | Changes                                                                                          |
| ------- | ---------- | ---------------------------- | ------------------------------------------------------------------------------------------------ |
| 0.1.0   | 2026-05-04 | manager-spec (Regula harness) | 초기 draft 생성. Wave 4 실시간 다중 사용자 문서 공동 편집 (Yjs CRDT + Cloudflare Durable Objects) 기반. 20개 REQ 정의 (Group A: Yjs schema 5개, Group B: Durable Objects WebSocket 5개, Group C: Presence + Comment 5개, Group D: Audit + Export 5개). |

---

## §1 목적 (Purpose)

Regula의 RA(Regulatory Affairs) 워크플로우에서 다수의 작성자·검토자가 동일한 규제 문서(예: CER — Clinical Evaluation Report, 인허가 제출 초안, MDR/IVDR 기술 파일, 시판 후 감시 보고서)를 **동시에 실시간으로 편집·검토**해야 하는 운영 시나리오를 지원한다.

전형적 사용 사례:

- **CER 동시 작성**: RA 담당자 1명 + 외부 임상평가 컨설턴트 2명이 동일 CER 초안의 다른 섹션을 동시에 작성. 변경사항이 실시간으로 다른 편집자에게 보이고, 인라인 코멘트로 의견을 교환한다.
- **제출 문서 합동 검토**: 인허가 제출 마감 직전, RA 1명이 본문을 수정하는 동안 임원(exec)과 개발(dev) 부서가 읽기 전용으로 실시간 미리보기를 보며 화상 회의에서 코멘트를 단다.
- **외부 컨설턴트 협업**: 외부 임상 통계 전문가(external 부서)가 데이터 섹션을 검토 모드로 열어 코멘트만 남기고, RA가 그 코멘트를 실시간으로 받아 본문을 수정한다.

기존 SPEC(`SPEC-REGULA-WORKFLOWS-001`)에서는 단일 작성자가 워크플로우 산출물을 작성하면 다른 사용자는 새로고침을 통해서만 최신 상태를 볼 수 있었다. 본 SPEC은 이를 실시간 협업으로 확장하되, 21 CFR Part 11(전자 기록·전자 서명) 추적성 요건과 부서별 권한(`SPEC-REGULA-TENANT-001`의 부서 ACL)을 모두 만족하도록 설계한다.

기술적으로는 **Yjs CRDT(Conflict-free Replicated Data Type)**를 데이터 모델로 사용하여 동시 편집 충돌을 자동 해소하고, **Cloudflare Durable Objects**를 WebSocket 게이트웨이 + 단일 진실원(SSoT — Single Source of Truth)으로 활용하여 한 문서당 하나의 DO 인스턴스가 모든 편집자의 동기화를 조율한다.

---

## §2 목표 및 비목표 (Goals and Non-Goals)

### 2.1 목표 (Goals)

- **G1**: Yjs CRDT를 데이터 모델로 채택하여 동시 편집 충돌(concurrent edit conflict)을 알고리즘 수준에서 자동 해소한다. 수동 충돌 해결 UI는 만들지 않는다.
- **G2**: Cloudflare Durable Objects를 워크플로우 단위(workflow_run.id 기준)로 1개씩 인스턴스화하여 WebSocket 게이트웨이 역할을 수행한다. 초기 릴리즈에서는 문서당 동시 5명까지 안정적으로 지원한다.
- **G3**: Yjs awareness 프로토콜을 통해 다른 편집자의 커서 위치, 선택 영역, 사용자 이름을 실시간으로 표시한다(presence). 부서별 색상 구분(ra=파랑, dev=초록, exec=보라, external=주황)을 적용한다.
- **G4**: 인라인 코멘트 시스템을 제공한다. 텍스트 범위에 앵커(anchor)된 코멘트를 추가·해결(resolve)할 수 있으며 모든 편집자에게 실시간 동기화된다.
- **G5**: `SPEC-REGULA-TENANT-001`의 부서 ACL을 협업 편집기 안에서도 강제한다. `ra` 부서는 읽기/쓰기, `dev`/`exec`/`external`은 읽기 전용이다.
- **G6**: 21 CFR Part 11 추적성을 위해 세션 시작/종료, 편집 요약(30초 디바운스), 코멘트 추가/해결을 audit_logs에 기록한다. 키 입력당 audit는 절대 기록하지 않는다(로그 폭주 방지).
- **G7**: Yjs CRDT 상태를 Markdown 스냅샷으로 변환하여 `workflow_runs.last_snapshot_md`에 저장한다. 이 스냅샷은 비협업 뷰(읽기 전용 사용자, PDF/DOCX export, RAG 인덱싱)에서 사용된다.

### 2.2 비목표 (Non-Goals)

- **NG1**: 6명 이상 동시 편집은 본 SPEC의 범위가 아니다. 5명 초과 연결은 명시적으로 거부(WS close code 4008)된다. 향후 확장은 별도 SPEC이 다룬다.
- **NG2**: 음성/영상 협업(VoIP, video chat)은 포함하지 않는다. 사용자는 외부 화상 회의 도구(Teams, Zoom 등)를 병행 사용한다고 가정한다.
- **NG3**: 오프라인 편집 후 장시간(시간 단위) 후 재동기화는 보장하지 않는다. CRDT 특성상 데이터 손실은 없으나, 본 SPEC의 "오프라인" 처리는 일시적인 네트워크 단절(분 단위) 회복만을 다룬다.
- **NG4**: 세부 권한 모델(섹션별 잠금, 사용자별 권한 오버라이드)은 본 SPEC의 범위가 아니다. 부서 단위 ACL만을 사용한다.
- **NG5**: 변경 이력 시각화(diff view, version timeline)는 포함하지 않는다. 추적성은 audit_logs 기록과 last_snapshot_md 백업으로 만족한다.

### 2.3 Wave 4 의존성 명시 (Wave 4 Dependency Notice)

본 SPEC은 **Wave 4(2차 릴리즈 후반)**에 구현된다. 다음 선결 조건이 충족되어야 한다:

- **D1**: `SPEC-REGULA-CLOUDFLARE-001`(Cloudflare Hybrid 인프라)의 Durable Objects 바인딩이 프로덕션 환경에 배포되어 있어야 한다. `wrangler.toml`에 DO namespace가 등록되고 마이그레이션이 완료된 상태여야 한다.
- **D2**: `SPEC-REGULA-FOUNDATION-001`의 Auth.js v5 세션 시스템이 운영 중이어야 한다(WebSocket 인증에 사용).
- **D3**: `SPEC-REGULA-ENTERPRISE-001`의 audit_logs 테이블 및 부서 ACL 인프라가 운영 중이어야 한다.
- **D4**: `SPEC-REGULA-WORKFLOWS-001`의 `workflow_runs` 테이블이 운영 중이어야 한다(yjs_state, last_snapshot_md 컬럼 추가 마이그레이션 필요).

위 의존성이 갖춰지지 않은 상태에서 본 SPEC을 RUN 단계로 진입시키면 안 된다. PLAN 단계에서 의존성 검증을 명시적으로 실시한다.

---

## §3 기능 요구사항 (Functional Requirements)

### Group A — Yjs Document Schema (REQ-COE-001 ~ REQ-COE-005)

#### REQ-COE-001: Yjs document model

The system SHALL use Yjs CRDT library for the collaborative document model. Each `workflow_run` document SHALL be represented as a `Y.Doc` containing: (a) `Y.Text body` for the main document content, (b) `Y.Array comments` for inline comments, (c) `Y.Map metadata` for document-level properties (title, device, status, last_modified_by).

- **근거**: Yjs는 JSON-CRDT 진영에서 가장 성숙한 라이브러리(GitHub 13k+ stars, Hocuspocus·TipTap·BlockNote 등 주요 협업 에디터의 표준)로, 텍스트·배열·맵 자료구조를 모두 CRDT로 제공한다. Y.Text는 ProseMirror·TipTap과 즉시 통합 가능하므로 추가 추상화 비용이 없다.
- **검증 방법**: `lib/coedit/yjs-schema.ts` 단위 테스트에서 신규 Y.Doc 생성 시 body/comments/metadata 3개 필드가 모두 초기화되는지 확인한다. Vitest로 `expect(doc.share.size).toBe(3)` 등 스키마 무결성을 검증한다.

#### REQ-COE-002: Document schema versioning

The Yjs document schema SHALL include a `schemaVersion` field in `Y.Map metadata`. When the schema changes, the system SHALL provide a migration function to upgrade existing documents to the new schema.

- **근거**: 협업 편집 문서는 장기간 보존(규제 문서는 최소 5년)되므로 스키마 변경에 대비해야 한다. schemaVersion 없이 진화하면 호환성 깨짐 시 복구 불가능하다.
- **검증 방법**: `lib/coedit/migrate.ts`에 v1→v2 마이그레이션 함수를 작성하고, v1 형식 문서를 입력하면 v2로 변환되는지 단위 테스트로 검증한다. 누락 필드 보완·이름 변경 등 일반 시나리오를 커버한다.

#### REQ-COE-003: Conflict resolution

Yjs CRDT SHALL handle all concurrent edit conflicts automatically. The system SHALL NOT implement any manual conflict resolution UI — all conflicts are resolved by CRDT algorithm.

- **근거**: CRDT의 핵심 가치는 수동 충돌 해결 UI를 제거하는 것이다. 수동 UI를 추가하면 사용자에게 인지 부하를 주고, CRDT의 수학적 보장(eventual consistency)을 무너뜨린다.
- **검증 방법**: 통합 테스트에서 동일 위치(같은 문자 인덱스)에 두 사용자가 동시에 다른 문자를 삽입하고, 두 클라이언트가 결과적으로 동일한 최종 상태로 수렴하는지 확인한다. 에디터 UI에 "충돌 해결" 모달이 노출되지 않음을 확인한다.

#### REQ-COE-004: Persistent storage

The system SHALL persist the Yjs document state to Neon Postgres `workflow_runs.yjs_state` column (type: `bytea`) after each significant edit event (debounced 5 seconds). The column SHALL store the Yjs binary encoded update.

- **근거**: Durable Object의 메모리 상태는 영구적이지 않으므로(DO 재시작·마이그레이션 시 소실 가능) Postgres에 정기 스냅샷이 필요하다. `Y.encodeStateAsUpdate(doc)`이 반환하는 바이너리는 그대로 bytea에 저장 가능하며 이후 `Y.applyUpdate(doc, bytes)`로 복원된다. 5초 디바운스는 쓰기 빈도와 데이터 손실 위험의 균형점이다.
- **검증 방법**: Drizzle 마이그레이션에 `yjs_state bytea` 컬럼 추가를 확인한다. 통합 테스트에서 DO에 1번 편집 후 5초 대기 → Postgres yjs_state가 비어 있지 않은지 확인한다. 6초 이내 추가 편집 시 디바운스 timer 재설정을 단위 테스트로 검증한다.

#### REQ-COE-005: Document recovery

WHEN a Durable Object instance is reset or a new session starts, the system SHALL hydrate the Yjs document from `workflow_runs.yjs_state` in Postgres. Cold-start hydration SHALL complete within 2 seconds.

- **근거**: Cloudflare Durable Object는 비활성 후 일정 시간이 지나면 hibernate되며, 다음 요청 시 메모리가 비어 있다. 이때 Postgres에서 즉시 복원해야 사용자 경험에 끊김이 없다. 2초는 사용자가 페이지 로딩으로 인지할 수 있는 임계값이다.
- **검증 방법**: `workers/coedit-room-do.ts`의 fetch handler 시작점에 hydration 로직을 두고, 통합 테스트에서 DO 재시작 시뮬레이션 후 첫 WebSocket 연결의 초기 상태가 마지막 저장 상태와 일치하는지 확인한다. 콜드 스타트 시간을 Cloudflare workers-types `performance.now()`로 측정한다.

### Group B — Cloudflare Durable Objects WebSocket Gateway (REQ-COE-006 ~ REQ-COE-010)

#### REQ-COE-006: Durable Object per document

The system SHALL create one Cloudflare Durable Object instance per `workflow_run.id`. The DO SHALL serve as the WebSocket coordinator for all concurrent editors of that document.

- **근거**: Durable Object의 강한 일관성(strong consistency) 모델은 "한 객체 = 한 진실원" 전제에 기반한다. 문서당 1개 DO로 모든 편집자의 변경을 단일 노드에서 직렬화하면 race condition이 원천 차단된다.
- **검증 방법**: `wrangler.toml`에 `[[durable_objects.bindings]] name = "COEDIT_ROOM" class_name = "CoeditRoomDO"` 등록을 확인한다. `env.COEDIT_ROOM.idFromName(workflow_run_id)`로 동일 ID에 동일 DO 인스턴스가 매핑되는지 통합 테스트로 검증한다.

#### REQ-COE-007: WebSocket connection

WHEN a user opens a collaborative document, the client SHALL establish a WebSocket connection to the DO via `wss://<worker-hostname>/coedit/{workflow_run_id}`. The connection SHALL include the Auth.js session token for authentication.

- **근거**: WebSocket은 양방향 저지연 통신을 위한 표준이며 Cloudflare Workers의 `WebSocketPair` API와 자연스럽게 통합된다. 토큰을 URL이 아닌 Cookie 헤더 또는 Sec-WebSocket-Protocol로 전달해야 보안 로그 노출이 방지된다.
- **검증 방법**: `components/coedit/CollaborativeEditor.tsx`에서 `new WebSocket(...)` 호출 시 credentials: 'include' 설정 확인. 통합 테스트에서 wrangler dev 환경 → DO 핸들러가 `request.headers.get('cookie')`로 세션 토큰 수신을 확인한다.

#### REQ-COE-008: Session authentication

The Durable Object SHALL validate the Auth.js session token on WebSocket handshake. Invalid or expired sessions SHALL be rejected with WS close code 4001.

- **근거**: 4xxx 코드는 IANA 등록된 애플리케이션 정의 영역이다. 4001을 "인증 실패"로 일관되게 사용하면 클라이언트 측 재로그인 유도 로직이 단순해진다.
- **검증 방법**: `workers/coedit-room-do.ts`의 fetch handler에서 세션 토큰 누락·만료·서명 불일치 케이스를 단위 테스트로 검증한다. 클라이언트가 4001 수신 시 자동으로 `/api/auth/signin`으로 리다이렉트하는 동작을 확인한다.

#### REQ-COE-009: Concurrent editor limit

The system SHALL support maximum 5 concurrent editors per document in the initial implementation. Connections beyond 5 SHALL receive WS close code 4008 (capacity exceeded) with a user-friendly error message.

- **근거**: Cloudflare DO는 단일 인스턴스 메모리 제한(128MB)이 있고, Yjs 문서 1MB × 5세션 = 약 5MB이며 awareness 채널·메시지 버퍼 포함 시 안전 마진이 필요하다. 6명 이상 동시 편집은 실제 RA 운영에서도 드문 시나리오(보통 2~3명)이므로 5명 한도는 충분하다. 향후 확장은 별도 SPEC이 처리한다.
- **검증 방법**: DO 내부 `connections: Set<WebSocket>` 카운트가 5를 초과하면 즉시 close(4008, message) 호출 단위 테스트. 클라이언트 UI에서 "최대 5명까지만 동시 편집 가능합니다" 토스트가 노출되는지 확인한다.

#### REQ-COE-010: Awareness protocol

The system SHALL implement Yjs awareness protocol for presence information: each connected user SHALL broadcast their cursor position, selection range, and username. The client SHALL render other users' cursors with their username label in distinct colors.

- **근거**: Yjs awareness 프로토콜(`y-protocols/awareness`)은 임시 상태(presence)를 영구 문서 상태와 분리하여 broadcast하는 표준 메커니즘이다. ProseMirror/TipTap 통합 라이브러리(`y-prosemirror`)가 커서 렌더링까지 자동 처리한다.
- **검증 방법**: 두 브라우저 탭에서 동일 문서 접속 → 한쪽에서 텍스트 클릭 시 반대쪽에 컬러 커서와 사용자 이름 라벨이 표시되는지 E2E 테스트(Playwright). awareness 메시지 형식이 Yjs 표준을 따르는지 단위 테스트로 검증한다.

### Group C — Presence and Comments (REQ-COE-011 ~ REQ-COE-015)

#### REQ-COE-011: User presence indicator

The collaborative editor UI SHALL display an avatar stack showing all currently connected editors. Each avatar SHALL show the user's initials and department color (ra=blue, dev=green, exec=purple, external=orange).

- **근거**: 부서별 색상 구분은 RA 워크플로우 특성상 빈번한 임원·외부 컨설턴트 협업 상황에서 누가 누구인지 즉각 인지할 수 있도록 한다. 색상은 `SPEC-REGULA-FOUNDATION-001`의 디자인 토큰과 일관성을 유지한다.
- **검증 방법**: `components/coedit/PresenceStack.tsx`의 단위 테스트에서 props로 다양한 부서 조합 입력 → 정확한 색상 클래스가 적용되는지 검증. Storybook 스토리로 시각 검증을 추가한다.

#### REQ-COE-012: Inline comments

The system SHALL support inline comments anchored to text ranges using `Y.Array comments`. Each comment SHALL have: (a) anchor range (start/end char index), (b) author (user_id + name), (c) text content, (d) timestamp, (e) resolved/open status.

- **근거**: 인라인 코멘트는 RA 검토 워크플로우의 핵심 기능이다. anchor range는 ProseMirror의 mark 시스템과 연동되어 문서가 변경되어도 코멘트 위치가 자연스럽게 따라간다(Yjs relative position 활용).
- **검증 방법**: `lib/coedit/yjs-schema.ts`의 Comment 타입 정의 검증. 본문에 코멘트 추가 후 다른 사용자의 본문 수정 시 코멘트 anchor가 적절히 이동하는지 통합 테스트(Yjs `Y.createRelativePositionFromTypeIndex` 사용).

#### REQ-COE-013: Comment resolution

WHEN a user marks a comment as resolved, the system SHALL update the comment's `resolved` field in the Yjs document and broadcast the change to all connected editors.

- **근거**: 코멘트 해결 상태는 모든 편집자가 즉시 보아야 하는 상태이므로 Yjs 문서 일부로 관리한다(awareness가 아닌 영구 상태). 해결된 코멘트는 UI에서 흐리게 또는 접힌 형태로 표시한다.
- **검증 방법**: Vitest로 `comments[i].resolved = true` 변경 후 `Y.encodeStateAsUpdate` 결과가 다른 클라이언트에 적용되어 `comments[i].resolved`가 동기화되는지 검증. UI에서 "해결" 버튼 클릭 시 즉시 다른 탭의 표시가 변경되는지 E2E 검증.

#### REQ-COE-014: Department-based write access

The system SHALL enforce department ACL (from SPEC-REGULA-TENANT-001 REQ-TEN-003) within the collaborative editor: `ra` department users have full read/write access; `dev`, `exec`, `external` have read-only access. Read-only users SHALL see the document but their edits SHALL be rejected (WebSocket error message: "Your role is view-only for this document").

- **근거**: 협업 편집기 안에서도 부서 ACL을 깨면 규제 컴플라이언스(누가 무엇을 수정했는가의 추적성)가 무너진다. 클라이언트 측에서는 에디터를 readonly 모드로 표시하되, 서버(DO) 측에서도 모든 mutation 메시지를 검증하여 이중 방어한다(defense in depth).
- **검증 방법**: 통합 테스트에서 dev 부서 사용자로 WebSocket 접속 → mutation 메시지 송신 시 DO가 거부 응답 송신 + audit_logs에 거부 사유 기록 확인. 클라이언트 UI에서 키보드 입력이 차단되고 "읽기 전용입니다" 안내가 표시되는지 확인한다.

#### REQ-COE-015: Offline indicator

WHEN a user loses WebSocket connection, the UI SHALL display an "offline" indicator. On reconnection, the client SHALL automatically sync the local Yjs state with the DO using Yjs update protocol (no data loss due to CRDT properties).

- **근거**: 일시적 네트워크 단절(분 단위)은 일상적이며, CRDT는 이런 시나리오에서 데이터 손실 없는 재동기화를 보장한다. 사용자에게 명시적 indicator를 보여주면 신뢰감과 작업 안정성이 향상된다.
- **검증 방법**: Playwright에서 `page.context().setOffline(true)` → "오프라인" 배지 표시 확인 → `setOffline(false)` → 자동 재연결 + 오프라인 중 작성한 텍스트가 다른 편집자에게도 동기화 확인.

### Group D — Audit and Export (REQ-COE-016 ~ REQ-COE-020)

#### REQ-COE-016: Session open audit

The system SHALL record `audit_action = 'coedit_session_open'` when a user joins a collaborative editing session, with `workflow_run_id`, user's department, and session start time.

- **근거**: 21 CFR Part 11 §11.10(e)는 시스템 접근 기록을 요구한다. 협업 세션 진입은 문서에 대한 일종의 접근이므로 audit 대상이다.
- **검증 방법**: 통합 테스트에서 신규 WebSocket 연결 직후 audit_logs에 해당 row가 INSERT되는지 검증. row의 metadata JSON에 workflow_run_id, department, session_id가 포함되는지 검증.

#### REQ-COE-017: Edit audit (debounced)

The system SHALL record `audit_action = 'coedit_edit'` every 30 seconds of active editing (NOT per-keystroke). Each record SHALL include approximate character count changed and the user's department. Rationale: prevents audit_logs pollution while maintaining 21 CFR Part 11 traceability.

- **근거**: 키 입력당 audit는 분당 수백 row를 생성하여 audit_logs를 무력화시킨다(중요 이벤트가 노이즈에 묻힘). 30초 디바운스는 "한 사용자가 어느 시간대에 활동했는가"를 충분히 추적하면서 로그 양은 분당 최대 2개로 제한한다.
- **검증 방법**: DO 내부에서 사용자별 lastEditAuditAt 타임스탬프를 관리하여 30초 이내 추가 편집은 카운터만 증가시키고 INSERT는 생략하는 로직 단위 테스트. 30초 경과 시 누적 카운터가 audit row의 char_count로 기록되는지 검증.

#### REQ-COE-018: Comment audit

The system SHALL record `audit_action = 'coedit_comment_added'` and `audit_action = 'coedit_comment_resolved'` for each comment event, with comment text excerpt (first 100 chars) and author.

- **근거**: 코멘트는 심사·검토 의사결정의 일부이므로 추적이 필요하다. 100자 발췌(text excerpt)는 audit_logs 크기를 제어하면서 의미 있는 컨텍스트를 보존한다. 전체 본문은 last_snapshot_md로 별도 보존된다.
- **검증 방법**: 코멘트 추가 시 audit row의 `metadata->>'comment_excerpt'`가 정확히 100자 이하임을 검증. 해결 이벤트도 별개 row로 INSERT되는지 검증.

#### REQ-COE-019: Session close audit

The system SHALL record `audit_action = 'coedit_session_close'` when a user leaves the collaborative session, with session duration and total character count contributed.

- **근거**: 세션 시작과 짝을 이루어 사용자별 작업 시간·기여도를 추적한다. 누가 얼마나 작업했는지가 RA 책임 추적에 활용된다.
- **검증 방법**: WebSocket close 이벤트에서 audit row INSERT + duration_seconds, char_count_contributed 필드 정확성 단위 테스트. 비정상 종료(client crash) 시에도 DO가 hibernation 직전 finalization 로직에서 처리하는지 검증.

#### REQ-COE-020: Snapshot export

The system SHALL provide an export function `lib/coedit/export-snapshot.ts` that converts the Yjs document state to Markdown text and saves it to `workflow_runs.last_snapshot_md`. This snapshot is used for: (a) non-collaborative viewing (read-only users, export), (b) RAG indexing by DOCINGEST, (c) PDF/DOCX export via existing workflow export infrastructure.

- **근거**: Yjs 바이너리 상태는 협업 편집기에서만 의미 있다. 다른 시스템(검색, RAG, PDF 변환)은 Markdown 같은 표준 포맷이 필요하다. last_snapshot_md를 5초 디바운스로 함께 갱신하면 모든 다운스트림 시스템이 일관된 데이터를 본다.
- **검증 방법**: Y.Doc → Markdown 변환 함수의 단위 테스트(헤더, 리스트, 강조 등 ProseMirror 노드 타입별). 5초 디바운스 트리거 시 yjs_state와 last_snapshot_md가 동시에 갱신되는지 통합 테스트.

---

## §4 인수 기준 (Acceptance Criteria)

본 SPEC의 RUN 단계 완료를 위해 아래 기준이 모두 충족되어야 한다:

1. **AC-1**: `lib/coedit/yjs-schema.ts`가 작성되어 Y.Doc 생성·검증·마이그레이션 함수를 제공한다. Vitest 단위 테스트 100% 통과.
2. **AC-2**: Drizzle 마이그레이션이 적용되어 `workflow_runs` 테이블에 `yjs_state bytea`, `last_snapshot_md text`, `last_snapshot_at timestamptz` 컬럼이 추가되어 있다.
3. **AC-3**: `workers/coedit-room-do.ts` Durable Object 클래스가 구현되어 WebSocket 핸드셰이크 → 인증(REQ-COE-008) → awareness broadcast → mutation 직렬화 → Postgres 디바운스 저장(REQ-COE-004)의 전체 흐름을 수행한다.
4. **AC-4**: `wrangler.toml`에 `COEDIT_ROOM` Durable Object 바인딩과 마이그레이션이 등록되어 `wrangler deploy` 시 정상 배포된다.
5. **AC-5**: `components/coedit/CollaborativeEditor.tsx` React 컴포넌트가 ProseMirror 또는 TipTap 기반으로 구현되어 `y-prosemirror` 어댑터로 Y.Doc과 양방향 바인딩된다.
6. **AC-6**: 부서 ACL(REQ-COE-014)이 클라이언트 UI(readonly mode)와 서버 DO(mutation 검증) 양쪽에서 강제된다. dev/exec/external 부서 사용자의 mutation 메시지는 100% 거부된다.
7. **AC-7**: Playwright E2E 테스트로 5명 동시 편집 시나리오가 통과한다(다른 5명의 awareness 표시, 동시 입력 결과 수렴, 6번째 사용자 거부 4008).
8. **AC-8**: `lib/coedit/audit-events.ts`가 작성되어 REQ-COE-016~019의 4개 audit 이벤트를 audit_logs에 기록한다. 30초 디바운스(REQ-COE-017) 동작이 단위 테스트로 검증된다.
9. **AC-9**: `lib/coedit/export-snapshot.ts`가 작성되어 Y.Doc → Markdown 변환을 수행하고, 5초 디바운스 시점에 yjs_state와 last_snapshot_md가 동시 갱신된다.
10. **AC-10**: `app/(app)/workflows/[runId]/coedit/page.tsx` 라우트가 추가되어 협업 편집기 페이지가 접근 가능하며, ra 부서 사용자는 편집·dev/exec/external 사용자는 읽기 전용 모드로 진입한다.
11. **AC-11**: 일시적 네트워크 단절(REQ-COE-015) 시 UI에 오프라인 배지가 표시되고 재연결 시 데이터 손실 없이 동기화된다.
12. **AC-12**: 콜드 스타트 hydration(REQ-COE-005)이 2초 이내에 완료됨이 통합 테스트(`performance.now()` 측정)로 입증된다.

---

## §5 구현 노트 (Implementation Notes)

### 주요 파일 (Key Files)

| 파일 경로                                          | 역할                                                                | 신규/수정 |
| -------------------------------------------------- | ------------------------------------------------------------------- | --------- |
| `lib/coedit/yjs-schema.ts`                         | Y.Doc 스키마 정의, 생성·검증·마이그레이션 함수                      | 신규      |
| `lib/coedit/audit-events.ts`                       | session_open/edit/comment/session_close audit 이벤트 기록            | 신규      |
| `lib/coedit/export-snapshot.ts`                    | Y.Doc → Markdown 변환 + last_snapshot_md 저장                       | 신규      |
| `workers/coedit-room-do.ts`                        | Cloudflare Durable Object 클래스(WebSocket 게이트웨이, 5명 제한)    | 신규      |
| `components/coedit/CollaborativeEditor.tsx`        | TipTap/ProseMirror + y-prosemirror 기반 React 협업 에디터          | 신규      |
| `components/coedit/PresenceStack.tsx`              | 접속한 사용자 아바타 스택(부서별 색상)                              | 신규      |
| `components/coedit/CommentThread.tsx`              | 인라인 코멘트 표시·작성·해결 UI                                      | 신규      |
| `app/(app)/workflows/[runId]/coedit/page.tsx`      | 협업 편집기 페이지 라우트                                            | 신규      |
| `lib/db/migrations/NNNN_add_coedit_columns.sql`    | workflow_runs에 yjs_state, last_snapshot_md, last_snapshot_at 추가  | 신규      |
| `wrangler.toml`                                    | COEDIT_ROOM Durable Object 바인딩 + migrations 추가                  | 수정      |
| `lib/auth/ws-session.ts`                           | WebSocket 핸드셰이크 시 Auth.js 세션 검증 헬퍼                      | 신규      |

### wrangler.toml 변경사항 예시 (예시 — RUN 단계에서 확정)

```toml
[[durable_objects.bindings]]
name = "COEDIT_ROOM"
class_name = "CoeditRoomDO"
script_name = "regula-coedit-worker"

[[migrations]]
tag = "v1-coedit"
new_classes = ["CoeditRoomDO"]
```

### 의존 라이브러리 (예상)

- `yjs` (CRDT 코어)
- `y-prosemirror` 또는 `y-tiptap` (ProseMirror/TipTap 어댑터)
- `y-protocols` (awareness 프로토콜)
- `@tiptap/react` 또는 `prosemirror-view` 등 에디터 UI 라이브러리
- `lib0` (Yjs 의존성)

설치 전 `SPEC-REGULA-FOUNDATION-001`의 Approved Dependencies 정책을 확인한다.

---

## §6 위험 요소 (Risks)

| ID  | 위험                                                                                           | 영향  | 가능성 | 완화 전략                                                                                                                                                                                                                                       |
| --- | ---------------------------------------------------------------------------------------------- | ----- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Durable Objects 확장성: 5명 → 20명+ 확대 시 DO 마이그레이션 또는 다중 DO 샤딩 필요          | 높음  | 중간   | 초기 릴리즈는 5명 한도(REQ-COE-009)를 명시적 거부로 강제. 6명 이상 요구가 발생하면 별도 SPEC(SPEC-REGULA-COEDIT-002 가칭)에서 다중 DO 토폴로지 설계. 본 SPEC의 인터페이스(`lib/coedit/`)는 변경되지 않도록 추상화 계층을 유지한다. |
| R2  | Yjs CRDT 메모리 풋프린트: 1MB+ 문서 × 5세션 = 5MB DO RAM (DO 메모리 한도 128MB의 4%)         | 중간  | 중간   | 평균 RA 문서는 100~500KB 수준이므로 안전 마진 충분. 1MB 초과 문서는 사전에 분할 권장 가이드 작성. DO 메모리 모니터링 메트릭 도입(Cloudflare Analytics).                                                                                          |
| R3  | 권한 게이팅 우회: 클라이언트 측 readonly만으로는 악의적 사용자가 mutation 메시지 직접 송신 가능 | 높음  | 중간   | DO 측 mutation 검증을 의무화(REQ-COE-014). 모든 mutation 메시지는 세션의 부서 정보를 조회하여 검증 후 적용. 거부 사례는 audit_logs에 별도 action(`coedit_mutation_rejected`)으로 기록하여 보안 침해 시도 추적.                                  |
| R4  | Audit 로그 폭주: 키 입력당 audit는 분당 수백 row 생성하여 audit_logs 무력화                  | 높음  | 높음   | 30초 디바운스(REQ-COE-017) 의무화. DO 내부 lastEditAuditAt 타임스탬프 관리로 중복 INSERT 방지. 로그 폭주 모니터링: audit_logs INSERT rate가 분당 임계치 초과 시 경고.                                                                          |
| R5  | 브라우저 WebSocket 호환성: 구버전 Edge·Safari·기업 프록시에서 WebSocket 차단 가능              | 중간  | 낮음   | 지원 브라우저 명시(Chrome 100+, Edge 100+, Firefox 100+, Safari 15+). 기업 프록시 환경에서는 wss://(TLS) 사용으로 대부분 통과. 실패 시 명시적 에러 메시지("귀사 네트워크에서 WebSocket이 차단되었습니다") + 정적 미리보기로 폴백.                  |

---

## §7 의존성 (Dependencies)

### 선행 SPEC

- `SPEC-REGULA-FOUNDATION-001`: Auth.js v5 세션 시스템(WebSocket 인증 토큰), 디자인 토큰(부서 색상)
- `SPEC-REGULA-ENTERPRISE-001`: audit_logs 테이블 + 인프라
- `SPEC-REGULA-WORKFLOWS-001`: workflow_runs 테이블(yjs_state·last_snapshot_md 컬럼 추가 마이그레이션 본 SPEC에서 수행)
- `SPEC-REGULA-CLOUDFLARE-001`: Cloudflare Hybrid 인프라 + Durable Objects 바인딩 사전 배포

### 외부 인프라 의존

- **Cloudflare Workers + Durable Objects**: Workers Paid 플랜 이상 필요(DO는 무료 플랜 미지원). Cloudflare 계정에 DO namespace 생성 권한 필요.
- **Neon Postgres**: bytea 컬럼(`workflow_runs.yjs_state`) + jsonb 컬럼(audit_logs.metadata) 지원(기본 Postgres 13+ 모두 지원).

### 후행 영향 SPEC (본 SPEC 완료 후 활성화)

- 향후 SPEC-REGULA-DOCINGEST-NNN(가칭): `workflow_runs.last_snapshot_md`를 RAG 인덱싱 소스로 활용.
- 향후 SPEC-REGULA-EXPORT-NNN(가칭): `workflow_runs.last_snapshot_md`를 PDF/DOCX export 입력으로 활용.
