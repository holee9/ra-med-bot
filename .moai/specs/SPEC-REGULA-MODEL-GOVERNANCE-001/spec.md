---
id: SPEC-REGULA-MODEL-GOVERNANCE-001
version: 1.0.0
status: completed
phase: system
priority: High
created: 2026-06-22
updated: 2026-06-22
author: manager-spec (batch-2026-06-22)
issue_number: 71
depends_on:
  - SPEC-REGULA-FOUNDATION-001
  - SPEC-REGULA-RELEASE-001
lifecycle_level: spec-anchored
labels:
  - component/backend
  - component/infra
---

# SPEC-REGULA-MODEL-GOVERNANCE-001 — LLM·프롬프트·템플릿 변경통제 (모델 버전 검증·승인·롤백)

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-06-22 | manager-spec (batch) | 초기 작성. Issue #71 기반. |

---

## §1 Purpose (목적)

### 1.1 배경 (Background)

Regula는 LLM, prompt, structured template, retrieval 설정에 따라 규제 문서 품질이 달라진다. #49 Validation과 #56 RLHF가 품질을 다루지만, 모델·프롬프트·템플릿 자체의 변경통제와 승인·롤백 체계는 별도 관리가 필요하다.

규제 문서 생성 제품에서는 모델 또는 prompt 변경이 기능 변경과 동일한 품질 리스크가 된다. 동일한 질문이라도 prompt가 바뀌면 citation 누락, hallucination, 잘못된 규제 해석으로 이어질 수 있다. 따라서 승인된 조합(approved combination)만 production에서 사용되어야 한다.

본 SPEC은 LLM provider, model version, prompt, template, eval set, retriever 설정 변경을 통제한다. 변경은 변경 요청 → eval run → expert approval → rollout 워크플로우를 거치며, 실패 시 이전 승인 버전으로 즉시 rollback한다.

모든 production answer에는 model/prompt/template version audit metadata가 기록되어 어떤 조합이 어떤 답변을 생성했는지 추적 가능하다. #56 RLHF 개선안은 승인 전 production에 반영되지 않는다.

### 1.2 규제 근거 (Regulatory Anchor)

- 21 CFR Part 11 — model/prompt 변경 승인 및 audit trail은 electronic record로 기록.
- GAMP 5 / ISO 13485 §4.1.6 — 소프트웨어 구성요소 변경통제 및 검증 재실행.
- ISO 14971 — 모델 변경에 따른 품질 리스크 평가.

### 1.3 본 SPEC의 범위 (In Scope)

- prompt/template registry 및 immutable versioning
- model provider/model id/version pinning
- retrieval config 변경 이력 관리
- 변경 요청 → eval run → expert approval → rollout 워크플로우
- 실패 시 이전 승인 버전 즉시 rollback
- production answer에 model/prompt/template version audit metadata 기록
- promptfoo eval threshold 및 regression suite를 release gate로 연결
- 승인되지 않은 prompt/model 조합 사용 시 runtime block

### 1.4 Out of Scope

- LLM 자체 fine-tuning 또는 training 파이프라인
- prompt 자동 생성/최적화 알고리즘
- RLHF 데이터 수집 로직 (#56 담당, 본 SPEC은 승인 게이트만 제공)

---

## §2 Requirements (EARS Format)

| ID | EARS Statement | Priority |
|----|---------------|----------|
| REQ-MODELGOV-001 | THE SYSTEM SHALL prompt 및 template을 registry에 immutable version으로 저장해야 한다 | High |
| REQ-MODELGOV-002 | THE SYSTEM SHALL model provider, model id, model version을 pinning하여 관리해야 한다 | High |
| REQ-MODELGOV-003 | THE SYSTEM SHALL retrieval config 변경 이력을 버전 단위로 관리해야 한다 | High |
| REQ-MODELGOV-004 | WHEN 변경 요청이 제출되면 THE SYSTEM SHALL eval run → expert approval → rollout 워크플로우를 강제해야 한다 | High |
| REQ-MODELGOV-005 | IF eval이 통과되지 않으면 THEN THE SYSTEM SHALL 해당 조합의 production 사용을 차단해야 한다 | High |
| REQ-MODELGOV-006 | WHEN rollback이 요청되면 THE SYSTEM SHALL 직전 승인 조합으로 즉시 복구해야 한다 | High |
| REQ-MODELGOV-007 | THE SYSTEM SHALL 모든 production answer에 model/prompt/template version audit metadata를 기록해야 한다 | High |
| REQ-MODELGOV-008 | IF 승인되지 않은 prompt/model 조합이 런타임에 사용되려 하면 THEN THE SYSTEM SHALL 실행을 차단해야 한다 | High |
| REQ-MODELGOV-009 | WHERE #56 RLHF 개선안이 존재하면 THE SYSTEM SHALL 해당 개선안을 승인 전 pending_review 상태로만 저장하고 production 반영을 금지해야 한다 | High |
| REQ-MODELGOV-010 | THE SYSTEM SHALL promptfoo eval threshold 및 regression suite를 release gate에 연결해야 한다 | High |
| REQ-MODELGOV-011 | IF promptfoo regression threshold가 미달이면 THEN THE SYSTEM SHALL release gate를 실패 처리해야 한다 | High |
| REQ-MODELGOV-012 | THE SYSTEM SHALL 변경 승인 시 승인자, 타임스탬프, eval 결과 링크를 audit_logs에 기록해야 한다 | High |
| REQ-MODELGOV-013 | WHEN 승인된 조합이 rollout되면 THE SYSTEM SHALL 활성 조합(active combination)을 단일하게 유지해야 한다 | Medium |
| REQ-MODELGOV-014 | IF 권한 없는 사용자가 변경 승인을 시도하면 THEN THE SYSTEM SHALL 거부하고 audit_logs에 기록해야 한다 | High |

---

## §3 Acceptance Criteria

| AC# | Criterion | Verification |
|-----|-----------|-------------|
| AC-01 | 모든 LLM 응답에 model/prompt/template version audit metadata가 기록됨 | Integration: answer 생성 후 metadata 필드 검증 |
| AC-02 | prompt 변경 시 eval 통과 전 production 사용이 차단됨 | Integration: eval 미통과 조합 사용 시도 시 block |
| AC-03 | rollback 명령으로 직전 승인 조합이 복구됨 | Integration: rollback 후 active combination 이전 버전 확인 |
| AC-04 | promptfoo regression threshold 미달 시 release gate가 실패함 | CI: threshold 미달 시나리오에서 gate fail |
| AC-05 | RLHF 개선안이 pending_review 상태로만 저장됨 | DB 조회: RLHF 제안 status=pending_review 확인 |
| AC-06 | 승인되지 않은 조합 런타임 사용이 차단됨 | Integration: unapproved 조합 호출 시 runtime block |
| AC-07 | 변경 승인이 승인자/타임스탬프/eval 링크로 audit에 기록됨 | DB 조회: audit_logs approval row 검증 |

---

## §4 Technical Approach

### 4.1 파일 구조

```
src/
  app/api/model-governance/
    prompt-registry/route.ts
    model-pinning/route.ts
    change-request/route.ts
    approve/route.ts
    rollback/route.ts
  lib/model-governance/
    registry.ts            # immutable prompt/template version 관리
    combination-resolver.ts # active approved combination 조회/검증
    runtime-guard.ts       # 미승인 조합 runtime block
    eval-gate.ts           # promptfoo threshold 연동
    audit-metadata.ts      # answer version metadata 부착
  db/schema/
    prompt-registry.ts
    model-pin.ts
    change-request.ts
    approved-combination.ts
```

### 4.2 DB Schema

- `prompt_registry`: id, kind (enum: prompt/template), content_hash, content (text), version, immutable (boolean default true), created_at
- `model_pin`: id, provider, model_id, model_version, retrieval_config (jsonb), created_at
- `change_request`: id, prompt_id (FK), model_pin_id (FK), eval_run_id, eval_status (enum: pending/passed/failed), approval_status (enum: pending_review/approved/rejected), approver_id (FK, nullable), created_at
- `approved_combination`: id, prompt_id (FK), model_pin_id (FK), active (boolean), approved_at, superseded_by (FK, nullable)
- `audit_logs` (기존): answer version metadata, 승인/rollback 이벤트

### 4.3 API Endpoints

- `POST/GET /api/model-governance/prompt-registry` — prompt/template 등록 (immutable)
- `POST /api/model-governance/change-request` — 변경 요청 + eval run 트리거
- `POST /api/model-governance/approve` — expert approval (RBAC gate)
- `POST /api/model-governance/rollback` — 직전 승인 조합 복구
- runtime-guard middleware — answer 생성 경로에서 active combination 검증

### 4.4 의존성

- 선행: SPEC-REGULA-FOUNDATION-001 (auth/RBAC/audit), SPEC-REGULA-RELEASE-001 (release gate)
- 연계: #39 Workflows LLM executor (생성 파이프라인), #49 Validation, #56 RLHF (승인 게이트), #48 Source Governance, #32 Release Gate
- 기술: Next.js 15, Drizzle ORM, PostgreSQL, promptfoo eval 연동, CI release gate
