---
id: SPEC-REGULA-PHI-REMOVAL-001
version: 1.0.0
status: planned
phase: cleanup
priority: High
created: 2026-07-01
updated: 2026-07-01
author: manager-spec
issue_number: 319
depends_on: []
supersedes:
  - SPEC-REGULA-CAPA-001 (CAPA scope depends on Decision Point A/B below)
  - SPEC-REGULA-PMS-001 (PMS patientOutcome fields affected — see REQ-PHI-006)
lifecycle_level: spec-first
labels:
  - component/backend
  - component/schema
  - component/routes
  - type/cleanup
  - domain/compliance
---

# SPEC-REGULA-PHI-REMOVAL-001 — 환자정보 취급 도메인 제거 (Regula 정체성 정합)

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-07-01 | manager-spec | 초기 작성. Issue #319 기반. task #9 PHI touch point survey (~35지점)를 제거 계획으로 전환. |

---

## §1 Purpose (목적)

### 1.1 배경 (Background)

Regula는 의료기기 **규제 보고(Regulatory Affairs)** AI 챗봇으로, **내부 제품 개발 자료**(510(k) 제출서, 인증 문서, 내부 SOP)만 다룬다. 사용자의 확고한 기업 정책(non-negotiable policy): **환자 정보 미취급** — 환자 outcome, 임상 데이터, PHI 어떤 것도 다루지 않는다.

그러나 현재 코드베이스에는 이전 요구사항(SPEC-REGULA-CAPA-001, SPEC-REGULA-PMS-001)에서 도입된 환자정보 취급 코드가 ~35개 touch point에 걸쳐 잔존한다. 이 코드는 Regula의 정체성과 충돌하며, "환자 정보를 다루지 않는다"는 정책을 코드 차원에서 정합하기 위해 전부 제거해야 한다.

task #9(완료)가 이 touch point들을 survey했고, 본 SPEC은 이를 구체적인 제거 계획으로 전환한다.

### 1.2 제거 대상 도메인 (Removal Scope)

**직접 검증된 제거 대상 (Direct-Verified Removal Scope)** — orchestrator grep, 2026-07-01 기준:

1. **`lib/vigilance/` (3 files)**: `audit.ts`, `report-generator.ts`, `reportability-engine.ts`
   - FDA MDR / EU MDV 환자 outcome 보고(death/serious_injury/malfunction). Regula는 환자 outcome을 다루지 않으므로 완전 제거.

2. **`lib/ingest/pii/` (6 files)**: `policy-by-class.ts`, `presidio.ts`, `redact.ts`, `redaction-map.ts`, `regex.ts`, `workers-ai.ts`
   - PHI/PII redaction (환자 식별자). 환자 데이터를 취급하지 않으므로 무의미.

3. **`lib/db/schema.ts`**:
   - `adverse_events` 테이블 (line ~1612, `patient_outcome` column 포함)
   - `vigilance_reports` 테이블 (line ~1648)

4. **Routes**:
   - `app/api/ra/vigilance/` (1 dir: `route.ts`)
   - `app/api/ra/capa/` 하위 reportability/vigilance 연결 경로 (complaints/[id]/reportability 등)

5. **Cascade 참조 (23 files)**:
   - `lib/inngest/functions.ts` (ingest pipeline 내 PII redact 호출)
   - `lib/knowledge-gap/redaction.ts`
   - `lib/knowledge-sources/sync.ts`
   - CAPA 도메인 내 vigilance 교차참조 (reportability-mapping.ts, close-gate.ts 등)

### 1.3 규제·정책 근거 (Policy Anchor)

- **기업 정책 (non-negotiable)**: Regula는 환자 정보(PHI/PII, patient outcome, 임상 데이터)를 일절 취급하지 않는다.
- **Regula 정체성**: 내부 제품 개발 자료(510(k), 인증 문서, SOP)만 처리하는 Regulatory Affairs AI.
- **제거 정당성**: 환자 outcome 보고(MDR/MDV)와 PHI redaction은 Regula 범위 밖. 잔존 코드는 정책 위반 가능성을 만들고, maintenance 부담만 가중한다.
- **데이터 안전성**: 운영 DB `regula_test` 코퍼스 전부 0 (session-memo 2026-07-01 확인). 제거 대상 테이블은 empty이므로 DROP이 안전하다 (단, 적용 전 직검 필수 — L-010).

### 1.4 본 SPEC의 범위 (In Scope)

- vigilance 도메인 완전 제거 (3 lib files + route + DB 2 tables)
- PII redaction 도메인 완전 제거 (6 lib files + inngest cascade)
- DB migration (adverse_events, vigilance_reports 테이블 DROP + 관련 enum cleanup)
- 23개 cascade 참조 파일 갱신 (import 제거, 호출부 제거, 타입 정리)
- 테스트 갱신/제거 (vigilance/PII 관련 테스트 파일 제거 + cascade 테스트 정리)
- UI nav 링크 갱신 (vigilance/capa 보고 링크 제거/비활성화)
- CAPA 도메인 patientOutcome 필드/로직 처리 (Decision Point A/B에 따라 — §6)

### 1.5 Out of Scope

- vigilance/CAPA 대체 시스템 설계 (Regula는 환자 정보를 다루지 않으므로 대체 불필요)
- 이력 데이터 마이그레이션 (코퍼스 0, 보존할 데이터 없음)
- PMS 도메인 전체 제거 (PMS는 제품 품질 모니터링으로 Regula 범위 내일 수 있음 — patientOutcome 필드만 제거, §6 Decision Point 참조)
- 보안 감사 로그(audit_logs)에서 환자 outcome 관련 action enum 값 제거 (별도 cleanup 권장사항으로만 기록)

---

## §2 Requirements (EARS Format)

| ID | EARS Statement | Priority |
|----|----------------|----------|
| REQ-PHI-001 | THE SYSTEM SHALL 환자정보 취급 코드를 포함하지 않아야 한다 (production code에서 `patientOutcome\|patient_outcome\|adverse_event\|vigilance_report\|presidio\|PII redact` grep 결과 0건) | High |
| REQ-PHI-002 | WHEN 스키마 마이그레이션이 적용되면 THE SYSTEM SHALL `adverse_events` 및 `vigilance_reports` 테이블과 관련 enum 값을 DROP하여야 한다 (데이터 보존 필요 없음 — 코퍼스 0 사전 검증 후) | High |
| REQ-PHI-003 | THE SYSTEM SHALL cascade 참조 23개 파일에서 제거된 도메인 모듈에 대한 import와 호출을 제거하여야 한다 (inngest ingest pipeline 내 PII redact 호출 제거 포함) | High |
| REQ-PHI-004 | THE SYSTEM SHALL `app/api/ra/vigilance/` 및 CAPA-vigilance 연결 route를 제거하여야 하며 UI nav 링크를 갱신하여야 한다 | High |
| REQ-PHI-005 | WHEN 테스트 스위트가 실행되면 THE SYSTEM SHALL vigilance/PII 관련 테스트 파일을 제거/갱신하고 전체 스위트 green(현재 4819 passed 기준 regression 0)을 유지하여야 한다 | High |
| REQ-PHI-006 | IF Decision Point A(완전 CAPA 제거)가 선택되면 THE SYSTEM SHALL `lib/capa/` 14개 파일과 capa routes, capa DB 테이블(complaints, capa_records 등 5개), CAPA 관련 enum/migration을 전부 제거하여야 한다 | High |
| REQ-PHI-007 | IF Decision Point B(CAPA 유지 + patientOutcome 필드 제거)가 선택되면 THE SYSTEM SHALL CAPA 도메인에서 `patientOutcome`/`patient_outcome` 필드와 severity-from-patient 로직만 제거하고 CAPA를 제품 품질 QMS 기능으로 보존하여야 한다 | High |
| REQ-PHI-008 | THE SYSTEM SHALL 제거 작업을 단계적 순서로 수행하여야 한다 (routes → lib → schema migration, 최소 regression risk 순) | Medium |
| REQ-PHI-009 | THE SYSTEM SHALL 각 제거 단계마다 rollback SQL과 rollback 절차를 제공하여야 한다 | Medium |
| REQ-PHI-010 | THE SYSTEM SHALL 환자정보 취급 잔존 여부를 검증하는 grep 기반 게이트를 CI에 추가하여야 한다 (regression 방지) | Medium |

---

## §3 Acceptance Criteria

| AC# | Criterion | Verification |
|-----|-----------|--------------|
| AC-01 | `lib/vigilance/` 3 files 전부 제거, `lib/ingest/pii/` 6 files 전부 제거 | `ls lib/vigilance lib/ingest/pii` → not found |
| AC-02 | `grep -rn "patientOutcome\|patient_outcome\|adverse_event\|vigilance_report\|presidio" lib/ app/ migrations/` 결과 0건 (Decision Point B 선택 시 patientOutcome는 CAPA/PMS 잔존 허용 — 단 AC-08 명시된 파일만) | grep 게이트 |
| AC-03 | `grep -rn "redact\|presidio\|workers-ai.*pii" lib/inngest/ lib/knowledge-gap/ lib/knowledge-sources/` 결과 0건 (cascade 정리 완료) | grep 게이트 |
| AC-04 | migration `0102_drop_phivigilance_tables.sql` 적용 후 `adverse_events`, `vigilance_reports` 테이블 DROP 확인 (실DB `regula_test` `\d adverse_events` → does not exist) | psql 직검 (L-010) |
| AC-05 | rollback SQL `0102_drop_phivigilance_tables_rollback.sql` 존재 및 테스트 DB에서 정상 동작 검증 | rollback 시연 |
| AC-06 | route 제거: `app/api/ra/vigilance/route.ts` 404, CAPA reportability route 비활성화 | curl/E2E |
| AC-07 | 전체 테스트 스위트 green: `pnpm test` → 0 failed (4819 baseline에서 vigilance/PII 테스트 감소분만큼 감소 허용, 신규 failure 0) | test runner |
| AC-08 | Decision Point A 선택 시: `lib/capa/` 14 files 제거, capa DB 5 tables DROP, SPEC-REGULA-CAPA-001 deprecated 표시. Decision Point B 선택 시: `patientOutcome` 필드만 제거, CAPA 기능 보존, `trend-detector.ts:58` severity 로직 대체 | grep + 기능 테스트 |
| AC-09 | `pnpm typecheck` 0 에러, `pnpm lint` 0 에러, `pnpm build` 0 에러 | 품질 게이트 |
| AC-10 | UI nav에서 vigilance 링크 제거 확인. CAPA는 Decision Point에 따라 nav 유지/제거 | 수동/UI 테스트 |
| AC-11 | CI grep 게이트 추가: 환자정보 키워드 감지 시 fail (Decision Point B의 명시된 잔존 위치는 allowlist 제외) | CI config 검증 |

---

## §4 Technical Approach

### 4.1 제거 순서 (Phasing — 최소 regression risk)

**원칙**: leaf node(의존성 없음) → internal lib → schema migration. 각 단계 독립 commit + regression test 게이트.

| Phase | 작업 | Regression Risk | 검증 |
|-------|------|-----------------|------|
| **P1: Routes 제거** | `app/api/ra/vigilance/`, CAPA reportability route 비활성화 | 낮음 (UI 연결 끊김 → 404만) | E2E route 404 확인 |
| **P2: Cascade 정리** | `lib/inngest/functions.ts` PII redact 호출 제거, `lib/knowledge-gap/redaction.ts`, `lib/knowledge-sources/sync.ts` 갱신 | 중간 (ingest pipeline 동작) | ingest E2E 통과 확인 |
| **P3: lib/vigilance + lib/ingest/pii 제거** | 9개 파일 삭제 + import 정리 | 중간 (컴파일 의존성) | typecheck 0 에러 |
| **P4: CAPA Decision 적용** | Decision Point A(전체 제거) 또는 B(patientOutcome 필드만) | A=높음, B=중간 | AC-08 시나리오 |
| **P5: 테스트 정리** | vigilance/PII 테스트 파일 제거 + cascade 테스트 갱신 | 낮음 | `pnpm test` green |
| **P6: Schema migration** | `0102_drop_phivigilance_tables.sql` 적용 | 높음 (DDL) | 실DB 직검 (L-010) |
| **P7: CI grep 게이트** | `.github/workflows/` 또는 pre-commit에 grep 게이트 추가 | 낮음 | CI 통과 |

### 4.2 파일 구조 (제거 대상)

```
# 완전 제거 (P3)
lib/vigilance/                          # 3 files 전체 dir 삭제
  audit.ts
  report-generator.ts
  reportability-engine.ts
lib/ingest/pii/                         # 6 files 전체 dir 삭제
  policy-by-class.ts
  presidio.ts
  redact.ts
  redaction-map.ts
  regex.ts
  workers-ai.ts

# Cascade 갱신 (P2, 23 files)
lib/inngest/functions.ts                # PII redact import + 호출 제거
lib/knowledge-gap/redaction.ts          # redact 모듈 참조 제거
lib/knowledge-sources/sync.ts           # PII 관련 참조 제거
# (+ CAPA internal cross-refs — Decision Point에 따라)

# Routes 제거 (P1)
app/api/ra/vigilance/                   # route.ts 포함 dir 삭제
app/api/ra/capa/complaints/[id]/reportability/   # reportability route 제거

# Tests 제거 (P5)
__tests__/lib/vigilance/reportability-engine.test.ts
tests/unit/ingest/pii-regex.test.ts
tests/unit/ingest/pii-policy-by-class.test.ts
tests/unit/ingest/pii/workers-ai.test.ts
tests/unit/ingest/pii/presidio.test.ts
tests/unit/lib/ingest/pii/redaction.test.ts
# (+ vigilance/PII를 참조하는 통합 테스트 갱신)
```

### 4.3 DB Schema Migration

**Migration 파일 컨벤션** (hand-written SQL, `migrations/` 디렉토리):
- forward: `migrations/0102_drop_phivigilance_tables.sql`
- rollback: `migrations/0102_drop_phivigilance_tables_rollback.sql`

**forward SQL (개요)**:
```sql
-- 0102_drop_phivigilance_tables.sql
-- SPEC-REGULA-PHI-REMOVAL-001: Regula 정체성 정합 — 환자정보 취급 테이블 제거
-- 사전 검증: SELECT COUNT(*) FROM adverse_events; → 0, SELECT COUNT(*) FROM vigilance_reports; → 0

-- 1. 테이블 DROP
DROP TABLE IF EXISTS vigilance_reports CASCADE;
DROP TABLE IF EXISTS adverse_events CASCADE;

-- 2. 관련 enum 정리 (adverse_event_outcome 등 — 사전 직검 필요)
DROP TYPE IF EXISTS adverse_event_outcome CASCADE;

-- 3. audit_logs의 vigilance/adverse_event 관련 workflow_type enum 값은
--    별도 cleanup 권장사항(Out of Scope) — enum lockstep 이슈 회피
```

**rollback SQL (개요)**:
```sql
-- 0102_drop_phivigilance_tables_rollback.sql
-- 주의: 복구 시 데이터는 복구되지 않음 (코퍼스 0이므로 무의미)

-- 테이블 재생성 (schema.ts의 원본 정의 기반)
CREATE TABLE adverse_events (...);  -- schema.ts 원본 참조
CREATE TABLE vigilance_reports (...);
-- enum 재생성
```

### 4.4 의존성 (Dependencies)

- **독립**: 본 SPEC은 다른 진행 중 SPEC에 의존하지 않음 (제거 작업이므로).
- **영향 받는 SPEC**:
  - `SPEC-REGULA-CAPA-001` (completed) — Decision Point A 선택 시 deprecated 처리 필요.
  - `SPEC-REGULA-PMS-001` — `pms_inputs` 테이블의 `complaint_trend` source가 patientOutcome-driven severity 사용 (Decision Point B 선택 시 해당 로직 제거).

### 4.5 Regression-Risk Matrix

| 영역 | Risk | 완화 방안 |
|------|------|-----------|
| **inngest ingest pipeline** | HIGH — PII redact 제거 후 ingest 동작 변경 | P2 후 ingest E2E 전체 통과 확인. redact 제거는 no-op 처리(문서만 ingest, PII mask 미적용) |
| **knowledge-gap/sources** | MEDIUM — redaction 모듈 참조 누락 시 컴파일 에러 | P2에서 import/call 사전 grep → typecheck 게이트 |
| **CAPA close-gate** | MEDIUM — vigilance 연결 누락 시 close 차단 로직 붕괴 | Decision Point A면 전체 제거, B면 로직 비활성화 |
| **DB migration** | HIGH — 운영 DB DDL. 코퍼스 0이라도 rollback 절차 필수 | 사전 COUNT(*) 직검 + rollback SQL 사전 테스트 (L-010) |
| **UI nav** | LOW — 죽은 링크만 | P1 후 수동 클릭 테스트 |

---

## §5 Implementation Notes

> 본 섹션은 구현 진행 중 갱신된다. 현재는 placeholder.

- (구현 시작 후 갱신)

---

## §6 Decision Point — CAPA Scope (사용자 결정 필요)

**상황**: CAPA(Corrective/Preventive Action)는 QMS 기능(21 CFR 820 / ISO 13485)으로, 제품 품질(defects, complaints)에 집중할 수도 있고 환자 outcome에 연결될 수도 있다. 현재 코드는 두 가지가 얽혀 있다.

**Entanglement 증거**:
- `lib/capa/trend-detector.ts:58`: `params.intake.patientOutcome === 'death' ? 'critical' : 'moderate'` — severity가 patientOutcome 기반.
- `lib/capa/reportability-mapping.ts:20`: `mapComplaintToAdverseEvent`가 `patientOutcome`을 vigilance engine에 전달.
- CAPA close-gate가 vigilance reportability 연결을 강제(REQ-CAPA-011).

### Option A — CAPA 도메인 완전 제거 (Full Removal)

**범위**: `lib/capa/` 14 files 전체 + `app/api/ra/capa/` routes + capa DB 5 tables (complaints, capa_records, capa_root_causes, capa_links, capa_effectiveness_checks) + SPEC-REGULA-CAPA-001 deprecated 처리.

**장점**:
- Regula 정체성(내부 제품 개발 자료 RA)과 가장 일관됨. CAPA는 QMS 운영 기능으로, 내부 자료 분석 AI의 범위 밖.
- vigilance와 깊게 얽혀 있어 부분 제거보다 깔끔함.
- 제거 후 maintenance 부담 영구 제거.

**단점**:
- SPEC-REGULA-CAPA-001(completed, Wave5)의 구현 투자가 무효화.
- 향후 RA 역할에서 CAPA 기능이 필요해지면 재구축 비용.

**근거**: Regula는 QMS 운영 시스템이 아니라 RA 문서 분석 AI. CAPA 폐루프는 QMS 운영 담당 시스템의 역할.

### Option B — CAPA 유지 + patientOutcome 필드만 제거 (Field-Only Removal)

**범위**: `lib/capa/` 14 files 유지. 다음만 제거:
- `types.ts`의 `ComplaintIntake.patientOutcome` 필드
- `trend-detector.ts:58`의 severity-from-patientOutcome 로직 → device defect 기반 severity로 대체 (또는 'moderate' 고정)
- `reportability-mapping.ts`의 `patientOutcome` 전달 제거 → vigilance engine 연결 끊기
- DB `complaints` 테이블의 `intake_data.patientOutcome` 필드 제거 (JSON column이므로 schema 변경 불필요, 애플리케이션 레벨만)
- CAPA close-gate에서 vigilance 연결 강제(REQ-CAPA-011) 제거

**장점**:
- 제품 품질 QMS 기능(defect, complaint 추적) 보존.
- CAPA 투자 보호.

**단점**:
- CAPA가 환자 outcome과 분리되어 "제품 결함 추적"으로 좁아짐 — 이것이 QMS 표준이긴 하나, vigilance 연결 없는 CAPA는 반쪽짜리.
- `reportability-mapping.ts`, close-gate 로직 재설계 필요.

**근거**: CAPA를 순수 제품 품질 QMS로 유지하면 환자 정보 없이도 defect 추적은 가능.

### 권장사항 (Recommendation)

**권장: Option A (CAPA 완전 제거)**.

이유: (1) Regula 정체성(내부 제품 개발 자료 RA AI)과 QMS 운영(CAPA)은 역할이 다르다. (2) vigilance와 얽힌 정도가 깊어 부분 제거는 복잡도만 남긴다. (3) 코퍼스 0이므로 제거 비용이 낮다. 단, 최종 결정은 사용자가 한다.

> **이 Decision Point는 사용자 승인이 필요합니다. 구현 시작 전 Option A 또는 B를 확정해야 합니다.**

---

## §7 Rollback Plan

### 7.1 코드 Rollback (P1–P5)

- 각 phase를 개별 commit으로 분리 → 부분 rollback 가능.
- P3(파일 삭제) rollback: `git revert <commit>`로 파일 복구.
- P2(cascade 갱신) rollback: 각 파일의 원본 상태로 `git checkout`.

### 7.2 DB Migration Rollback (P6)

- `0102_drop_phivigilance_tables_rollback.sql` 사전 작성 + 테스트 DB 검증.
- rollback 적용 순서: rollback SQL 실행 → schema.ts 갱신 revert → 애플리케이션 재배포.
- **주의**: rollback은 스키마만 복구. 데이터는 코퍼스 0이므로 복구 불필요.

### 7.3 전체 Rollback 시나리오 (production 중단 필요 시)

1. 이전 main 브랜치로 `git revert` (또는 `git reset` — 단 main 직접 push 금지, feature branch 경유).
2. rollback SQL 적용.
3. 애플리케이션 재배포.
4. regression 테스트 전체 실행.

---

## §8 Exclusions (What NOT to Build)

본 SPEC은 제거 작업만 다룬다. 다음은 명시적으로 제외:

- **vigilance/CAPA 대체 시스템 설계 금지**: Regula는 환자 정보를 다루지 않으므로 대체 시스템 불필요. 제거 후 빈 자리를 채우려 하지 말 것.
- **PHI handling 프레임워크 도입 금지**: "나중에 필요할 수 있으니" 프레임워크를 남기지 말 것. 사용자 정책상 환자 정보 미취급이 확고.
- **audit_logs의 vigilance action enum 정리**: 본 SPEC 범위 밖 (별도 cleanup 권장사항). enum lockstep 이슈 회피 목적.
- **PMS 도메인 전체 제거**: PMS는 제품 품질 postmarket 모니터링으로 Regula 범위 내일 수 있음. patientOutcome 필드만 제거 대상 (Decision Point B 선택 시).

---

## §9 Follow-up Issues

- (구현 중 발견 시 등록)
- audit_logs의 vigilance/adverse_event action enum 값 cleanup — 별도 이슈 권장.

---

## §10 References

- Issue #319: 본 SPEC의 issue.
- task #9: PHI touch point survey (~35지점, 완료).
- SPEC-REGULA-CAPA-001: CAPA 구현 SPEC (Decision Point A 선택 시 deprecated).
- SPEC-REGULA-PMS-001: PMS SPEC (patientOutcome 필드 영향).
- session-memo 2026-07-01: Regula 정체성, 환자 정보 미취급 정책, 코퍼스 0 확인.
- L-010 (lesson): migration 실DB 적용 테스트 필수.
- L-013 (lesson): 정적 테스트 + CI mock DB + self-report 3중 맹점 — 실DB 직검으로 검증.
