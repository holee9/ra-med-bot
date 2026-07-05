# SPEC-V3-IMPACT-UI-001 — Acceptance Criteria

---
**SPEC ID:** SPEC-V3-IMPACT-UI-001
**Version:** 0.1.0
**Status:** planned
**Phase:** C-4
**Created:** 2026-07-06
---

## §1 Acceptance Criteria

> 모든 AC는 observable evidence를 포함한다. 백엔드 계약 필드는 camelCase, confidence는 0..1 float (`app/api/impact-check/route.ts` 직검).

### AC-IMP-UI-01: 위저드 라우트 RBAC 게이트 (REQ-IMP-UI-001)

> **역할 래더 (verified):** `admin` > `qa-lead` (2.5) > `ra-lead` > `ra-member` > `viewer` > `auditor` (0.5). `employee` 역할은 존재하지 않는다 (`lib/auth/rbac.ts:14`).

**Given** `impact.view` 권한 미달 역할 — `auditor`, `viewer`, 또는 익명/비활성 사용자 — 이
**When** `/impact` 경로로 접근하면
**Then** 서버 컴포넌트가 `auth()`를 호출해 역할을 읽고 `hasRole(userRole, 'ra-member')`가 false이면 `/?error=access_denied`로 리다이렉트한다.

**Given** `ra-member` 이상 권한(`ra-member`, `qa-lead`, `ra-lead`, `admin`) 사용자가
**When** `/impact` 경로로 접근하면
**Then** 클라이언트 위저드 컴포넌트가 렌더링되고 Step 1이 보인다.

**Evidence:** Playwright E2E + RTL 단위 테스트에서 `auth()` mock으로 `{auditor, viewer, ra-member, qa-lead, ra-lead, admin}` 6종 역할 + 익명 분기 검증. 특히 consult 게이트(`viewer`만 거부)와 달리 impact 게이트는 `viewer`와 `auditor` 모두 거부함을 단언.

### AC-IMP-UI-02: Step 1 제품 식별자 입력 (REQ-IMP-UI-002)

**Given** Step 1이 렌더링되었을 때
**When** `productId` 입력 필드가 비어 있으면
**Then** "다음" 버튼이 비활성화되어 있다.

**Given** 사용자가 `productId`에 "xray-src-001"을 입력하면
**When** 입력값이 1자 이상일 때
**Then** "다음" 버튼이 활성화되고 클릭 시 Step 2로 이동한다.

**Evidence:** RTL — `screen.getByRole('button', {name:/next/i})`의 `disabled` 속성 변화.

### AC-IMP-UI-03: Step 2 카테고리 7종 선택 (REQ-IMP-UI-003)

**Given** Step 2가 렌더링되었을 때
**When** 카테고리 목록이 표시되면
**Then** 정확히 7개 항목(`bom`, `sw`, `sw-minor`, `label`, `warn`, `process`, `sterile`)이 라디오/카드 UI로 표시된다.

**Given** 어떤 카테고리도 선택되지 않았을 때
**When** 사용자가 "다음"을 시도하면
**Then** 버튼이 비활성화되어 있다.

**Given** 사용자가 `bom` 카드를 클릭하면
**When** 선택 이벤트가 발생하면
**Then** `changeType='bom'` 상태가 저장되고 설명 툴팁(i18n 키 `impact.categories.bom.description`)이 표시되며 "다음" 버튼이 활성화된다.

**Evidence:** RTL — 7개 라디오 role 조회 + 클릭 후 상태 검증.

### AC-IMP-UI-04: Step 3 변경 상세 입력 및 길이 검증 (REQ-IMP-UI-004)

**Given** Step 3가 렌더링되었을 때
**When** textarea가 비어 있을 때
**Then** "최소 10자 이상 입력하세요" 에러가 표시되고 "다음"이 비활성화된다.

**Given** 사용자가 5자("hello")를 입력하면
**When** 글자 수가 10 미만일 때
**Then** 카운터에 "5 / 2000"이 표시되고 에러가 유지된다.

**Given** 사용자가 10자 이상 입력하면
**When** 길이가 10..2000 범위일 때
**Then** 에러가 사라지고 "다음"이 활성화된다.

**Given** 사용자가 2000자를 초과 시도하면
**When** 2001번째 문자 입력 시
**Then** 추가 입력이 차단되고 "최대 2000자까지 입력 가능합니다" 에러가 표시된다.

**Evidence:** RTL — ` fireEvent.change` + 카운터/에러 메시지 단언.

### AC-IMP-UI-05: Step 4 시장 다중 선택 (REQ-IMP-UI-005)

**Given** Step 4가 렌더링되었을 때
**When** 체크박스 5종(us, eu, kr, cn, jp)이 표시될 때
**Then** 아무것도 선택되지 않은 상태에서 "평가 시작"이 비활성화되어 있다.

**Given** 사용자가 `us`, `eu`를 선택하면
**When** 선택된 시장이 1개 이상일 때
**Then** "평가 시작" 버튼이 활성화된다.

**Evidence:** RTL — 체크박스 클릭 후 버튼 활성 상태 단언.

### AC-IMP-UI-06: API 호출 및 로딩/에러 상태 (REQ-IMP-UI-006)

**Given** 모든 단계 입력이 완료되고 "평가 시작"이 클릭되었을 때
**When** `useImpactCheck` mutation이 pending 상태이면
**Then** 로딩 스피너 + "4계층 평가 수행 중..." 메시지가 표시되고 "뒤로"/"재전송" 버튼이 비활성화된다.

**Given** 백엔드가 200 OK를 반환하면
**When** mutation이 성공하면
**Then** 결과 페이지가 렌더링된다.

**Given** 백엔드가 403 Forbidden을 반환하면
**When** mutation이 403 에러를 throw하면
**Then** "권한이 없습니다. 관리자에게 문의하세요" 에러 메시지가 표시된다.

**Given** 백엔드가 400 Bad Request를 반환하면
**When** Zod 에러 메시지가 응답 본문에 있으면
**Then** 에러 메시지가 파싱되어 사용자에게 표시된다.

**Given** 네트워크 오류 또는 500이 발생하면
**When** mutation이 일반 에러를 throw하면
**Then** "일시 오류. 나중에 다시 시도하세요" 메시지 + "다시 시도" 버튼이 표시된다.

**Evidence:** RTL + MSW (또는 `vi.mock('@/lib/queries/useImpactCheck')`)로 mutation 상태별 렌더링 검증.

### AC-IMP-UI-07: 결과 페이지 — 신호등 및 매트릭스 (REQ-IMP-UI-007)

**Given** 백엔드 응답의 `signal='green'`이면
**When** 결과 페이지가 렌더링되면
**Then** SignalLight 컴포넌트가 green 상태로 표시된다.

**Given** 백엔드 응답의 `signal='red'`이고 `matrix`에 `market='us', level='required'` 셀이 포함되어 있으면
**When** 매트릭스 표가 렌더링되면
**Then** `us` 행의 셀이 red 강조 스타일로 표시되고 `ref` / `note`가 보인다.

**Given** 백엔드 응답의 `matrix`에 `market='eu', level='conditional'` 셀이 포함되어 있으면
**When** 매트릭스 표가 렌더링되면
**Then** `eu` 행의 셀이 yellow 강조 스타일로 표시되고 `ref` / `note`가 보인다.

**Given** 백엔드 응답의 `matrix`에 `market='kr', level='not-required'` 셀이 포함되어 있으면
**When** 매트릭스 표가 렌더링되면
**Then** `kr` 행의 셀이 neutral(강조 없음) 스타일로 표시된다.

**Given** SignalLight가 렌더링될 때
**When** 컴포넌트가 신호 값을 계산하면
**Then** 백엔드 `signal` 필드를 직접 사용하고 재계산하지 않는다 (코드 검사로 검증 — `calculateSignal` import 없음).

**Evidence:** RTL — 다양한 `signal` 값으로 렌더링 + 스타일/텍스트 단언.

### AC-IMP-UI-08: 결과 페이지 — LLM 분류 (REQ-IMP-UI-008)

**Given** 응답의 `classification={category:'bom', confidence:0.85, reason:'SoC 교체는 BOM 패턴'}`이면
**When** 결과 페이지가 렌더링되면
**Then** category="bom", confidence="85%", reason 텍스트가 표시된다.

**Given** `confidence=0.65`이면
**When** 결과 페이지가 렌더링되면
**Then** "신뢰도 낮음 — RA 검토 권장" 경고 배지가 표시된다.

**Evidence:** RTL — float → 백분율 변환 렌더링 + 임계값 배지 검증.

### AC-IMP-UI-09: 결과 페이지 — 유사 사례 RAG (REQ-IMP-UI-009)

**Given** 응답에 `similarCases=[{id,title,content,similarity}]` 배열이 존재하고 비어 있지 않으면
**When** SimilarCasesCard가 렌더링되면
**Then** 각 사례가 카드로 표시되고 출처 인용 `<sup class="cite" data-src="...">번호</sup>`가 포함된다.

**Given** 응답에 `similarCases=[]`(빈 배열)이면
**When** SimilarCasesCard가 렌더링되면
**Then** "유사 사례가 없습니다" 메시지가 표시된다.

**Given** 응답에 `similarCases` 필드 자체가 undefined이면(low-confidence 분기)
**When** 결과 페이지가 렌더링되면
**Then** 유사 사례 섹션이 렌더링되지 않고 "신뢰도 낮아 유사 사례 조회를 생략했습니다" 안내가 표시된다.

**Evidence:** RTL — `similarCases` undefined / [] / 비어있지 않은 배열 3가지 케이스 렌더링 분기 검증.

### AC-IMP-UI-10: 결과 페이지 — 티켓 CTA 분기 (REQ-IMP-UI-010)

**Given** 응답에 `ticketId='abc-123'`이 존재하면
**When** 결과 페이지가 렌더링되면
**Then** "RA 티켓 #abc-123 생성됨" CTA가 `/inbox/abc-123` 링크로 표시된다.

**Given** `ticketId`가 없고 `recommendation='low-confidence-manual-review'`이면
**When** 결과 페이지가 렌더링되면
**Then** "RA 검토 권장 — RA 큐에 문의하세요" CTA가 `/inbox` 링크로 표시된다.

**Given** `recommendation='high-confidence-auto-approve'`이면
**When** 결과 페이지가 렌더링되면
**Then** 티켓 CTA가 렌더링되지 않는다.

**Evidence:** RTL — `recommendation` 분기별 CTA 렌더링 단언.

### AC-IMP-UI-11: 국제화 및 접근성 (REQ-IMP-UI-011)

**Given** `messages/ko.json`에 `impact.title`, `impact.steps.*`, `impact.categories.*.description` 키가 정의되어 있으면
**When** 한국어 로켈로 위저드가 렌더링되면
**Then** 모든 가시 문자열이 한국어로 표시된다.

**Given** `messages/en.json`에 동일한 키가 정의되어 있으면
**When** 영어 로켈로 렌더링되면
**Then** 모든 문자열이 영어로 표시된다.

**Given** 사용자가 Tab 키로 위저드를 탐색하면
**When** Step이 전환되면
**Then** 첫 번째 입력 요소로 포커스가 이동한다.

**Given** 모든 폼 입력이 렌더링될 때
**When** 접근성 audit을 실행하면
**Then** `aria-label` / `<label>` 연결이 100%이고 WCAG 2.1 AA 색상 대비를 만족한다 (`ci:contrast` 통과).

**Evidence:** RTL — next-intl mock 으로 키 lookup 검증 + axe accessibility audit.

---

## §2 Edge Cases

### Edge Case 1: 빈 productId로 폼 제출 시도

**Given** Step 1의 "다음" 버튼이 비활성화된 상태에서
**When** 사용자가 강제로 폼을 submit하려 하면
**Then** 버튼이 비활성화되어 있어 submit이 발생하지 않는다. API 호출은 일어나지 않는다.

### Edge Case 2: changeDetail 2000자 경계

**Given** 사용자가 정확히 2000자를 입력하면
**When** 길이가 max 경계일 때
**Then** 에러 없이 "다음"이 활성화된다.

**Given** 2001자를 시도하면
**When** 입력 차단이 발동하면
**Then** 2000자에서 멈추고 에러 메시지가 표시된다.

### Edge Case 3: 시장 전체 선택 / 전체 해제

**Given** 5개 시장 모두 선택 후
**When** "전체 해제" 버튼(또는 개별 해제)을 클릭하면
**Then** 선택된 시장이 0개가 되고 "평가 시작"이 다시 비활성화된다.

### Edge Case 4: 403 Forbidden 응답

**Given** 권한이 있는 사용자가 API를 호출했으나 백엔드 `withPermission` 래퍼가 403을 반환하면 (예: 권한 캐시 만료)
**When** mutation이 403을 throw하면
**Then** "권한이 없습니다" 에러가 표시되고 자동 리다이렉트는 발생하지 않는다 (사용자가 새로고침/재로그인 선택).

### Edge Case 4b: confidence=0.80 경계 (RAG 분기 + 표시 배지)

**Given** 백엔드 응답의 `classification.confidence=0.80`이면 (백엔드는 `>= 0.8` 임계값 사용 — `route.ts:92`)
**When** 결과 페이지가 렌더링되면
**Then** (a) `similarCases`가 fetch되어 렌더링되고 (high-confidence 분기), (b) `recommendation='high-confidence-auto-approve'`이며, (c) "신뢰도 낮음" 배지는 미표시된다 (REQ-IMP-UI-008의 `< 0.8` 조건 미충족). 백엔드 임계값이 `>`가 아닌 `>=`임을 확인하는 회귀 방지 케이스.

### Edge Case 5: 백엔드 타임아웃 (non-functional observation)

> v1에는 명시적 타임아웃 UI가 없다. 이 케이스는 automated-test 의무가 아닌 관측 항목이다.

**Given** 백엔드 응답이 20초 이상 소요되면 (parent SPEC NFR 상한)
**When** 사용자가 대기 중일 때
**Then** (관측) 로딩 UI가 계속 표시되고 "뒤로"/"재전송" 버튼이 비활성화를 유지한다. 별도 타임아웃 컴포넌트는 렌더링되지 않는다 — 백엔드가 응답하거나 네트워크 에러가 발생할 때까지 대기한다.

### Edge Case 6: 중복 제출 방지

**Given** 사용자가 "평가 시작"을 클릭한 직후
**When** mutation이 pending 중일 때 다시 클릭을 시도하면
**Then** 버튼이 비활성화되어 있어 중복 API 호출이 발생하지 않는다.

### Edge Case 7: 네트워크 끊김 → "다시 시도"

**Given** 네트워크 오류로 mutation이 실패하면
**When** "다시 시도" 버튼이 표시될 때
**Then** 동일 입력값으로 mutation을 재시도하고 네트워크 복귀 시 성공한다.

### Edge Case 8: low-confidence 응답에서 similarCases undefined 처리

**Given** 백엔드가 `confidence=0.65`로 인해 `similarCases`를 생략한 응답을 반환하면
**When** 결과 페이지가 렌더링될 때
**Then** SimilarCasesCard 컴포넌트가 "유사 사례 조회 생략" 안내를 렌더링하고 빈 카드로 깨지지 않는다.

### Edge Case 9: 키보드 전용 탐색

**Given** 사용자가 마우스 없이 Tab/Enter/Space로만 위저드를 완료하면
**When** 모든 단계를 키보드로 진행하면
**Then** 4단계 입력 + "평가 시작" + 결과 확인까지 완료 가능하다.

### Edge Case 10: 다크 모드 렌더링

**Given** 사용자가 다크 모드를 활성화하면
**When** 위저드가 렌더링되면
**Then** 신호등 색상이 다크 모드에서도 WCAG AA 대비를 유지한다 (`ci:contrast` 통과).

---

## §3 Quality Gate Criteria

### Definition of Done (DoD)

**SPEC-V3-IMPACT-UI-001은 다음 조건을 모두 충족할 때 "완료"로 간주한다:**

1. **기능 완료:**
   - [ ] 11개 AC (AC-IMP-UI-01 ~ AC-IMP-UI-11)가 모두 통과한다
   - [ ] 4단계 위저드 입력 플로우가 동작한다
   - [ ] 결과 페이지(신호등 / 매트릭스 / LLM 분류 / 유사 사례 / 티켓 CTA)가 정상 렌더링된다
   - [ ] 모든 에러 상태(403, 400, 500, 네트워크)가 적절히 처리된다

2. **i18n:**
   - [ ] `messages/ko.json`에 `impact.*` 키가 모두 정의되었다
   - [ ] `messages/en.json`에 동일 키가 정의되었다
   - [ ] 컴포넌트 내 하드코딩 문자열이 없다

3. **접근성:**
   - [ ] 모든 폼 입력이 `<label>` 또는 `aria-label`과 연결된다
   - [ ] 키보드 전용 탐색이 가능하다
   - [ ] `ci:contrast` 게이트가 통과한다 (WCAG 2.1 AA)
   - [ ] 다크 모드에서 색상 대비가 유지된다

4. **성능:**
   - [ ] 초기 렌더링 < 1초
   - [ ] 로딩 UI가 즉시 표시된다
   - [ ] 백엔드 응답 대기 중 중복 제출이 방지된다

5. **비회귀:**
   - [ ] 기존 consult UI 테스트가 전체 통과한다
   - [ ] 신규 파일이 지정된 디렉토리에만 생성되었다 (`components/impact/`, `lib/queries/useImpactCheck.ts`, `app/(app)/impact/`, `messages/*.json`)
   - [ ] 기존 컴포넌트가 수정되지 않았다 (parent SPEC 비회귀)

6. **보안:**
   - [ ] `dangerouslySetInnerHTML` 미사용
   - [ ] `<sup>` 인용의 `data-src` 속성 sanitization
   - [ ] XSS 방지 (React 기본 이스케이핑)

7. **테스트:**
   - [ ] 단위 테스트 커버리지 85% 이상 (`components/impact/__tests__/`)
   - [ ] 10개 edge case 시나리오 테스트 포함
   - [ ] 백엔드 200/400/403/500/네트워크 에러 분기 테스트 포함

### 테스트 전략

**단위 테스트 (Unit Tests, Vitest + RTL):**
- `components/impact/__tests__/ImpactWizard.test.tsx` — 단계 전환/상태
- `components/impact/__tests__/Step1Product.test.tsx` — productId 입력 검증
- `components/impact/__tests__/Step2Category.test.tsx` — 7 카테고리 선택
- `components/impact/__tests__/Step3Detail.test.tsx` — 10..2000자 검증
- `components/impact/__tests__/Step4Markets.test.tsx` — 시장 다중 선택
- `components/impact/__tests__/ImpactResult.test.tsx` — 결과 렌더링
- `components/impact/__tests__/SignalLight.test.tsx` — 신호등 표시
- `components/impact/__tests__/SimilarCasesCard.test.tsx` — undefined/[]/비어있지 않음 분기
- `lib/queries/__tests__/useImpactCheck.test.ts` — mutation hook

**Mock 패턴** (`components/consult/__tests__` 직검 기반):
- `vi.mock('next-intl')` — `useTranslations`
- `vi.mock('@/lib/queries/useImpactCheck')` — mutation 상태별 반환값
- `vi.mock('next/navigation')` — `useRouter`
- `vi.mock('@/lib/auth')` — 역할별 `auth()` 반환

**접근성 테스트:**
- `axe` 라이브러리로 자동 audit (consult 패턴 준용)
- 키보드 탐색 RTL 시뮬레이션

---

**생성일:** 2026-07-06
**버전:** 0.2.0
**상태:** planned
**총 AC 개수:** 11개 (서브 케이스 확장 — AC-IMP-UI-07에 conditional/not-required 추가)
**총 Edge Cases:** 11개 (Edge Case 4b confidence=0.80 경계 추가)
