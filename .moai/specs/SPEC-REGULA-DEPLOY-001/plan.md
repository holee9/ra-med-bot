# SPEC-REGULA-DEPLOY-001 — 구현 계획 (plan.md)

## 1. 개요

본 SPEC은 1차 RC 시점 배포 자동화를 다룬다. 신규 인프라 코드 1개 (`.github/workflows/deploy.yml`) + GitHub Environments 3종 정의 + 운영 secrets 등록만 존재한다. 신규 비즈니스 기능 0건.

## 2. Milestones (Priority-based, no time estimates)

### Milestone M1 — Priority High: deploy.yml 기본 골격 + Preview per PR

**대상 REQ**: REQ-DEPLOY-001, 002, 003, 004, 005, 006

작업 단위:

1. `.github/workflows/deploy.yml` 신규 작성 — 3 job 골격
   - `vercel-preview`: `on: pull_request` 트리거
   - `cloudflare-staging`: `on: push: branches: [main]` 트리거
   - `vercel-production`: `on: release` 또는 `on: push: tags: [release/v*]` 트리거
2. Vercel `amondnet/vercel-action@v25` 또는 `vercel/cli` 직접 호출 패턴 도입
3. `vercel deploy --prebuilt --token=$VERCEL_TOKEN` (preview), `--prod` (production) 분기
4. PR comment 자동 게시 (Vercel action 내장 기능 또는 `peter-evans/create-or-update-comment@v3`)
5. `wrangler deploy --env staging` (production 배제 검증 REQ-DEPLOY-002)

검증 지점:
- YAML parse OK + 3 job 정의 + 5 secret 참조
- PR open 시 preview URL 자동 게시 확인 (시범 PR로 시뮬레이션)

### Milestone M2 — Priority High: Production Manual Gate

**대상 REQ**: REQ-DEPLOY-007, 008, 009

작업 단위:

1. GitHub Repo Settings → Environments → `production-vercel` 신규 생성 (CLOUDFLARE-001 Phase 7의 `production-cloudflare`와 자원 분리)
   - Required reviewers: QA lead, Compliance lead, Product owner 중 1+
   - Deployment branches: `release/v*` 태그 한정
   - Wait timer: 0 minutes
2. `vercel-production` job에 `environment: production-vercel` 키 추가 (GitHub Actions 인식)
3. `release/v*` 태그 push 시 pending 상태 진입 검증
4. Workflow_dispatch 또는 branch direct push로 우회 시도 시 fail 검증

검증 지점:
- Test tag (`release/v0.0.1-test`) push → `vercel-production` pending 상태 진입
- Approve 후 deploy 실행 또는 reject 후 abort 확인
- 우회 시도 시 명확한 error 메시지 출력

### Milestone M3 — Priority Medium: Post-deploy Smoke 자동 호출

**대상 REQ**: REQ-DEPLOY-010, 011

작업 단위:

1. `post-deploy-smoke` 4번째 job 추가
   - `needs: [vercel-preview, cloudflare-staging, vercel-production]` 또는 `on.workflow_run` 트리거
   - 실행 시 deployed URL을 `BASE_URL` env로 전달
   - `bash scripts/post-deploy-smoke.sh` 실행
2. 실패 시 PR/release comment에 결과 게시 (`Smoke check: passed/failed`)
3. Production smoke 실패 시 unhealthy 라벨 + Sentry P1 alert 호출 (Vercel API + Sentry CLI)
4. **명시적으로** `vercel rollback` 호출 코드를 deploy.yml에 추가하지 않음 (REQ-DEPLOY-011)

검증 지점:
- Preview deploy 후 PR comment에 smoke 결과 게시
- Production deploy 후 release notes에 smoke 결과 추가
- 의도적 smoke 실패 주입 시 `vercel rollback` 호출 0건 확인

### Milestone M4 — Priority Medium: 문서화 + 운영 핸드오프

**대상 REQ**: 모든 REQ (문서화)

작업 단위:

1. `docs/runbook.md`에 deploy.yml 동작 + 트리거 매트릭스 + reviewer 명단 + secret 등록 절차 추가
2. `docs/deployment/release-tag-convention.md` 신규 — `release/v*` tag naming 규칙
3. README.md (필요 시) 1차 RC 배포 흐름 1줄 요약

검증 지점:
- runbook.md 4 섹션 추가 (트리거 / reviewer / secret / rollback)
- release-tag-convention.md 존재 + naming 표준 명시

## 3. 파일 변경 매트릭스

| 파일 | 작업 | Milestone | REQ |
| --- | --- | --- | --- |
| `.github/workflows/deploy.yml` | 신규 | M1, M2, M3 | REQ-DEPLOY-001~011 |
| `.github/workflows/ci.yml` | **수정 금지** (CICD-001 ownership) | — | — |
| `.github/workflows/cf-deploy.yml` | **미존재 유지** (CLOUDFLARE-001 Phase 7 ownership) | — | — |
| `vercel.json` | **수정 금지** (LAUNCH REQ-LAUNCH-037) | — | — |
| `wrangler.toml` | **수정 최소** ([env.staging] 블록 추가만 허용, CLOUDFLARE-001과 협의) | M1 (선택적) | REQ-DEPLOY-002 |
| `scripts/post-deploy-smoke.sh` | **수정 금지** (LAUNCH REQ-LAUNCH-043 단독 owner) | — | — |
| `docs/runbook.md` | 수정 (deploy 섹션 추가) | M4 | 문서화 |
| `docs/deployment/release-tag-convention.md` | 신규 | M4 | 문서화 |
| GitHub Environment `preview` | 신규 정의 (no protection rules) | M1 | REQ-DEPLOY-005 |
| GitHub Environment `staging` | 신규 정의 (no protection rules) | M1 | — |
| GitHub Environment `production-vercel` | 신규 정의 (Required reviewers + branch limit) — CLOUDFLARE-001 Phase 7의 `production-cloudflare`와 자원 분리 | M2 | REQ-DEPLOY-007 |

총 신규 파일: 2 (deploy.yml, release-tag-convention.md)
총 수정 파일: 1 (runbook.md) + wrangler.toml staging 블록 (선택적)
총 GitHub Environments: 3종 (preview / staging / production)

## 4. 기술 접근 (Technical Approach)

### 4.1 Vercel deploy 전략

`amondnet/vercel-action@v25` 또는 `vercel/cli` 직접 호출. PR comment 자동 게시 기능 내장.

Preview 단계:
- `vercel deploy --prebuilt --token=$VERCEL_TOKEN` (no `--prod` flag)
- 출력 URL을 GITHUB_OUTPUT에 캡처 → PR comment step에서 사용

Production 단계:
- `environment: production-vercel` 키로 manual approval 트리거 (CLOUDFLARE-001 Phase 7의 `production-cloudflare`와 자원 분리)
- approve 후 `vercel deploy --prod --prebuilt --token=$VERCEL_TOKEN`
- alias 설정: `vercel alias set <preview-url> regula.{prod-domain}`

### 4.2 Cloudflare staging 전략

`cloudflare/wrangler-action@v3` 사용:

- `pnpm build` (OpenNext.js prebuilt)
- `wrangler deploy --env staging` (production 배제)
- `wrangler.toml`의 `[env.staging]` 블록 사전 정의 필요 (운영 수동 작업)

Phase 7 cf-deploy.yml과 분리:
- 본 deploy.yml은 staging 한정
- cf-deploy.yml (Phase 7)은 production canary 전용

### 4.3 Production Manual Gate 메커니즘

GitHub Actions `environment:` 키 + Repository Settings의 Environments protection rules가 결합되어 동작:

- workflow에서 `environment: production-vercel` 명시 (CLOUDFLARE-001 Phase 7의 `production-cloudflare`와 자원 분리)
- Settings에서 `production-vercel` env에 `Required reviewers` 설정
- workflow가 environment에 진입 시 GitHub UI에서 reviewer가 approve 필요
- Deployment branches 제한으로 `release/v*` 태그만 허용

### 4.4 Smoke 자동 호출 + Auto-rollback 금지

**왜 auto-rollback 안 함**:
- LAUNCH REQ-LAUNCH-042가 수동 절차 명시 (vercel rollback + drizzle-kit down + flag kill switch + 5분 SLA)
- 자동 rollback은 false positive (smoke의 외부 의존성 outage) 시 정상 deploy를 erroneously rollback할 위험
- 1차 RC는 안전 우선 — 사람이 판단 후 rollback

**대신 무엇을 함**:
- Vercel deployment에 `unhealthy` 라벨 (Vercel API 호출)
- Sentry custom event `deploy.smoke.failed` 게시 → P1 알림 라우팅
- Slack/Teams 채널 메시지 (운영 수동 채널 구성 시)

## 5. 위험 (Risks) and Mitigations

| Risk | Mitigation |
| --- | --- |
| Vercel token 만료 | 90-day rotation 정책, runbook에 명시. 만료 시 fail-fast |
| Cloudflare staging env 미정의 | 본 SPEC RUN 진입 전 `wrangler.toml [env.staging]` 검증 단계 |
| Production reviewer 부재 시 auto-pass | Settings에서 reviewer 수동 검증 + acceptance.md G3 시나리오 |
| Smoke false positive (외부 outage) | RELEASE-001 REQ-REL-020 bounded build, 1회 retry 허용 |
| Tag naming 표준 위반 (`v1.0.0` vs `release/v1.0.0`) | `release-tag-convention.md` + REQ-DEPLOY-008 정규식 lock |
| Preview URL 공개 누출 | Vercel password protection 권고 (운영 수동, OOS) |
| `cf-deploy.yml` (Phase 7)와 file 충돌 | 파일명 분리 + REQ-DEPLOY-002 명시적 검증 |

## 6. RUN 진입 게이트

다음 사전 조건 만족 시 RUN 진입 가능:

- [ ] LAUNCH-001 status: completed (vercel.json + post-deploy-smoke.sh + runbook 존재 확인)
- [ ] CICD-001 status: completed (ci.yml 안정 동작)
- [ ] GitHub Secrets에 `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` 등록 완료 (운영 수동)
- [ ] `wrangler.toml` `[env.staging]` 블록 정의 (Phase 7과 협의)
- [ ] Production reviewer 명단 (QA lead / Compliance lead / Product owner) 확정 (운영 수동)
- [ ] CLOUDFLARE-001 cf-deploy.yml 미작성 상태 확인 (file 충돌 회피)

## 7. 완료 조건 요약

- [ ] 11 REQ 전부 acceptance 통과
- [ ] PR open → preview URL PR comment 자동 게시
- [ ] `release/v*` tag → production manual approval pending → approve 후 deploy + smoke
- [ ] Smoke 실패 시 unhealthy 라벨 + Sentry P1 + auto-rollback 0건
- [ ] `wrangler deploy --env production` 명령어가 deploy.yml에 미포함 (CLOUDFLARE-001 ownership 분리)
- [ ] 3 GitHub Environments 운영 (preview / staging / production)
- [ ] runbook.md + release-tag-convention.md 갱신
