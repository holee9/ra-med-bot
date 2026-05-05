---
runbook_id: RELEASE-RC1
version: 5.0.0
created: 2026-05-05
updated: 2026-05-05
owner: drake.lee
status: active
---

# Regula 1차 RC v1.0.0-rc 실행 콘티 (Runbook v5.0)

> **순차 싱글 터미널** — 이슈 순서: #32 → #33 → #34 → #31 → RC 태깅
>
> **이전 히스토리**: v4.0(#97-#100 기반)은 해당 이슈들이 워크트리 트래커 폐기와 함께 CLOSED 처리되어 폐기. v5.0은 여전히 OPEN 상태인 원본 릴리즈 이슈를 기준으로 재정의.

---

## 0. 현재 상태

| 항목 | 상태 |
|---|---|
| 마지막 기능 커밋 | Phase 11 RBAC (PR #21, 2026-05-04) |
| RC 태그 v1.0.0-rc | 미생성 |
| 대시보드 종합 점수 | 7.1/10 |
| E2E 실행성 | 2/10 (skip 미해제) |
| 배포 자동화 | deploy.yml 미존재 |

---

## 1. 이슈 순서 매트릭스

| 순서 | 이슈 | 내용 | 우선순위 |
|---|---|---|---|
| 1 | [#32](https://github.com/holee9/ra-med-bot/issues/32) | RELEASE-GATE-001 — `.env.local` bootstrap, CI/Branch 정합성 | P0 |
| 2 | [#33](https://github.com/holee9/ra-med-bot/issues/33) | RELEASE-HARDENING-001 — E2E 활성화, deploy.yml, Dashboard 실데이터, console.* 제거 | P0 |
| 3 | [#34](https://github.com/holee9/ra-med-bot/issues/34) | QUALITY-001 — Corpus seed, Eval Pipeline, Cloudflare TODO 해소 | P1 |
| 4 | [#31](https://github.com/holee9/ra-med-bot/issues/31) | RELEASE-001 — 우산 SPEC (Sentry ErrorBoundary, Langfuse trace, 4-way 통합 게이트) | P1 |

---

## 2. 사전 작업 (1회)

```bash
cd D:/workspace-github/ra-med-bot

# .env.local 없으면 생성
cp .env.example .env.local
# DATABASE_URL, ANTHROPIC_API_KEY 등 실제 값 입력 후:
pnpm db:migrate

# Playwright 브라우저 (미설치 시)
pnpm exec playwright install chromium firefox
```

---

## 3. 이슈별 실행 절차

### Step 1 — #32 RELEASE-GATE-001 (P0)

**목적**: `.env.local` bootstrap 스크립트 구현, CI/Branch 정합성 확보.

동반 자료:
- `.moai/specs/SPEC-REGULA-RELEASE-GATE-001/spec.md`
- `.moai/plans/amendments-2026-05-05.md` §1 (REQ-QUAL-026~028 포함)

```bash
git checkout -b work/issue-32-release-gate
claude
# Claude 안: /moai run SPEC-REGULA-RELEASE-GATE-001
# PR 생성 후 → main 머지
```

**주요 파일**:
- `scripts/dev-bootstrap.ts` (신규)
- `package.json` — `dev:bootstrap` script 추가
- `lib/env.ts` — `dev-placeholder-` fail-fast 로직
- `DEVELOPMENT.md` — Section 2 갱신

**완료 기준**:
- `pnpm dev:bootstrap` → `.env.local` 생성
- `NODE_ENV=production` + placeholder → fail-fast exit ≠ 0
- PR: `Closes #32`

---

### Step 2 — #33 RELEASE-HARDENING-001 (P0, #32 완료 후)

**목적**: E2E skip 해제 7개, deploy.yml 신설, Dashboard/Knowledge 실데이터, console.* 제거.

동반 자료:
- `.moai/specs/SPEC-REGULA-RELEASE-HARDENING-001/spec.md`

```bash
git checkout main && git pull origin main
git checkout -b work/issue-33-hardening
claude
# Claude 안: /moai run SPEC-REGULA-RELEASE-HARDENING-001
# PR 생성 후 → main 머지
```

**주요 파일**:
- `tests/e2e/**` (7개 spec의 `test.skip(true)` 제거, `citation-click.spec.ts` 제외)
- `playwright/globalSetup.ts` (신규)
- `.github/workflows/deploy.yml` (신규)
- Dashboard/Knowledge 실데이터 연결

**완료 기준**:
- `pnpm test:e2e` PASS (chromium + firefox, skip 0개)
- deploy.yml dry-run PASS
- PR: `Closes #33`

---

### Step 3 — #34 QUALITY-001 (P1, #33 완료 후)

**목적**: Corpus seed 데이터 적재, Eval Pipeline 가동, Cloudflare TODO 해소.

동반 자료:
- `.moai/specs/SPEC-REGULA-QUALITY-001/spec.md`

```bash
git checkout main && git pull origin main
git checkout -b work/issue-34-quality
claude
# Claude 안: /moai run SPEC-REGULA-QUALITY-001
# PR 생성 후 → main 머지
```

**완료 기준**:
- `pnpm db:seed:corpus` 실행 → DB에 규제 청크 100+ 적재
- `/api/ra/consult` 실제 규제 답변 반환 확인
- PR: `Closes #34`

---

### Step 4 — #31 RELEASE-001 (P1, #33+#34 완료 후)

**목적**: 우산 SPEC — Sentry ErrorBoundary, Langfuse trace 미들웨어, 4-way 통합 E2E.

동반 자료:
- `.moai/specs/SPEC-REGULA-RELEASE-001/spec.md`
- `.moai/plans/amendments-2026-05-05.md` §2 (REQ-ENTERPRISE-074~076)

```bash
git checkout main && git pull origin main
git checkout -b work/issue-31-release
claude --team
# Claude 안: /moai run SPEC-REGULA-RELEASE-001
# PR 생성 후 → main 머지
```

**주요 파일**:
- `app/layout.tsx` — Sentry ErrorBoundary
- `lib/observability/langfuse-handler.ts`
- `app/api/ra/consult/route.ts` — `withLangfuseTrace` 래핑
- `tests/e2e/observability-integration.spec.ts`

**완료 기준**:
- 4-way observability E2E PASS
- PR: `Closes #31`

---

## 4. PR 머지 게이트 (사용자)

머지 순서: #32 → #33 → #34 → #31

---

## 5. RC 태깅

모든 PR 머지 + main CI green 후:

```bash
git checkout main && git pull origin main
$EDITOR CHANGELOG.md
git add CHANGELOG.md && git commit -m "docs: v1.0.0-rc 릴리즈 노트 갱신" && git push origin main

gh release create v1.0.0-rc \
  --title "Regula v1.0.0-rc — 1차 Release Candidate" \
  --notes-file CHANGELOG.md \
  --prerelease
```

---

## 6. 파일 소유권 매트릭스

| 이슈 | 소유 파일 |
|---|---|
| #32 | `scripts/dev-bootstrap.*`, `lib/env.ts` (placeholder 차단), `DEVELOPMENT.md`, `package.json` (dev:bootstrap) |
| #33 | `tests/e2e/**` (obs 제외), `playwright/globalSetup.ts`, `.github/workflows/deploy.yml`, Dashboard/Knowledge 컴포넌트 |
| #34 | `scripts/seed-corpus.*`, corpus seed 데이터, `lib/cloudflare/hybrid-router.ts` TODO 해소 |
| #31 | `app/layout.tsx`, `lib/observability/**`, `app/api/ra/consult/route.ts`, `tests/e2e/observability-integration.spec.ts` |

---

## 7. 트러블슈팅

| 증상 | 원인 | 해결 |
|---|---|---|
| `pnpm db:migrate` 실패 | `.env.local` 미설정 | `.env.local`에 `DATABASE_URL` 입력 후 재실행 |
| Playwright 브라우저 누락 | 재설치 필요 | `pnpm exec playwright install chromium firefox` |
| merge conflict | 이전 브랜치 잔재 | `git status` 확인 후 충돌 해결 |

---

## 8. 명령 Cheatsheet

```bash
# Step 1 — #32
git checkout -b work/issue-32-release-gate
claude  # /moai run SPEC-REGULA-RELEASE-GATE-001

# Step 2 — #33 (#32 PR 머지 후)
git checkout main && git pull
git checkout -b work/issue-33-hardening
claude  # /moai run SPEC-REGULA-RELEASE-HARDENING-001

# Step 3 — #34 (#33 PR 머지 후)
git checkout main && git pull
git checkout -b work/issue-34-quality
claude  # /moai run SPEC-REGULA-QUALITY-001

# Step 4 — #31 (#33+#34 PR 머지 후)
git checkout main && git pull
git checkout -b work/issue-31-release
claude --team  # /moai run SPEC-REGULA-RELEASE-001
```

---

**Runbook 종료**. 4개 PR 모두 머지 + RC 태깅 완료 시 v1.0.0-rc 릴리즈.
