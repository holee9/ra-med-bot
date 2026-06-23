# Session Memo

> 세션 연결용. 상세 작업 맥락은 auto-memory `project-state.md`(~/.claude/projects/.../memory/)가 1차 진실원 — 항상 로드됨. 본 파일은 빠른 시작 요약.

## 현재 세션 (2026-06-23) — PR #237 knowledge-gap 리뷰 픽스

- Duplicate-work prevention: GitHub Issue #18 확인 완료. `origin/main` fetch 완료. 현재 브랜치 `feat/issue-59-classify`, 열린 PR #237 (`feat(classify): SPEC-REGULA-CLASSIFY-001 (#59)`).
- Review fix scope: PR #237에 포함된 knowledge-gap 공통 코드 P2 3건 수정 — missing org scope fail-closed, digest dispatch result 기반 audit, replay consult side-effect suppression.
- Verification target: `tests/unit/knowledge-gap-queue-query.test.ts`, `tests/unit/knowledge-gap-consult-hook.test.ts`, `tests/integration/knowledge-gap.test.ts`, `tests/integration/knowledge-gap-replay-real.test.ts`, `tests/unit/knowledge-gap-phase23.test.ts`.

## 현재 세션 (2026-06-23) — PR #234 리뷰 픽스

- Duplicate-work prevention: GitHub Issue #18 확인 완료. 동일 작업은 현재 브랜치 `feat/issue-35-knowledge-gap` / PR #234 / Issue #35 범위로 진행 중이며, 새 브랜치 생성 없음.
- Main state: `origin/main` fetch 완료. PR #234는 stacked PR로 base `docs/specs-regula-2026-06-22` (#233), head `feat/issue-35-knowledge-gap`.
- Review fix scope: `consult()` 지식 갭 캡처가 `messages` FK 생성 전 `unanswered_queue`를 insert하던 순서 수정, `captureKnowledgeGap()` 이후 clustering + GitHub issue create/append wiring 복구.
- Verification target: 신규 회귀 테스트 `tests/unit/knowledge-gap-capture-automation.test.ts`, 기존 consult hook/order test, knowledge-gap integration/phase23 tests.

## 현재 세션 (2026-06-23) — tier0 KNOWLEDGE-GAP-001 (#35) 구현 + sync + 보안 수정

**브랜치: `feat/issue-35-knowledge-gap`** (stacked on `docs/specs-regula-2026-06-22` = PR #233). 커밋 6개(`56f9054`→`b10a9e2`). 작업 트리 clean.

### 무엇을 했나
1. **우선순위 분석**: 신규 26개 SPEC `priority`×`depends_on` 교차 → READY 17 / BLOCKED 9 + 촉매 그래프. tier0 1순위 = KNOWLEDGE-GAP-001 #35(해금 3, delta-sync #45 머지됨).
2. **구현 (Phase 0-5, DDD)**: migration 0066(enum 3종·`unanswered_queue`·RLS), 4-condition 감지, redaction+hash, GitHub issue 자동화(cosine clustering), classify API/UI, Inngest 일일 digest(08:00), gap-replay 폐쇄 루프.
3. **`/moai sync` 사이클**: 문서 6개 동기화(`b10a9e2`) + **보안 리뷰(expert-security)가 머지 차단 결함 포착·수정(`e081435`)**.

### 보안 수정 (sync Phase 0.55) — ★반드시 기억
- **C1 CRITICAL**: `replayGapTest` 런타임 깨짐(비-UUID 합성 id → `consult()` persist FK 위반 → markGapResolved 도달 불가). 통합테스트가 `consult()` mock해 놓침 → `consult()` 비지속 `mode:'replay'` 추가 + real-replay regression 테스트(pre-fix FAIL 검증).
- **H1/H2**: classify/replay 라우트 + markGapResolved 크로스-org IDOR → `org_id` 소유권 검증(타 org 404); delta-sync org 미확정 시 skip.
- **M1**: `knowledge_gap_resolved` audit을 resolve 성공 후 이동. **M2**: apiBase `https://` 강제.
- **★교훈**: mock 중심 통합테스트는 외부 파이프라인 재실행 경로의 런타임 결함을 놓침 → replay/재실행 경로는 실제 파이프라인을 호출하는 regression test 병행 필수.

### 상태
- 전체 스위트 **3165 passed | 7 skipped** · typecheck/biome/`next build` PASS.
- **PR #234** OPEN (stacked on #233). `Fixes #35`. #35 이슈 코멘트(시작/완료) + PR sync 코멘트 완료.
- 환경변수(선택): `KNOWLEDGE_GAP_GITHUB_{TOKEN,REPO}`, `SENDGRID_API_KEY` — `.env.example` 추가. 미설정 시 no-op.

## 🎯 다음 세션 시작 지점

### 옵션 A — tier1 착수 (권장: 단일 세션 구현 가능성 높은 순)
1. **CLASSIFY #59** — 의료기기 분류 마법사(FDA/EU/MFDS/NMPA/PMDA). 해금 2(STANDARDS#62·REIMBURSEMENT#70). deps 3/3 충족. spec.md만 존재(draft).
2. **PMS #53** — EU MDR PMS 보고서·PMCF. 해금 2(CAPA#68·CLINICAL-INVESTIGATION#69). deps 5/5.
3. **TRACEABILITY #47** — 해금 1(LABELING#66). deps 2/2, 최저 복잡도(빠른 승리).
4. **CHANGE-CONTROL #54**(Medium) — 해금 2(CAPA#68·LABELING#66).

**tier1 착수 절차 (L-001 + 이번 세션 패턴)**:
- `feat/issue-{N}` 브랜치 → 이슈 코멘트 "작업 시작" → manager-ddd ANALYZE(tasks.md/design.md; 26개 신규 SPEC은 전부 spec.md 단일이라 구현계획 선행 필수)
- phase별 구현(regula-backend/frontend) + **매 phase 게이트 직검**(typecheck+test+count 단언)
- ★**구현 완료 후 `/moai sync` Phase 0.55 expert-security 리뷰 필수** (이번 C1 교훈: mock 테스트 통과해도 런타임 결함 가능)
- `Fixes #{N}` PR

### 옵션 B — PR #233/#234 머지 (사용자 주도)
- #233(26 SPEC) 머지 → #234 base 자동 갱신 → #234 머지 → #35 자동 close.
- 머지 후: README/implementation-status "pending merge" → "merged"로 갱신.

### hybrid-ra-saas 연동 — 사실상 완료, Vercel 프로덕션 env 미확정 (2026-06-23 정정)
- ✅ 백엔드 배포됨(Azure Container Apps `api-prod`, /health 200), 코드 양측 완료, UI 연동 #168/#169/#171 · #199/#200/#201 CLOSED.
- ⚠️ **Vercel 프로덕션 환경변수 3개 실제 등록 미확정**: #191 클로저 코멘트는 "로컬 `.env.local` 업데이트"로만 마무리 → 후속 이슈(#202 등)가 이를 "Vercel 완료"로 재해석(기록 모순). 코드 `optional + ?? ''` fallback이라 미등록 시 silent degradation(에러 없이 hybrid 비활성). 확인 필요(Vercel 대시보드 Settings→Env 또는 `vercel env ls`).
- ⏸️ #202(유일 OPEN) E2E: Vercel env 확인 후 착수 전제. 기록 모순 정정 코멘트 #202에 등록.

## 이전 세션 히스토리 (상세는 git log + project-state.md)
- 2026-06-22: 26개 SPEC-REGULA 일괄 작성 (PR #233, OPEN).
- 2026-06-21: 백엔드 tech debt 3종(#214/#215/#216 → PR #220/#221/#222), QA Gate 0~5 Active 통일(#217/#218), PERSONAL-LIB #86·CALENDAR #44 머지, Delta-Sync #45 머지.
- 2026-06-20: EXPORT-HUB·ESIG·AUDITOR-VIEW 완료, QA Gate 5종 구현.
