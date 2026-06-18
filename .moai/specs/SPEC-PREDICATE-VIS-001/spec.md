# SPEC-PREDICATE-VIS-001: Predicate 비교 분석 시각화 개선

## 상태

| 항목 | 값 |
|---|---|
| Issue | #185 |
| PR | #186 |
| Branch | `feat/issue-185-predicate-visualization` |
| Base | `main` |
| 상태 | Review fix + docs update |
| 관련 상위 SPEC | `SPEC-REGULA-PREDICATE-001` |

## 목표

Predicate 비교 분석 결과를 테이블 중심 UI에서 인터랙티브 분석 UI로 확장하여 기술 투자자, 고객, RA Lead가 subject device와 predicate device의 차이를 빠르게 이해하도록 한다.

## 배경

Wave 3 `SPEC-REGULA-PREDICATE-001`은 openFDA 검색, 5-dimension 비교표, 승인, PDF/DOCX export를 구현했다. 그러나 실사용자 E2E 검증에서는 Predicate 비교 분석이 텍스트 기반으로만 제공되어 데모와 기술적 평가 상황에서 직관성이 부족하다는 개선 사항이 남았다.

이 SPEC은 기존 `ComparisonTable` 승인 경로를 제거하지 않고, `/predicate/compare` 결과 영역에 visualization-first layer를 추가한다.

## 범위

### In Scope

- `/predicate/compare` 결과 화면에서 visualization/table 전환
- Recharts 기반 bar chart, radar chart, table view
- Before-After 비교 모드
- 필수/선택 dimension의 실제 chart 색상 구분
- Demo Mode animation
- Dimension 상세 panel
- lint/typecheck gate 통과
- session memo history 보존

### Out of Scope

- Predicate 검색 알고리즘 변경
- openFDA API, cache, export API 변경
- 비교 승인 데이터 모델 변경
- 실제 clinical/statistical equivalence 판단 자동화

## 요구사항

### REQ-VIS-001: 인터랙티브 시각화

**EARS:** WHEN a predicate comparison exists, THEN the system SHALL render an interactive visualization view in `/predicate/compare` without removing the existing approval table path.

구현:

- `components/predicate/PredicateVisualization.tsx` 신규 컴포넌트
- Compare page에서 `Show Interactive Visualization` 토글 제공
- Bar Chart, Radar Chart, Table View 모드 제공
- Tooltip에 dimension status와 series value 표시
- Table View에서 dimension button 클릭 시 상세 panel 표시

검증:

- `tests/unit/components/predicate/PredicateComparePage.test.tsx` 통과
- `pnpm typecheck` 통과

### REQ-VIS-002: Before-After 비교 모드

**EARS:** WHEN the user enables Before-After Mode in the visualization, THEN the chart SHALL compare subject device dimension values against the first selected predicate dimension values.

구현:

- `beforeAfterMode` state 추가
- subject text length와 first predicate text length를 dimension별 proxy metric으로 chart 구성
- required/optional dimension별 fill token 유지

검증:

- `pnpm lint`와 `pnpm typecheck` 통과

### REQ-VIS-003: 필수 문서 vs 선택 문서 시각적 구분

**EARS:** WHEN a dimension is optional, THEN predicate bars for that dimension SHALL use the optional document color instead of always using the required document color.

구현:

- `isRequiredDimension(index)` 기준: 첫 3개 dimension required, 나머지 optional
- `Bar` 내부 `Cell`을 row별로 렌더링해 optional row를 `var(--color-ink-400)`로 표시
- legend와 실제 chart 색상 일치
- raw hex 금지 규칙에 맞춰 design token CSS variable 사용

검증:

- `pnpm lint` 통과
- `scripts/no-hex-colors.mjs` 통과

### REQ-VIS-004: 데모 모드 애니메이션

**EARS:** WHEN Demo Mode is enabled, THEN animation phase SHALL affect actual Bar/Radar rendering, not only surrounding banner or shadow styling.

구현:

- `animationPhase` state를 0/1/2 순환
- `animationKey`, `animationDuration`, `animationBegin`을 Bar/Radar에 연결
- Radar opacity가 demo phase에 따라 변하도록 설정

검증:

- 리뷰 코멘트 P2 반영
- `pnpm lint`, `pnpm typecheck` 통과

### REQ-VIS-005: 접근성과 lint gate

**EARS:** WHEN the visualization component is submitted to CI, THEN it SHALL pass lint without explicit `any`, raw hex colors, mouse-only table row interaction, or accumulator spread warnings.

구현:

- `ChartRow`, `BeforeAfterRow`, `RadarRow`, `PredicateMetricKey` 타입 추가
- Recharts `TooltipProps<number, string>` 사용
- `Record<string, any>`와 tooltip `any` 제거
- reduce accumulator spread 제거
- mouse-only row click 제거, dimension button 사용
- `var(--color-brand-500)`, `var(--color-ink-400)`, `var(--color-success)` 사용

검증:

- `pnpm lint` 통과
- `pnpm typecheck` 통과
- `git diff --check` 통과

### REQ-VIS-006: session memo 보존

**EARS:** WHEN this branch records session state, THEN it SHALL append current PR state without deleting previous session memo history.

구현:

- `.moai/state/session-memo.md` 기존 PR #174, #184, #177 기록 복원
- PR #186 branch, issue, work gate, verification 기록 append

검증:

- `git diff .moai/state/session-memo.md`에서 기존 기록 삭제 없이 append만 발생

## 구현 파일

| 파일 | 변경 |
|---|---|
| `app/(app)/predicate/compare/page.tsx` | visualization/table 토글과 `PredicateVisualization` 진입점 |
| `components/predicate/PredicateVisualization.tsx` | interactive visualization 구현 |
| `package.json` / `pnpm-lock.yaml` | Recharts dependency update |
| `.moai/state/session-memo.md` | Issue #18 work gate 및 PR #186 상태 기록 |
| `README.md` | Predicate Visualization addendum 문서화 |
| `docs/implementation-status.md` | active PR #186 상태와 branch 점검 결과 기록 |
| `docs/e2e-user-validation-report.md` | high-priority improvement 상태 갱신 |

## 성공 기준

- [x] 인터랙티브 시각화 완성
- [x] Before-After 비교 모드 작동
- [x] 필수/선택 문서 시각적 구분 완료
- [x] Demo Mode animation phase가 실제 chart/radar 렌더링에 연결
- [x] lint gate 통과
- [x] typecheck 통과
- [x] predicate 관련 unit tests 통과
- [x] session memo history 보존

## 검증 결과

| Command | Result |
|---|---|
| `pnpm lint` | pass |
| `pnpm typecheck` | pass |
| `pnpm exec vitest run tests/unit/components/predicate/PredicateComparePage.test.tsx tests/unit/predicate-schema.test.ts tests/unit/predicate-rbac.test.ts` | 45 tests pass |
| `git diff --check` | pass |

## Branch 점검 기록

2026-06-18 KST 기준:

- `gh pr list --state open`: PR #186만 open
- `git branch -r`: `origin/main`, `origin/feat/issue-185-predicate-visualization`만 확인
- `gh issue view 18`: duplicate-work prevention rule 재확인
- current branch: `feat/issue-185-predicate-visualization`
- local `main`: `origin/main`보다 1 commit ahead, compare-page visualization toggle duplicate commit 포함. 이번 PR branch에 동일 기능이 이미 있으므로 main은 push/merge하지 않음

## 참고

- Issue: #185
- PR: #186
- Related SPEC: `SPEC-REGULA-PREDICATE-001`
- Existing compare path: `app/(app)/predicate/compare/page.tsx`
