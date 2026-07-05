# SPEC-V3-IMPACT-UI-001 — Implementation Plan

---
**SPEC ID:** SPEC-V3-IMPACT-UI-001
**Version:** 0.1.0
**Status:** planned
**Phase:** C-4
**Created:** 2026-07-06
---

## §1 Overview

v3 Phase C-4 **Change Impact Wizard UI** 구현 계획. SPEC-V3-IMPACT-001 백엔드(`POST /api/impact-check`, PR #349 merged)를 소비하는 4-step 위저드 + 결과 페이지를 구축한다.

**핵심 목표:**
- 4단계 입력 위저드 (제품 → 카테고리 → 상세 → 시장)
- 결과 페이지 (신호등 / 매트릭스 / LLM 분류 / 유사 사례 / 티켓 CTA)
- consult UI 패턴 준용 (`components/consult/`, `app/(app)/consult/`)
- i18n + WCAG 2.1 AA 접근성
- UI 전용 (백엔드 변경 없음)

**TDD 기본:** quality.yaml `development_mode: tdd` 에 따라 RED-GREEN-REFACTOR. brownfieldEnhancement: 기존 consult 컴포넌트 패턴 사전 독해 (Pre-RED).

---

## §2 Implementation Milestones

### Milestone 1: Foundation — Route + RBAC Gate + Hook (Priority: High)

**목표:** 위저드 라우트, RBAC 게이트, `useImpactCheck` mutation hook 마련

**작업 항목:**
1. `app/(app)/impact/page.tsx` 신규 — 서버 컴포넌트, `auth()` 호출, 역할 게이트, 클라이언트 위저드 wrapper 렌더링 (`app/(app)/consult/page.tsx` 패턴).
2. `app/(app)/impact/ImpactWizardClient.tsx` 신규 — `'use client'` wrapper.
3. `lib/queries/useImpactCheck.ts` 신규 — TanStack Query `useMutation` 정의:
   - request/response 타입(`ImpactCheckRequest`, `ImpactCheckResponse` — spec.md §5)
   - `fetch('/api/impact-check', {method:'POST', body: JSON.stringify(input)})`
   - 400/403/500 에러 분기 throw
4. 단위 테스트:
   - `app/(app)/impact/__tests__/page.test.tsx` — RBAC 리다이렉트 분기
   - `lib/queries/__tests__/useImpactCheck.test.ts` — mutation 성공/실패

**산출물:**
- `app/(app)/impact/page.tsx`, `ImpactWizardClient.tsx`
- `lib/queries/useImpactCheck.ts`
- 단위 테스트 2종

**완료 기준:**
- [ ] `/impact` 라우트가 렌더링된다
- [ ] `impact.view` 미권한 역할이 `/?error=access_denied`로 리다이렉트된다
- [ ] `useImpactCheck` mutation이 POST를 정상 호출한다
- [ ] 단위 테스트 통과

**의존성:**
- `@/lib/auth` (`auth()`)
- TanStack Query
- 백엔드 `POST /api/impact-check` (frozen)

### Milestone 2: i18n + Design Tokens (Priority: High)

**목표:** 모든 위저드 문자열 키 + 신호등 토큰 준비

**작업 항목:**
1. `messages/ko.json`에 `impact` 네임스페이스 추가:
   - `impact.title`, `impact.steps.{1..4}.title`, `impact.steps.{1..4}.description`
   - `impact.categories.{bom|sw|sw-minor|label|warn|process|sterile}.label`
   - `impact.categories.{...}.description`
   - `impact.markets.{us|eu|kr|cn|jp}.label`
   - `impact.form.{productId.label, changeDetail.label, changeDetail.placeholder, changeDetail.counter, charMinError, charMaxError}`
   - `impact.button.{next, back, startEvaluation, retry}`
   - `impact.result.{signalLabel, matrixHeader, llmHeader, similarHeader, ticketCta, contactRaCta, noSimilarCases, similarCasesSkipped, lowConfidenceBadge, loadingMessage}`
   - `impact.error.{forbidden, badRequest, network}`
2. `messages/en.json` 동일 키 추가.
3. 신호등 색상 토큰 — `app/globals.css`에 `--signal-green`, `--signal-yellow`, `--signal-red` semantic 토큰 정의 (light/dark 모드 각각). 기존 `--color-brand-*`와 `--danger` 재사용. `ci:contrast` 통과 검증.

**산출물:**
- `messages/ko.json`, `messages/en.json` 확장
- `app/globals.css` 신호등 토큰 (필요 시)

**완료 기준:**
- [ ] 모든 위저드 가시 문자열이 키로 관리된다
- [ ] 한국어/영어 전환이 동작한다
- [ ] 신호등 색상이 light/dark 모두에서 AA 대비 통과한다

**의존성:**
- next-intl
- Tailwind v4 @theme

### Milestone 3: Step 1-4 위저드 컴포넌트 (Priority: High)

**목표:** 4단계 입력 UI + 단계 전환 로직

**작업 항목:**
1. `components/impact/ImpactWizard.tsx` — 오케스트레이터:
   - `step` state (1..4)
   - `productId`, `changeType`, `changeDetail`, `markets` state
   - Step 전환 + 포커스 관리
   - 완료 시 `useImpactCheck().mutate(input)`
2. `components/impact/Step1Product.tsx` — productId 자유 텍스트 입력 (REQ-IMP-UI-002):
   - 입력값 1자 이상 시 "다음" 활성화
   - i18n 키 lookup
3. `components/impact/Step2Category.tsx` — 7개 라디오/카드 (REQ-IMP-UI-003):
   - 7 카테고리 라디오 그룹
   - 선택 시 설명 툴팁 표시
4. `components/impact/Step3Detail.tsx` — textarea + 카운터 (REQ-IMP-UI-004):
   - 10..2000자 검증
   - 실시간 카운터 렌더링
5. `components/impact/Step4Markets.tsx` — 체크박스 5종 (REQ-IMP-UI-005):
   - 1개 이상 선택 시 "평가 시작" 활성화
6. 단위 테스트:
   - `ImpactWizard.test.tsx` — 단계 전환 + 상태
   - `Step1Product.test.tsx` — 빈 입력/활성 입력 분기
   - `Step2Category.test.tsx` — 7 카테고리 라디오 + 선택 단일성
   - `Step3Detail.test.tsx` — 10자 미만/2000자 초과/정상 분기
   - `Step4Markets.test.tsx` — 0개 선택/1개 이상 선택 분기

**산출물:**
- `components/impact/ImpactWizard.tsx`, `Step1Product.tsx`, `Step2Category.tsx`, `Step3Detail.tsx`, `Step4Markets.tsx`
- 단위 테스트 5종

**완료 기준:**
- [ ] 4단계 입력 플로우가 동작한다
- [ ] 각 단계 검증 로직이 AC-IMP-UI-02..05를 만족한다
- [ ] "평가 시작" 클릭 시 `useImpactCheck` mutation이 호출된다
- [ ] 키보드 탐색이 가능하다
- [ ] 단위 테스트 통과

**의존성:**
- Milestone 1 (`useImpactCheck`)
- Milestone 2 (i18n 키)
- Radix UI primitives (라디오/체크박스)

### Milestone 4: 로딩 및 에러 상태 (Priority: High)

**목표:** mutation pending/error 상태 UI (REQ-IMP-UI-006)

**작업 항목:**
1. `ImpactWizard.tsx`에 mutation 상태 분기 추가:
   - `isPending`: 로딩 스피너 + "4계층 평가 수행 중..." + "뒤로"/"재전송" 비활성화
   - `isError` + 403: "권한이 없습니다. 관리자에게 문의하세요"
   - `isError` + 400: 백엔드 에러 메시지 파싱 표시
   - `isError` + 네트워크/500: "일시 오류. 나중에 다시 시도하세요" + "다시 시도" 버튼
   - `isSuccess`: 결과 페이지 렌더링 (Milestone 5)
2. 중복 제출 방지 — pending 중 "평가 시작" 버튼 비활성화.
3. 단위 테스트:
   - `ImpactWizard.test.tsx`에 pending/403/400/500/네트워크 분기 케이스 추가 (MSW 또는 mutation mock)

**산출물:**
- `ImpactWizard.tsx` 상태 분기
- 단위 테스트 케이스 5종 추가

**완료 기준:**
- [ ] 모든 에러 상태가 AC-IMP-UI-06을 만족한다
- [ ] 중복 제출이 방지된다
- [ ] "다시 시도" 버튼이 동작한다
- [ ] 단위 테스트 통과

**의존성:**
- Milestone 3

### Milestone 5: 결과 페이지 컴포넌트 (Priority: High)

**목표:** 신호등 / 매트릭스 / LLM 분류 / 유사 사례 / 티켓 CTA 렌더링

**작업 항목:**
1. `components/impact/SignalLight.tsx` (REQ-IMP-UI-007):
   - props: `signal: 'green'|'yellow'|'red'`
   - 백엔드 값 직접 소비 (재계산 X)
   - 신호등 semantic 토큰 사용
2. `components/impact/ImpactMatrixTable.tsx` (REQ-IMP-UI-007):
   - props: `matrix: Array<{level, ref, note, market}>`
   - market별 그룹화 렌더링
   - `level='required'` 셀 강조 스타일
3. `components/impact/LlmClassification.tsx` (REQ-IMP-UI-008):
   - props: `classification: {category, confidence, reason}`
   - confidence float → 백분율 표시
   - `confidence < 0.8` 경고 배지
4. `components/impact/SimilarCasesCard.tsx` (REQ-IMP-UI-009):
   - props: `similarCases?: Array<...>` (undefined / [] / 비어있지 않음 분기)
   - 출처 인용 `<sup class="cite" data-src="...">번호</sup>` 포함
   - undefined 시 "조회 생략" 안내
   - 빈 배열 시 "유사 사례 없음"
5. `components/impact/ImpactResult.tsx` (REQ-IMP-UI-007..010):
   - SignalLight + MatrixTable + LlmClassification + SimilarCasesCard 조합
   - `recommendation` 분기 티켓 CTA 렌더링
   - `ticketId` 존재 시 `/inbox/{ticketId}`, 미존재 + low-confidence 시 `/inbox` 정적 CTA
6. 단위 테스트:
   - `SignalLight.test.tsx`, `ImpactMatrixTable.test.tsx`, `LlmClassification.test.tsx`, `SimilarCasesCard.test.tsx`, `ImpactResult.test.tsx`
   - 특히 SimilarCasesCard 3분기(undefined/[]/비어있지 않음) 집중 검증

**산출물:**
- 결과 컴포넌트 5종
- 단위 테스트 5종

**완료 기준:**
- [ ] 결과 페이지가 AC-IMP-UI-07..10을 만족한다
- [ ] 신호등 재계산이 없다 (코드 검사)
- [ ] `similarCases` undefined vs [] 분기가 정확하다
- [ ] 출처 인용 `<sup>`가 모든 유사 사례에 포함된다
- [ ] 단위 테스트 통과

**의존성:**
- Milestone 4

### Milestone 6: 접근성 + 다크 모드 + 통합 테스트 (Priority: Medium)

**목표:** WCAG 2.1 AA + 다크 모드 검증 + E2E

**작업 항목:**
1. 모든 폼 입력에 `<label htmlFor>` 또는 `aria-label` 연결
2. Step 전환 시 첫 입력으로 포커스 이동
3. 다크 모드 렌더링 검증 — SignalLight, 매트릭스 강조 스타일
4. `ci:contrast` 게이트 통과 검증
5. axe 자동 접근성 audit (`@axe-core/playwright` 또는 `jest-axe`)
6. 통합 시나리오 테스트:
   - happy path (high-confidence → 결과 + 유사 사례)
   - low-confidence path (결과 + RA 검토 CTA, similarCases 생략)
   - 네트워크 오류 → 재시도 → 성공
   - 권한 없는 사용자 → 리다이렉트

**산출물:**
- 접근성 개선 (기존 컴포넌트 수정)
- 통합 테스트 케이스

**완료 기준:**
- [ ] AC-IMP-UI-11 (i18n + 접근성) 통과
- [ ] 다크 모드에서 WCAG AA 대비 유지
- [ ] 통합 시나리오 4종 통과
- [ ] `ci:contrast` 게이트 통과

**의존성:**
- Milestone 5

---

## §3 New and Modified Files

### 신규 파일 (New Files)

**라우트:**
```
app/(app)/impact/
├── page.tsx                          # M1: 서버 컴포넌트 + RBAC 게이트
├── ImpactWizardClient.tsx           # M1: 'use client' wrapper
└── __tests__/
    └── page.test.tsx                 # M1: RBAC 리다이렉트
```

**컴포넌트:**
```
components/impact/
├── ImpactWizard.tsx                  # M3: 오케스트레이터 (M4에서 상태 분기 확장)
├── Step1Product.tsx                  # M3
├── Step2Category.tsx                 # M3
├── Step3Detail.tsx                   # M3
├── Step4Markets.tsx                  # M3
├── ImpactResult.tsx                  # M5: 결과 페이지 조합
├── SignalLight.tsx                   # M5
├── ImpactMatrixTable.tsx             # M5
├── LlmClassification.tsx             # M5
├── SimilarCasesCard.tsx              # M5
└── __tests__/
    ├── ImpactWizard.test.tsx         # M3+M4
    ├── Step1Product.test.tsx         # M3
    ├── Step2Category.test.tsx        # M3
    ├── Step3Detail.test.tsx          # M3
    ├── Step4Markets.test.tsx         # M3
    ├── ImpactResult.test.tsx         # M5
    ├── SignalLight.test.tsx          # M5
    ├── ImpactMatrixTable.test.tsx    # M5
    ├── LlmClassification.test.tsx    # M5
    └── SimilarCasesCard.test.tsx     # M5
```

**쿼리 훅:**
```
lib/queries/
├── useImpactCheck.ts                 # M1: TanStack Query mutation
└── __tests__/
    └── useImpactCheck.test.ts        # M1
```

### 수정 파일 (Modified Files)

**i18n:**
```
messages/ko.json                      # M2: impact 네임스페이스 추가
messages/en.json                      # M2: 동일
```

**디자인 토큰 (필요 시):**
```
app/globals.css                       # M2: 신호등 semantic 토큰 (light/dark)
```

### 수정 금지 (Out of Scope)

- `app/api/impact-check/route.ts` — frozen
- `lib/domains/impact/*` — frozen
- `lib/db/schema.ts` — frozen
- 기존 consult 컴포넌트 — 비회귀

---

## §4 Technical Approach

### 아키텍처 패턴

**서버/클라이언트 분리 (consult 패턴 준용):**
```
app/(app)/impact/page.tsx (server)
    ↓ auth() + role gate
ImpactWizardClient.tsx ('use client')
    ↓
components/impact/ImpactWizard.tsx
    ↓ step state + useImpactCheck mutation
Step1Product / Step2Category / Step3Detail / Step4Markets
    ↓ on submit
useImpactCheck → POST /api/impact-check
    ↓ response
ImpactResult (SignalLight + MatrixTable + LlmClassification + SimilarCasesCard + TicketCTA)
```

**상태 관리:**
- 위저드 입력값: React `useState` (ImpactWizard 내부) — 다른 페이지와 공유 필요 없음.
- API mutation: TanStack Query `useMutation` (`useImpactCheck`).
- 전역 상태(Zustand/Jotai) 불필요 — 과잉 추상화 방지 (Charter [지양-5]).

### 데이터 흐름

**정상 플로우 (high-confidence):**
```
Step 1..4 입력 → "평가 시작" 클릭
    ↓
useImpactCheck.mutate(input)
    ↓ POST /api/impact-check
백엔드 4계층 실행 (retestMatrix → LLM → RAG → signal)
    ↓ 200 OK {matrix, signal, classification, similarCases, recommendation}
ImpactResult 렌더링 (SignalLight green/yellow, SimilarCasesCard 카드 N건)
```

**Low-confidence 플로우:**
```
Step 1..4 입력 → "평가 시작"
    ↓
useImpactCheck.mutate
    ↓ 200 OK {matrix, signal, classification, recommendation='low-confidence-manual-review'}
    ↓ similarCases 생략, ticketId 생략 (assigneeId 미전송)
ImpactResult 렌더링 (SignalLight, 유사 사례 생략 안내, RA 검토 CTA /inbox)
```

### 에러 처리 전략

| 상황 | 사용자 UX |
|---|---|
| 403 Forbidden | "권한 없음" 에러 메시지 (자동 리다이렉트 X) |
| 400 Bad Request | 백엔드 Zod 메시지 파싱 표시 |
| 500 / 네트워크 | "일시 오류" + "다시 시도" 버튼 |
| pending 중복 클릭 | 버튼 비활성화로 차단 |

### 백엔드 계약 준수 체크리스트 (코드 리뷰 게이트)

- [ ] request field names: camelCase (`orgId`, `productId`, `changeType`, `markets`, `changeDetail`) — snake_case 금지
- [ ] `confidence` 0..1 float 처리 (백분율 변환은 표시 레이어에서만)
- [ ] `similarCases` undefined vs [] 구분
- [ ] `signal` 재계산 금지 (백엔드 값 직접 소비)
- [ ] `assigneeId` v1에서 미전송 (low-confidence 시 티켓 미생성 정상)

---

## §5 Testing Strategy

### 단위 테스트 (Vitest + RTL)

**목표 커버리지:** 85% 이상

**Mock 패턴** (`components/consult/__tests__/` 직검 기반):
```ts
vi.mock('next-intl', () => ({ useTranslations: () => (key) => key }));
vi.mock('@/lib/queries/useImpactCheck', () => ({
  useImpactCheck: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
    data: null,
  }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
```

**테스트 대상:** plan.md §3 단위 테스트 파일 목록 참조.

### 접근성 테스트

- `jest-axe` 또는 `@axe-core/playwright` 자동 audit
- 키보드 탐색 RTL 시뮬레이션 (`fireEvent.keyDown` Tab/Enter)
- `ci:contrast` CI 게이트 통과

### 비회귀 테스트

- 기존 `pnpm test` (full suite) 통과 — 특히 consult 테스트가 깨지지 않는지 (L-009).
- `pnpm lint` (lint:hex) full 실행 (L-008).

---

## §6 Risk Mitigation

### 위험 1: 백엔드 계약 drift (camelCase vs snake_case)

**완화:**
- research.md §2.2에 직검 검증된 camelCase 필드명을 spec.md §5 + 모든 테스트 단언에 고정.
- 코드 리뷰 게이트(§4 체크리스트)에서 필드명 단언.

**검증:** M1 mutation hook 테스트에서 request body camelCase 단언.

### 위험 2: similarCases undefined 처리 누락

**완화:**
- AC-IMP-UI-09에서 undefined / [] / 비어있지 않음 3분기를 명시적 단언.
- SimilarCasesCard 단위 테스트에서 3분기 집중 검증.

**검증:** M5 SimilarCasesCard.test.tsx 3분기 통과.

### 위험 3: 제품 목록 데이터 소스 부재 (research.md §6-A1)

**완화:**
- v1은 자유 텍스트 productId 입력 (백엔드 Zod `z.string()` 호환).
- 제품 피커는 별도 follow-up SPEC으로 이월 (spec.md §8).

**검증:** M3 Step1Product가 단순 텍스트 입력으로 동작.

### 위험 4: 신호등 재계산 drift

**완화:**
- REQ-IMP-UI-007에 "백엔드 값 직접 소비, 재계산 X" 명시.
- 코드 검사에서 `calculateSignal` import 부재 단언.

**검증:** M5 SignalLight 테스트 + 코드 리뷰.

### 위험 5: low-confidence 티켓 미생성 사용자 혼란

**완화:**
- v1은 `assigneeId` 미전송 → `recommendation='low-confidence-manual-review'` 시 `/inbox` 정적 CTA (research.md §6-A2).
- AC-IMP-UI-10에 명시적 CTA 분기 단언.

**검증:** M5 ImpactResult.test.tsx recommendation 분기.

---

## §7 Dependencies Mapping

### 내부 의존성

| 의존 대상 | 용도 | Milestone |
|---|---|---|
| `POST /api/impact-check` | 4계층 평가 백엔드 | M1 (frozen) |
| `@/lib/auth` (`auth()`) | 페이지 RBAC 게이트 | M1 |
| TanStack Query | mutation hook | M1 |
| `next-intl` | i18n | M2 |
| Tailwind v4 `@theme` | 디자인 토큰 | M2 |
| 기존 consult 패턴 | 컴포넌트/테스트 참조 | M3 (참고용) |

### 외부 의존성

| 의존 대상 | 용도 | 버전 |
|---|---|---|
| Radix UI primitives | 라디오/체크박스/dialog (접근성) | 기존 consult 사용 버전 |
| `jest-axe` 또는 `@axe-core/playwright` | 접근성 audit | 기존 설정 준용 |

### 외부 의존성이 아닌 것 (NOT Imported)

- `useStreamingAnswer` — consult SSE 전용 (impact는 동기 POST)
- `/api/products` — 존재하지 않음
- `/api/ra/assignees` — 존재하지 않음

---

## §8 Open Questions (Run-Phase Resolution)

| ID | Question | Default | Owner |
|---|---|---|---|
| OQ-1 | 제품 목록 출처 (research.md §6-A1) | 자유 텍스트 productId | run phase: UX 확정 |
| OQ-2 | low-confidence 티켓 CTA (research.md §6-A2) | `/inbox` 정적 CTA | run phase: UX 확정 |
| OQ-3 | `phase: C-4` 라벨 roadmap 교차 검증 | orchestrator 지시 따름 | plan-auditor |

---

**생성일:** 2026-07-06
**버전:** 0.1.0
**상태:** planned
**총 Milestones:** 6개
**예상 완료:** Phase C-4 종료 시점
