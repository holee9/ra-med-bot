---
artifact: research
spec_id: SPEC-REGULA-VALIDATION-001
version: 1.1.0
created: 2026-07-06
updated: 2026-07-06
author: manager-spec (plan-phase)
purpose: "구현 착수 전 코드베이스 분석 — 재사용 가능 자산·통합 지점·자동화 범위 식별"
---

# Research — SPEC-REGULA-VALIDATION-001

본 문서는 구현 착수 전(Plan phase) 코드베이스 정적 분석 결과를 기록한다. 목표는 (1) 재사용 가능 자산 식별, (2) 통합 지점 매핑, (3) 자동화 가능 영역과 수동 영역의 구분이다. Charter [지양-5]에 따라 신규 자산 생성을 최소화하고 기존 인프라를 집계하는 설계를 지향한다.

---

## §1 코드베이스 자산 인벤토리 (Reuse Map)

### 1.1 CI/Quality Gate 인프라 (IQ/OQ/PQ evidence 소스)

| 자산 | 경로 | 역할 | 검증 단계 |
|------|------|------|-----------|
| CI workflow | `.github/workflows/ci.yml` | typecheck/lint/format/test/rbac/audit/tokens gates | IQ(config) + OQ(unit) |
| E2E workflow | `.github/workflows/e2e.yml` | Playwright smoke + full suite | PQ |
| Security workflow | `.github/workflows/security.yml` | gitleaks/dependency scan | IQ(secret) |
| Deploy workflow | `.github/workflows/deploy.yml` | Vercel preview/prod | IQ(deploy) |
| Preflight | `scripts/preflight.sh` | 로컬 사전검증 (eval/e2e/load skip 플래그) | OQ/PQ 로컬 실행 |
| Env validation | `scripts/validate-runtime-env.ts` | lib/env.ts Zod 검증 | IQ(env/secret) |
| Migration check | `scripts/ci/check-migrations.ts` | `pnpm ci:migrations` | IQ(migration) |
| RBAC check | `scripts/qa/check-rbac.mjs` | `pnpm ci:rbac` | OQ(rbac) |
| Audit completeness | `scripts/qa/audit-completeness.ts` | `pnpm ci:audit` | OQ(audit) |
| QA gate scripts | `scripts/qa/gate-{0..5}-*.ts` | QA 게이트 0~5 (qa-gate-roadmap.md SSoT) | Gate 5 = 운영 QA |
| Eval | `tests/eval/promptfoo.config.yaml` + `pnpm eval:ci` | promptfoo eval 결과 (`tests/eval/results/latest.json`) | PQ(eval) |
| Release scripts | `scripts/release-rc1/{merge-gate,pr-body-template,safe-merge}.sh` | RC1 릴리즈 게이트 | Report 연동 |

**핵심 발견**: IQ/OQ/PQ evidence는 새 harness를 만들지 않고 위 결과를 집계하는 얇은 레코드 조립이다.

### 1.2 Audit Chain Foundation (PR #356, 방금 머지)

| 자산 | 경도 | 역할 |
|------|------|------|
| writeAudit (hash chain) | `lib/audit.ts:535+` | app-side `crypto.randomUUID()` 사전 생성 → INSERT 시 `previous_hash`, `chain_seq` 명시 전달 (REQ-AC-005) |
| Hash compute | `lib/audit/hash-chain.ts` | `chainHash_N = SHA256(canonical(row_N) ‖ chainHash_{N-1})` 점화식 |
| Verify | `lib/audit/verify-chain.ts` | chain 위반 탐지 (tamper-evidence) |
| Daily cron | `lib/inngest/audit/audit-chain-verify-daily.ts` | 일일 chain 검증 (SPEC-V3-AUDIT-CHAIN-001 M3) |

**활용 방식**: `validation_signoff` 테이블과 이중 저장하지 않고, sign-off 성공 시 `writeAudit` 1건 호출 (action_type: `validation.signoff`). `audit_logs` 행의 hash chain이 sign-off 무결성을 보장한다.

### 1.3 Model Governance (변경통제 7축 중 model/prompt 소스)

| 자산 | 경로 | 역할 |
|------|------|------|
| Registry | `lib/model-governance/registry.ts` | LLM 모델 registry, 메타데이터 |
| Pinning | `lib/model-governance/model-pinning.ts` | release별 model pinning 기록 |
| Change workflow | `lib/model-governance/change-workflow.ts` | model/prompt 변경 이력 |
| Eval gate | `lib/model-governance/eval-gate.ts` | eval 통과 게이트 |
| RLHF gate | `lib/model-governance/rlhf-gate.ts` | RLHF 피드백 게이트 |
| Rollback | `lib/model-governance/rollback.ts` | 모델 롤백 절차 |
| Combination | `lib/model-governance/combination-resolver.ts` | model+prompt 조합 |
| Audit | `lib/model-governance/audit.ts`, `audit-metadata.ts` | model-gov 변경 audit 메타데이터 |

**경계 (§3.2 spec.md 참조)**: `change-workflow.ts`가 model/prompt 변경 워크플로우 자체를 담당. 본 SPEC은 릴리즈 시점에 change-workflow 기록을 읽어 7축 중 `prompt`, `model` 축의 impact 평가에 소비한다. 중복 구현 금지.

### 1.4 DB 스키마 (기존)

| 자산 | 경로 | 내용 |
|------|------|------|
| 중앙 스키마 | `lib/db/schema.ts` | users, audit_logs, messages, workflow_runs 등 |
| DocIngest 스키마 | `lib/db/schema-docingest.ts` | source_sections, citations 등 (traceability SPEC) |
| Migrations | `migrations/*.sql` | 77+ 파일 (예: `0013_workflow_audit_actions.sql`, `0069_pms.sql`, `0077_model_governance.sql`, `0109_impact_wizard_columns.sql`) |

**발견**: `audit_logs` 테이블이 이미 `previous_hash`, `chain_seq` 컬럼을 보유 (PR #356). 본 SPEC의 `validation_evidence`, `change_control`, `validation_signoff` 3개 신규 테이블은 신규 마이그레이션 1건으로 추가.

### 1.5 기존 Validation/Evidence 코드 탐색 결과

```
grep -rn "validationEvidence\|releaseReport\|qualification" src/ app/ lib/  → 0 matches
```

**결론**: 현재 validation-specific 코드 부재. greenfield 구현이나 모든 빌딩 블록(audit, model-gov, CI, schema)은 존재. 따라서 본 SPEC의 구현은 **aggregator/glue** 코드가 중심이며, 신규 비즈니스 로직은 최소화.

---

## §2 통합 지점 (Integration Points)

### 2.1 SPEC-REGULA-TRACEABILITY-001 (#47) 연동

- Traceability SPEC은 source_sections/citations/messages/workflow_runs/expert_reviews/submission_packages/risk_items 간 evidence graph를 정의.
- 본 SPEC의 `validation_evidence` 레코드는 traceability graph의 **추가 노드 타입**으로 연결 가능 (`derived_from` edge로 release 노드와 연결).
- 단, 본 SPEC은 traceability graph 구현을 직접 하지 않고, TRACEABILITY-001이 완료된 후 노드 타입 확장을 후속 PR로 처리 (의존성 non-blocking).

### 2.2 SPEC-REGULA-RELEASE-001 (#31) §2.1 연동

- RELEASE-001 §2.1은 60개 OPEN 이슈를 5분류(in-scope/post-v0.1/Wave3/Wave5/QA-program)로 분류한 release 범위 SSoT.
- 본 SPEC의 `release_id`는 RELEASE-001이 관리하는 release 식별자를 참조.
- Release Validation Report의 "release scope status" 섹션은 RELEASE-001 §2.1의 5분류 상태를 집계.

### 2.3 _shared/qa-gate-roadmap.md (QA SSoT)

- QA Gate 0~5 중 본 SPEC은 Gate 5(운영 QA, #79)의 입력을 제공:
  - `validation_evidence` 레코드 → Gate 5 synthetic check 기준
  - `change_control` impact history → Gate 5 회귀 모니터링 대상 식별
  - Release Validation Report → Gate 5 rollback 판단 근거

### 2.4 CI run ID 매핑

- GitHub Actions run ID는 `gh run list --workflow=ci.yml --json databaseId,headSha,conclusion`로 획득.
- artifact path는 `gh run view <id> --log` 또는 actions API로 수집.
- artifact 만료(기본 90일) 전에 validation bundle로 확정 저장해야 함 → M2/M3 설계에서 snapshot 시점 명시.

---

## §3 자동화 가능 vs 수동 영역 구분

### 3.1 자동화 가능 (Auto-collect)

| 항목 | 소스 | 자동화 방법 |
|------|------|------------|
| commit SHA | git | `git rev-parse HEAD` |
| CI run ID | GitHub API | `gh run list --json` |
| test result (pass/fail/skip) | vitest/junit | `tests/results/junit.xml` 파싱 |
| artifact path | GitHub API | `gh run view --json artifacts` |
| dependency hash | `pnpm-lock.yaml` | sha256 |
| env/secret presence | `lib/env.ts` | Zod 검증 결과 |
| migration status | `scripts/ci/check-migrations.ts` | exit code |
| model change | `lib/model-governance/change-workflow.ts` | record 조회 |
| prompt change | git diff + `lib/model-governance/registry.ts` | 휴리스틱 + registry |
| schema change | `migrations/` diff | 파일 목록 비교 |
| E2E result | `.github/workflows/e2e.yml` artifact | HTML report path |
| eval result | `tests/eval/results/latest.json` | JSON 파싱 |

### 3.2 수동 (Human-in-loop)

| 항목 | 이유 | 담당 |
|------|------|------|
| `intended-use.md` 최초 작성 | 제품 사용 범위 선언은 전문가 판단 | RA Lead |
| criticality 분류 (critical/support/ancillary) | 기능별 비즈니스 임팩트 판단 | RA Lead + QA Lead |
| residual risk 서술 | 자동 분류 불가 | RA Lead |
| exception note 서술 | 자동 분류 불가 | QA Lead |
| final sign-off 승인 | 규제 책임 | Admin (validation:approve 권한) |

---

## §4 자동화 스크립트 설계 (구현 착수 시 참조)

### 4.1 Evidence Collector (신규, 경량)

```
scripts/validation/
  collect-iq.ts        # IQ bundle 생성 (env/deps/migrations/config/secret)
  collect-oq.ts        # OQ bundle 생성 (CI test 결과 매핑)
  collect-pq.ts        # PQ bundle 생성 (E2E + eval 매핑)
  classify-changes.ts  # 7축 분류 (model-gov + git diff)
  build-report.ts      # Markdown report 조립
  export-pdf.ts        # (post-v0.1) PDF 변환
```

### 4.2 자동화 트리거

- **수동**: `pnpm validation:collect --release=<id>` 명령
- **CI 연동**: `release-rc1` workflow 내에서 release tag 시점에 자동 실행 (별도 workflow job)
- **Inngest**: 주기적 evidence refresh (artifact 만료 전 갱신)

---

## §5 위험 분석 (구현 착수 전)

### 5.1 기술적 위험

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| CI run ID ↔ 테스트 결과 매핑 정확도 | 중 | 중 | `gh run view --json` 결과를 저장 후 추출; 추출 실패 시 result=skip + 로깅 |
| promptfoo eval 결과 스키마 변경 | 낮 | 중 | eval 결과 JSON 버전 핀; 스키마 검증 Zod 추가 |
| model-governance change-workflow 미구현 상태 | 중 | 높음 | M0~M3는 model-gov 없이 동작하는 fallback 모드 설계 (git diff 휴리스틱만 사용) |
| audit_logs chain 실패 | 낮 | 높음 | sign-off는 writeAudit 성공을 전제; 실패 시 500 + retry policy |

### 5.2 범위 위험 (Scope creep)

| Risk | Mitigation |
|------|-----------|
| "PDF도 만들어야 함" 확장 요구 | REQ-VAL-011을 Optional/Low로 고정; §8 Exclusions에 명시 |
| "QMS 워크플로우 통합" 확장 요구 | §1.4 Out of Scope, §8 Exclusions에 명시 |
| "real-time dashboard" 요구 | §8 Exclusions; observability는 별도 SPEC |
| "다중 관할권 matrix" 요구 | §8 Exclusions; post-v0.1 |

---

## §6 마이그레이션 설계 (개요)

신규 마이그레이션 1건 (`migrations/0NNN_validation_evidence.sql`, 번호는 착수 시점 최신 + 1):

```sql
-- validation_evidence: IQ/OQ/PQ 증거 레코드
CREATE TABLE validation_evidence (
  id UUID PRIMARY KEY,
  release_id TEXT NOT NULL,
  qualification_type TEXT NOT NULL CHECK (qualification_type IN ('iq','oq','pq')),
  commit_sha TEXT NOT NULL,
  ci_run_id BIGINT,
  test_command TEXT NOT NULL,
  artifact_path TEXT,
  result TEXT NOT NULL CHECK (result IN ('pass','fail','skip')),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- change_control: 7축 변경 영향 평가
CREATE TABLE change_control (
  id UUID PRIMARY KEY,
  release_id TEXT NOT NULL,
  change_axis TEXT NOT NULL CHECK (change_axis IN
    ('source_policy','prompt','model','schema','retrieval','export','review_workflow')),
  impact_level TEXT NOT NULL CHECK (impact_level IN ('low','medium','high')),
  rerun_required BOOLEAN NOT NULL,
  residual_risk TEXT NOT NULL,
  exception_note TEXT,
  evidence_ref UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- validation_signoff: 최종 승인
CREATE TABLE validation_signoff (
  id UUID PRIMARY KEY,
  release_id TEXT NOT NULL UNIQUE,
  checklist_state JSONB NOT NULL,
  approver_id UUID NOT NULL REFERENCES users(id),
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  report_artifact_path TEXT NOT NULL,
  audit_log_ref UUID
);

CREATE INDEX idx_validation_evidence_release ON validation_evidence(release_id);
CREATE INDEX idx_change_control_release ON change_control(release_id);
```

charter RLS(Regula-Lite Single-tenant) 전제이므로 tenant_id는 생략. 모든 테이블은 append-only (update 미지원, 갱신 시 신규 INSERT). audit_logs chain 무결성을 해치지 않음.

---

## §7 결론 및 구현 착수 전제조건

1. **재사용 전제 충족**: 모든 빌딩 블록(audit chain, model-gov, CI, DB)이 존재 → greenfield가 아닌 aggregator 구현.
2. **의존성 전제**: SPEC-V3-AUDIT-CHAIN-001(PR #356) 머지 완료. TRACEABILITY-001(#47)은 non-blocking이나 report의 traceability 섹션은 TRACEABILITY-001 완료 전까지 stub 허용.
3. **범위 원칙**: §1.5 CSV-lite, §8 Exclusions에 명시된 항목은 post-v0.1로 이월. 구현 중 scope creep 발생 시 plan.md의 milestone 재조정.
4. **자동화 한계**: §3.2 수동 항목은 사람이 작성. 자동화 강요 금지.
5. **plan.md의 milestone M0~M5가 본 research의 자산 인벤토리를 소비**.
