---
runbook_id: RELEASE-RC1
version: 2.0.0
created: 2026-05-05
updated: 2026-05-05
owner: drake.lee
meta_issue: "#101"
status: active
---

# Regula 1차 RC v1.0.0-rc 실행 콘티 (Runbook v2.0)

> 본 문서는 Regula 1차 RC 출시까지의 **싱글-병렬-싱글 5단계 실행 콘티**다.
> 운영 원칙은 단순하다: **싱글 사전 작업 → 3-터미널 개별 병렬 작업 → 싱글 마무리**.
> 복잡한 통합 자동화 스크립트는 폐기되었고, 사용자가 각 단계를 명시적으로 가동한다.

---

## 0. 메타

- **메타 Issue**: [#101](https://github.com/drake-lee/ra-med-bot/issues/101) — Release RC1 Tracker
- **자동화** (3개만 유지, 그 외 자동화 스크립트는 폐기):
  - `runbook-sync` (GitHub Actions) — PR 머지 시 본 문서 체크박스 자동 체크
  - `wave-progress-tracker` (GitHub Actions) — Issue #101 진행률 코멘트 자동 갱신
  - `wave-b-trigger` (GitHub Actions) — T1+T2+T3 머지 완료 시 T4 진입 게이트 알림
- **운영 원칙**:
  - 싱글 사전 → 3-터미널 병렬 → 싱글 마무리의 단순 5-Stage 흐름
  - 사용자 개입 총 10회 (§10 Cheatsheet 참조)
  - File ownership 0% 충돌 보장 (§7 매트릭스)
  - 모든 작업 결과는 Issue #101에 코멘트로 동기화
  - Time estimate 사용 금지 — Priority(P0/P1) + Phase ordering(Stage 1~5) only

---

## 1. 작업 분류 매트릭스

| 단계 | 작업 | 모드 | 위치 |
|---|---|---|---|
| Stage 1 | worktree 3개 생성 | 싱글 | 메인 repo |
| Stage 1 | DB 마이그레이션 + corpus seed | 싱글 | 메인 repo (1회) |
| Stage 1 | Playwright 브라우저 설치 | 싱글 | 메인 repo (1회) |
| Stage 2 | T1/T2/T3 SPEC 실행 | 병렬 | 각 worktree (3개 터미널) |
| Stage 3 | T1/T2/T3 PR 머지 | 싱글 | GitHub |
| Stage 4 | T4 (Wave B) SPEC 실행 | 싱글 | worktree T4 |
| Stage 5 | RC 태깅 / 릴리즈 | 싱글 | GitHub |

---

## 2. Stage 1 — 싱글 사전 작업 (메인 repo, 1회)

목적: 3-터미널 병렬 작업에 필요한 worktree와 공유 인프라(DB, Playwright)를 메인 repo에서 1회 준비한다.

전제 조건:
- `moai` CLI 설치됨 (`which moai` 확인)
- `pnpm` 설치됨 (`pnpm --version` 확인)
- Docker가 실행 중이거나 외부 PostgreSQL 접속 가능

명령 박스 (메인 repo 루트에서 실행):

```bash
# 1) worktree 3개 생성 (~/.moai/worktrees/ra-med-bot/SPEC-REGULA-XXX-001/)
moai worktree new SPEC-REGULA-QUALITY-001
moai worktree new SPEC-REGULA-DEPLOY-001
moai worktree new SPEC-REGULA-E2EFIX-001

# 2) .env.local 준비 (없을 경우)
cp .env.example .env.local
# .env.local 에 DATABASE_URL, ANTHROPIC_API_KEY 등 실제 값 입력

# 3) DB 스키마 마이그레이션 (DATABASE_URL이 .env.local에 설정된 후)
pnpm db:migrate

# 4) Playwright 브라우저 설치 (1회만 필요)
pnpm exec playwright install chromium firefox
```

검증:

```bash
moai worktree list                # 3개 worktree 노출 확인
pnpm typecheck                    # 타입 에러 없음 확인
```

worktree 표준 경로:

- T1: `~/.moai/worktrees/ra-med-bot/SPEC-REGULA-QUALITY-001/`
- T2: `~/.moai/worktrees/ra-med-bot/SPEC-REGULA-DEPLOY-001/`
- T3: `~/.moai/worktrees/ra-med-bot/SPEC-REGULA-E2EFIX-001/`

---

## 3. Stage 2 — 3-터미널 개별 병렬 작업

각 터미널은 자기 worktree에서 **독립적으로** 작업한다. 메인 repo로 돌아갈 일은 없다. 작업 순서는 의존성이 없으므로 동시 가동 가능하다.

### 3.1 T1 카드 — SPEC-REGULA-QUALITY-001 (QUALITY-AMEND, P0, solo 모드)

목적: 품질 게이트 보강 (REQ-QUAL-026/027/028) 및 CI 재안정화.

| 필드 | 값 |
|---|---|
| **worktree path** | `~/.moai/worktrees/ra-med-bot/SPEC-REGULA-QUALITY-001/` |
| **branch** | `feat/spec-regula-quality-001` |
| **GitHub Issue** | [#99](https://github.com/drake-lee/ra-med-bot/issues/99) |
| **모드** | solo (`/moai run` — `--team` 없음) |
| **우선순위** | P0 (1순위 머지) |
| **재개 여부** | `--resume` (기존 진행 상태 이어가기) |

동반 자료 (worktree 내부에서 자동 동기화됨):
- `.moai/specs/SPEC-REGULA-QUALITY-001/spec.md`
- `.moai/specs/SPEC-REGULA-QUALITY-001/plan.md`
- `.moai/specs/SPEC-REGULA-QUALITY-001/acceptance.md`
- `.moai/specs/SPEC-REGULA-QUALITY-001/traceability-matrix.md`

명령 박스 (터미널 1):

```bash
cd ~/.moai/worktrees/ra-med-bot/SPEC-REGULA-QUALITY-001
pnpm install
claude
# Claude 세션 안에서:
/moai run SPEC-REGULA-QUALITY-001 --resume
```

파일 소유권 (T1 전용, 다른 터미널이 건드리지 않음):
- `.github/workflows/qa-coverage.yml`
- `.github/workflows/quality-gate.yml`
- `scripts/qa/coverage-report.ts`
- `tests/unit/quality/**`
- `.moai/specs/SPEC-REGULA-QUALITY-001/**`

검증 기준:
- CI green (qa-coverage.yml, quality-gate.yml 둘 다 PASS)
- REQ-QUAL-026, REQ-QUAL-027, REQ-QUAL-028 acceptance 통과
- coverage threshold ≥ 85% 충족

agent 행동 규약 (§8 [HARD] 참조):
- 시작 시 Issue #101에 `[T1] starting QUALITY-AMEND` 코멘트
- PR 본문은 `./scripts/release-rc1/pr-body-template.sh T1` 출력 사용
- 단계 완료 시 Issue #101에 진행 코멘트
- 블로커 발생 시 Issue #101에 `[T1] BLOCKER: ...` 코멘트

### 3.2 T2 카드 — SPEC-REGULA-DEPLOY-001 (DEPLOY-001, P1, solo 모드)

목적: 프로덕션 배포 자동화 파이프라인 구축.

| 필드 | 값 |
|---|---|
| **worktree path** | `~/.moai/worktrees/ra-med-bot/SPEC-REGULA-DEPLOY-001/` |
| **branch** | `feat/spec-regula-deploy-001` |
| **GitHub Issue** | [#98](https://github.com/drake-lee/ra-med-bot/issues/98) |
| **모드** | solo (`/moai run` — `--team` 없음) |
| **우선순위** | P1 (T1과 무관, 병렬 머지 가능) |

동반 자료:
- `.moai/specs/SPEC-REGULA-DEPLOY-001/spec.md`
- `.moai/specs/SPEC-REGULA-DEPLOY-001/plan.md`
- `.moai/specs/SPEC-REGULA-DEPLOY-001/acceptance.md`

명령 박스 (터미널 2):

```bash
cd ~/.moai/worktrees/ra-med-bot/SPEC-REGULA-DEPLOY-001
pnpm install
claude
# Claude 세션 안에서:
/moai run SPEC-REGULA-DEPLOY-001
```

파일 소유권 (T2 전용):
- `.github/workflows/deploy-production.yml`
- `.github/workflows/deploy-preview.yml`
- `infra/**`
- `scripts/deploy/**`
- `Dockerfile.production`
- `.moai/specs/SPEC-REGULA-DEPLOY-001/**`

검증 기준:
- 배포 워크플로우 dry-run PASS
- DEPLOY acceptance.md 모든 항목 PASS
- preview 환경 헬스체크 200 OK

agent 행동 규약: §8 동일 (Issue #101 코멘트, PR 템플릿 사용).

### 3.3 T3 카드 — SPEC-REGULA-E2EFIX-001 (E2EFIX-001, P0, team 모드)

목적: E2E 테스트 안정화 및 fixture 정리.

| 필드 | 값 |
|---|---|
| **worktree path** | `~/.moai/worktrees/ra-med-bot/SPEC-REGULA-E2EFIX-001/` |
| **branch** | `feat/spec-regula-e2efix-001` |
| **GitHub Issue** | [#97](https://github.com/drake-lee/ra-med-bot/issues/97) |
| **모드** | team (`claude --team` + `/moai run ... --team`) |
| **우선순위** | P0 (T1과 동등, 단 T1 머지 후 rebase 필수) |

동반 자료:
- `.moai/specs/SPEC-REGULA-E2EFIX-001/spec.md`
- `.moai/specs/SPEC-REGULA-E2EFIX-001/plan.md`
- `.moai/specs/SPEC-REGULA-E2EFIX-001/acceptance.md`

명령 박스 (터미널 3):

```bash
cd ~/.moai/worktrees/ra-med-bot/SPEC-REGULA-E2EFIX-001
pnpm install
claude --team
# Claude 세션 안에서:
/moai run SPEC-REGULA-E2EFIX-001 --team
```

T1 머지 후 rebase 절차 (T3 worktree에서 1회 실행):

```bash
git pull --rebase origin main
# 충돌 발생 시 §9 트러블슈팅 항목 참고
```

파일 소유권 (T3 전용):
- `tests/e2e/**` (단, `tests/e2e/observability-integration.spec.ts`는 T4 소유)
- `tests/fixtures/auth.ts`
- `playwright.config.ts`
- `.moai/specs/SPEC-REGULA-E2EFIX-001/**`

검증 기준:
- Playwright e2e 전체 PASS (chromium + firefox)
- E2EFIX acceptance.md 모든 시나리오 PASS
- T1 머지 후 rebase 정상 완료

agent 행동 규약: §8 동일 + T1 머지 직후 rebase 절차 자동 실행.

---

## 4. Stage 3 — PR 머지 게이트 (사용자, 싱글)

머지 순서 [HARD]:

```
1. T1 PR (#99) 리뷰 → main 머지       (1순위, 다른 PR보다 먼저)
2. T2 PR (#98) 리뷰 → main 머지       (T1과 무관, 병렬)
3. T3 PR (#97) 리뷰 → main 머지       (T1 머지 후 worktree에서 rebase 후)
```

T3 rebase 절차:

T1 머지가 끝나면 T3 worktree에서 다음 1줄 실행:

```bash
git pull --rebase origin main
```

충돌 발생 가능 위치 (예측):
- `tests/fixtures/auth.ts` — T1과 T3가 동일 파일 일부 수정 가능 시. §9 참고.

자동화:
- `runbook-sync.yml` 워크플로우가 PR 머지 시 본 문서의 체크박스를 자동 체크
- `wave-progress-tracker.yml` 워크플로우가 Issue #101에 진행률 코멘트를 자동 갱신
- T1+T2+T3 모두 머지 완료 시 `wave-b-trigger.yml`이 Issue #101에 Wave B 진입 가능 코멘트 자동 게시

---

## 5. Stage 4 — Wave B (T4 OBS-AMEND, 싱글)

목적: 관측성(observability) 보강 및 Langfuse 통합 검증.

| 필드 | 값 |
|---|---|
| **SPEC** | SPEC-REGULA-ENTERPRISE-001 |
| **worktree path** | `~/.moai/worktrees/ra-med-bot/SPEC-REGULA-ENTERPRISE-001/` |
| **branch** | `feat/spec-regula-enterprise-001` |
| **GitHub Issue** | [#100](https://github.com/drake-lee/ra-med-bot/issues/100) |
| **모드** | team (`claude --team` + `/moai run ... --team`) |
| **진입 조건** | T1+T2+T3 모두 머지 완료 (`wave-b-trigger.yml`이 Issue #101에 자동 코멘트) |

동반 자료:
- `.moai/specs/SPEC-REGULA-ENTERPRISE-001/spec.md`
- `.moai/specs/SPEC-REGULA-ENTERPRISE-001/tasks.md`

명령 박스 (메인 repo + 터미널 4):

```bash
# 메인 repo에서 worktree 1개 추가 생성 (Stage 1과 동일 패턴)
moai worktree new SPEC-REGULA-ENTERPRISE-001

# 4번째 터미널에서:
cd ~/.moai/worktrees/ra-med-bot/SPEC-REGULA-ENTERPRISE-001
pnpm install
claude --team
# Claude 세션 안에서:
/moai run SPEC-REGULA-ENTERPRISE-001 --team
```

파일 소유권 (T4 전용):
- `app/layout.tsx`
- `lib/observability/langfuse-handler.ts`
- `app/api/ra/consult/route.ts`
- `tests/e2e/observability-integration.spec.ts`
- `.moai/specs/SPEC-REGULA-ENTERPRISE-001/**`

검증 기준:
- Langfuse trace 정상 발행 확인
- ENTERPRISE acceptance 모든 항목 PASS
- observability-integration e2e PASS

PR 머지: 사용자가 리뷰 후 main 머지 (Issue #100 close).

agent 행동 규약: §8 동일.

---

## 6. Stage 5 — RC 태깅 (사용자, 싱글)

목적: 1차 RC 릴리즈 v1.0.0-rc 태그 및 GitHub Release 발행.

전제 조건:
- 모든 PR (#97, #98, #99, #100) main 머지 완료
- main 브랜치 CI green
- `RELEASE-001` acceptance 항목 전체 검증

명령 박스 (메인 repo, main 브랜치):

```bash
git checkout main
git pull origin main

# RELEASE-001 acceptance 최종 점검
cat .moai/specs/SPEC-REGULA-RELEASE-001/acceptance.md

# CHANGELOG 갱신 (수동 편집)
$EDITOR CHANGELOG.md

# 변경분 커밋
git add CHANGELOG.md
git commit -m "docs: v1.0.0-rc 릴리즈 노트 갱신"
git push origin main

# RC 태깅
gh release create v1.0.0-rc \
  --title "Regula v1.0.0-rc — 1차 Release Candidate" \
  --notes-file CHANGELOG.md \
  --prerelease

# Issue #101 close
gh issue close 101 --comment "v1.0.0-rc 릴리즈 완료. RELEASE-RC1 Runbook 종료."
```

검증:
- `gh release view v1.0.0-rc` 노출 확인
- `gh issue view 101` 상태 closed 확인

---

## 7. 파일 소유권 매트릭스 (충돌 0% 보장)

| 터미널 | SPEC | 소유 디렉토리/파일 | 비고 |
|---|---|---|---|
| T1 | QUALITY-001 | `.github/workflows/qa-coverage.yml`, `.github/workflows/quality-gate.yml`, `scripts/qa/**`, `tests/unit/quality/**` | T2/T3/T4 접근 금지 |
| T2 | DEPLOY-001 | `.github/workflows/deploy-*.yml`, `infra/**`, `scripts/deploy/**`, `Dockerfile.production` | T1/T3/T4 접근 금지 |
| T3 | E2EFIX-001 | `tests/e2e/**` (T4 obs 파일 제외), `tests/fixtures/auth.ts`, `playwright.config.ts` | T1 머지 후 rebase 필요 |
| T4 | ENTERPRISE-001 | `app/layout.tsx`, `lib/observability/**`, `app/api/ra/consult/route.ts`, `tests/e2e/observability-integration.spec.ts` | Wave B 단독 실행 |

각 터미널 SPEC 디렉토리(`.moai/specs/SPEC-REGULA-*/`)는 disjoint이므로 충돌 없음.

---

## 8. Agent 행동 규약 [HARD]

각 터미널의 agent는 다음 7개 규약을 반드시 따른다:

1. **시작 코멘트**: 작업 시작 시 Issue #101에 `[T{N}] starting <SPEC-NAME>` 코멘트 게시
2. **소유권 준수**: 자기 worktree 외 파일 또는 §7 매트릭스에서 다른 터미널 소유로 명시된 파일 수정 금지
3. **PR 본문 표준화**: PR 생성 시 본문은 `./scripts/release-rc1/pr-body-template.sh T{N}` 출력을 그대로 사용
4. **단계 완료 보고**: 주요 단계(테스트 통과, 구현 완료 등) 시 Issue #101에 진행 코멘트
5. **블로커 즉시 공유**: 작업이 막히면 Issue #101에 `[T{N}] BLOCKER: <상세>` 코멘트 후 사용자 응답 대기
6. **머지 권한 분리**: PR 머지는 사용자 권한이며 agent는 머지 시도 금지
7. **T3 rebase 자율 실행**: T3는 T1 머지 알림(`wave-b-trigger`/`wave-progress-tracker` 코멘트) 감지 시 `git pull --rebase origin main` 자동 실행

---

## 9. 트러블슈팅

| 증상 | 원인 | 해결 |
|---|---|---|
| `moai worktree new` 실패 | moai CLI 미설치 또는 PATH 누락 | `which moai`로 점검, 미설치 시 `npm i -g @moai/cli` |
| `pnpm install` 실패 | lock 파일 충돌 | worktree 내부에서 `rm pnpm-lock.yaml && pnpm install` (단 T1/T2/T3 동시 실행 시는 main 기준 lock 사용) |
| T3 rebase 충돌 (`tests/fixtures/auth.ts`) | T1과 T3가 동일 파일 수정 | T3 worktree에서 수동 해결 후 `git rebase --continue` |
| `pnpm db:migrate` 실패 | `.env.local` 미설정 또는 DATABASE_URL 오류 | `.env.local`에 실제 DB 연결 문자열 입력 후 재실행 |
| Wave B 자동 알림 누락 | `wave-b-trigger.yml` 워크플로우 실패 | 수동 트리거: `gh workflow run wave-b-trigger.yml` |
| Playwright 브라우저 누락 | `pnpm exec playwright install` 미실행 | Stage 1의 `pnpm exec playwright install chromium firefox` 재실행 |
| `claude --team` 시작 실패 | 환경변수 `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` 누락 | `.env` 또는 셸 rc에 추가 후 재기동 |
| PR 본문 템플릿 스크립트 부재 | scripts/release-rc1/ 미생성 | T별로 수동 작성 가능. 본문에 SPEC-ID, Issue 링크, acceptance 체크리스트 포함 |

---

## 10. 사용자 개입 횟수 요약

| 단계 | 액션 | 횟수 |
|---|---|---:|
| Stage 1 | 사전 명령 (worktree+seed+playwright) | 1 |
| Stage 2 | 3-터미널 명령 (T1/T2/T3 각각) | 3 |
| Stage 3 | PR 머지 (T1, T2, T3) | 3 |
| Stage 4 | T4 명령 (worktree 추가 + 실행) | 1 |
| Stage 4 | T4 PR 머지 | 1 |
| Stage 5 | RC 태깅 + Issue close | 1 |
| **합계** | | **10** |

---

## 11. 명령 Cheatsheet (복붙용)

### Stage 1 — 메인 repo 사전 작업 박스

```bash
moai worktree new SPEC-REGULA-QUALITY-001
moai worktree new SPEC-REGULA-DEPLOY-001
moai worktree new SPEC-REGULA-E2EFIX-001

cp .env.example .env.local   # 이미 있으면 skip
# .env.local에 DATABASE_URL 등 실제 값 입력 후:
pnpm db:migrate
pnpm exec playwright install chromium firefox
```

### Stage 2 — T1 박스 (터미널 1, solo)

```bash
cd ~/.moai/worktrees/ra-med-bot/SPEC-REGULA-QUALITY-001
pnpm install
claude
# /moai run SPEC-REGULA-QUALITY-001 --resume
```

### Stage 2 — T2 박스 (터미널 2, solo)

```bash
cd ~/.moai/worktrees/ra-med-bot/SPEC-REGULA-DEPLOY-001
pnpm install
claude
# /moai run SPEC-REGULA-DEPLOY-001
```

### Stage 2 — T3 박스 (터미널 3, team)

```bash
cd ~/.moai/worktrees/ra-med-bot/SPEC-REGULA-E2EFIX-001
pnpm install
claude --team
# /moai run SPEC-REGULA-E2EFIX-001 --team

# T1 머지 후 1회:
git pull --rebase origin main
```

### Stage 4 — T4 박스 (메인 + 터미널 4, team)

```bash
# 메인 repo:
moai worktree new SPEC-REGULA-ENTERPRISE-001

# 터미널 4:
cd ~/.moai/worktrees/ra-med-bot/SPEC-REGULA-ENTERPRISE-001
pnpm install
claude --team
# /moai run SPEC-REGULA-ENTERPRISE-001 --team
```

### Stage 5 — RC 태깅 박스 (메인 repo)

```bash
git checkout main && git pull origin main
$EDITOR CHANGELOG.md
git add CHANGELOG.md && git commit -m "docs: v1.0.0-rc 릴리즈 노트 갱신" && git push origin main

gh release create v1.0.0-rc \
  --title "Regula v1.0.0-rc — 1차 Release Candidate" \
  --notes-file CHANGELOG.md \
  --prerelease

gh issue close 101 --comment "v1.0.0-rc 릴리즈 완료. RELEASE-RC1 Runbook 종료."
```

### 모니터링 (언제든)

```bash
# 진행 상황 한눈에 보기
gh issue view 101 --comments

# worktree 목록
moai worktree list

# CI 상태
gh pr list --state open
```

---

**Runbook 종료**. 본 콘티가 완료되면 Regula v1.0.0-rc 릴리즈가 발행되며 메타 Issue #101이 closed 상태가 된다.
