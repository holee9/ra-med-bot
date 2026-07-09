# Plan — SPEC-REGULA-RLS-SOURCES-001

> Implementation plan, milestones, file-by-file change list, gates checklist
> Issue #317 | Branch: `feat/spec-regula-rls-sources-001-plan`
> 방식: priority-based milestones (시간 추정 안 함, CLAUDE.md §7 Rule 준수)

---

## 1. 구현 접근법 (Technical Approach)

### 1.1 migration 0114 — sources/source_sections RLS 활성화

migration 0099 (knowledge_sources) 패턴을 템플릿으로 사용 (research.md Fact 6):

```sql
-- migration 0114: sources/source_sections RLS 활성화
-- AC4: 0084가 누락한 진실 원인 @MX:NOTE 포함

-- §1 sources
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources FORCE ROW LEVEL SECURITY;

-- plan-auditor D1: PostgreSQL has no CREATE POLICY IF NOT EXISTS.
-- DROP IF EXISTS guard makes the migration safe to re-apply (enterprise-migrations
-- idempotency philosophy). Sibling 0099/0104 omit this; we add it defensively.
DROP POLICY IF EXISTS sources_org_isolated ON sources;
CREATE POLICY sources_org_isolated ON sources
  FOR ALL
  TO regula_app
  USING (organization_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);

-- §2 source_sections (Option A: subquery 정책, research.md §2)
ALTER TABLE source_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_sections FORCE ROW LEVEL SECURITY;

-- plan-auditor D1: idempotency guard (see §1).
DROP POLICY IF EXISTS source_sections_org_isolated ON source_sections;
CREATE POLICY source_sections_org_isolated ON source_sections
  FOR ALL
  TO regula_app
  USING (
    EXISTS (
      SELECT 1 FROM sources s
      WHERE s.id = source_sections.source_id
        AND s.organization_id = current_setting('app.current_org_id', true)::uuid
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sources s
      WHERE s.id = source_sections.source_id
        AND s.organization_id = current_setting('app.current_org_id', true)::uuid)
    )
  );
```

**NULL 정책 (USING + WITH CHECK): M0 RESOLVED — strict org-match (fail-closed) 확정.** real-DB 직검: NULL 0 rows + `knowledge_sources.organization_id` NOT NULL ⇒ ingestion은 항상 org-scoped, NULL org_id는 bug이므로 차단 (defense-in-depth). 위 migration SQL은 이미 strict 형태로 명시됨. `IS NULL OR` disjunction은 의도적으로 배제됨.

### 1.2 카나리 테스트 — regula_app role 재사용

migration 0085가 이미 `regula_app` (NOSUPERUSER NOBYPASSRLS)를 생성했으므로, 별도 카나리 role 생성 불필요. 테스트는 `SET ROLE regula_app` 패턴 사용:

```ts
// tests/integration/rls-sources-real-db.test.ts
await db.execute(sql`SET ROLE regula_app`);
await db.execute(sql`SET app.current_org_id TO ${orgAId}`);
// ... query assertions
await db.execute(sql`RESET ROLE`);
```

### 1.3 real-DB catalog 직검 (L-010/L-013)

`tests/integration/migrations-real-db.test.ts`에 sources/source_sections 케이스 추가 또는 신규 파일에서 `pg_class`/`pg_policy` catalog 쿼리로 ENABLE+FORCE+policy를 직검. textual SQL만으로는 0086/0087 버그를 놓친 전례 (L-013).

---

## 2. Milestones

### M0 — 코퍼스 no-NULL-row 데이터 무결성 가드 (Priority: High, blocker — RESOLVED reframe)

**목표:** migration 0114 apply 전 regula-test-db에 NULL-org source가 없음을 regression-check로 확인한다 (data-integrity guard). 정책 결정은 이미 strict org-match로 확정됨 (Orchestrator real-DB 직검: Fact 7).

**작업:**
1. migration 0114 apply 직전 다음 쿼리를 실행하여 no-NULL-row를 확인:
   ```sql
   SELECT count(*) AS null_org_rows FROM sources WHERE organization_id IS NULL;
   SELECT organization_id::text, count(*) FROM sources GROUP BY 1 ORDER BY 2 DESC;
   SELECT count(*) FROM source_sections;
   SELECT count(*) FROM sources s JOIN source_sections ss ON ss.source_id = s.id WHERE s.organization_id IS NULL;
   ```
2. **가드 (fail-closed):** `null_org_rows > 0`이면 migration을 **중단**한다 — 예상과 다른 데이터 상태이므로 데이터 무결성 위반. 수동 조사 필요. (Fact 7 직검에서는 0건이었으나, 향후 스키마 변경/ingestion bug로 유입될 수 있으므로 가드로 유지)
3. 결과(0건 예상)를 research.md §5 직검 로그에 regression baseline으로 기록

**산출물:** research.md §5에 regression baseline 기록, migration 0114 safe-to-apply 확인.

**완료 조건:** NULL-org row 0건 확인으로 strict org-match 정책의 데이터 전제가 유효함이 입증됨. (정책 결정 자체는 이미 Fact 7/8/9로 확정되어 본 마일스톤의 역할은 data-integrity 가드로 축소됨.)

---

### M1 — migration 0114 작성: sources (Priority: High)

**목표:** sources 테이블에 ENABLE + FORCE + org-isolation policy를 부여한다.

**파일:**
- `migrations/0114_rls_sources_source_sections.sql` (신규) — §1 sources 블록

**내용:**
- 헤더에 AC4 (0084 누락 원인) 설명 `@MX:NOTE` 포함
- `@MX:SPEC SPEC-REGULA-RLS-SOURCES-001` 태그
- `@MX:WARN` RLS inert 경고 (superuser 하에서) — 0084 패턴 준수
- §1: sources ENABLE + FORCE + `sources_org_isolated` policy

**완료 조건:** SQL이 regula-test-db에 apply 성공, `pg_class` 직검으로 ENABLE+FORCE true.

---

### M2 — migration 0114: source_sections (Priority: High)

**목표:** source_sections 테이블에 ENABLE + FORCE + subquery org-isolation policy를 부여한다.

**파일:** 동일 migration 파일 §2 블록

**내용:**
- §2: source_sections ENABLE + FORCE + `source_sections_org_isolated` policy (Option A subquery)
- 주석: "source_sections has no organization_id column (Fact 2). Policy uses subquery to parent sources."

**완료 조건:** `pg_policy`에 `source_sections_org_isolated` 존재, 카나리(GUC set)로 자기 org sections 가시 확인.

---

### M3 — 카나리 real-DB 테스트 (Priority: High)

**목표:** `regula_app` role 기반 GUC 시나리오로 AC2/AC3를 검증한다.

**파일:**
- `tests/integration/rls-sources-real-db.test.ts` (신규)
- 또는 `tests/integration/migrations-real-db.test.ts` 확장

**내용 (acceptance.md 매핑):**
- AC2-G3: GUC set → 자기 org sources 가시
- AC2-G4: GUC unset → fail-closed (0행)
- AC2-G5: cross-org INSERT 차단 (WITH CHECK)
- AC2-G6: source_sections GUC set 가시
- AC2-G7: source_sections cross-org INSERT 차단
- AC2-G8: NULL-org source sections 가시 (strict 정책: 항상 차단 — fail-closed 검증)
- AC3-G1: superuser unaffected
- AC3-G2: regula_app 3상태 시뮬레이션
- AC3-G3/G4: ingestion/retrieval 경로 호환
- NFR-5: `EXPLAIN ANALYZE`로 subquery 성능 측정

**완료 조건:** 모든 카나리 시나리오 pass. NFR-5에서 성능 기준치 초과 시 Option B fallback 검토.

---

### M4 — 문서화 + AC4 (Priority: Medium)

**목표:** 0084 누락 진실 원인을 migration 헤더 + research.md에 최종 문서화한다.

**작업:**
1. migration 0114 헤더에 AC4 요약 1문단 (research.md §1 Fact 4 기반)
2. research.md에 M0 데이터 분포 결과 추가
3. spec.md frontmatter `status: draft → approved` (run phase 진입 시)

**완료 조건:** AC4-G1, AC4-G2 모두 충족.

---

### M5 — CI 게이트 통과 (Priority: High, L-015)

**목표:** 모든 `ci:*` 단계를 로컬에서 직검한다 (CI green ≠ 전체 green, L-015).

**실행:**
```bash
pnpm ci:migrations      # 0114 sequence 정합
pnpm ci:lint            # biome (lint:hex full, L-008)
pnpm ci:typecheck       # tsc
pnpm ci:test            # vitest run full (L-009)
pnpm ci:coverage        # 85% ratchet (SPEC-REGULA-REALDB-001)
pnpm ci:rbac            # route matrix 회귀 없음
pnpm ci:audit           # audit completeness
```

real-DB (DATABASE_URL 설정):
```bash
pnpm vitest run tests/integration/rls-sources-real-db.test.ts
pnpm vitest run tests/integration/migrations-real-db.test.ts
```

**완료 조건:** 전 단계 green. staged 파일 범위 직검 (L-009).

---

## 3. File-by-File Change List

| 파일 | 유형 | 변경 내용 | Milestone |
|------|------|-----------|-----------|
| `migrations/0114_rls_sources_source_sections.sql` | 신규 | sources + source_sections ENABLE+FORCE+policy, AC4 주석 | M1, M2, M4 |
| `tests/integration/rls-sources-real-db.test.ts` | 신규 | 카나리 GUC 시나리오 (AC2-G3~G8, AC3-G1~G4, NFR-5) | M3 |
| `tests/integration/migrations-real-db.test.ts` | 수정 (선택) | sources/source_sections catalog 직검 케이스 추가 (NFR-2) | M3 |
| `.moai/specs/SPEC-REGULA-RLS-SOURCES-001/research.md` | 수정 | M0 데이터 분포 결과 추가 | M0, M4 |
| `.moai/specs/SPEC-REGULA-RLS-SOURCES-001/spec.md` | 수정 | status draft → approved (run 진입 시) | M4 |

**총 파일 수:** 3~5개 (Rule 2: 3+ 파일이나 단일 마이그레이션 + 테스트 중심, 논리적 단위로 분해됨).

---

## 4. 리스크 및 완화 (Risks)

| 리스크 | 확률 | 영향 | 완화 |
|--------|------|------|------|
| Option A subquery가 hot retrieval 경로에서 성능 악화 | 중 | 중 | M3 NFR-5에서 `EXPLAIN ANALYZE` 측정, 초과 시 Option B additive migration |
| M0 가드에서 NULL-org row 발견 (예상: 0건) | 낮 | 중 | migration 중단 + 수동 조사 (data-integrity 위반). 정책 자체는 strict 고정이므로 영향 없음 |
| 카나리 테스트가 regula-test-db 의존 (psql 미설치) | 중 | 중 | drizzle client 기반 테스트로 우회; Docker container 내부 psql 사용 |
| superuser 하에서 false-green (테스트가 RLS를 안 본다) | 높 | 높 | `SET ROLE regula_app` 강제 (NFR-3); L-013 교훈 |
| 기존 ingestion/retrieval 경로 회귀 | 낮 | 높 | RLS는 superuser 하에서 inert (Fact 3); NFR-1로 기존 테스트 100% 통과 검증 |
| regula_app 권한 부족 (GRANT 누락) | 낮 | 중 | migration 0085가 이미 GRANT 수행 (직검); 카나리에서 권한 에러 시 0085 재확인 |

---

## 5. 비-goal 명시 (Scope Discipline, Charter [지양] 준수)

- 다른 테이블 RLS 수정: **NO**
- RAG pipeline 재구조화: **NO**
- `regula_app` role 신규 생성: **NO** (0085 재사용)
- `DATABASE_URL` ops 전환: **NO** (본 SPEC 외부)
- source_sections denormalized column (Option B): **NO** (M3에서 성능 입증 전까지)
- `withTenantScope` app 로직 변경: **NO** (RLS는 백업 계층)
- inbox_tickets/approved_answers의 FORCE/WITH CHECK 누락 보완: **NO** (0104 부채, 별도 이슈)

---

## 6. 의존성 (Dependencies)

| 의존 | 상태 | 비고 |
|------|------|------|
| migration 0085 (regula_app role) | CLOSED (직검) | 카나리 재사용 |
| parent SPEC-REGULA-RLS-ENFORCE-001 (#239) | CLOSED | GUC 메커니즘 + policy 패턴 토대 |
| `withTenantScope` (lib/db/client.ts:54) | 구현 완료 | 모든 app 경로가 이미 GUC 설정 |
| `psql` 또는 drizzle debug 스크립트 | **해결** | Orchestrator가 regula-test-db 직검으로 Fact 7 해결 (drizzle/docker 경유). M0 가드도 동일 경로 사용 |
| regula-test-db Docker | 구동 중 (직검) | real-DB 테스트 |

---

## 7. 검증 체크리스트 (Verification Checklist)

run phase 종료 전:

- [ ] migration 0114 생성 (sources + source_sections ENABLE+FORCE+policy)
- [ ] migration 0114 헤더에 AC4 설명 (@MX:NOTE)
- [ ] M0: `sources.organization_id` 분포 직검 및 research.md 기록
- [ ] M1/M2: regula-test-db에 migration apply 성공
- [ ] M3: `pg_class`/`pg_policy` catalog 직검 (NFR-2, L-013)
- [ ] M3: 카나리 AC2-G3~G8, AC3-G1~G4 모두 pass
- [ ] M3: `EXPLAIN ANALYZE` 성능 측정 (NFR-5)
- [ ] M4: AC4 문서화 완료 (research.md + migration 헤더)
- [ ] M5: `pnpm ci:*` 전 단계 로컬 green (L-015)
- [ ] M5: real-DB 통합 테스트 green
- [ ] 기존 `pnpm test` 100% 통과 (NFR-1)
- [ ] Charter [지양-1~5] 위반 없음
- [ ] staged 파일 범위 직검 (L-009)
- [ ] 직검 로그 (research.md §5) 모든 Fact의 file:line 출처 포함
