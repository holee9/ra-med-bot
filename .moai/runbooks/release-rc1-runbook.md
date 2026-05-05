---
runbook_id: RELEASE-RC1
version: 1.0.0
created: 2026-05-05
owner: drake.lee
meta_issue: "#101"
status: active
---

# Regula 1차 RC v1.0.0-rc 실행 콘티 (Runbook)

> 본 문서는 Regula 1차 RC 출시까지의 **하이브리드 자동 추적 실행 콘티**다. 사용자 개입을 ≤9회로 제한하고, 3-터미널 병렬(Wave A) + 단일 터미널 후속(Wave B) 구조로 운영한다. 모든 진행 상황은 GitHub Issue #101에 자동 동기화된다.

---

## 0. 메타

- **메타 Issue**: [#101](https://github.com/drake-lee/ra-med-bot/issues/101) — Release RC1 Tracker
- **자동화**:
  - `runbook-sync` (GitHub Actions) — PR 머지 시 본 문서 체크박스 자동 체크
  - `wave-progress-tracker` (GitHub Actions) — Issue #101 진행률 코멘트 자동 갱신
  - `wave-b-trigger` (GitHub Actions) — T1+T2+T3 머지 완료 시 T4 진입 게이트 알림
- **Pre-flight 스크립트**: `scripts/release-rc1/preflight.sh` (idempotent, 8 단계)
- **머지 게이트 스크립트**: `scripts/release-rc1/merge-gate.sh` (T1 → T2‖T3 순서 강제)
- **운영 원칙**:
  - Agent 자율 우선, 사용자 개입 **최대 9회**
  - File ownership 0% 충돌 보장 (§3 매트릭스)
  - 모든 작업 결과는 Issue #101에 코멘트로 동기화
  - Time estimate 사용 금지 — Priority(P0/P1/P2) + Phase ordering(Wave A/B) only

---

## 1. 사용자 운영 흐름 요약

사용자 개입 9회 (✅ = 사용자 액션 필요):

```
[준비]
  1. ✅ Pre-flight 실행 → PF 8/8 PASS 확인
  2. ✅ Wave A 진입 승인 (3-터미널 가동 명령)

[Wave A 병렬]
  3. ✅ T1 PR 리뷰/머지 (#99 close)
  4. ✅ T2 PR 리뷰/머지 (#98 close, T1 머지 후)
  5. ✅ T3 PR 리뷰/머지 (#97 close, T1 머지 후 rebase)

[Wave B 단일]
  6. ✅ Wave B 진입 승인 (T4 가동 명령)
  7. ✅ T4 PR 리뷰/머지 (#100 close)

[릴리즈]
  8. ✅ RELEASE-001 acceptance 검증 결과 승인
  9. ✅ `gh release create v1.0.0-rc` 최종 트리거
```

각 단계 사이의 모든 코드 작성 / 테스트 / CI 검증 / 문서 동기화는 **agent가 자율 수행**하며 사용자 개입을 요구하지 않는다.

---

## 2. Agent 행동 규약 [HARD]

본 Runbook을 참조하여 작업하는 모든 agent는 다음 7개 규약을 **위반 없이** 준수한다.

1. **[HARD] Issue #101 코멘트 의무**
   - 모든 sub-task 시작 시 Issue #101에 시작 코멘트 작성 (§5.x 카드 템플릿 사용)
   - PR 생성/머지/CI fail/rebase 충돌 시 Issue #101에 즉시 코멘트
   - 코멘트 형식: `[Tn][PHASE] message` (예: `[T1][RUN] REQ-QUAL-026 구현 시작`)

2. **[HARD] File ownership 준수**
   - §3 File Ownership 매트릭스 외 파일을 **수정하지 않는다**
   - 본인 ownership 외 파일 변경이 필요하면 Issue #101에 블로커 코멘트 작성 후 사용자 결정 대기
   - `.moai/specs/SPEC-REGULA-*/` 파일은 **수정 금지** (drift 방지, amendment는 별도 PR)

3. **[HARD] PR 표준 템플릿 호출**
   - 모든 PR body는 `.github/pull_request_template.md` 형식 준수
   - 필수 필드: `Closes #<issue>`, `SPEC: SPEC-REGULA-{ID}`, `File ownership: <list>`, `Verification: <commands>`, `Risk: <none|low|medium|high>`
   - PR 제목: `[Tn] <SPEC-ID>: <one-line summary>`

4. **[HARD] CI green 머지 게이트**
   - PR CI green이 아닌 상태에서 **머지하지 않는다**
   - CI fail 시 §8 트러블슈팅 참조 후 root cause 수정, 재실행 금지
   - 동일 fail 3회 연속 발생 시 Issue #101에 블로커 코멘트 작성

5. **[HARD] Worktree 격리**
   - T1/T2/T3/T4는 각자 전용 worktree에서만 작업
   - 메인 작업 트리(`D:\workspace-github\ra-med-bot`)에서 직접 코드 수정 금지
   - Worktree 경로: `.worktrees/<branch-name>/` (§5/§6 카드 명시)

6. **[HARD] Time estimate 금지**
   - 작업 보고서/PR/커밋 메시지에 시간 단위 추정 사용 금지 ("2일", "1주" 등)
   - 우선순위(P0/P1/P2)와 phase 순서(Wave A → Wave B)로만 표현

7. **[HARD] Idempotent 재실행 보장**
   - Pre-flight, post-deploy smoke, wave 진입 게이트 모두 재실행 안전 (idempotent)
   - 부분 실패 시 처음부터 재실행해도 부작용 없음 (스크립트 자체가 보장)

---

## 3. File Ownership 매트릭스

각 터미널이 소유하는 파일 패턴. **충돌 매트릭스: 0%**

| 터미널 | SPEC | Branch | Worktree | Owned Files | Forbidden |
|--------|------|--------|----------|-------------|-----------|
| **T1** | QUALITY-AMEND (REQ-QUAL-026~028) | `feat/quality-amend-rc1` | `.worktrees/quality-amend/` | `scripts/dev/bootstrap.ts`<br>`lib/env.ts` (placeholder regex 추가만)<br>`DEVELOPMENT.md` Section 2<br>`.env.example` (검증 항목 추가) | T2/T3/T4 ownership 전부 |
| **T2** | DEPLOY-001 (P1) | `feat/deploy-rc1` | `.worktrees/deploy-rc1/` | `.github/workflows/deploy.yml` (NEW)<br>`scripts/release-rc1/post-deploy-trigger.sh` (NEW)<br>`vercel.json` (Environments 분리 항목)<br>`docs/runbook-deploy.md` (NEW) | `.github/workflows/cf-deploy.yml` (CLOUDFLARE-001 ownership)<br>`.github/workflows/ci.yml` (CICD-001 ownership)<br>T1/T3/T4 ownership 전부 |
| **T3** | E2EFIX-001 (P0, team) | `feat/e2efix-rc1` | `.worktrees/e2efix-rc1/` | `playwright/globalSetup.ts` (NEW)<br>`tests/e2e/fixtures/auth.ts` (REWRITE)<br>`tests/e2e/auth.spec.ts`<br>`tests/e2e/consultation.spec.ts`<br>`tests/e2e/expert-review.spec.ts`<br>`tests/e2e/project-switch.spec.ts`<br>`tests/e2e/i18n.spec.ts`<br>`tests/e2e/a11y.spec.ts`<br>`tests/e2e/security-headers.spec.ts`<br>`playwright.config.ts` (globalSetup 등록) | `tests/e2e/citation-click.spec.ts` (HARDENING-001 ownership)<br>`tests/e2e/fixtures/msw-sse.ts` (HARDENING-001 ownership)<br>T1/T2/T4 ownership 전부 |
| **T4** | ENTERPRISE-AMEND (REQ-ENT-074~076) | `feat/enterprise-obs-amend` | `.worktrees/enterprise-obs/` | `app/layout.tsx` (Sentry ErrorBoundary wrapping)<br>`lib/observability/langfuse-handler.ts` (NEW)<br>`app/api/ra/consult/route.ts` (handler wrap)<br>`app/api/ra/expert-review/*/route.ts`<br>`app/api/ra/consultations/*/route.ts`<br>`tests/integration/observability-4way.test.ts` (NEW) | `lib/observability/sentry.ts`<br>`lib/observability/posthog.ts`<br>`lib/observability/langfuse.ts` (init만, handler는 신규)<br>T1/T2/T3 ownership 전부 |

**충돌 검증 명령** (PR 생성 전 self-check):

```bash
# 본인 PR diff와 다른 터미널 ownership 비교
gh pr diff --name-only | grep -E '<other-terminal-ownership-pattern>' && echo "FAIL: ownership 위반" || echo "OK"
```

---

## 4. Pre-flight 8단계

> 사용자 개입 #1 — `bash scripts/release-rc1/preflight.sh` 실행 후 PF 8/8 PASS 확인.
>
> 모든 단계는 idempotent. 부분 실패 시 같은 명령으로 재실행 가능.

### PF-1: GitHub 상태 확인

- **명령**: `gh issue list --label release-rc1 --state open`
- **검증 기준**: Issue #97, #98, #99, #100, #101 모두 OPEN 상태로 출력
- **자동화 동작**: `runbook-sync` workflow가 본 단계 실패 시 알림
- **체크박스**:
  - [ ] PF-1 PASS — release-rc1 라벨 5개 issue 확인됨

### PF-2: SPEC 디렉토리 무결성

- **명령**: `ls .moai/specs/SPEC-REGULA-{E2EFIX-001,DEPLOY-001,QUALITY-001,ENTERPRISE-001,RELEASE-001}/spec.md`
- **검증 기준**: 5개 spec.md 모두 존재, exit 0
- **자동화 동작**: 누락 시 즉시 abort, Issue #101에 블로커 코멘트
- **체크박스**:
  - [ ] PF-2 PASS — 5개 SPEC spec.md 존재

### PF-3: Plan 문서 무결성

- **명령**: `ls .moai/plans/{review-gaps-2026-05-05.md,amendments-2026-05-05.md}`
- **검증 기준**: 2개 plan 문서 존재
- **자동화 동작**: T1/T4 amendment의 source-of-truth 보장
- **체크박스**:
  - [ ] PF-3 PASS — review-gaps + amendments 문서 존재

### PF-4: Worktree 디렉토리 정리

- **명령**: `git worktree list && git worktree prune`
- **검증 기준**: stale worktree 없음, prune 성공
- **자동화 동작**: 이전 세션 잔여 worktree 자동 정리
- **체크박스**:
  - [ ] PF-4 PASS — worktree clean

### PF-5: 원격 동기화

- **명령**: `git fetch --all --prune && git status -sb`
- **검증 기준**: main 브랜치가 origin/main과 동일, 미커밋 변경사항 없음
- **자동화 동작**: 충돌 발생 시 abort
- **체크박스**:
  - [ ] PF-5 PASS — main clean & up-to-date

### PF-6: CI baseline 확인

- **명령**: `gh run list --branch main --limit 3 --json conclusion`
- **검증 기준**: 최근 3회 CI 모두 `success`
- **자동화 동작**: baseline 깨진 상태에서 RC 진입 차단
- **체크박스**:
  - [ ] PF-6 PASS — main CI green baseline

### PF-7: 환경변수 부트스트랩

- **명령**: `test -f .env.local || cp .env.example .env.local`
- **검증 기준**: `.env.local` 존재, `lib/env.ts` zod fail-fast 통과
- **자동화 동작**: T1 작업 결과(REQ-QUAL-026)와 정합성 사전 확인 (T1 머지 전이라도 baseline 보장)
- **체크박스**:
  - [ ] PF-7 PASS — `.env.local` 부트스트랩됨

### PF-8: 메모리/디스크 자원

- **명령**: `node -e "console.log(process.memoryUsage().rss / 1024 / 1024)"` & `df -h .`
- **검증 기준**: RAM ≥ 16GB 시스템 추천 (3-터미널 병렬 가동), 디스크 여유 ≥ 5GB
- **자동화 동작**: 미달 시 §8 트러블슈팅 참조
- **체크박스**:
  - [ ] PF-8 PASS — 자원 충분

**Pre-flight 완료 시 Issue #101 자동 코멘트**:
```
[PREFLIGHT] PF 8/8 PASS — Wave A 진입 가능
```

---

## 5. Wave A — 3-터미널 병렬 가동

### 5.1 진입 게이트 (PF 8/8 통과)

> 사용자 개입 #2 — Wave A 진입 승인. 3개 터미널을 병렬로 가동한다.

- **전제 조건**: §4 PF 8/8 PASS
- **자동화**: `wave-progress-tracker`가 Issue #101 본문에 진행률 표 생성

### 5.2 🖥 T1 카드 — QUALITY-AMEND (P0, solo, closes #99)

```yaml
terminal: T1
spec: amendment to SPEC-REGULA-QUALITY-001 (REQ-QUAL-026~028)
priority: P0
mode: solo (sub-agent)
issue: closes #99
file_owner: T1 (per §3)
agent_role: implementer
```

**Worktree 명령**:

```bash
git worktree add .worktrees/quality-amend feat/quality-amend-rc1
cd .worktrees/quality-amend
```

**Launch 명령** (Claude Code):

```
/moai run --solo "QUALITY-AMEND REQ-QUAL-026~028 — .env.local bootstrap script per .moai/plans/amendments-2026-05-05.md §1. File ownership: scripts/dev/bootstrap.ts, lib/env.ts (placeholder regex only), DEVELOPMENT.md §2, .env.example. Closes #99. Branch: feat/quality-amend-rc1."
```

**작업 단계**:

- [ ] T1-S1: `scripts/dev/bootstrap.ts` 신규 작성 — `.env.example → .env.local` placeholder mapping (REQ-QUAL-026)
- [ ] T1-S2: `package.json`에 `"dev:bootstrap": "tsx scripts/dev/bootstrap.ts"` 추가
- [ ] T1-S3: `lib/env.ts` placeholder regex `/^dev-placeholder-/` 추가, NODE_ENV !== 'development' 차단 (REQ-QUAL-027)
- [ ] T1-S4: `DEVELOPMENT.md` §2 5단계 setup 시퀀스 갱신 (REQ-QUAL-028)
- [ ] T1-S5: `.env.example` 검증 항목 추가 (placeholder 명시)
- [ ] T1-S6: 통합 테스트 — fresh checkout 시뮬레이션, `pnpm dev:bootstrap && pnpm db:seed:corpus` zod fail-fast 통과 확인
- [ ] T1-S7: `pnpm test && pnpm lint && pnpm typecheck` 모두 PASS
- [ ] T1-S8: PR 생성, CI green 확인

**검증 기준**:

```bash
# Acceptance verification
NODE_ENV=production ANTHROPIC_API_KEY=dev-placeholder-anthropic pnpm build  # exit code != 0
NODE_ENV=development ANTHROPIC_API_KEY=dev-placeholder-anthropic pnpm build  # exit code == 0
test -x scripts/dev/bootstrap.ts && pnpm dev:bootstrap  # idempotent
grep -A 10 "## 2. Setup" DEVELOPMENT.md | grep -c "pnpm dev:bootstrap"  # >= 1
```

**PR 생성**: 표준 템플릿(§2 규약 #3) + `--title "[T1] QUALITY-AMEND: .env.local bootstrap script (REQ-QUAL-026~028)"`. Body 필수 필드: `Closes #99`, SPEC 참조, file ownership 5개, verification 3개 항목, `Risk: low`.

**Issue #101 코멘트 템플릿** (작업 완료 시):

```
[T1][DONE] QUALITY-AMEND merged via PR #<NUM>
- REQ-QUAL-026/027/028 verified
- File ownership compliance: PASS
- Closes #99
- Next gate: T2/T3 unblocked (Wave A continuing)
```

---

### 5.3 🖥 T2 카드 — DEPLOY-001 (P1, solo, closes #98)

```yaml
terminal: T2
spec: SPEC-REGULA-DEPLOY-001
priority: P1
mode: solo (sub-agent)
issue: closes #98
file_owner: T2 (per §3)
agent_role: implementer
```

**Worktree 명령**:

```bash
git worktree add .worktrees/deploy-rc1 feat/deploy-rc1
cd .worktrees/deploy-rc1
```

**Launch 명령**:

```
/moai run --solo "DEPLOY-001 RC1 deployment automation per .moai/specs/SPEC-REGULA-DEPLOY-001/spec.md. File ownership: .github/workflows/deploy.yml (NEW), scripts/release-rc1/post-deploy-trigger.sh (NEW), vercel.json (Environments only), docs/runbook-deploy.md (NEW). Do NOT touch ci.yml or cf-deploy.yml. Closes #98. Branch: feat/deploy-rc1."
```

**작업 단계**:

- [ ] T2-S1: `.github/workflows/deploy.yml` 신규 — Vercel preview-per-PR job
- [ ] T2-S2: `deploy.yml`에 cloudflare-staging job 추가 (staging-only, REQ-DEPLOY-001a)
- [ ] T2-S3: `production-vercel` Environment 정의 + manual approval reviewers (REQ-DEPLOY-007/008/009)
- [ ] T2-S4: `vercel.json` Environments 분리 메타데이터 추가
- [ ] T2-S5: `scripts/release-rc1/post-deploy-trigger.sh` 신규 — `scripts/post-deploy-smoke.sh` 자동 호출 (REQ-DEPLOY-006 ED 패턴)
- [ ] T2-S6: `docs/runbook-deploy.md` 신규 — manual rollback 절차
- [ ] T2-S7: `act` 또는 `gh workflow run --ref` dry-run 검증
- [ ] T2-S8: PR 생성, CI green 확인

**검증 기준**:

```bash
# deploy.yml 구조 검증
yq '.jobs | keys' .github/workflows/deploy.yml | grep -E '(vercel-preview|cloudflare-staging|production-vercel-deploy|post-deploy-smoke)'
# Environment 분리 확인
grep -c "production-vercel" .github/workflows/deploy.yml  # >= 1
grep -c "production-cloudflare" .github/workflows/deploy.yml  # == 0 (CLOUDFLARE-001 ownership)
# Smoke 자동 호출
grep -c "post-deploy-smoke.sh" .github/workflows/deploy.yml  # >= 1
```

**PR 생성**: 표준 템플릿 + `--title "[T2] DEPLOY-001: RC1 deployment automation"`. Body 필수: `Closes #98`, SPEC-REGULA-DEPLOY-001 4 groups 11 REQs 요약, file ownership 4개, verification 4개 항목 (yaml valid / production-vercel / no cf-deploy.yml 충돌 / smoke auto-trigger), `Risk: medium (deploy infra)`.

**Issue #101 코멘트 템플릿**:

```
[T2][DONE] DEPLOY-001 merged via PR #<NUM>
- 11 REQs (4 groups) verified
- File ownership compliance: PASS
- No collision with CLOUDFLARE-001 / CICD-001
- Closes #98
```

---

### 5.4 🖥 T3 카드 — E2EFIX-001 (P0, team, closes #97)

```yaml
terminal: T3
spec: SPEC-REGULA-E2EFIX-001
priority: P0
mode: team (3 teammates: implementer + tester + reviewer)
issue: closes #97
file_owner: T3 (per §3)
agent_role: team-coordinator
depends_on_merge: T1 (REQ-QUAL-026 placeholder regex needed for env.ts in test runner)
```

**Worktree 명령**:

```bash
git worktree add .worktrees/e2efix-rc1 feat/e2efix-rc1
cd .worktrees/e2efix-rc1
```

**Launch 명령** (team mode):

```
/moai run --team "E2EFIX-001 per .moai/specs/SPEC-REGULA-E2EFIX-001/spec.md. Activate 7 Playwright specs (auth, consultation, expert-review, project-switch, i18n, a11y, security-headers). DO NOT touch citation-click.spec.ts (HARDENING-001 ownership) or fixtures/msw-sse.ts. Add playwright/globalSetup.ts and rewrite tests/e2e/fixtures/auth.ts. Closes #97. Branch: feat/e2efix-rc1."
```

**작업 단계**:

- [ ] T3-S1: `playwright/globalSetup.ts` 신규 — SSO 로그인 자동화, `.auth.json` storage state 직렬화
- [ ] T3-S2: `tests/e2e/fixtures/auth.ts` REWRITE — placeholder marker 제거, 실제 storage state 로드
- [ ] T3-S3: 7개 spec `test.skip(true)` 일괄 해제 (auth, consultation, expert-review, project-switch, i18n, a11y, security-headers)
- [ ] T3-S4: `playwright.config.ts`에 globalSetup 등록 + storageState 환경변수 주입
- [ ] T3-S5: 7-spec 일관성 grep 게이트 — `.moai/specs/SPEC-REGULA-E2EFIX-001/spec.md` REQ-E2EFIX-001 명시 7개 파일 모두 통과 확인
- [ ] T3-S6: `pnpm test:e2e` 로컬 통과 (8 specs 중 citation-click 제외 7개 PASS)
- [ ] T3-S7: **T1 머지 후 rebase** (§5.5 머지 순서 게이트 참조)
- [ ] T3-S8: CI에서 e2e job green 확인 후 PR 생성

**T1 머지 후 Rebase 절차** (필수):

```bash
# T1 머지 완료 알림 후 (Issue #101에서 [T1][DONE] 확인)
cd .worktrees/e2efix-rc1
git fetch origin main
git rebase origin/main

# Conflict 발생 시 (가능성: lib/env.ts placeholder regex 충돌)
# T1의 placeholder regex는 그대로 유지, T3는 본인 e2e 파일만 수정 (충돌 없음 예상)
# 실제 충돌 시 §8 트러블슈팅 참조

# Rebase 성공 후
pnpm install
pnpm test:e2e  # 재검증
git push --force-with-lease origin feat/e2efix-rc1
```

**검증 기준**:

```bash
# 7-spec 일괄 해제 검증
for spec in auth consultation expert-review project-switch i18n a11y security-headers; do
  grep -c "test.skip(true" tests/e2e/${spec}.spec.ts || echo "OK: $spec"
done
# globalSetup 존재
test -f playwright/globalSetup.ts && echo OK
# auth.ts storage state 로드
grep -c "storageState" tests/e2e/fixtures/auth.ts  # >= 1
# E2E pass
pnpm test:e2e --reporter=list  # 7 specs pass, citation-click skipped (HARDENING-001 ownership 유지)
```

**PR 생성**: 표준 템플릿 + `--title "[T3] E2EFIX-001: Activate 7 Playwright specs + auto auth seeding"`. Body 필수: `Closes #97`, SPEC-REGULA-E2EFIX-001 3 groups 10 REQs, file ownership 7 spec + 3 infra, out-of-scope 명시 (citation-click → HARDENING-001, msw-sse → HARDENING-001, DB seed → QUALITY-001), verification 3개 (7 spec activated / CI green / rebased on T1), `Risk: medium`.

**Issue #101 코멘트 템플릿**:

```
[T3][DONE] E2EFIX-001 merged via PR #<NUM>
- 7 spec activations verified (citation-click excluded per spec §1.2)
- globalSetup.ts auto-seeding PASS
- File ownership compliance: PASS
- Closes #97
```

---

### 5.5 머지 순서 게이트

> 자동화: `scripts/release-rc1/merge-gate.sh`가 PR 머지 시 순서 강제

```
T1 (P0) ──merge──┐
                 ├──> T2 ‖ T3 (T1 머지 후 unblock)
                 │
                 ├──> T2: 독립 머지 가능 (T1 무관)
                 │
                 └──> T3: T1 머지 후 rebase 필수 → 머지

after [T1, T2, T3] all merged → wave-b-trigger fires → Wave B unlock
```

**머지 게이트 룰** (HARD):

- [HARD] T1 PR이 머지되기 전까지 T2/T3 PR은 **draft 상태** 유지
- [HARD] T1 머지 후 T2와 T3는 **순서 무관 병렬 머지 가능**
- [HARD] T3는 T1 머지 후 **rebase 필수** (CI 재실행 필요)
- [HARD] 3개 모두 머지 완료 시 `wave-b-trigger` workflow가 Issue #101에 자동 코멘트:
  ```
  [WAVE-A][DONE] T1+T2+T3 merged. Wave B (T4) unlocked.
  Next: bash scripts/release-rc1/wave-b-launch.sh
  ```

---

## 6. Wave B — T4 단일 터미널

### 6.1 진입 게이트 (T1+T2+T3 머지 자동 트리거)

> 사용자 개입 #6 — Wave B 진입 승인. 단일 터미널에서 T4를 가동한다.

- **전제 조건**: §5.5 게이트 통과 (T1+T2+T3 모두 머지)
- **자동화**: `wave-b-trigger` workflow가 Issue #101 코멘트 + email 알림
- **수동 트리거 fallback**: §8 트러블슈팅 "Wave B 자동 알림 누락" 참조

### 6.2 🖥 T4 카드 — ENTERPRISE-001 OBS-AMEND (P1, team, closes #100)

```yaml
terminal: T4
spec: amendment to SPEC-REGULA-ENTERPRISE-001 (REQ-ENT-074~076)
priority: P1
mode: team (3 teammates: implementer + tester + reviewer)
issue: closes #100
file_owner: T4 (per §3)
agent_role: team-coordinator
prerequisite: T1+T2+T3 all merged (Wave A complete)
```

**Worktree 명령**:

```bash
git worktree add .worktrees/enterprise-obs feat/enterprise-obs-amend
cd .worktrees/enterprise-obs
```

**Launch 명령**:

```
/moai run --team "ENTERPRISE-OBS-AMEND REQ-ENT-074~076 per .moai/plans/amendments-2026-05-05.md §2. File ownership: app/layout.tsx (Sentry ErrorBoundary wrap), lib/observability/langfuse-handler.ts (NEW), 3x route handlers, tests/integration/observability-4way.test.ts (NEW). DO NOT modify lib/observability/sentry.ts|posthog.ts|langfuse.ts (init layer). Closes #100. Branch: feat/enterprise-obs-amend."
```

**작업 단계**:

- [ ] T4-S1: `app/layout.tsx`에 `<Sentry.ErrorBoundary fallback={...}>` wrapping (REQ-ENT-074)
- [ ] T4-S2: `lib/observability/langfuse-handler.ts` 신규 — `withLangfuseTrace(handler)` 내보내기 (REQ-ENT-075)
- [ ] T4-S3: `app/api/ra/consult/route.ts` handler를 `withLangfuseTrace`로 wrap
- [ ] T4-S4: `app/api/ra/expert-review/*/route.ts`, `app/api/ra/consultations/*/route.ts` 동일 wrap
- [ ] T4-S5: `tests/integration/observability-4way.test.ts` 신규 — 단일 시나리오에서 Sentry/PostHog/Langfuse/Vercel 4 벤더 동시 수신 검증 (REQ-ENT-076)
- [ ] T4-S6: `X-Langfuse-Trace-Id` 응답 헤더 검증
- [ ] T4-S7: `pnpm test:integration && pnpm test && pnpm lint` 통과
- [ ] T4-S8: PR 생성, CI green 확인

**검증 기준**:

```bash
# Sentry ErrorBoundary 통합
grep -c "Sentry.ErrorBoundary\|@sentry/nextjs.*ErrorBoundary" app/layout.tsx  # >= 1
# Langfuse handler middleware
test -f lib/observability/langfuse-handler.ts && grep -c "withLangfuseTrace" lib/observability/langfuse-handler.ts  # >= 1
# 3 route handlers wrapped
for route in app/api/ra/consult/route.ts; do
  grep -c "withLangfuseTrace" $route  # >= 1
done
# 4-way integration test
pnpm test tests/integration/observability-4way.test.ts  # PASS
# X-Langfuse-Trace-Id header
curl -I http://localhost:3000/api/ra/consult | grep -i "X-Langfuse-Trace-Id"
```

**PR 생성**: 표준 템플릿 + `--title "[T4] ENTERPRISE-OBS-AMEND: 4-way observability integration gate (REQ-ENT-074~076)"`. Body 필수: `Closes #100`, ENTERPRISE-001 Group G amendment 3 REQs (074 ErrorBoundary / 075 langfuse-handler / 076 4-way gate), file ownership 4개, out-of-scope (init layer 변경 없음), verification 4개 (RootLayout / 3 routes / X-Langfuse-Trace-Id / integration test), `Risk: low (additive)`.

**Issue #101 코멘트 템플릿**:

```
[T4][DONE] ENTERPRISE-OBS-AMEND merged via PR #<NUM>
- REQ-ENT-074/075/076 verified
- 4-way (Sentry/PostHog/Langfuse/Vercel) integration gate green
- File ownership compliance: PASS
- Closes #100
- Wave B complete → RELEASE-001 acceptance ready
```

---

## 7. RC 태깅

> 사용자 개입 #8/#9 — RELEASE-001 acceptance 검증 + 최종 태깅

### 7.1 RELEASE-001 acceptance 검증

```bash
# 모든 RELEASE-001 acceptance criteria 점검
cat .moai/specs/SPEC-REGULA-RELEASE-001/acceptance.md

# 자동 검증 스크립트
bash scripts/release-rc1/acceptance-check.sh
```

**검증 항목**:

- [ ] REQ-REL-010: release PR CI green ✅ (T1+T2+T3+T4 merge 후)
- [ ] E2E 8 spec 중 7개 PASS (citation-click HARDENING-001 ownership 유지)
- [ ] 4-way observability integration test PASS
- [ ] deploy.yml dry-run PASS
- [ ] `.env.local` bootstrap E2E PASS
- [ ] Issue #97/#98/#99/#100 모두 closed
- [ ] 메타 Issue #101 진행률 100%

### 7.2 RC 태그 생성

```bash
# main 브랜치 최신 동기화
git checkout main
git pull origin main

# 태그 생성
git tag -a v1.0.0-rc -m "Regula 1차 RC v1.0.0-rc"
git push origin v1.0.0-rc

# GitHub Release 생성
gh release create v1.0.0-rc \
  --title "Regula 1차 RC v1.0.0-rc" \
  --notes "$(cat <<'EOF'
## Wave A
- T1 #99 QUALITY-AMEND (REQ-QUAL-026~028)
- T2 #98 DEPLOY-001 (4 groups, 11 REQs)
- T3 #97 E2EFIX-001 (7 spec activation, 3 groups, 10 REQs)

## Wave B
- T4 #100 ENTERPRISE-OBS-AMEND (REQ-ENT-074~076)

## Acceptance
- All RELEASE-001 acceptance criteria PASS
- See meta issue #101 for full audit trail
EOF
)" \
  --prerelease
```

### 7.3 최종 마무리

- [ ] Issue #101에 `[RC1][DONE] v1.0.0-rc tagged` 코멘트 + close
- [ ] `wave-progress-tracker` workflow 자동 disable
- [ ] runbook status를 `active` → `archived`로 변경 (frontmatter)

---

## 8. 트러블슈팅

### 8.1 ⚠ T1/T2/T3 PR CI fail

**진단**:
```bash
gh run view --log-failed
gh pr checks <PR-NUM>
```

**대응**:
1. CI fail 로그를 Issue #101에 코멘트 (raw 첨부 금지, 핵심 라인만)
2. Root cause 수정 후 push (재실행 금지)
3. 동일 fail 3회 연속 → Issue #101에 블로커 코멘트, 사용자 결정 대기

### 8.2 ⚠ T3 rebase 충돌 (`fixtures/auth.ts` 또는 `lib/env.ts`)

**시나리오**: T1 `lib/env.ts` placeholder regex 추가 vs T3 `fixtures/auth.ts` storage state 변경

**예상 충돌**:
- `lib/env.ts`: T3는 일반적으로 미수정. 충돌 발생 시 T1 변경사항 그대로 수용
- `fixtures/auth.ts`: T3 owner이므로 충돌 없음. 단, T1 머지 시 `.env.local` 부트스트랩 흐름 변경으로 storage state 시드 로직 영향 가능

**해결 절차**:
```bash
cd .worktrees/e2efix-rc1
git rebase origin/main
# 충돌 발생 시
git status  # 충돌 파일 확인
# lib/env.ts 충돌이면: T1 버전 채택 (theirs)
git checkout --theirs lib/env.ts
# fixtures/auth.ts 충돌이면: T3 버전 우선 + T1 placeholder regex 호환성 확인
git add <resolved-files>
git rebase --continue

# Rebase 후 재검증
pnpm install && pnpm test:e2e
```

### 8.3 🚫 File ownership 위반

**탐지**:
```bash
# §3 매트릭스와 PR diff 비교
gh pr diff <PR-NUM> --name-only
# 본인 ownership 외 파일 변경 발견 시
```

**대응**:
1. 즉시 해당 파일 변경 revert
2. Issue #101에 `[Tn][BLOCKED] ownership violation: <file>` 코멘트
3. 사용자 결정 대기 — ownership 재할당 또는 별도 SPEC 발행

### 8.4 ⚠ 메모리 부족 (RAM<16GB)

**증상**: 3-터미널 병렬 가동 시 OOM, Claude Code 응답 지연

**대응**:
1. 3-터미널 병렬 → **순차 실행**으로 전환 (T1 → T2 → T3 순서, Wave A 자체는 유지)
2. 각 터미널에서 `/clear` 자주 실행 (phase 전환 시점)
3. Issue #101에 `[INFRA][DEGRADED] sequential mode` 코멘트 추가
4. 9회 사용자 개입 한도 초과 가능성 — 추가 개입 양해

### 8.5 ⚠ Wave B 자동 알림 누락

**증상**: T1+T2+T3 머지 완료에도 `wave-b-trigger` 코멘트 없음

**수동 트리거**:
```bash
# 머지 상태 확인
gh pr list --state merged --label release-rc1 --base main

# 수동으로 Wave B 진입 코멘트
gh issue comment 101 --body "[WAVE-A][MANUAL-DONE] T1+T2+T3 verified merged. Wave B (T4) manually unlocked. Next: bash scripts/release-rc1/wave-b-launch.sh"

# Wave B 가동
bash scripts/release-rc1/wave-b-launch.sh
```

### 8.6 ⚠ Pre-flight 부분 실패 시 idempotent 재실행

**원칙**: PF-1~PF-8 모두 idempotent. 실패 단계만 다시 실행해도 무방.

**재실행 명령**:
```bash
# 전체 재실행 (안전)
bash scripts/release-rc1/preflight.sh

# 특정 단계만 재실행
bash scripts/release-rc1/preflight.sh --step PF-7
```

**복구 불가 케이스**:
- PF-2 SPEC 디렉토리 손상 → `git checkout origin/main -- .moai/specs/`
- PF-5 main 미커밋 변경 → `git stash` 후 재실행

---

## 9. 명령 Cheatsheet

### 9.1 3-터미널 복붙용 명령 박스

**T1 (Terminal 1)**:
```bash
# T1 setup
git worktree add .worktrees/quality-amend feat/quality-amend-rc1
cd .worktrees/quality-amend
# Launch in Claude Code:
# /moai run --solo "QUALITY-AMEND REQ-QUAL-026~028 ..."
```

**T2 (Terminal 2)**:
```bash
# T2 setup
git worktree add .worktrees/deploy-rc1 feat/deploy-rc1
cd .worktrees/deploy-rc1
# Launch in Claude Code:
# /moai run --solo "DEPLOY-001 RC1 deployment automation ..."
```

**T3 (Terminal 3)**:
```bash
# T3 setup
git worktree add .worktrees/e2efix-rc1 feat/e2efix-rc1
cd .worktrees/e2efix-rc1
# Launch in Claude Code:
# /moai run --team "E2EFIX-001 ..."
```

**T4 (Wave B, single terminal)**:
```bash
# T4 setup (after Wave A complete)
git worktree add .worktrees/enterprise-obs feat/enterprise-obs-amend
cd .worktrees/enterprise-obs
# Launch in Claude Code:
# /moai run --team "ENTERPRISE-OBS-AMEND REQ-ENT-074~076 ..."
```

### 9.2 Issue 모니터링 명령

```bash
# 메타 Issue 진행률
gh issue view 101 --comments | tail -50

# 5개 SPEC issue 상태
gh issue list --label release-rc1 --json number,state,title

# PR 머지 상태 (Wave A 추적)
gh pr list --label release-rc1 --json number,state,mergedAt,headRefName

# CI 실시간 모니터링
gh run watch
```

### 9.3 Worktree 관리

```bash
# 전체 worktree 목록
git worktree list

# Worktree 정리 (작업 완료 후)
git worktree remove .worktrees/<name>
git worktree prune

# 강제 정리 (디스크 부족 시)
git worktree remove --force .worktrees/<name>
```

---

## 10. 부록 — 의존성·리스크

### 10.1 SPEC 의존성 그래프

```
RELEASE-001 (umbrella)
  ├── E2EFIX-001 (T3) — depends_on: HARDENING-001 (file ownership 분리), GATE-001
  ├── DEPLOY-001 (T2) — depends_on: LAUNCH-001, CICD-001, related: CLOUDFLARE-001
  ├── QUALITY-AMEND (T1) — amendment to QUALITY-001 (Group G — Local Bootstrap)
  └── ENTERPRISE-AMEND (T4) — amendment to ENTERPRISE-001 (Group G — 4-way Observability)

Cross-amendment ownership:
  - QUALITY-001 amendment owner = T1 (Wave A)
  - ENTERPRISE-001 amendment owner = T4 (Wave B)
  - 두 amendment는 file ownership 충돌 없음 (T1: env/scripts/docs vs T4: app/api 라우트)
```

### 10.2 T3 → T1 의존성 상세

**의존 파일**: `lib/env.ts` (T1이 placeholder regex 추가, T3는 e2e runner에서 env load 의존)

**해결**:
- T1 머지 전: T3는 `playwright/globalSetup.ts` 작성 가능, e2e runner 검증은 T1 머지 후로 보류
- T1 머지 후: T3 worktree에서 `git rebase origin/main` 후 e2e CI 재실행

**리스크**: T1 PR CI fail 지속 시 T3 머지 지연 → Wave A 전체 지연
**완화**: T1을 P0 최우선으로 배정, Wave A 진입 즉시 T1부터 가동

### 10.3 시간 추정 사용 금지 (HARD)

본 runbook 내 모든 진행 단위는 **Priority(P0/P1/P2)**와 **Phase ordering(Wave A → Wave B → Tag)**으로만 표현된다. "2일", "1주", "ASAP" 등의 시간 추정 표현은 [HARD] 금지된다.

**대신 사용**:
- 우선순위: P0 (RC 진입 차단) > P1 (안정성 강화) > P2 (RC 후 정리)
- 순서: Wave A 병렬 → Wave A 머지 게이트 → Wave B 단일 → RELEASE-001 acceptance → Tag

### 10.4 리스크 매트릭스

| 리스크 | 영향 | 확률 | 완화 |
|--------|------|------|------|
| T1 CI 회귀 → Wave A 전체 지연 | High | Low | T1을 첫 가동, P0 배정, fail 시 즉시 사용자 알림 |
| T3 rebase 충돌 | Medium | Low | §8.2 절차 사전 숙지, file ownership 매트릭스로 충돌 면적 0% |
| Wave B 자동 트리거 누락 | Low | Medium | §8.5 수동 trigger 절차 제공 |
| 메모리 부족 (3-터미널) | Medium | Medium | §8.4 sequential fallback |
| Acceptance 검증 실패 | High | Low | §7.1 자동 스크립트 + 수동 체크리스트 |
| 사용자 개입 9회 초과 | Low | Medium | 트러블슈팅 발생 시 양해 필요, runbook 자체는 9회 한도 설계 |

---

**Runbook 종료** — 작업 진행 상황은 항상 Issue [#101](https://github.com/drake-lee/ra-med-bot/issues/101)에 동기화된다.
