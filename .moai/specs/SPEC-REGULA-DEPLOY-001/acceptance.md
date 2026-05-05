# SPEC-REGULA-DEPLOY-001 — 인수 기준 (acceptance.md)

## 1. 핵심 인수 기준 (Top-Level)

본 SPEC이 완료되었다고 판정하는 6개 핵심 게이트:

1. **G1**: `.github/workflows/deploy.yml` 존재 + 4 job (vercel-preview, cloudflare-staging, vercel-production, post-deploy-smoke) + 5 secret 참조
2. **G2**: PR open 시 Vercel preview URL이 PR comment에 자동 게시 (24시간 이내)
3. **G3**: `release/v*` tag push → `vercel-production` job pending 진입 + GitHub Environments `production-vercel` reviewer approve 후 deploy 성공 (Environment 자원은 CLOUDFLARE-001 Phase 7의 `production-cloudflare`와 분리)
4. **G4**: 모든 deploy 후 `post-deploy-smoke` 자동 실행 + 결과 게시
5. **G5**: Smoke 실패 시 `vercel rollback` 호출 0건 + unhealthy 라벨 + Sentry P1 alert 게시
6. **G6**: deploy.yml에 `wrangler deploy --env production` 명령어 0회 등장 (CLOUDFLARE-001 ownership 분리)

## 2. Given-When-Then 시나리오

### 2.1 Group A — deploy.yml 골격 (REQ-DEPLOY-001~003)

#### 시나리오 A1 — deploy.yml 파일 + 4 job

**Given** RUN M1 완료
**When** `.github/workflows/deploy.yml` 파싱
**Then** 다음 모두 존재:
- top-level `name: Deploy` (또는 동등)
- `jobs.vercel-preview` with `on: pull_request`
- `jobs.cloudflare-staging` with `on: push branches: [main]`
- `jobs.vercel-production` with `on: push tags: [release/v*]` 또는 `on: release`
- `jobs.post-deploy-smoke` with `needs: [vercel-preview, cloudflare-staging, vercel-production]` 또는 `on.workflow_run`

#### 시나리오 A2 — Required Secrets 5종 참조

**Given** RUN M1 완료
**When** deploy.yml `${{ secrets.* }}` 참조 grep
**Then** 다음 5개 모두 매치:
- `${{ secrets.VERCEL_TOKEN }}`
- `${{ secrets.VERCEL_ORG_ID }}`
- `${{ secrets.VERCEL_PROJECT_ID }}`
- `${{ secrets.CLOUDFLARE_API_TOKEN }}`
- `${{ secrets.CLOUDFLARE_ACCOUNT_ID }}`

#### 시나리오 A3 — production wrangler 명령 차단 + staging-only 단언 (REQ-DEPLOY-001a + 002)

**Given** RUN M1 완료
**When** `grep -nE "wrangler deploy" .github/workflows/deploy.yml` (REQ-DEPLOY-001a positive 단언 + REQ-DEPLOY-002 negative grep 결합)
**Then** 매치된 모든 `wrangler deploy` 호출이 `pnpm wrangler deploy --env staging` 형태이며, `--env production` / `--env preview` / no-env 변형은 0 매치 (production은 cf-deploy.yml ownership)
**And** `cloudflare-staging` job에서 `pnpm wrangler deploy --env staging` 호출 1회 이상 확인

### 2.2 Group B — Preview per PR (REQ-DEPLOY-004~006)

#### 시나리오 B1 — PR open 시 preview URL 자동 게시

**Given** RUN M1 완료, GitHub Secrets 등록
**When** 신규 PR open against main
**Then** GitHub Actions deploy.yml `vercel-preview` job이 트리거되고, 5분 이내 PR에 자동 comment 게시:
- comment 본문이 `Preview deployed:` 패턴 포함
- URL이 `https://*.vercel.app` 정규식 매치

#### 시나리오 B2 — Production secret 미주입

**Given** Vercel project settings에 production-scoped env vars 존재 (예: 운영 ANTHROPIC_API_KEY)
**When** `vercel env ls preview` 실행
**Then** preview env 목록에 production-only key가 등장하지 않음
**And** 의도적 production key를 preview에 주입 시 Vercel deployment fail

#### 시나리오 B3 — PR close 후 cleanup

**Given** PR이 merged 또는 closed 상태
**When** 24시간 경과
**Then** 해당 PR의 Vercel preview deployment가 dashboard에서 inactive 표시
**And** 본 SPEC은 custom cleanup logic을 추가하지 않음 (Vercel native 의존)

### 2.3 Group C — Production Manual Gate (REQ-DEPLOY-007~009)

#### 시나리오 C1 — GitHub Environments production-vercel 정의

**Given** RUN M2 완료
**When** GitHub Repo Settings → Environments → `production-vercel` 페이지 검사 (CLOUDFLARE-001 Phase 7의 `production-cloudflare`와 자원 분리)
**Then** 다음 모두 존재:
- Required reviewers 1+ (QA lead / Compliance lead / Product owner 중)
- Deployment branches: `release/v*` 한정
- Wait timer ≥ 0 minutes
**And** `production` (suffix 없음) Environment 이름은 본 SPEC에서 사용하지 않음 (예약 이름)

#### 시나리오 C2 — Release tag → manual approval pending

**Given** RUN M2 완료
**When** `git tag release/v1.0.0-rc-test && git push origin release/v1.0.0-rc-test`
**Then** GitHub Actions에서 `vercel-production` job이 pending 상태 진입
**And** UI에서 `production-vercel` environment reviewer에게 approval 요청 표시
**And** Approve 클릭 시 deploy 실행, Reject 클릭 시 abort

#### 시나리오 C3 — Workflow_dispatch 우회 차단

**Given** RUN M2 완료
**When** `gh workflow run deploy.yml --ref main` (workflow_dispatch 시도)
**Then** workflow가 trigger되지 않거나, trigger되어도 `vercel-production` job이 즉시 fail with `"Production deployment requires release/v* tag and environment approval"` 에러
**And** Vercel production deploy 0회 실행

#### 시나리오 C4 — Branch direct push 차단

**Given** RUN M2 완료
**When** `git push origin main` (release tag 없이) 후 workflow 실행 결과 확인
**Then** `vercel-production` job이 트리거되지 않음 (트리거가 `push tags: [release/v*]`로 제한)
**And** `cloudflare-staging` job만 실행 (정상)

### 2.4 Group D — Post-deploy Smoke (REQ-DEPLOY-010~011)

#### 시나리오 D1 — Preview deploy 후 smoke 자동 실행

**Given** PR 생성 + `vercel-preview` job 성공
**When** `vercel-preview` 완료
**Then** `post-deploy-smoke` job이 자동 트리거되고, BASE_URL env에 preview URL 주입
**And** `scripts/post-deploy-smoke.sh` 실행
**And** 결과가 PR comment에 추가 게시 (`Smoke check: passed` 또는 `Smoke check: failed: <reason>`)

#### 시나리오 D2 — Production deploy 후 smoke + release notes

**Given** `release/v*` tag deploy 성공
**When** `vercel-production` 완료
**Then** `post-deploy-smoke` 자동 트리거 + production URL 대상 실행
**And** GitHub Release notes 또는 release tag 코멘트에 smoke 결과 추가 (release notes body update via `gh release edit`)

#### 시나리오 D3 — Smoke 실패 → unhealthy 라벨 + Sentry P1 alert

**Given** Smoke가 fail (의도적 endpoint break 시뮬레이션)
**When** `post-deploy-smoke` job fail 종료
**Then** Vercel API 호출로 deployment 라벨 unhealthy 설정
**And** Sentry custom event `deploy.smoke.failed` 게시 (Sentry CLI 또는 HTTP API)
**And** workflow log에 `Skipping rollback per REQ-DEPLOY-011 — manual rollback required per runbook.md` 메시지 존재

#### 시나리오 D4 — Auto-rollback 0건 검증

**Given** Smoke fail 시나리오 D3
**When** workflow 종료 후 `gh run view --log` 분석
**Then** `vercel rollback` 명령 실행 0회
**And** Vercel deployment status가 `READY` 또는 `unhealthy` (인위적 라벨)로 유지
**And** 이전 deployment로의 traffic shift 0건

## 3. Edge Cases

| Edge Case | 처리 방식 | 검증 |
| --- | --- | --- |
| Vercel token 만료 | deploy job fail with 401 | 의도적 만료 token 주입 후 명확한 error 메시지 |
| Cloudflare staging env 미정의 | `cloudflare-staging` job fail with config error | `wrangler.toml [env.staging]` 제거 후 fail 확인 |
| `release/v*` 태그 외 tag (예: `v1.0.0`) push | `vercel-production` 미트리거 | 태그 push 후 workflow 미실행 확인 |
| Production approval 24시간 이내 미접수 | workflow timeout | GitHub Actions 기본 6h timeout (또는 custom) |
| Smoke의 외부 의존성 일시 outage (Anthropic 503) | 1회 retry 허용 (RELEASE-001 REQ-REL-020) | retry logic in post-deploy-smoke.sh (LAUNCH owner) |
| 동시 다중 PR preview deploy | Vercel concurrency-safe | 5 PR 동시 open 후 5 preview URL 생성 확인 |
| Production deploy 중 reviewer offline | workflow pending 유지 | UI에서 timeout 또는 manual cancel 가능 |
| Fork PR (외부 contributor) | secrets 접근 차단 | `pull_request` 트리거에서 fork PR은 secrets 미접근 (GitHub 기본 정책) |

## 4. Definition of Done

- [ ] G1~G6 6 핵심 게이트 모두 통과
- [ ] 11 REQ 모두 acceptance 시나리오 통과 (REQ-DEPLOY-001a 포함, 총 12 REQ로 카운트 가능)
- [ ] GitHub Environments 3종 운영 (preview / staging / production-vercel) — `production-cloudflare`는 CLOUDFLARE-001 Phase 7 ownership으로 본 SPEC 범위 외
- [ ] 5 GitHub Secrets 등록 완료 + 시범 PR로 preview 게시 확인
- [ ] 시범 release tag (`release/v0.0.1-test`) 시뮬레이션 완료 후 reviewer approve flow 검증
- [ ] 의도적 smoke fail 주입 후 auto-rollback 0건 + unhealthy 라벨 확인
- [ ] CLOUDFLARE-001 cf-deploy.yml 미존재 또는 file ownership 분리 검증
- [ ] runbook.md에 deploy 섹션 4개 (트리거 / reviewer / secret 등록 / rollback) 추가
- [ ] release-tag-convention.md 신규 + tag naming 표준 명시
- [ ] LAUNCH REQ-LAUNCH-042 수동 rollback 절차 그대로 계승 확인 (auto-rollback 미도입)

## 5. Quality Gate Criteria

- YAML lint 0 violation (deploy.yml)
- shellcheck 0 violation (deploy.yml inline shell scripts)
- TRUST 5 — Tested(시나리오 A1~D4 통과), Readable(job 명료한 명명), Unified(Vercel + Cloudflare 패턴 통일), Secured(production gate + secret scope 분리), Trackable(REQ-DEPLOY-NNN 추적)
- LAUNCH REQ-LAUNCH-041 manual approval 정책 그대로 계승
- LAUNCH REQ-LAUNCH-042 rollback 5-min SLA 계승
- LAUNCH REQ-LAUNCH-043 post-deploy smoke 인터페이스 계승

## 6. RACI (책임 매트릭스)

| 항목 | Responsible | Accountable | Consulted | Informed |
| --- | --- | --- | --- | --- |
| deploy.yml 작성 | manager-tdd / 구현 담당 | manager-spec | expert-devops | release-orchestrator |
| GitHub Environments 정의 | manager-git / 운영팀 | manager-spec | manager-git | — |
| Secret 등록 (5종) | 운영팀 (수동) | 운영팀 | manager-git | manager-spec |
| Production reviewer 명단 확정 | 운영팀 (수동) | 운영팀 | QA lead, Compliance lead, Product owner | manager-spec |
| `wrangler.toml [env.staging]` 정의 | 운영팀 / CLOUDFLARE-001 owner | manager-spec | CLOUDFLARE-001 owner | — |
| runbook.md / release-tag-convention.md | manager-docs | manager-spec | — | release-orchestrator |
| cf-deploy.yml ownership 분리 | manager-spec | manager-spec | CLOUDFLARE-001 owner | — |
| Smoke 실패 시 manual rollback 실행 | 운영팀 (수동) | 운영팀 | LAUNCH-001 owner | — |
| Auto-rollback 미도입 정책 | manager-spec | manager-spec | LAUNCH-001 owner | release-orchestrator |
