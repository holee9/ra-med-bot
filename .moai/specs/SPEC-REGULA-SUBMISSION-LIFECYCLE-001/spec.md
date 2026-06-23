---
id: SPEC-REGULA-SUBMISSION-LIFECYCLE-001
version: 1.0.0
status: draft
phase: wave4
priority: High
created: 2026-06-22
updated: 2026-06-22
author: manager-spec (batch-2026-06-22)
issue_number: 37
depends_on:
  - SPEC-REGULA-FOUNDATION-001
  - SPEC-REGULA-WORKFLOWS-001
lifecycle_level: spec-anchored
labels:
  - component/frontend
  - component/backend
---

# SPEC-REGULA-SUBMISSION-LIFECYCLE-001 — 510(k)·CER·PCCP 산출물 패키징·검증·추적

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-06-22 | manager-spec (batch) | 초기 작성. Issue #37 기반. |

---

## §1 Purpose (목적)

### 1.1 배경 (Background)

Predicate Search(#22), CER Builder(#23), PCCP Builder(#24)가 완료되면 Regula는 핵심 규제 산출물을 생성할 수 있다. 그러나 실제 RA 업무에서는 산출물 생성이 끝이 아니다. 생성된 초안을 제출 패키지로 구성하고, readiness를 검증하며, 버전을 추적하고, 승인 상태를 관리하는 운영 단계가 필요하다.

본 SPEC은 개별 작성기들을 하나의 제출 라이프사이클로 묶는다. product/project 단위로 submission package를 생성하고, 각 산출물(draft, source evidence, checklist, reviewer approval, export artifact)을 package item으로 연결한다. Readiness Validator는 필수 섹션 누락, citation 미연결, unreviewed draft, stale regulatory update, unresolved knowledge gap을 검사하여 blocking/non-blocking finding으로 분리한다.

모든 export는 package version, artifact hash, reviewer approval snapshot과 함께 immutable audit trail을 생성하며, 이전 버전과의 변경 diff를 제공한다. 상태는 draft → review → approved → exported → submitted_external_manual → archived로 전이되며, 외부 제출은 수동 evidence upload와 receipt number 기록으로 추적한다.

이를 통해 Regula는 문서 생성기를 넘어 제출 준비 운영 도구로 발전한다. 단, 실제 외부 제출 API(FDA ESG/eSTAR, EUDAMED) 연동은 범위 외이다.

### 1.2 규제 근거 (Regulatory Anchor)

- FDA 510(k): 21 CFR 807 Subpart E, eCopy/eSTAR readiness checklist (실제 ESG 제출은 범위 외)
- EU MDR CER: Annex XIV, MEDDEV 2.7/1 Rev 4 stage completeness
- AI/ML PCCP: FDA Predetermined Change Control Plan guidance
- ISO 13485:2016 §4.2.5 (Control of Documents), §7.3.10 (Design and Development Files)
- audit trail은 21 CFR Part 11 record integrity 원칙 준수 (전자서명 full validation은 범위 외)

### 1.3 본 SPEC의 범위 (In Scope)

- Submission Package 모델: product/project 단위 package, type(FDA 510(k), EU MDR CER, AI/ML PCCP, internal review packet), package item(draft, source evidence, checklist, reviewer approval, export artifact)
- Readiness Validator: 필수 섹션·citation·review·stale source·knowledge gap 검사, blocking/non-blocking 분리, FDA eSTAR / EU Annex XIV completeness 검사
- Versioning & Audit: package version, artifact hash, reviewer approval snapshot, export별 immutable audit trail, 버전 diff
- Status Tracking: 상태 전이, manual submission evidence upload, external submission ID / receipt number 기록

### 1.4 Out of Scope

- FDA ESG/eSTAR 실제 mTLS 제출
- EU EUDAMED machine submission
- 공인기관 포털 자동 업로드

---

## §2 Requirements (EARS Format)

| ID | EARS Statement | Priority |
|----|---------------|----------|
| REQ-SUBMISSION-001 | WHEN a user creates a submission package THE SYSTEM SHALL associate it with a product or project and a package type (FDA 510(k), EU MDR CER, AI/ML PCCP, internal review packet) | High |
| REQ-SUBMISSION-002 | THE SYSTEM SHALL allow generated drafts from #22, #23, and #24 to be linked as package items | High |
| REQ-SUBMISSION-003 | WHEN a package item is added THE SYSTEM SHALL record its type as one of draft, source evidence, checklist, reviewer approval, or export artifact | High |
| REQ-SUBMISSION-004 | WHEN readiness validation runs THE SYSTEM SHALL detect missing required sections, unlinked citations, unreviewed drafts, stale regulatory updates, and unresolved knowledge gaps | High |
| REQ-SUBMISSION-005 | THE SYSTEM SHALL classify each readiness finding as blocking or non-blocking | High |
| REQ-SUBMISSION-006 | WHERE the package type is FDA 510(k) THE SYSTEM SHALL validate against an eCopy/eSTAR readiness checklist | Medium |
| REQ-SUBMISSION-007 | WHERE the package type is EU MDR CER THE SYSTEM SHALL validate Annex XIV / MEDDEV stage completeness | Medium |
| REQ-SUBMISSION-008 | IF a package contains any unreviewed or unresolved blocking item THEN THE SYSTEM SHALL block export | High |
| REQ-SUBMISSION-009 | WHEN a package is exported THE SYSTEM SHALL record the export artifact hash and reviewer approval snapshot in audit_logs | High |
| REQ-SUBMISSION-010 | WHEN a new package version is created THE SYSTEM SHALL display a diff against the previous version | Medium |
| REQ-SUBMISSION-011 | THE SYSTEM SHALL transition package status through draft, review, approved, exported, submitted_external_manual, and archived | High |
| REQ-SUBMISSION-012 | WHEN external submission occurs THE SYSTEM SHALL allow manual upload of submission evidence and recording of an external submission ID or portal receipt number | Medium |

---

## §3 Acceptance Criteria

| AC# | Criterion | Verification |
|-----|-----------|-------------|
| AC-01 | 프로젝트에서 submission package를 생성하고 type을 지정할 수 있다 | Test / Review |
| AC-02 | #22/#23/#24 산출물을 package item으로 연결할 수 있다 | Test |
| AC-03 | readiness validator가 blocking/non-blocking finding을 분리한다 | Test |
| AC-04 | unreviewed 또는 unresolved blocking item이 있으면 export가 서버 측에서 차단된다 | Test |
| AC-05 | export artifact hash와 reviewer snapshot이 audit_logs에 기록된다 | Test |
| AC-06 | manual submission receipt를 저장하고 상태를 전이할 수 있다 | Test / Review |
| AC-07 | 이전 버전과의 변경 diff가 표시된다 | Review |
| AC-08 | FDA 510(k) / EU MDR CER 각각의 completeness 검사가 동작한다 | Test |

---

## §4 Technical Approach

### 4.1 파일 구조

```
src/
  app/
    (dashboard)/submissions/
      page.tsx                  # package 목록
      [packageId]/page.tsx      # package detail, readiness, status
      [packageId]/diff/page.tsx # 버전 diff
    api/submissions/
      route.ts                  # package 생성/조회
      [packageId]/items/route.ts    # package item 연결
      [packageId]/readiness/route.ts # validator 실행
      [packageId]/export/route.ts    # export + hash + audit
      [packageId]/status/route.ts    # 상태 전이 + manual receipt
  lib/submissions/
    readiness/
      fda-510k.ts               # eSTAR checklist
      eu-mdr-cer.ts             # Annex XIV completeness
      validator.ts              # blocking/non-blocking 분류
    versioning.ts               # version diff, snapshot
    artifact-hash.ts            # export hash
  db/schema/submissions.ts
```

### 4.2 DB Schema

- `submission_packages`: id, project_id, package_type, status, current_version, created_at
- `submission_package_items`: id, package_id, item_type, source_ref (draft/evidence/checklist/approval/artifact id), created_at
- `submission_package_versions`: id, package_id, version, artifact_hash, reviewer_snapshot (jsonb), exported_at
- `readiness_findings`: id, package_id, finding_type, severity (blocking|non_blocking), detail, created_at
- `external_submissions`: id, package_id, external_id, receipt_number, evidence_file_ref, recorded_by, recorded_at
- audit_logs 재사용 — export·status 전이·version 기록

### 4.3 API Endpoints

- `POST /api/submissions` — package 생성
- `POST /api/submissions/{id}/items` — 산출물 연결
- `POST /api/submissions/{id}/readiness` — validator 실행, finding 반환
- `POST /api/submissions/{id}/export` — readiness 통과 검증 후 export, hash·snapshot·audit
- `POST /api/submissions/{id}/status` — 상태 전이, manual receipt 기록
- `GET /api/submissions/{id}/diff?from=&to=` — 버전 diff

### 4.4 의존성

- SPEC-REGULA-FOUNDATION-001 (project, audit_logs, RBAC, source/citation)
- SPEC-REGULA-WORKFLOWS-001 (draft 생성 산출물)
- #22 Predicate Search, #23 CER Builder, #24 PCCP Builder (package item 공급)
- #36 Review Ops (reviewed=true 게이트, reviewer approval snapshot)
