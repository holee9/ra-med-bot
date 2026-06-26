# SPEC-REGULA-PROJECT-MEMORY-001 — tasks.md (구현 계획)

> Issue #51 · Branch `feat/issue-51-project-memory` (base main `62a4e8c`)
> 작성일 2026-06-26 · READ-ONLY 분석 + 계획 (코드·마이그레이션·테스트 변경 없음)

---

## §1 Baseline (직검 — L-007)

| 지표 | 값 | 검증 파일 |
|------|----|-----------|
| audit_action enum 값 수 | **196** | `lib/db/schema.ts` (auditActionEnum) · `tests/unit/audit.test.ts:75` |
| PERMISSIONS 키 수 | **73** | `lib/auth/permissions.ts` · `tests/unit/auth/permissions.test.ts:88` |
| 최신 마이그레이션 번호 | **0086** (`0086_knowledge_promo.sql`) | `migrations/` dir (87 files, 0000~0086) |
| 회귀 테스트 수 | **4399 passed** (외부 보고) | `tests/regression/foundation.test.ts` |
| audit_action enum 선언 | `lib/db/schema.ts:117` (`auditActionEnum = pgEnum(...)`) | `tests/unit/enterprise-migrations.test.ts` |
| AuditAction TS type | `lib/audit.ts:65` (`export type AuditAction =`) | — |

**마이그레이션 체계 주의**: 본 repo는 두 체계가 병존 —
- `lib/db/migrations/` (drizzle-kit 자동생성, 0000~0001): 본 SPEC 무관
- `migrations/` (수기 SQL, 0000~0086): **본 SPEC이 사용하는 체계**. 다음 신규 = **`0087_project_memory.sql`**

---

## §2 Phases (구현 순서)

### P0 — Schema & Migration (우선순위 High, 의존성 최상위)

1. **마이그레이션 `0087_project_memory.sql`** 작성 (`migrations/` dir)
   - `project_memory_type` pgEnum: `device_classification`, `target_markets`, `submission_strategy`, `predicate_device`, `risk_class`, `custom` (REQ-002)
   - `project_memory_status` pgEnum: `active`, `pending`, `invalidated` (§7 설계결정 #2)
   - `project_memory` 테이블 (REQ-001): `id`, `project_id` FK→projects ON DELETE CASCADE, `memory_type`, `key`, `value`, `source_conversation_id` FK→conversations ON DELETE SET NULL (REQ-013), `created_by` FK→users, `status` default `active`, `valid_from` timestamptz default now(), `valid_until` timestamptz nullable
   - 인덱스: `idx_project_memory_lookup (project_id, key, valid_until)` (§4.2)
   - UNIQUE 제약: `(project_id, key) WHERE status = 'active'` — 동일 key 활성 메모리 단일 보장 (REQ-012 atomicity의 DB-level guard)
   - RLS: org_id GUC 기반 (0083/0084/0085 패턴). project_memory는 org를 직접 가지지 않으므로 `projects.organization_id` 조인 서브쿼리로 RLS policy 작성
   - audit_action +3: `memory_created`, `memory_updated`, `memory_invalidated` (REQ-007/008/009)
   - 감사 enum 드루필: `lib/db/schema.ts` auditActionEnum (196→199) + AuditAction type (`lib/audit.ts:65`) 동기화

2. **Drizzle schema** `lib/db/schema/project-memory.ts` (SPEC §4.1) — pgEnum + pgTable 미러링. `lib/db/schema.ts` barrel re-export 확인. **L-004 주의**: `lib/db/client` top-level import 회피 — `project-memory/manager.ts`는 함수 내 lazy import.

3. **enterprise-migrations.test.ts** 업데이트 — 0087 파일 존재 + audit_action enum 값 199로 어설션 (196→199, +3).

### P1 — lib/project-memory/ (도메인 로직, P0 완료 후)

4. **`lib/project-memory/manager.ts`** — 생성/수정/무효화 + 이력 보존 (REQ-012)
   - `createMemory()`: `withTenantScope` tx 내 INSERT + `writeAudit('memory_created', tx)` (Part 11 atomicity, #50 promote.ts 패턴)
   - `updateMemory()`: **동일 tx에서** 기존 row `status='invalidated'` + `valid_until=now()` UPDATE → 신규 row INSERT + `writeAudit('memory_updated', tx)` (REQ-012 — invalidate old + create new ONE tx)
   - `invalidateMemory()`: UPDATE `valid_until` + `status='invalidated'` + `writeAudit('memory_invalidated', tx)`
   - `getValidMemories(projectId)`: `WHERE project_id = ? AND status = 'active' AND (valid_until IS NULL OR valid_until > now())` (REQ-010 만료 제외)
   - `approveSuggestedMemory()`: `status='pending'` → `status='active'` 전환 + createdBy 갱신 (REQ-014) + `writeAudit('memory_created', tx)` — Charter [지양-4] NO auto-confirm, 반드시 명시적 승인 API 통해서만

5. **`lib/project-memory/injector.ts`** — 시스템 프롬프트 메모리 주입기 (AC-02)
   - `injectProjectMemory(systemPrompt, projectId): Promise<string>` — 유효 메모리 조회 → 포맷팅 → systemPrompt 앞에 prepend
   - 포맷: `\n## 프로젝트 컨텍스트 (자동 주입)\n- 디바이스 분류: Class II\n- 목표 시장: KR, US\n...\n\n` + 원본 systemPrompt
   - **토큰 예산** (§7 #3): 활성 메모리가 N개일 때 총 주입 텍스트 ≤ 2000 chars (~500 토큰). 초과 시 memoryType 우선순위(device_classification > risk_class > target_markets > predicate_device > submission_strategy > custom)로 truncate. prompt bloat 방지.

6. **`lib/project-memory/extractor.ts`** — AI 의사결정 감지 (AC-03)
   - `detectDecisions(messageContent, projectId, conversationId, orgId): Promise<SuggestedMemory[]>` — LLM 호출로 6개 memoryType 해당 의사결정 추출
   - **추출 LLM 프롬프트** (§7 #1): few-shot 예시 포함. "다음 대화에서 디바이스 분류/목표 시장/제출 전략/predicate device/위험 등급 결정을 감지하라. 명시적 결정이 있는 경우만 응답하라."
   - 감지 시: `project_memory`에 `status='pending'` row INSERT (NOT active). `source_conversation_id` = REQ-013 출처. `writeAudit`은 승인 시점(`approveSuggestedMemory`)에만 기록 (pending 단계는 감사 미발생 — false positive noise 방지)
   - **Charter [지양-4] / REQ-005**: 절대 `status='active'` 자동 기록 금지. pending은 조회/주입에서 제외 (REQ-010 동일 필터).

### P2 — API Routes (P1 완료 후)

7. **`app/api/project-memory/route.ts`** — CRUD (SPEC §4.3)
   - `GET ?projectId=`: `withPermission('projectmemory.view')` + IDOR assert (projectBelongsToOrg, #50 access.ts 패턴) → `getValidMemories()`
   - `POST`: `withPermission('projectmemory.manage', minRole: 'ra-lead')` + IDOR + `createMemory()` + denial audit (#50 AC-03 패턴)
   - `PATCH /:id`: `withPermission('projectmemory.manage')` + IDOR + `updateMemory()` (동일 key 갱신 → REQ-012 invalidate+create tx)
   - `DELETE /:id`: `withPermission('projectmemory.manage')` + IDOR + `invalidateMemory()`

8. **`app/api/project-memory/suggest/approve/route.ts`** — AI 제안 승인 (REQ-014)
   - `POST`: `withPermission('projectmemory.manage', minRole: 'ra-lead')` + IDOR + `approveSuggestedMemory()` → `status='pending'`→`'active'` + `writeAudit('memory_created')` (승인=생성으로 감사 처리)

9. **`app/api/project-memory/suggest/route.ts`** — (선택) pending 목록 조회 for RA Lead 검토 UI (REQ-006)

### P3 — System Prompt 주입 연결 (AC-02 dead-code 방지 — 최고 위험)

> **L-008 교훈**: 함수 존재 ≠ AC 충족. 주입기가 실제 파이프라인에서 호출되어야 함.

10. **`lib/ai/consult.ts:190-192` 연결** (THE call site)
    - 현행: `const composed = composePrompt(rewrittenQuery, intent, topChunks, input.locale);` (line 190)
    - 현행: `systemMessages = [{ text: composed.systemPrompt }, ...]` (line 192)
    - **변경**: line 190~192 사이에 주입기 호출 삽입:
      ```ts
      let systemPromptText = composed.systemPrompt;
      if (input.projectId) {
        const { injectProjectMemory } = await import('./project-memory/injector');
        systemPromptText = await injectProjectMemory(systemPromptText, input.projectId);
      }
      ```
      이후 `{ text: systemPromptText }`로 교체.
    - `input.projectId`는 `ConsultRequest`에 이미 존재 (`types/consult.ts:24`).
    - lazy import 사용 (L-004 — `lib/db/client` top-level import 회피, consult.ts는 테스트에서 parseEnv로 로드됨)
    - **AC-02 검증**: 새 대화(input.projectId 있, conversationId 없)에서 `ensureConversation` 직후 첫 `consult()` 호출 시 `getValidMemories`가 실제 실행되는지 테스트로 확인 (§5 AC-02 매핑 참조)

11. **`ensureConversation` 주입** (`lib/ai/consult.ts:728`) — 신규 대화 생성 시점에 이미 활성 메모리가 있는지 확인만 (주입은 Stage 5에서). `ensureConversation` 자체는 변경 불필요 (주입은 `consult` 본문에서).

### P4 — UI (P2 완료 후)

12. **`app/(app)/projects/[id]/memory/page.tsx`** — RA Lead 메모리 관리 UI (REQ-006, AC-04)
    - 활성 메모리 목록 (memoryType별 그룹핑)
    - 편집 모달 (key/value/memoryType)
    - 무효화 버튼 (soft-delete)
    - AI 제안(pending) 검토 패널 — 승인/거부 버튼 (REQ-014)

### P5 — Tests (AC-01~08全覆盖)

13. **`tests/unit/project-memory.test.ts`** (신규) — manager.ts 단위 테스트
    - AC-01: 6종 memoryType CRUD
    - AC-06: valid_until 만료 메모리 주입 제외 (`getValidMemories` 필터)
    - AC-07: 동일 key 갱신 → 기존 invalidated + 신규 active (이력 보존)
    - REQ-012 atomicity: tx rollback 시 기존 row도 롤백 (둘 다 또는 둘 다 아님)

14. **`tests/unit/project-memory-injector.test.ts`** (신규) — AC-02
    - **mock `composePrompt` 결과에 주입기 prepend 검증** — 메모리 0건/3건/10건(예산 초과) 케이스
    - 토큰 예산 truncate 검증

15. **`tests/unit/project-memory-extractor.test.ts`** (신규) — AC-03
    - "본 디바이스는 Class IIa로 분류됩니다" → memoryType=device_classification suggestion (pending)
    - pending row는 `getValidMemories`에서 제외 확인 (REQ-005 no auto-confirm)
    - LLM 미응답 시 빈 배열 (false positive 없음)

16. **`tests/integration/project-memory-api.test.ts`** (신규) — AC-08
    - 권한 없는 사용자 PATCH → 403 + `rbac.permission_deny` audit
    - cross-org (IDOR) GET → 403 + denial audit (#50 AC-03 패턴)
    - 승인 플로우: pending → approve → active + `memory_created` audit

---

## §3 파일 목록 (SPEC §4.1 매핑)

| 파일 | 유형 | Phase | 비고 |
|------|------|-------|------|
| `migrations/0087_project_memory.sql` | 신규 | P0 | enum 2개 + 테이블 + 인덱스 + RLS + audit_action +3 |
| `lib/db/schema/project-memory.ts` | 신규 | P0 | Drizzle pgEnum/pgTable 미러링 |
| `lib/db/schema.ts` | 수정 | P0 | auditActionEnum +3값 (196→199), barrel re-export |
| `lib/audit.ts` | 수정 | P0 | AuditAction type +3 (memory_created/updated/invalidated) |
| `lib/auth/permissions.ts` | 수정 | P0 | +2 permission: `projectmemory.manage`, `projectmemory.view` (73→75) |
| `lib/project-memory/manager.ts` | 신규 | P1 | 생성/수정/무효화/승인 + tx atomicity |
| `lib/project-memory/injector.ts` | 신규 | P1 | 시스템 프롬프트 주입 (토큰 예산) |
| `lib/project-memory/extractor.ts` | 신규 | P1 | LLM 의사결정 감지 → pending suggestion |
| `lib/project-memory/access.ts` | 신규 | P1 | IDOR guard (projectBelongsToOrg, #50 access.ts 패턴) |
| `app/api/project-memory/route.ts` | 신규 | P2 | CRUD API |
| `app/api/project-memory/suggest/approve/route.ts` | 신규 | P2 | AI 제안 승인 (REQ-014) |
| `app/api/project-memory/suggest/route.ts` | 신규 | P2 | pending 목록 조회 (선택) |
| `lib/ai/consult.ts` | 수정 | P3 | **AC-02 call site** (line 190-192 주입 연결) |
| `app/(app)/projects/[id]/memory/page.tsx` | 신규 | P4 | RA Lead 관리 UI |
| `tests/unit/project-memory.test.ts` | 신규 | P5 | AC-01,06,07, REQ-012 |
| `tests/unit/project-memory-injector.test.ts` | 신규 | P5 | AC-02 |
| `tests/unit/project-memory-extractor.test.ts` | 신규 | P5 | AC-03, REQ-005 |
| `tests/integration/project-memory-api.test.ts` | 신규 | P5 | AC-08, IDOR |

---

## §4 Count-Delta 예측 + 업데이트 대상 어설션 파일 (L-008 — 분산 카운트 어설션)

### 예측 delta

| 지표 | baseline | delta | 신규 값 | 비고 |
|------|----------|-------|---------|------|
| audit_action enum | 196 | **+3** | **199** | `memory_created`, `memory_updated`, `memory_invalidated` |
| PERMISSIONS 수 | 73 | **+2** | **75** | `projectmemory.manage` (ra-lead), `projectmemory.view` (ra-member) |
| 마이그레이션 파일 | 0086 | **+1** | **0087** | `0087_project_memory.sql` |
| 회귀 테스트 | 4399 | **+(신규 테스트)** | 4399+α | AC-01~08 커버리지에 따라 |

### 업데이트 MUST 파일 (grep `196` / `73` 로 전수 확인 — L-008)

> `grep -rln "196)" tests/` 및 `grep -rln "toHaveLength(73)\|toBe(73)" tests/` 직검 결과:

**audit_action 196 → 199 업데이트 대상 (4 files):**
1. `tests/unit/audit.test.ts:75` — `expect(values).toHaveLength(196)` → `199`, 코멘트 `// +3 projectmemory.* (#51)`
2. `tests/unit/enterprise-migrations.test.ts` — audit_action enum 값 수 어설션 (0087 파일 존재 체크 추가)
3. `tests/integration/cyberdevice.test.ts` — `196` 어설션 (L-008 놓침 방지)
4. `tests/integration/capa.test.ts` — `196` 어설션 (L-008 놓침 방지)

**PERMISSIONS 73 → 75 업데이트 대상 (4 files):**
1. `tests/unit/auth/permissions.test.ts:88` — `toHaveLength(73)` → `75`
2. `tests/regression/foundation.test.ts:42` — `toBe(73)` → `75`
3. `tests/integration/cyberdevice.test.ts` — `73` 어설션
4. `tests/integration/capa.test.ts` — `73` 어설션

> **L-008 강제**: 구현 에이전트는 bump 후 반드시 `grep -rln "196\|toHaveLength(73)\|toBe(73)" tests/` 재실행하여 위 4+4=8개 파일 외 누락 파일이 없는지 확인. #50에서 cyberdevice/capa가 누락되어 full `pnpm test`에서만 적발됨.

---

## §5 AC → Requirement → Test 매핑 (dead-code 방지)

| AC | REQ | 구현 위치 | Test 파일 | dead-code 방지 체크 |
|----|-----|-----------|-----------|---------------------|
| AC-01 | 001,002 | manager.ts createMemory + 6 enum | project-memory.test.ts | enum 값 6개 INSERT 성공 |
| **AC-02** | **003,010** | **`lib/ai/consult.ts:190-192` (주입 call site) + injector.ts** | **project-memory-injector.test.ts** | **`consult()`가 `input.projectId` 있을 때 `injectProjectMemory` 실제 호출 (mock으로 호출 검증). 이것이 AC-02의 증거 — injector.ts 존재만으로는 부족.** |
| **AC-03** | 004,005 | extractor.ts (pending suggestion) + consult.ts 감지 훅 | project-memory-extractor.test.ts | **감지 시 `status='pending'` row 생성 (NOT active). pending은 getValidMemories에서 제외. `status='active'` 자동 기록 절대 금지 (REQ-005).** |
| AC-04 | 006 | projects/[id]/memory/page.tsx | 수동 Review | RA Lead가 UI에서 편집/검토/승인 가능 |
| AC-05 | 007,008,009 | manager.ts writeAudit ×3 | project-memory.test.ts | memory_created/updated/invalidated audit row 존재 |
| AC-06 | 010 | getValidMemories WHERE valid_until | project-memory.test.ts | 만료 메모리 주입 제외 |
| AC-07 | 012 | updateMemory tx (invalidate+create) | project-memory.test.ts | 기존 row invalidated + 신규 active + 히스토리 보존 |
| AC-08 | 011 | API route withPermission + IDOR | project-memory-api.test.ts | 403 + `rbac.permission_deny` audit |

### AC-02 call site 정확위치 (L-008 dead-code 최고위험)

**파일**: `lib/ai/consult.ts`
**라인**: 190~192 (현행)
```ts
// 현행 (변경 전)
const composed = composePrompt(rewrittenQuery, intent, topChunks, input.locale);
const systemMessages = [
  { type: 'text' as const, text: composed.systemPrompt },  // ← line 192
```
**변경 후** (P3 Task 10):
```ts
const composed = composePrompt(rewrittenQuery, intent, topChunks, input.locale);
let systemPromptText = composed.systemPrompt;
if (input.projectId) {
  const { injectProjectMemory } = await import('./project-memory/injector');
  systemPromptText = await injectProjectMemory(systemPromptText, input.projectId);
}
const systemMessages = [
  { type: 'text' as const, text: systemPromptText },
```

**AC-02 증거 (테스트)**: `project-memory-injector.test.ts`에서 consult 파이프라인을 mock하여 `input.projectId` 있을 때 `injectProjectMemory`가 호출되었음을 spy로 검증. injector.ts가 정의만 되고 호출되지 않는 dead-code 패턴 (L-008 7회 반복) 차단.

### AC-03 감지 call site

**파일**: `lib/ai/consult.ts` — 답변 생성 후 post-processing 단계 (Stage 6 이후, ~line 600 근처 answer persist 시점)
**구현**: assistant 답변이 사용자에게 스트리밍 완료된 후, 백그라운드에서 `detectDecisions(assistantContent, projectId, conversationId, orgId)` 호출. 결과는 pending row로 저장되고, RA Lead UI에서 승인 대기. **절대 답변 스트림에 블로킹하지 않음** (비동기 fire-and-forget 또는 별도 API 엔드포인트).

---

## §6 Charter Guards (Charter [지양-4], [지양-2])

| Guard | REQ | 구현 강제 |
|-------|-----|-----------|
| **[지양-4] Suggest ≠ Confirm** | REQ-005, REQ-014 | pending row는 절대 active가 될 수 없음. `approveSuggestedMemory()` API 통해서만 status 전환. extractor.ts는 pending까지만. manager.ts `createMemory()` (직접 active)는 RBAC `projectmemory.manage` + 명시적 API 호출시에만. |
| **[지양-2] 출처 보존** | REQ-013 | 모든 project_memory row의 `source_conversation_id` NOT NULL (단, RA Lead 수동 생성은 nullable 허용 — UI에서 출처 명시 입력). AI suggestion은 반드시 출처 대화 ID 기록. |
| 21 CFR Part 11 | REQ-007/008/009 | 모든 생성/수정/무효화는 `writeAudit`과 동일 tx (atomicity — #50 promote.ts 패턴) |
| 감사 가능 | REQ-012 | 동일 key 갱신 시 기존 row soft-invalidate (valid_until 설정). hard delete 금지. 이력 보존. |

---

## §7 설계 결정 및 리스크/복잡도

### 설계 결정

**#1 추출 LLM 프롬프트 (device_classification 감지)**
- few-shot 프롬프트: "Class II", "510(k)", "CE 마킹", "predicate device" 등 RA 용어 패턴을 예시로 제공
- 6개 memoryType 각각 감지 기준 명시 — false positive 최소화
- LLM 응답은 반드시 JSON schema `{memoryType, key, value, confidence}` 준수. confidence < 0.7은 제안 생성 안 함 (노이즈 방지)
- **리스크**: LLM이 과도하게 제안 → pending 스팸. 완화: confidence threshold + RA Lead UI에서 일괄 거부 기능.

**#2 상태 모델 (suggest/approve)**
- `project_memory.status`: `active` (주입 대상) / `pending` (AI 제안, 승인 대기) / `invalidated` (과거 이력)
- pending은 `getValidMemories()`에서 제외 (REQ-010 동일 필터: `WHERE status = 'active' AND valid`)
- #50 knowledge-promo의 `promoted_answer_status` (`active`/`unpromoted`) 패턴 확장 — pending 상태 추가
- 승인 플로우: pending → (RA Lead approve) → active + `memory_created` audit

**#3 주입 토큰 예산**
- 활성 메모리 N개 → 주입 텍스트 ≤ 2000 chars (~500 토큰). consult.ts system prompt의 5% 이내.
- 초과 시 memoryType 우선순위(device_classification > risk_class > target_markets > predicate_device > submission_strategy > custom)로 truncate
- 각 value는 최대 200 chars — 초과 시 `...` truncation
- **리스크**: 메모리 20개 이상 프로젝트에서 프롬프트 bloat. 완화: 우선순위 truncate + 캐시 가능한 포맷(`cache_control` 적용 가능한 system block).

**#4 valid-until 시맨틱스**
- `valid_from` (default now()) ~ `valid_until` (nullable = 영구) 범위 내만 주입
- 무효화 = `valid_until = now()` + `status='invalidated'` 동시 설정 (둘 다 — 어느 하나만으로 쿼리가 누락됨)
- 수동 만료 설정 지원 (RA Lead UI에서 "2026-12-31까지 유효" 지정)

### 리스크/복잡도

| 항목 | 위험 | 완화 |
|------|------|------|
| **AC-02 dead-code** (L-008 최고위험) | injector.ts 정의만 되고 consult.ts에서 호출 안 됨 | §5 call site 명시 + 테스트에서 consult() 경로로 injectProjectMemory 호출 spy 검증 |
| **REQ-012 atomicity** | 동일 key 갱신 시 기존 invalidate + 신규 create가 별도 tx이면 crash 시 불일치 | manager.ts `updateMemory()`는 단일 `withTenantScope` tx에서 둘 다 실행. rollback 시 둘 다 롤백. 테스트로 tx 실패 시나리오 검증 (AC-07). |
| **분산 카운트 어설션** (L-008) | cyberdevice/capa 등 다른 도메인 테스트가 196/73 하드코딩 | §4에서 8개 파일 명시. bump 후 grep 재확인 필수. |
| **RLS org-isolation** | project_memory가 org_id 직접 컬럼 없음 → RLS policy가 projects 조인 필요 | 마이그레이션 0087에서 `(SELECT organization_id FROM projects WHERE id = project_memory.project_id)` 서브쿼리 RLS policy. #239 inert 상태이므로 access.ts JS-level IDOR guard가 실제 게이트 (RLS는 #239 해결 후 defense-in-depth). |
| **db/client top-level import** (L-004) | injector.ts를 consult.ts가 import 시 parseEnv 깨짐 | consult.ts에서 lazy `await import('./project-memory/injector')` 사용. injector.ts 자체는 `lib/db/client`를 top-level에서 import 가능 (consult 경유 로드 시에만 실행되므로). |

---

## §8 의존성 및 선행 조건

- **SPEC-REGULA-BREADTH-001** (projects 테이블): 완료. `projects.id`, `projects.organization_id` (FK target) 존재 확인 (`lib/db/schema.ts:558`).
- **SPEC-REGULA-FOUNDATION-001** (audit_logs, RBAC, writeAudit, withPermission): 완료.
- **SPEC-REGULA-CHAT-001** (conversations, consult.ts 파이프라인, composePrompt): 완료. AC-02 주입 지점 확정.
- **이슈 #47** (Evidence Traceability): 메모리 출처 추적과 보완 관계이나 직접 의존 아님 — source_conversation_id로 충족.

---

버전 1.0.0 · 2026-06-26 · manager-strategy (분석 전용, 코드 변경 없음)
