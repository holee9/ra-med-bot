---
id: SPEC-V3-IMPACT-UI-001
version: 1.0.0
status: completed
phase: C-4
priority: High
created: 2026-07-06
updated: 2026-07-06
author: manager-spec
issue_number: TBD
depends_on:
  - SPEC-V3-IMPACT-001
# SPEC-V3-UI-001은 hard contract dependency가 아님 — consult UI 패턴 참조용 (TanStack Query provider, design tokens, i18n 네임스페이스 관례). run-phase가 consult 컴포넌트 구조/테스트 mock 패턴을 상속받으나 API 계약 의존성은 없음.
blocks: []
parent_spec: SPEC-V3-IMPACT-001
lifecycle_level: spec-anchored
labels:
  - component/frontend
  - component/ui
  - domain/impact
  - type/v3-new
---

# SPEC-V3-IMPACT-UI-001 — Change Impact Wizard UI (v3 Phase C-4)

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1.0 | 2026-07-06 | manager-spec | 초기 작성. SPEC-V3-IMPACT-001 백엔드(POST /api/impact-check)를 소비하는 4-step 위저드 + 결과 페이지 UI. research.md 직검 기반 (L-013). REQ 11종. |
| 0.2.0 | 2026-07-06 | manager-spec | plan-auditor FAIL findings 수정. C1/C2/H2: `employee` 역할 제거 (verified Role union), RBAC 게이트 `ra-member+`로 정정. C3: `**NOTE:**` prose 4종 EARS sub-REQ로 전환. H1: REQ-IMP-UI-006a orgId provenance 추가. H3: `level='conditional'` 렌더링 REQ 추가. H4: consult보다 엄격한 게이트 명시. H5: confidence 임계값 3종 정리. M2/M3/m2/m4 기타 정정. |

---

## §1 Purpose (목적)

### 1.1 배경 (Background)

SPEC-V3-IMPACT-001 (Phase C-3, PR #349 merged)이 제공한 `POST /api/impact-check` 4계층 평가 백엔드를 소비하는 `ra-member+` facing 위저드 UI를 구현한다. 백엔드는 retestMatrix 결정론 → LLM 분류 → (confidence 분기) RAG / 티켓 → 신호등 결과를 동기 JSON으로 반환한다 (`app/api/impact-check/route.ts` 직검).

현재 코드베이스에는 `components/impact/` 디렉토리와 `app/(app)/impact/` 라우트가 존재하지 않는다 (research.md §4 greenfield 검증). 본 SPEC은 4단계 입력 위저드 + 결과 페이지를 새로 구축하며, 기존 consult UI 패턴 (`components/consult/`, `app/(app)/consult/`)을 따른다.

### 1.2 핵심 가치

- **자가진단 워크플로우:** `ra-member+` 사용자가 4단계(제품 → 카테고리 → 상세 → 시장) 입력으로 변경 영향 평가를 실행.
- **즉각적 시각 피드백:** 신호등(green/yellow/red) + 시장별 매트릭스 셀 + LLM 분류를 한 화면에 렌더링.
- **RAG citation 강제:** 유사 사례 렌더링 시 출처 인용을 필수화 (Charter [지양-2]).
- **백엔드 계약 엄수:** UI는 신호등/매트릭스를 재계산하지 않고 백엔드 응답을 그대로 표시 (drift 방지).

### 1.3 페르소나 (Personas)

> **역할 래더 (verified, `lib/auth/rbac.ts:14`):** `Role = 'admin' | 'qa-lead' | 'ra-lead' | 'ra-member' | 'viewer' | 'auditor'`. `employee` 역할은 존재하지 않는다. `auditor`는 외부 감사자 전용 읽기 전용 역할 (`ROLE_HIERARCHY.auditor = 0.5`)로 impact 접근이 거부된다.

| 페르소나 | 역할 | Impact 위저드 관점 |
|---|---|---|
| RA Member | `ra-member` | 위저드 실행 권한 (`impact.view` + `impact.self_check`). 변경 영향 자가진단. low-confidence 시 "RA 문의" CTA 노출. |
| RA Lead | `ra-lead` | 동일 위저드 + 결과에서 `recommendation` 값으로 수동 검토 큐 유도. |
| QA Lead | `qa-lead` | 동일 위저드 (QA가 member-level 업무 수행 가능 — `ROLE_HIERARCHY['qa-lead'] = 2.5`). |
| Admin | `admin` | 모든 권한. 위저드 자체는 동일. |
| Viewer / Auditor (차단) | `viewer`, `auditor` | `impact.view` 권한 미달 (`minRole: 'ra-member'`). `/impact` 접근 시 `/?error=access_denied` 리다이렉트. |

> `impact.self_check`는 `minRole: 'viewer'`이지만, 페이지 진입 게이트(`impact.view`)가 더 엄격하므로 viewer/auditor는 위저드 페이지 자체에 진입할 수 없다 (H4 참조).

### 1.4 비목표 (Charter [지양-2 / 지양-5] 정렬)

- 실시간 스트리밍 답변 X — `/api/impact-check`는 동기 JSON POST이므로 SSE 불필요.
- 자체 위저드 프레임워크 도입 X — 기존 4-step form 패턴으로 충분 (과잉 추상화 금지).
- 백엔드 변경 X — 모든 백엔드 계약은 frozen.

---

## §2 Scope

### 2.1 In Scope

1. `app/(app)/impact/page.tsx` 신규 라우트 (server component, RBAC gate).
2. `components/impact/` 신규 디렉토리 — 위저드 컴포넌트 6종 + 결과 컴포넌트.
3. `lib/queries/useImpactCheck.ts` — TanStack Query mutation hook.
4. `messages/ko.json` / `messages/en.json` — `impact` 키 신규 추가.
5. `components/impact/__tests__/` — Vitest + RTL 단위 테스트.

### 2.2 Out of Scope (Exclusions)

- 백엔드 4계층 로직, 마이그레이션, RBAC enum 추가 — SPEC-V3-IMPACT-001 완료.
- ESIG 전자서명 UI — Phase D 이월 (parent SPEC Exclusions).
- Slack/이메일 실시간 알림 — Phase D 이월.
- `impact.ra_escalate` 권한 기반 에스컬레이션 워크플로우 — future SPEC.
- 제품 목록 조회 API (`/api/products`) — 본 SPEC 범위 외 (research.md §6-A1).
- 위저드 실행 히스토리 목록 페이지 — consult `ConsultSessionList` 패턴과 별개; future SPEC.

---

## §3 Functional Requirements (EARS)

> **Backend contract reference:** 모든 REQ는 `POST /api/impact-check` (route.ts 직검)의 request/response 필드와 정확히 일치해야 한다. 필드명은 camelCase (`orgId`, `productId`, `changeType`, `changeDetail`, `markets`, `assigneeId`). confidence는 0..1 float.

### REQ-IMP-UI-001: 위저드 라우트 및 RBAC 게이트

**WHEN** 인증되지 않은 사용자(anonymous)가 `/impact` 경로로 접근하면, **THE SYSTEM SHALL** 로그인 페이지로 리다이렉트한다.

**WHILE** `impact.view` 권한이 없는 역할 — 즉 `ra-member` 미만인 `viewer`, `auditor`, 또는 비활성 사용자 — 이 `/impact`에 접근할 때, **THE SYSTEM SHALL** `/?error=access_denied`로 리다이렉트한다. 페이지 게이트는 `lib/auth/rbac.ts`의 `hasRole(userRole, 'ra-member')` 헬퍼를 사용해 판정한다 (`impact.view`의 `minRole: 'ra-member'`, `permissions.ts:582-596` 직검).

**WHERE** 권한이 있는 사용자(`ra-member` 이상)가 접근하면, **THE SYSTEM SHALL** 서버 컴포넌트에서 `auth()`를 호출해 역할을 읽고 클라이언트 위저드를 렌더링한다.

> **H4 — consult 게이트보다 엄격 (run-phase 주의):** consult 페이지 (`app/(app)/consult/page.tsx`)는 `viewer`만 거부한다. Impact 페이지는 더 엄격하게 `ra-member` 미만 전체(viewer + auditor + 비활성)를 거부한다. run-phase에서 consult 게이트를 copy-paste 하지 말 것 — `hasRole(userRole, 'ra-member')` 사용 필수.

### REQ-IMP-UI-002: Step 1 — 제품 식별자 입력

**WHEN** 위저드 Step 1이 렌더링되면, **THE SYSTEM SHALL** 제품 식별자 입력 UI를 제공한다.

**THE SYSTEM SHALL** 사용자가 `productId`를 자유 텍스트로 입력할 수 있도록 한다 (백엔드 Zod `z.string()` 계약 준수 — research.md §6-A1 해석).

**WHILE** 입력이 비어 있을 때, **THE SYSTEM SHALL** "다음" 버튼을 비활성화한다.

**IF** 사용자가 1자 이상 입력하면, **THE SYSTEM SHALL** "다음" 버튼을 활성화하고 Step 2로 진행 가능하게 한다.

### REQ-IMP-UI-003: Step 2 — 변경 카테고리 선택

**WHEN** Step 2가 렌더링되면, **THE SYSTEM SHALL** 다음 7개 카테고리를 라디오/카드 선택 UI로 표시한다:
1. `bom` — BOM 변경 (부품 교체)
2. `sw` — SW 알고리즘 재학습
3. `sw-minor` — SW 마이너 (버그픽스)
4. `label` — 라벨 문구 변경
5. `warn` — Critical Warning 개정
6. `process` — 생산공정 변경
7. `sterile` — 멸균 조건 변경

**WHILE** 카테고리를 선택할 때, **THE SYSTEM SHALL** 각 카테고리에 대한 설명(Tooltip 또는 보조 텍스트)을 i18n 키(`impact.categories.{id}.description`)로 표시한다.

**IF** 정확히 하나의 카테고리가 선택되면, **THE SYSTEM SHALL** `changeType` 값을 Step 3로 전달하고 "다음" 버튼을 활성화한다.

### REQ-IMP-UI-004: Step 3 — 변경 상세 입력

**WHEN** Step 3이 렌더링되면, **THE SYSTEM SHALL** 자유 텍스트 입력 필드(textarea)를 제공한다.

**THE SYSTEM SHALL** 안내 문구("변경 내용을 구체적으로 기술하세요: 부품 모델번호, 변경 사유, 영향 범위 등")를 i18n 키로 표시한다.

**WHILE** 사용자가 입력할 때, **THE SYSTEM SHALL** 글자 수 카운터(예: "247 / 2000")를 실시간으로 표시한다.

**IF** 입력 길이가 10자 미만이면, **THE SYSTEM SHALL** 에러 메시지("최소 10자 이상 입력하세요")를 표시하고 "다음" 버튼을 비활성화한다.

**IF** 입력 길이가 2000자를 초과하면, **THE SYSTEM SHALL** 추가 입력을 차단하고 "최대 2000자까지 입력 가능합니다" 에러를 표시한다.

**WHERE** 입력이 10..2000자이면, **THE SYSTEM SHALL** `changeDetail` 값을 Step 4로 전달한다.

### REQ-IMP-UI-005: Step 4 — 영향 시장 다중 선택

**WHEN** Step 4가 렌더링되면, **THE SYSTEM SHALL** 다음 5개 시장을 체크박스/칩 다중 선택 UI로 표시한다:
- `us` — FDA (US)
- `eu` — MDR (EU)
- `kr` — MFDS (KR)
- `cn` — NMPA (CN)
- `jp` — PMDA (JP)

**THE SYSTEM SHALL** 최소 1개 시장 선택을 요구한다.

**IF** 선택된 시장이 0개이면, **THE SYSTEM SHALL** "평가 시작" 버튼을 비활성화한다.

**WHERE** 1개 이상 선택되면, **THE SYSTEM SHALL** "평가 시작" 버튼을 활성화한다.

**WHEN** "평가 시작"이 클릭되면, **THE SYSTEM SHALL** `orgId`, `productId`, `changeType`, `markets`, `changeDetail`을 `POST /api/impact-check`로 전송한다. v1에서 `assigneeId`는 생략한다 (research.md §6-A2).

**IF** 백엔드 응답의 `recommendation='low-confidence-manual-review'`이면, **THE SYSTEM SHALL** 사용자에게 "자동 티켓이 생성되지 않았습니다 — RA 큐에 문의하세요" 안내를 표시한다 (v1은 `assigneeId` 미전송이므로 low-confidence 시 티켓이 생성되지 않음).

### REQ-IMP-UI-006a: orgId 출처 (Provenance)

**WHEN** 위저드 페이지가 서버에서 로드될 때, **THE SYSTEM SHALL** `session.user.orgId`를 읽어 클라이언트 위저드로 전달하고, "평가 시작" 클릭 시 요청 본문의 `orgId` 필드로 전송한다 (백엔드 Zod가 `orgId: z.string()` non-optional을 요구 — `route.ts:21`).

> **세션 shape 가정:** `auth()` 반환의 `session.user.orgId`가 존재한다고 가정한다. consult 페이지가 동일 가정으로 동작 중 (`app/(app)/consult/page.tsx`). run-phase에서 세션 타입 확장 필요 시 `lib/auth` 수정은 별도 SPEC으로 분리.

### REQ-IMP-UI-006: API 호출 및 로딩 상태

**WHEN** "평가 시작"이 클릭되면, **THE SYSTEM SHALL** `useImpactCheck` mutation을 호출하고 로딩 스피너 + "4계층 평가 수행 중..." 메시지를 표시한다.

**THE SYSTEM SHALL** 백엔드 응답 대기 중 "뒤로" / 재전송 버튼을 비활성화하여 중복 제출을 방지한다.

**IF** 백엔드 응답이 200 OK이면, **THE SYSTEM SHALL** 결과 페이지를 렌더링한다.

**IF** 백엔드 응답이 403 Forbidden이면, **THE SYSTEM SHALL** "권한이 없습니다. 관리자에게 문의하세요" 에러를 표시한다.

**IF** 백엔드 응답이 400 Bad Request이면, **THE SYSTEM SHALL** Zod 검증 에러 메시지를 파싱하여 사용자에게 표시한다.

**IF** 네트워크 오류 또는 500이면, **THE SYSTEM SHALL** "일시 오류. 나중에 다시 시도하세요" 메시지와 "다시 시도" 버튼을 표시한다.

### REQ-IMP-UI-007: 결과 페이지 — 신호등 및 매트릭스

**WHEN** 결과 응답이 도착하면, **THE SYSTEM SHALL** `signal` 필드(`green` | `yellow` | `red`)에 따라 색상화된 SignalLight 컴포넌트를 렌더링한다.

**THE SYSTEM SHALL** 신호등 색상을 **재계산하지 않고** 백엔드 `signal` 값을 그대로 사용한다 (drift 방지).

**THE SYSTEM SHALL** `matrix` 배열의 각 셀을 시장(`market` 필드)별로 그룹화하여 표 형태로 렌더링하고 각 셀에 `level` / `ref` / `note`를 표시한다.

**WHILE** `level='required'`인 셀을 렌더링할 때, **THE SYSTEM SHALL** 해당 셀을 red 강조 스타일로 표시한다.

**WHILE** `level='conditional'`인 셀을 렌더링할 때, **THE SYSTEM SHALL** 해당 셀을 yellow 강조 스타일로 표시한다.

**WHILE** `level='not-required'`인 셀을 렌더링할 때, **THE SYSTEM SHALL** 해당 셀을 neutral(강조 없음) 스타일로 표시한다.

### REQ-IMP-UI-008: 결과 페이지 — LLM 분류 표시

**WHEN** 결과 페이지가 렌더링되면, **THE SYSTEM SHALL** `classification` 객체의 `category`, `confidence`, `reason`을 표시한다.

**THE SYSTEM SHALL** `confidence`를 0..1 float으로 수신받아 백분율(예: 0.85 → "85%")로 표시한다.

**IF** `confidence < 0.8`이면, **THE SYSTEM SHALL** "신뢰도 낮음 — RA 검토 권장" 경고 배지를 표시한다.

> **Confidence 임계값 3종 정리 (H5 — drift 방지):** 본 SPEC에는 서로 다른 3개 confidence 임계값이 등장하며, 각각 목적과 소비 경로가 다르다.
>
> 1. **백엔드 신호등 임계값 (0.7 / 0.9)** — `calculateSignal`이 `confidence*100`으로 신호등 색상 산정에 사용 (`route.ts:71`). UI는 이 값을 직접 비교하지 **않는다**. UI는 백엔드가 산정한 `signal` 필드를 그대로 소비 (REQ-IMP-UI-007).
> 2. **백엔드 RAG 분기 임계값 (0.8)** — `confidence >= 0.8`일 때만 Layer 4 RAG가 실행되어 `similarCases`가 응답에 포함되고 `recommendation='high-confidence-auto-approve'`가 설정됨 (`route.ts:92`). UI는 이 임계값 자체를 검사하지 않고 `recommendation` 필드와 `similarCases`의 존재 여부로 분기 (REQ-IMP-UI-009/010).
> 3. **UI 표시 배지 임계값 (0.8)** — REQ-IMP-UI-008의 "신뢰도 낮음" 배지 표시용. cosmetic-only 결정이며 signal 색상과 독립적임 (예: confidence=0.82 → signal은 green/yellow일 수 있지만 배지는 미표시).

### REQ-IMP-UI-009: 결과 페이지 — 유사 사례 (RAG)

**IF** 응답에 `similarCases` 배열이 **존재하고**(high-confidence 분기), 배열이 비어 있지 않으면, **THE SYSTEM SHALL** 각 사례를 카드로 렌더링하고 `title`, `content`, `similarity`를 표시한다.

**THE SYSTEM SHALL** 각 유사 사례 카드에 출처 인용을 `<sup class="cite" data-src="{source}">{번호}</sup>` 형식으로 표시한다 (Charter [지양-2] 강제).

**IF** `similarCases`가 빈 배열이면, **THE SYSTEM SHALL** "유사 사례가 없습니다" 메시지를 표시한다.

**IF** 응답에 `similarCases` 필드가 **존재하지 않으면**(low-confidence 분기 — 백엔드가 RAG을 건너뜀), **THE SYSTEM SHALL** 유사 사례 섹션을 렌더링하지 않고 "신뢰도 낮아 유사 사례 조회를 생략했습니다" 안내를 표시한다. 백엔드는 low-confidence 시 `similarCases`를 `undefined`로 반환한다 (route.ts 직검) — UI는 빈 배열 `[]`과 `undefined`를 반드시 구분해서 렌더링해야 한다.

### REQ-IMP-UI-010: 결과 페이지 — 티켓 CTA

**IF** 응답에 `ticketId`가 존재하면, **THE SYSTEM SHALL** "RA 티켓 #{ticketId} 생성됨" CTA를 표시하고 `/inbox/{ticketId}`로 링크한다.

**IF** 응답에 `ticketId`가 존재하지 않고 `recommendation='low-confidence-manual-review'`이면, **THE SYSTEM SHALL** "RA 검토 권장 — RA 큐에 문의하세요" 정적 CTA를 `/inbox`로 링크하여 표시한다 (v1은 assigneeId 미전송이므로 이 분기가 기본 — research.md §6-A2).

**IF** `recommendation='high-confidence-auto-approve'`이면, **THE SYSTEM SHALL** 티켓 CTA를 표시하지 않는다.

### REQ-IMP-UI-011: 국제화 (i18n) 및 접근성

**THE SYSTEM SHALL** 모든 사용자 가시 문자열을 `next-intl`의 `impact.*` 네임스페이스 키로 관리한다 (`messages/ko.json` + `messages/en.json`).

**WHEN** 사용자가 키보드로 위저드를 탐색할 때, **THE SYSTEM SHALL** Tab/Shift+Tab 논리적 순서를 유지하고, Step 진입 시 `focus()`를 해당 Step의 첫 번째 입력 요소에 호출한다.

**THE SYSTEM SHALL** 모든 폼 입력에 `aria-label` / `<label>` 연결을 제공하고 WCAG 2.1 AA 색상 대비를 만족한다 (`ci:contrast` 게이트).

---

## §4 Non-Functional Requirements

### REQ-IMP-UI-NFR-001: 성능

**THE SYSTEM SHALL** 위저드 초기 렌더링을 1초 이내에 완료한다 (서버 컴포넌트 + 클라이언트 hydration).

**THE SYSTEM SHALL** 백엔드 응답 대기 중 로딩 UI를 즉시 표시한다. 백엔드 응답 시간(parent SPEC NFR: < 20초) 동안 사용자가 대기 상태를 인지할 수 있어야 한다.

### REQ-IMP-UI-NFR-002: 보안

**THE SYSTEM SHALL** `productId`, `changeDetail` 입력값을 렌더링할 때 React의 기본 XSS 이스케이핑에 의존하고 `dangerouslySetInnerHTML`을 사용하지 않는다.

**THE SYSTEM SHALL** 유사 사례 카드의 출처 인용 `<sup>`을 렌더링할 때 `data-src` 속성값을 sanitization한다.

### REQ-IMP-UI-NFR-003: 유지보수성

**THE SYSTEM SHALL** 컴포넌트를 단일 책임 원칙으로 분리한다: `ImpactWizard` (오케스트레이터), `Step1Product` / `Step2Category` / `Step3Detail` / `Step4Markets` (각 단계), `ImpactResult` / `SignalLight` / `SimilarCasesCard` (결과 표시).

**THE SYSTEM SHALL** 컴포넌트 테스트 커버리지 85% 이상을 달성한다 (parent SPEC quality.yaml).

### REQ-IMP-UI-NFR-004: 비회귀

**THE SYSTEM SHALL** 기존 consult UI, 트리age UI, 기타 v3 컴포넌트에 영향을 주지 않는다. 모든 신규 파일은 `components/impact/`, `lib/queries/useImpactCheck.ts`, `app/(app)/impact/`, `messages/*.json` 신규 키로 한정된다.

---

## §5 Data Model

본 SPEC은 신규 DB 스키마를 정의하지 않는다 (백엔드가 이미 SPEC-V3-IMPACT-001에서 확장 완료). UI는 다음 타입만 사용한다:

```ts
// lib/queries/useImpactCheck.ts
type ImpactCheckRequest = {
  orgId: string;
  productId: string;
  changeType: 'bom'|'sw'|'sw-minor'|'label'|'warn'|'process'|'sterile';
  markets: Array<'us'|'eu'|'kr'|'cn'|'jp'>;
  changeDetail: string;
  // assigneeId는 v1에서 생략 (research.md §6-A2)
};

type ImpactCheckResponse = {
  matrix: Array<{ level: string; ref: string; note: string; market: string }>;
  signal: 'green'|'yellow'|'red';
  classification: { category: string; confidence: number; reason: string };
  similarCases?: Array<{ id: string; title: string; content: string; similarity: number }>;
  ticketId?: string;
  recommendation: string;
};
```

---

## §6 API Contract (Consumed)

본 SPEC은 API를 정의하지 않는다. `POST /api/impact-check`는 SPEC-V3-IMPACT-001 (PR #349 merged)에서 정의되었으며 본 SPEC은 이를 소비(consume)만 한다. 필드 계약은 research.md §2에 직검 검증되어 있다.

---

## §7 Dependencies

### 7.1 Internal
- `POST /api/impact-check` (frozen contract, SPEC-V3-IMPACT-001).
- `@/lib/auth` (`auth()`, role types) — page-level RBAC.
- TanStack Query — `useImpactCheck` mutation.
- `next-intl` — i18n.
- Tailwind v4 `@theme` design tokens.

### 7.2 External
- Radix UI primitives — accessible checkboxes / radio / dialog (consult UI와 동일 라이브러리).

### 7.3 NOT Imported
- `useStreamingAnswer` (consult SSE 전용 — impact API는 동기 POST).
- `/api/products`, `/api/ra/assignees` (존재하지 않음 — research.md §6).

---

## §8 Exclusions (What NOT to Build)

[HARD] 본 SPEC의 제외 항목:

1. **백엔드 4계층 로직 / 마이그레이션 / RBAC enum** — parent SPEC-V3-IMPACT-001 completed.
2. **제품 목록 피커 API (`/api/products`)** — 제품 목록 데이터 소스가 코드베이스에 없다 (research.md §6-A1). v1은 자유 텍스트 입력. 제품 피커는 별도 SPEC 필요.
3. **자동 티켓 에스컬레이션 (`assigneeId` 자동 지정)** — assignee resolution 백엔드가 없다 (research.md §6-A2). v1은 정적 CTA만.
4. **위저드 실행 히스토리 / 재실행 목록 페이지** — consult `ConsultSessionList`와 별개 스펙. future.
5. **실시간 스트리밍 결과** — `/api/impact-check`는 동기 JSON. SSE 불필요.
6. **ESIG 전자서명 플로우** — Phase D 이월 (parent SPEC Exclusions).

---

## §9 Open Questions (Run-Phase Resolution)

| ID | Question | Default | Plan-auditor focus |
|---|---|---|---|
| OQ-1 | 제품 목록 출처 확정 필요 (A1) | 자유 텍스트 productId | scope creep 여부 |
| OQ-2 | low-confidence 티켓 CTA UX 확정 (A2) | `/inbox` 정적 링크 | backend contract 정확성 |
| OQ-3 | `phase: C-4` 라벨 roadmap 교차 검증 | orchestrator 지시 따름 | — |

---

**생성일:** 2026-07-06
**버전:** 0.2.0
**상태:** planned
**총 REQ:** 12 functional (REQ-IMP-UI-006a 추가) + 4 NFR
**다음 단계:** plan.md 구현 계획 수립 → acceptance.md 검증 시나리오 → plan-auditor 감사
