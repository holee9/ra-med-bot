---
runbook_id: RELEASE-RC1
version: 4.0.0
created: 2026-05-05
updated: 2026-05-05
owner: drake.lee
meta_issue: "#101"
status: active
---

# Regula 1차 RC v1.0.0-rc 실행 콘티 (Runbook v4.0)

> **순차 싱글 터미널 모델** — 이슈 순서: #99 → #97 → #98 → #100 → RC 태깅

---

## 0. 메타

- **메타 Issue**: #101
- **Canonical 이슈**: #97, #98, #99, #100
- **의존성 순서**: #99 → #97 → #98 → #100
- **이전 모델**: 워크트리 병렬 3-터미널 (폐기 — ad68eef)

---

## 1. 이슈 순서 매트릭스

| 순서 | 이슈 | SPEC | 의존 | 우선순위 |
|---|---|---|---|---|
| 1 | #99 | SPEC-REGULA-QUALITY-001 | 없음 (P0 선행) | P0 |
| 2 | #97 | SPEC-REGULA-E2EFIX-001 | #99 결과 필요 | P0 |
| 3 | #98 | SPEC-REGULA-DEPLOY-001 | #97 이후 | P1 |
| 4 | #100 | SPEC-REGULA-ENTERPRISE-001 | #97+#98 머지 후 | P1 |

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

### Step 1 — #99 QUALITY-AMEND (P0)

**목적**: `pnpm dev:bootstrap` 스크립트 구현, placeholder 차단(REQ-QUAL-026/027), DEVELOPMENT.md 갱신(REQ-QUAL-028).

동반 자료:
- `.moai/specs/SPEC-REGULA-QUALITY-001/spec.md` (REQ-QUAL-026~028)
- `.moai/specs/SPEC-REGULA-QUALITY-001/plan.md`
- `.moai/specs/SPEC-REGULA-QUALITY-001/acceptance.md`

```bash
cd D:/workspace-github/ra-med-bot
git checkout -b work/issue-99-quality-bootstrap
claude
# Claude 세션 안에서:
/moai run SPEC-REGULA-QUALITY-001
```

파일 소유:
- `scripts/dev-bootstrap.ts`
- `package.json` — `dev:bootstrap` script 추가
- `lib/env.ts` — `dev-placeholder-` 차단 로직
- `DEVELOPMENT.md` — Section 2 갱신

완료 기준:
- `pnpm dev:bootstrap` → `.env.local` 생성
- `NODE_ENV=production` + placeholder 값 → fail-fast exit ≠ 0
- PR: `Closes #99`

---

### Step 2 — #97 E2EFIX-001 (P0, #99 완료 후)

**목적**: E2E skip 해제, Playwright globalSetup + `.auth.json` 안정화, CI E2E 증거 확보.

동반 자료:
- `.moai/specs/SPEC-REGULA-E2EFIX-001/spec.md`
- `.moai/specs/SPEC-REGULA-E2EFIX-001/plan.md`
- `.moai/specs/SPEC-REGULA-E2EFIX-001/acceptance.md`

```bash
git checkout main && git pull origin main
git checkout -b work/issue-97-e2efix
claude
# Claude 세션 안에서:
/moai run SPEC-REGULA-E2EFIX-001
```

파일 소유:
- `tests/e2e/**` (단, `tests/e2e/observability-integration.spec.ts`는 #100 소유 — 수정 금지)
- `tests/fixtures/auth.ts`
- `playwright.config.ts`
- `.github/workflows/ci.yml` — E2E job 조정

완료 기준:
- `pnpm test:e2e` 전체 PASS (chromium + firefox)
- `.auth.json` globalSetup 정상 생성
- PR: `Closes #97`

---

### Step 3 — #98 DEPLOY-001 (P1, #97 완료 후)

**목적**: 배포 자동화 — deploy.yml, Vercel preview/staging/production 파이프라인.

동반 자료:
- `.moai/specs/SPEC-REGULA-DEPLOY-001/spec.md`
- `.moai/specs/SPEC-REGULA-DEPLOY-001/plan.md`
- `.moai/specs/SPEC-REGULA-DEPLOY-001/acceptance.md`

```bash
git checkout main && git pull origin main
git checkout -b work/issue-98-deploy
claude
# Claude 세션 안에서:
/moai run SPEC-REGULA-DEPLOY-001
```

파일 소유:
- `.github/workflows/deploy.yml` (신규)
- `vercel.json` (조정 가능)

완료 기준:
- deploy.yml dry-run PASS
- preview/staging/production-vercel Environment 분리
- PR: `Closes #98`

---

### Step 4 — #100 OBS-AMEND (P1, #97+#98 머지 후)

**목적**: Sentry ErrorBoundary, Langfuse trace 미들웨어, 4-way 통합 E2E 게이트(REQ-ENTERPRISE-074~076).

동반 자료:
- `.moai/specs/SPEC-REGULA-ENTERPRISE-001/spec.md` (REQ-ENTERPRISE-074~076)

```bash
git checkout main && git pull origin main
git checkout -b work/issue-100-observability
claude --team
# Claude 세션 안에서:
/moai run SPEC-REGULA-ENTERPRISE-001
```

파일 소유:
- `app/layout.tsx` — Sentry ErrorBoundary
- `lib/observability/langfuse-handler.ts`
- `app/api/ra/consult/route.ts` — `withLangfuseTrace` 래핑
- `tests/e2e/observability-integration.spec.ts`

완료 기준:
- POST `/api/ra/consult` → 응답 헤더 `X-Langfuse-Trace-Id` 존재
- 4-way 통합 E2E PASS
- PR: `Closes #100`

---

## 4. PR 머지 게이트 (사용자)

머지 순서 [HARD]:
1. #99 PR → main 머지
2. #97 PR → main 머지
3. #98 PR → main 머지
4. #100 PR → main 머지

---

## 5. RC 태깅

모든 PR 머지 + main CI green 확인 후:

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

---

## 6. 파일 소유권 매트릭스

| 이슈 | 소유 파일 |
|---|---|
| #99 | `scripts/dev-bootstrap.*`, `lib/env.ts`, `DEVELOPMENT.md`, `package.json` (dev:bootstrap) |
| #97 | `tests/e2e/**` (obs 제외), `tests/fixtures/auth.ts`, `playwright.config.ts`, `.github/workflows/ci.yml` |
| #98 | `.github/workflows/deploy.yml`, `vercel.json` |
| #100 | `app/layout.tsx`, `lib/observability/**`, `app/api/ra/consult/route.ts`, `tests/e2e/observability-integration.spec.ts` |

---

## 7. 트러블슈팅

| 증상 | 원인 | 해결 |
|---|---|---|
| `pnpm db:migrate` 실패 | `.env.local` 미설정 | `.env.local`에 `DATABASE_URL` 입력 후 재실행 |
| Playwright 브라우저 누락 | 재설치 필요 | `pnpm exec playwright install chromium firefox` |
| merge conflict | 이전 브랜치 잔재 | `git status` 확인 후 충돌 해결 |

---

## 8. 명령 Cheatsheet

### Step 1 — #99

```bash
git checkout -b work/issue-99-quality-bootstrap
claude
# /moai run SPEC-REGULA-QUALITY-001
```

### Step 2 — #97 (#99 PR 머지 후)

```bash
git checkout main && git pull
git checkout -b work/issue-97-e2efix
claude
# /moai run SPEC-REGULA-E2EFIX-001
```

### Step 3 — #98 (#97 PR 머지 후)

```bash
git checkout main && git pull
git checkout -b work/issue-98-deploy
claude
# /moai run SPEC-REGULA-DEPLOY-001
```

### Step 4 — #100 (#97+#98 PR 머지 후)

```bash
git checkout main && git pull
git checkout -b work/issue-100-observability
claude --team
# /moai run SPEC-REGULA-ENTERPRISE-001
```

---

**Runbook 종료**. 4개 PR 모두 머지 + RC 태깅 완료 시 Issue #101 closed.
