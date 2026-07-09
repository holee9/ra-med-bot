# Progress — SPEC-REGULA-MIGRATION-001

> Issue #396. Run phase 기록. 모든 결정은 fresh pgvector 컨테이너(port 5434) 실증 기반 (L-013).

---

## Run phase 결과 (2026-07-09)

**AC-01~08 전부 실증 달성.** status: draft → completed.

### 검증 러너
fresh Docker `pgvector/pgvector:pg16` 컨테이너 `regula-fresh-5434` (port 5434). bootstrap: `CREATE ROLE regula_app` (적용 전, readiness retry). apply: `cat $(ls migrations/[0-9]*.sql | grep -v _rollback | sort) | psql -v ON_ERROR_STOP=0`.

### AC 실증 (fresh 컨테이너)
- **AC-01**: 0 ERROR · **96 tables** (regula-test-db baseline과 동일) · `audit_logs_no_mutation`/`audit_logs_no_truncate` trigger 존재 · **RLS policy명 set diff = 0** (45=45 identical) · **table명 set diff = 0** (96=96 identical, 추가 직검).
- **AC-02**: 7개 real-db suite **44 passed / 0 failed** (최소 seed: org 1행 + audit_logs 1행 — 데이터 의존 suite용).
- **AC-03**: 구조적 regression-free (regula-test-db 재적용 0, schema 변화 0) + full suite green.
- **AC-04**: `pnpm ci:migrations` exit 0.
- **AC-05**: 구조적 보장 (workflow apply 단계 `ON_ERROR_STOP=1` — 원본 drift가 에러를 발생시킴을 RED에서 실증).
- **AC-06**: fix-up 0089/0090/0092 from-scratch no-op (이미 IF NOT EXISTS) — **수정 불필요**.
- **AC-07**: 0002 CONCURRENTLY index autocommit apply 0 error (트랜잭션 블록 에러 없음).
- **AC-08**: `CREATE ROLE regula_app` 선행 시 0001 REVOKE/GRANT 0 error (미선행 시 "role does not exist" 2건 — bootstrap artifact, migration 결함 아님).

### 게이트 직검 (L-007/008/009/013/015)
typecheck 0 · ci:lint 0 (12 pre-existing warning 무관) · ci:format/audit/rbac/tokens/i18n/glossary/contrast/module-boundaries 전 exit 0 · ci:migrations 0 · enterprise-migrations 478/478 · full `pnpm test` **4784 passed / 0 failed / 35 skipped** (real-db env 의존). 회귀 0.

---

## [DELTA] 진단 정정 (Run 중 실측, plan/research 대비)

### C1 / D11 (0014 → 실제는 0017 + 0083/0084)
- **plan 진단 오류**: "0014 BEGIN/COMMIT 트랜잭션 내부 에러로 ingest_jobs 미생성".
- **실측 정정**: 0014는 정상 적용 (organization_documents/document_chunks/document_access_policies/ingest_jobs 4개 전부 CREATE 성공). 문제는 **0017 §3 (`DROP TABLE IF EXISTS ingest_jobs CASCADE`)** 가 ingest_jobs를 의도적 DROP("Inngest handles job tracking natively") 한 것.
- **진짜 원인**: 0083의 `ALTER POLICY "tenant_isolation_ingest_jobs" ON ingest_jobs` + 0084의 `ALTER TABLE ingest_jobs FORCE ROW LEVEL SECURITY` 가 **DROP된 테이블을 참조** → "relation ingest_jobs does not exist".
- **수정**: 0083/0084에서 ingest_jobs dead reference 제거 (테이블 영구 drop, 부활 없음 → guard 대신 제거가 정확, Enforce Simplicity).

### C2 / D8 (0083 organization_id)
- **plan 진단**: "0083 RLS policy가 미존재 컬럼 organization_id 참조".
- **실측 정정**: organization_documents.organization_id는 **0017 §1이 org_id로 RENAME**. 0083의 `tenant_isolation_documents` policy가 organization_id 참조 → "column organization_id does not exist". document_chunks/document_access_policies는 0017가 건드리지 않아 organization_id 유지 → 해당 policy는 OK.
- **수정**: 0083 organization_documents policy의 `organization_id` → `org_id`.

### D3 (0054) 보충
- plan은 org_id만 명시했으나, **created_by도 TEXT REFERENCES users(id)** (uuid)로 동일 text↔uuid 불일치. RED에서 org_id FK가 먼저 실패해 CREATE가 롤백되어 created_by는 평가되지 않았을 뿐. **org_id + created_by 모두 uuid로 정정**.

### fix-up 0089/0090/0092
- **이미 전부 `CREATE TABLE IF NOT EXISTS` + 인덱스/policy IF NOT EXISTS 가드로 idempotent**. 원본 uuid 정정 후 from-scratch에서는 원본이 테이블 생성 → fix-up은 no-op. **수정 0건** (plan B6의 "가드 추가" 가정은 불필요 — Enforce Simplicity).

### AC-01 audit trigger명 오류 (SPEC 결함)
- SPEC AC-01이 `audit_log_hash_bi` trigger를 참조했으나, **이 trigger는 어떤 migration에도 미존재**. audit 해시 체인은 `lib/audit.ts` writeAudit에서 app-side 계산 (SPEC-V3-AUDIT-CHAIN-001), DB trigger 아님. 실제 audit trigger는 0001의 `audit_logs_no_mutation`/`audit_logs_no_truncate`. spec.md/acceptance.md v1.2.0에서 정정.

---

## 수정 파일 (12 modified + 1 new)

**Group A (trivial)**: 0002(dead index 삭제) · 0004(DROP DEFAULT 순서) · 0087(CONSTRAINT→CREATE UNIQUE INDEX) · 0095('set null' 따옴표).
**Group B (FK-type)**: 0054/0055/0056(org_id+created_by text→uuid) · 0082(user_id) · 0086(promoted_by). fix-up 0089/0090/0092 수정 0.
**Group C ([DELTA])**: 0083(organization_documents org_id + ingest_jobs 제거) · 0084(ingest_jobs FORCE RLS 제거).
**Group D (CI)**: `.github/workflows/migrations-real-db.yml` (standalone, pgvector service + bootstrap + cat|psql + seed + 7 real-db suite).
**Test**: `tests/unit/enterprise-migrations.test.ts` (텍스트 단언을 정정된 migration에 맞게 갱신 — 0083/0084 카운트 20→19 + ingest_jobs 케이스 제거, 0086 promoted_by uuid, 0087 CREATE UNIQUE INDEX).
