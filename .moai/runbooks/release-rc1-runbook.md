---
runbook_id: RELEASE-RC1
version: 3.0.0
created: 2026-05-05
updated: 2026-05-05
owner: drake.lee
meta_issue: "#101"
status: active
---

# Regula 1차 RC v1.0.0-rc 실행 콘티 (Runbook v3.0)

> **싱글 사전 작업 → 3-터미널 개별 병렬 작업 → 싱글 마무리**
> 4개 이슈를 3개 터미널에 배치. #100은 #98 이후 3번 터미널에서 순차 처리.

---

## 0. 메타

- **메타 Issue**: [#101](https://github.com/drake-lee/ra-med-bot/issues/101) — Release RC1 Tracker
- **Canonical 이슈**: #97, #98, #99, #100 (#93~#96은 closed+duplicate)
- **자동화**:
  - `runbook-sync` — PR 머지 시 본 문서 체크박스 자동 체크
  - `wave-progress-tracker` — Issue #101 진행률 코멘트 자동 갱신
  - `wave-b-trigger` — T1+T2+T3 머지 완료 시 T4 진입 게이트 알림
- **의존성 순서**: #99 → #97 → #98 → #100

---

## 1. 터미널 배치 매트릭스

| 터미널 | worktree | 이슈 | 의존 | 우선순위 |
|---|---|---|---|---|
| 1 | `issue-99-quality-bootstrap` | #99 Quality Bootstrap | 없음 (P0 선행) | P0 |
| 2 | `issue-97-e2efix` | #97 E2E Fix | #99 결과 필요 | P0 |
| 3 | `issue-98-deploy` → `issue-100-observability` | #98 배포, 이후 #100 OBS | #97 이후 | P1 |

**실행 원칙**:
- T1(#99)을 먼저 완료한다 — `dev:bootstrap` canonical 명령이 확정되어야 T2(#97) E2E 안정화 가능
- T2(#97)와 T3(#98)는 #99 완료 후 병렬 가동 가능
- T3는 #98 완료 후 같은 터미널에서 #100으로 전환

---

## 2. Stage 1 — 싱글 사전 작업 (메인 repo 루트, 1회)

**현재 상태**: worktree 3개 이미 생성됨, Playwright 설치 완료.

worktree 경로 (`.moai/worktrees/`는 `.gitignore` 포함):

```
D:\workspace-github\ra-med-bot\.moai\worktrees\issue-99-quality-bootstrap  [work/issue-99-quality-bootstrap]
D:\workspace-github\ra-med-bot\.moai\worktrees\issue-97-e2efix             [work/issue-97-e2efix]
D:\workspace-github\ra-med-bot\.moai\worktrees\issue-98-deploy             [work/issue-98-deploy]
```

남은 사전 작업 (`.env.local` 준비 후):

```bash
# .env.local 없으면:
cp .env.example .env.local
# DATABASE_URL, ANTHROPIC_API_KEY 등 실제 값 입력 후:
pnpm db:migrate
```

검증:

```bash
git worktree list    # 4개 (main + 3개) 확인
```

---

## 3. Stage 2 — 3-터미널 개별 병렬 작업

### 3.1 T1 — #99 Quality Bootstrap (터미널 1, solo)

**목적**: `pnpm dev:bootstrap` 스크립트 구현, placeholder 차단(REQ-QUAL-026/027), DEVELOPMENT.md 갱신(REQ-QUAL-028). canonical 명령명 확정이 핵심 — T2가 이 결과를 사용한다.

| 필드 | 값 |
|---|---|
| **worktree** | `.moai/worktrees/issue-99-quality-bootstrap` |
| **branch** | `work/issue-99-quality-bootstrap` |
| **GitHub Issue** | [#99](https://github.com/drake-lee/ra-med-bot/issues/99) |
| **모드** | solo |
| **우선순위** | P0 — 가장 먼저 완료 |

동반 자료:
- `.moai/specs/SPEC-REGULA-QUALITY-001/spec.md` (REQ-QUAL-026~028)
- `.moai/specs/SPEC-REGULA-QUALITY-001/plan.md`
- `.moai/specs/SPEC-REGULA-QUALITY-001/acceptance.md`

명령 박스 (터미널 1):

```bash
cd D:/workspace-github/ra-med-bot/.moai/worktrees/issue-99-quality-bootstrap
pnpm install
claude
# Claude 세션 안에서:
/moai run SPEC-REGULA-QUALITY-001
```

파일 소유권 (T1 전용):
- `scripts/dev-bootstrap.ts` (또는 `scripts/dev-bootstrap.sh`)
- `package.json` — `dev:bootstrap` script 추가
- `lib/env.ts` — `dev-placeholder-` 차단 로직
- `DEVELOPMENT.md` — Section 2 갱신
- `.moai/specs/SPEC-REGULA-QUALITY-001/**`

검증 기준:
- `pnpm dev:bootstrap` 실행 → `.env.local` 생성 확인
- `NODE_ENV=production pnpm build` + `ANTHROPIC_API_KEY=dev-placeholder-x` → fail-fast exit ≠ 0
- `DEVELOPMENT.md` Section 2에 5단계 시퀀스 존재

agent 행동 규약:
- 시작 시 Issue #101에 `[T1] starting #99 quality-bootstrap` 코멘트
- 완료 시 `dev:bootstrap` canonical 명령명을 Issue #99에 코멘트로 공유 (T2 참조용)
- PR body: `./scripts/release-rc1/pr-body-template.sh T1`

---

### 3.2 T2 — #97 E2E Fix (터미널 2, solo)

**목적**: E2E skip 해제, Playwright globalSetup + `.auth.json` 안정화, CI E2E 증거 확보.
**진입 조건**: T1 완료 후 `dev:bootstrap` 명령명 확정되면 즉시 가동 (PR 머지 불필요).

| 필드 | 값 |
|---|---|
| **worktree** | `.moai/worktrees/issue-97-e2efix` |
| **branch** | `work/issue-97-e2efix` |
| **GitHub Issue** | [#97](https://github.com/drake-lee/ra-med-bot/issues/97) |
| **모드** | solo |
| **우선순위** | P0 |

동반 자료:
- `.moai/specs/SPEC-REGULA-E2EFIX-001/spec.md`
- `.moai/specs/SPEC-REGULA-E2EFIX-001/plan.md`
- `.moai/specs/SPEC-REGULA-E2EFIX-001/acceptance.md`

명령 박스 (터미널 2):

```bash
cd D:/workspace-github/ra-med-bot/.moai/worktrees/issue-97-e2efix
pnpm install
claude
# Claude 세션 안에서:
/moai run SPEC-REGULA-E2EFIX-001
```

파일 소유권 (T2 전용):
- `tests/e2e/**` (단, `tests/e2e/observability-integration.spec.ts`는 T4 소유)
- `tests/fixtures/auth.ts`
- `playwright.config.ts`
- `.github/workflows/ci.yml` — E2E job 조정
- `.moai/specs/SPEC-REGULA-E2EFIX-001/**`

검증 기준:
- `pnpm test:e2e` 전체 PASS (chromium + firefox, skip 0개)
- `.auth.json` globalSetup 정상 생성 확인
- CI E2E job green 증거 스크린샷

agent 행동 규약:
- 시작 시 Issue #101에 `[T2] starting #97 e2efix` 코멘트
- T1 명령명 확정 코멘트(Issue #99) 확인 후 `dev:bootstrap` 연동 여부 판단

---

### 3.3 T3 — #98 Deploy (터미널 3, solo) → 이후 #100 OBS

**목적 (#98)**: 배포 증거 축 구축 — deploy.yml, smoke test, preview 헬스체크.
**목적 (#100)**: Sentry ErrorBoundary, Langfuse trace 미들웨어, 4-way 통합 E2E 게이트(REQ-ENTERPRISE-074~076).

| 필드 | 값 |
|---|---|
| **worktree (#98)** | `.moai/worktrees/issue-98-deploy` |
| **branch (#98)** | `work/issue-98-deploy` |
| **GitHub Issue** | [#98](https://github.com/drake-lee/ra-med-bot/issues/98) → [#100](https://github.com/drake-lee/ra-med-bot/issues/100) |
| **모드** | solo |
| **우선순위** | P1 (#98), P1 (#100은 #98 이후) |

동반 자료:
- `.moai/specs/SPEC-REGULA-DEPLOY-001/spec.md` / `plan.md` / `acceptance.md`
- `.moai/specs/SPEC-REGULA-ENTERPRISE-001/spec.md` (REQ-ENTERPRISE-074~076 — #100용)

명령 박스 (터미널 3, #98 선):

```bash
cd D:/workspace-github/ra-med-bot/.moai/worktrees/issue-98-deploy
pnpm install
claude
# Claude 세션 안에서:
/moai run SPEC-REGULA-DEPLOY-001
```

#98 PR 머지 후 — 같은 터미널에서 #100 전환:

```bash
# 메인 repo 루트에서 (새 터미널 또는 메인 세션):
git worktree remove D:/workspace-github/ra-med-bot/.moai/worktrees/issue-98-deploy
git worktree add D:/workspace-github/ra-med-bot/.moai/worktrees/issue-100-observability -b work/issue-100-observability origin/main

# 터미널 3에서:
cd D:/workspace-github/ra-med-bot/.moai/worktrees/issue-100-observability
pnpm install
claude
# Claude 세션 안에서:
/moai run SPEC-REGULA-ENTERPRISE-001
```

파일 소유권 — #98:
- `.github/workflows/deploy-production.yml`
- `.github/workflows/deploy-preview.yml`
- `infra/**`
- `scripts/deploy/**`
- `.moai/specs/SPEC-REGULA-DEPLOY-001/**`

파일 소유권 — #100:
- `app/layout.tsx` — Sentry ErrorBoundary
- `lib/observability/langfuse-handler.ts` — Route Handler trace 미들웨어
- `app/api/ra/consult/route.ts` — `withLangfuseTrace` 래핑
- `tests/e2e/observability-integration.spec.ts` — 4-way 통합 E2E
- `.moai/specs/SPEC-REGULA-ENTERPRISE-001/**`

검증 기준 (#98):
- 배포 워크플로우 dry-run PASS
- preview 환경 헬스체크 200 OK

검증 기준 (#100):
- POST `/api/ra/consult` → 응답 헤더 `X-Langfuse-Trace-Id` 존재
- `tests/e2e/observability-integration.spec.ts` 4-way 동시 검증 PASS

agent 행동 규약:
- #98 시작 시 Issue #101에 `[T3] starting #98 deploy` 코멘트
- #100 전환 시 Issue #101에 `[T3] #98 merged → switching to #100 observability` 코멘트

---

## 4. Stage 3 — PR 머지 게이트 (사용자, 싱글)

머지 순서 [HARD]:

```
1. T1 PR (#99) → main 머지  (P0 선행)
2. T2 PR (#97) → main 머지  (T1과 독립, 병렬 머지 가능)
3. T3 PR (#98) → main 머지  (T1/T2와 파일 충돌 낮음)
4. T3' PR (#100) → main 머지 (#98 이후)
```

T2 rebase 절차 (T1 PR 머지 후, T2 worktree에서):

```bash
git pull --rebase origin main
# 충돌 발생 시 수동 해결 후 git rebase --continue
```

자동화:
- `runbook-sync.yml` — PR 머지 시 본 문서 체크박스 자동 체크
- `wave-progress-tracker.yml` — Issue #101 진행률 코멘트 갱신
- `wave-b-trigger.yml` — #99+#97+#98 모두 머지 시 Issue #101에 #100 진입 게이트 코멘트

---

## 5. Stage 4 — RC 태깅 (사용자, 싱글)

목적: 1차 RC 릴리즈 v1.0.0-rc 태그 및 GitHub Release 발행.

전제 조건:
- 모든 PR (#97, #98, #99, #100) main 머지 완료
- main 브랜치 CI green

명령 박스 (메인 repo, main 브랜치):

```bash
git checkout main
git pull origin main

# CHANGELOG 갱신
$EDITOR CHANGELOG.md
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

---

## 6. 파일 소유권 매트릭스 (충돌 0% 보장)

| 터미널 | 이슈 | 소유 파일/디렉토리 |
|---|---|---|
| T1 | #99 | `scripts/dev-bootstrap.*`, `lib/env.ts` (placeholder 차단), `DEVELOPMENT.md`, `package.json` (dev:bootstrap script) |
| T2 | #97 | `tests/e2e/**` (obs 제외), `tests/fixtures/auth.ts`, `playwright.config.ts`, `.github/workflows/ci.yml` |
| T3 | #98 | `.github/workflows/deploy-*.yml`, `infra/**`, `scripts/deploy/**` |
| T3' | #100 | `app/layout.tsx`, `lib/observability/**`, `app/api/ra/consult/route.ts`, `tests/e2e/observability-integration.spec.ts` |

각 SPEC 디렉토리(`.moai/specs/SPEC-REGULA-*/`)는 disjoint — 충돌 없음.

---

## 7. Agent 행동 규약 [HARD]

1. **시작 코멘트**: 작업 시작 시 Issue #101에 `[T{N}] starting #<issue> <name>` 코멘트
2. **소유권 준수**: §6 매트릭스 외 파일 수정 금지
3. **PR 본문**: `./scripts/release-rc1/pr-body-template.sh T{N}` 출력 사용
4. **블로커 공유**: `[T{N}] BLOCKER: <상세>` 코멘트 후 사용자 대기
5. **머지 금지**: PR 머지는 사용자 권한 — agent 머지 시도 불가
6. **T2 rebase**: T1 PR 머지 감지 후 `git pull --rebase origin main` 자동 실행

---

## 8. 트러블슈팅

| 증상 | 원인 | 해결 |
|---|---|---|
| `git worktree add` 실패 | 브랜치명 중복 | `git branch -d work/issue-XX-*` 후 재시도 |
| `pnpm install` 실패 | lock 파일 충돌 | worktree 내부에서 `rm pnpm-lock.yaml && pnpm install` |
| T2 rebase 충돌 (`tests/fixtures/auth.ts`) | T1과 T2 동일 파일 | T2 worktree에서 수동 해결 후 `git rebase --continue` |
| `pnpm db:migrate` 실패 | `.env.local` 미설정 | `.env.local`에 `DATABASE_URL` 입력 후 재실행 |
| Wave B 자동 알림 누락 | `wave-b-trigger.yml` 실패 | `gh workflow run wave-b-trigger.yml` 수동 트리거 |
| Playwright 브라우저 누락 | 재설치 필요 | `pnpm exec playwright install chromium firefox` |

---

## 9. 명령 Cheatsheet (복붙용)

### Stage 1 — 사전 작업 (이미 완료된 항목 표시)

```bash
# ✅ worktree 3개 생성 완료
# git worktree list 로 확인

# ✅ Playwright 설치 완료

# 남은 작업 (.env.local 준비 후):
cp .env.example .env.local   # 이미 있으면 skip
# .env.local에 DATABASE_URL 등 실제 값 입력 후:
pnpm db:migrate
```

### Stage 2 — T1 박스 (터미널 1)

```bash
cd D:/workspace-github/ra-med-bot/.moai/worktrees/issue-99-quality-bootstrap
pnpm install
claude
# /moai run SPEC-REGULA-QUALITY-001
```

### Stage 2 — T2 박스 (터미널 2, #99 완료 후)

```bash
cd D:/workspace-github/ra-med-bot/.moai/worktrees/issue-97-e2efix
pnpm install
claude
# /moai run SPEC-REGULA-E2EFIX-001
```

### Stage 2 — T3 박스 (터미널 3, #98)

```bash
cd D:/workspace-github/ra-med-bot/.moai/worktrees/issue-98-deploy
pnpm install
claude
# /moai run SPEC-REGULA-DEPLOY-001
```

### T3 #100 전환 (#98 PR 머지 후)

```bash
# 메인 repo에서:
git worktree remove D:/workspace-github/ra-med-bot/.moai/worktrees/issue-98-deploy
git worktree add D:/workspace-github/ra-med-bot/.moai/worktrees/issue-100-observability -b work/issue-100-observability origin/main

# 터미널 3에서:
cd D:/workspace-github/ra-med-bot/.moai/worktrees/issue-100-observability
pnpm install
claude
# /moai run SPEC-REGULA-ENTERPRISE-001
```

### Stage 4 — RC 태깅 박스

```bash
git checkout main && git pull origin main
$EDITOR CHANGELOG.md
git add CHANGELOG.md && git commit -m "docs: v1.0.0-rc 릴리즈 노트 갱신" && git push origin main
gh release create v1.0.0-rc --title "Regula v1.0.0-rc — 1차 Release Candidate" --notes-file CHANGELOG.md --prerelease
gh issue close 101 --comment "v1.0.0-rc 릴리즈 완료."
```

### 모니터링

```bash
git worktree list
gh issue view 101 --comments
gh pr list --state open
```

---

**Runbook 종료**. 본 콘티가 완료되면 Regula v1.0.0-rc 릴리즈가 발행되며 메타 Issue #101이 closed 상태가 된다.
