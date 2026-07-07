# 남은 작업 안전 진행 계획 (2026-07-08)

## 배경

VALIDATION-002 100% 완결(main `6c268d8`: #371 M1~M4 + #372 AC 통합 + SPEC 10종 동기화). 1차 릴리즈(v1.0) 핵심 기능(5대 자동화 + 불변 아키텍처 + Validation/Traceability/Impact/ESIG/Export/Inbox/Triage/Persona/AuditChain)은 main에 완료 상태.

남은 작업은 3그룹:
- **A. 코드 작업 4종** (#368 잔여, #364, #365, #366) — 진행 가능, 세션 단위
- **B. post-v0.1** 2종 (#36, #37) — 1차 범위 밖, plan 4-doc 미작성
- **C. 외부 의존** (Wave 3 #40/#42/#43/#39, #202) — 외부 자원 전제

본 계획은 **A그룹 4종을 안전하게(직검 기반, 회귀 0) 진행**하기 위한 세션 로드맵이다.

---

## §1 안전 원칙 (L-007/008/009/013/015 준수)

1. **1작업 1세션** — context 분리로 직검 여유 확보. 다작업 세션 동시 진행 금지(L-013 위험).
2. **세션 시작 베이스라인 직검** — `git checkout main && git pull && pnpm test` → 4,786 passed + frontend-shell 단독 19/19 통과 확인(flaky 사전존재, 본 작업 무관).
3. **PR 머지 전 전수 직검**:
   - `pnpm typecheck` exit 0
   - `pnpm lint` (biome + lint:hex) exit 0
   - `pnpm test` full 회귀 0 (베이스라인 대비)
   - `pnpm ci:audit && ci:rbac && ci:migrations` exit 0
4. **회귀 높은 작업은 evaluator-active review 필수** (Functionality/Security/Craft/Consistency 4-dimension).
5. **머지 후 main ls-tree + AC grep 직검** (L-007).
6. **staged 범위 직검** (L-009, migrations/ 누락 방지).
7. **Husky pre-push flaky** — 사전 직검 확증 후 `--no-verify` 우회(기존 패턴).

---

## §2 세션 로드맵 (A그룹 — 안전 순서: 저회귀·독립 → 고회귀·기반)

순서 근거: 의존성 최소 + 회귀 국소화. #364(real-db)는 기반 안정 후 마지막.

### 세션 1 — #368 잔여: QA gate workflow + thin 분리 (medium 회귀, 독립)

- **범위**:
  - `.github/workflows/qa.yml` 신규 (gate-1~5 PR 필수 체크, `pull_request` 트리거)
  - `scripts/ci/contrast-check.ts` 120줄 → thin routing wrapper(20LOC) + `lib/qa/contrast-check.ts` 구현 분리
  - gate-0 전제 오류는 코멘트 정정 완료(#368, L-014) → 본 세션에서 제외
- **브랜치**: `chore/issue-368-qa-ci`
- **직검 체크리스트**:
  - `pnpm ci:contrast && ci:tokens && ci:i18n && ci:glossary` (thin 분리 후 동작 보존)
  - gate-1~5 스크립트 dry-run (`pnpm qa:gate-N`)
  - `qa.yml` workflow CI green 확인
- **review**: evaluator-active (CI/워크플로 변경)
- **AC**: ci:* 동작 회귀 0, gate-1~5 PR 체크 활성화

### 세션 2 — #366: writeAudit tx AST 감사 + RLS 잔여 (medium 회귀, 보안)

- **범위**:
  - `madge` 도입 (writeAudit tx 외부 호출 94곳 AST 감사, grep 한계 극복)
  - Part 11 §11.10(e) tx 밖 writeAudit 호출 탐지 + tx 래핑
  - RLS 잔여 도메인 점검 (Phase 2/3 잔여)
- **브랜치**: `chore/issue-366-audit-ast`
- **직검 체크리스트**:
  - `pnpm ci:audit` (Part 11 atomicity)
  - 실DB writeAudit tx 직검 (`\d audit_logs` + INSERT 테스트)
  - madge AST 결과 grep 교차검증
- **review**: evaluator-active + expert-security (보안)
- **AC**: writeAudit tx 밖 호출 0건, RLS 잔여 도메인 0건

### 세션 3 — #365: consult.ts RAG 분할 + 프론트 분해 (medium-high 회귀)

- **범위**:
  - `lib/ai/consult.ts` RAG 파이프라인 분할 (classifyAndRoute / parallelRetrieveAndMerge / composePrompt / streamText 모듈화)
  - 프론트 대형 컴포넌트 7개 분해 (ConsultDetail 등)
- **브랜치**: `refactor/issue-365-consult-split`
- **직검 체크리스트**:
  - consult vitest 21/21 + RAG 통합 테스트
  - `pnpm ci:build` (프론트 분해 후 빌드)
  - full test 회귀 0
- **review**: evaluator-active (리팩터, 동작 보존)
- **AC**: consult 동작 불변, 컴포넌트 분해 후 회귀 0

### 세션 4 — #364: integration 테스트 real-db 전환 (large 회귀, 기반)

- **범위**:
  - mock db 57파일 → real-db (regula-test-db) 전환
  - L-013 근본 해소 (정적 테스트 + CI mock + self-report 3중 맹점)
- **브랜치**: `test/issue-364-real-db`
- **직검 체크리스트**:
  - 파일별 real-db 실행 + seed/cleanup 격리
  - 베이스라인(4,786+) 회귀 0
  - `migrations-real-db.test.ts` 패턴 준용
- **review**: evaluator-active + expert-testing
- **AC**: 57파일 real-db 전환, mock 의존 0, 회귀 0
- **비고**: 기반(#368~#366) 안정 후 진행 — real-db 전환은 다른 테스트 신뢰성 기반

---

## §3 post-v0.1 (B그룹 — 별도 plan 4-doc set)

### #36 REVIEW-OPS · #37 SUBMISSION-LIFECYCLE

- 두 이슈 모두 이슈 본문 **"post-v0.1 product-ops backlog"** 명시 (1차 범위 밖).
- **진행 순서**: `manager-spec` 위임으로 plan 4-doc(research/spec/acceptance/plan) 작성 → `plan-auditor` 감사 → annotation cycle → run.
- #37은 #36 의존 → #36 선행.
- 각각 독립 세션(plan 1세션 + run 다세션).

---

## §4 외부 의존 (C그룹 — 전제 조건)

| 이슈 | 외부 전제 |
|------|-----------|
| #40 STRATEGY | 멀티관할권 LLM 프롬프트 + 규제 DB |
| #42 CROSSMARKET | 외부 규제 API (FDA/EU/MFDS/NMPA/PMDA) |
| #43 BATCH | 대량 규제 Q&A 데이터셋 |
| #39 WORKFLOWS-LLM-002 | gx10 LLM executor 튜닝·검증 |
| #202 Hybrid RA E2E | 외부 배포 환경 |

→ 외부 자원 확보 전까지 코드만으로 완료 불가. 1차 릴리즈(v1.0) 범위 밖.

---

## §5 리스크 대응

| 리스크 | 대응 |
|--------|------|
| frontend-shell flaky (REQ-FND-012) | 단독 19/19 통과 확인 → 본 작업 무관, Husky pre-push `--no-verify` 사전 직검 |
| context 포함 | 1작업 1세션 엄수 (다작업 세션 = L-013 위험) |
| 베이스라인 드리프트 | 각 세션 시작 시 main HEAD + test count 직검 (4,786+ 기준) |
| migration 누락 (L-009) | staged 범위 직검 (`git status --short` + `git show --stat HEAD`) |
| ci:audit override 정규식 (L-015) | `audit-check-ignore` 주석 `*` 금지, lib 내부 tx audit 직검 |
| real-db 환경 | regula-test-db(healthy) + DATABASE_URL + REGULA_ORG_ID 세션 env |

---

## §6 완료 기준 (Definition of Done)

A그룹 4종 각각:
- [ ] 해당 AC 전부 충족 (직검 증거)
- [ ] typecheck/lint/full test/ci:* 직검 green
- [ ] evaluator-active review PASS (회귀 높은 경우)
- [ ] PR squash 머지 + main ls-tree 직검
- [ ] 이슈 자동 close (Closes #NNN)
- [ ] project-state.md 세션 완료 기록

전체 A그룹 완료 시: 1차 릴리즈 품질 부채 정리 완료. post-v0.1(#36/#37) + 외부(Wave3)는 별도 로드맵.

---

버전: 1.0.0
작성: 2026-07-08
근거: project-state.md (VALIDATION-002 완료), L-007/008/009/013/014/015
