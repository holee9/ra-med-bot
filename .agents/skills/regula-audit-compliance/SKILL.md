---
name: regula-audit-compliance
description: "Regula의 21 CFR Part 11 감사 로깅 규칙. append-only audit_logs 테이블, 7-year retention, 모든 consult/source access/expert flag 기록. '21 CFR Part 11', 'audit', '감사 로그', 'compliance', '규제 준수', 'GxP', 'append-only' 언급 시 반드시 이 스킬 사용. 백엔드 Route Handler, DB schema, QA 검증 모두에 적용."
---

# Regula Audit Compliance (21 CFR Part 11)

Regula는 의료기기 RA 도메인의 production 시스템이다. FDA 21 CFR Part 11 (electronic records) 준수는 **day-1 요구사항**이지, 나중에 추가하는 기능이 아니다.

## 핵심 원칙

1. **Append-only.** `audit_logs` 행은 UPDATE/DELETE 불가. PostgreSQL trigger로 강제.
2. **7-year retention.** FDA 기대치. 물리적 삭제 금지. Archival tier로 이동만 허용.
3. **모든 규제 관련 이벤트 기록.** 누락은 규제 위반.
4. **Tamper evidence.** actor, timestamp, resource, action, meta(JSONB) 모두 immutable.
5. **Observability와 분리.** Sentry/PostHog은 버그 추적용. audit_logs는 규제 준수용. 절대 대체 관계 아님.

## DB Schema

```ts
// lib/db/schema.ts
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  actorId: uuid('actor_id').notNull(),           // user.id or 'system'
  action: varchar('action', { length: 64 }).notNull(),
  resourceType: varchar('resource_type', { length: 32 }).notNull(),
  resourceId: uuid('resource_id'),
  meta: jsonb('meta'),                           // 비PII 컨텍스트만
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  createdAtIdx: index('audit_logs_created_at_idx').on(t.createdAt),
  actorIdx: index('audit_logs_actor_idx').on(t.actorId),
}));
```

## PostgreSQL Trigger (append-only 강제)

```sql
-- migrations/NNNN_audit_append_only.sql
CREATE OR REPLACE FUNCTION prevent_audit_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only. UPDATE/DELETE forbidden.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_no_update
  BEFORE UPDATE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_mutation();

CREATE TRIGGER audit_no_delete
  BEFORE DELETE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_mutation();
```

## Action Enum (기록 대상)

```ts
// lib/audit.ts
export type AuditAction =
  // Consult
  | 'consult.start'
  | 'consult.complete'
  | 'consult.error'
  | 'consult.expert_review_auto_flag'
  // Source access
  | 'source.view'
  | 'source.download'
  // Expert review
  | 'expert_review.submit'
  | 'expert_review.assign'
  | 'expert_review.resolve'
  // Admin / ingestion
  | 'ingest.corpus.start'
  | 'ingest.corpus.complete'
  | 'ingest.internal.upload'
  // Auth
  | 'auth.login'
  | 'auth.logout'
  | 'auth.mfa_fail'
  // Feedback
  | 'message.feedback';
```

## 헬퍼 함수

```ts
// lib/audit.ts
export async function writeAudit(params: {
  actor: string | 'system';
  action: AuditAction;
  resourceType: string;
  resourceId?: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(auditLogs).values({
    actorId: params.actor === 'system' ? SYSTEM_USER_UUID : params.actor,
    action: params.action,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    meta: params.meta ?? null,
  });
}
```

**규칙:**
- `meta`에 PII 넣지 않음. 질문 원문, 답변 원문 금지. 대신 `messageId`로 간접 참조.
- 실패 시 silently swallow 금지. `writeAudit`가 실패하면 해당 요청을 500 에러로 응답 (규제 요구사항 충족 우선).

## Route Handler 패턴

```ts
// app/api/ra/consult/route.ts
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return unauthorized();

  const input = ConsultRequestSchema.parse(await req.json());

  // 1. consult 시작 audit (실패 시 요청 거부)
  await writeAudit({
    actor: session.user.id,
    action: 'consult.start',
    resourceType: 'conversation',
    resourceId: input.conversationId,
    meta: { projectId: input.projectId, sourceFilter: input.sourceFilter, locale: input.locale, questionLength: input.question.length },
  });

  // 2. 파이프라인 실행 중 source 조회마다 source.view audit
  // 3. 완료 시 consult.complete audit, expert_review 필요 시 consult.expert_review_auto_flag

  // 4. 에러 시에도 consult.error audit (필수!)
  // ...
}
```

## QA 정적 분석 (regula-compliance-qa)

AST-grep 또는 ts-morph로 검출:

```
위험 패턴:
- POST/PATCH/DELETE/PUT Route Handler에 writeAudit 호출이 없음
- writeAudit 호출 전에 throw 또는 early return 있음 (이벤트 누락)
- audit_logs 테이블에 UPDATE/DELETE 쿼리가 있음 (트리거 우회 시도)
- meta JSONB에 'question', 'answer', 'email', 'phone' 키 포함 (PII 누설)
```

`scripts/qa/audit-completeness.ts`에서 자동 검사하고, CI에서 실패하면 빌드 블록.

## 감사 로그 쿼리 (규제 검사 대비)

```ts
// lib/db/queries.ts
export async function getAuditTrail(params: {
  resourceType?: string;
  resourceId?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}) {
  // 읽기 전용. 쓰기 필드 접근 자체가 없도록 Drizzle select()만 사용.
}
```

**감사관이 보는 정보:**
- 언제 (createdAt)
- 누가 (actorId → users join)
- 무엇을 (action)
- 어디에 (resourceType + resourceId)
- 맥락 (meta, PII-free)

## 7-year Retention 정책

- **현 단계:** 단순 보존. 삭제 cron 없음.
- **Phase 6+:** 고빈도 쿼리 대상이 아닌 5년 초과 행을 cold storage (S3 Glacier 등)로 이동. 원본 DB에서는 archived 플래그 유지.
- **절대 금지:** 7년 이내 물리 삭제.

## EU 데이터 residency

```ts
// lib/db/client.ts
const regionalUrl = process.env.DATA_REGION === 'EU'
  ? process.env.DATABASE_URL_EU
  : process.env.DATABASE_URL;
```

org.region == 'EU'면 EU-only DB로 분기. audit_logs도 region별로 분리.

## Zero-Data-Retention (LLM)

- Anthropic enterprise API만 사용 (`ANTHROPIC_API_KEY` 검증 시 enterprise tier 확인)
- 사내 SOP를 consumer API에 전송하는 것을 prevent: `lib/ai/consult.ts`에서 internal retriever 결과는 enterprise key로만 호출하는 client instance 사용
- 우발적 key 혼동 방지를 위해 env validation at startup

## 체크리스트 (regula-compliance-qa 검증)

- [ ] `audit_logs` 테이블에 UPDATE/DELETE 트리거가 적용되었는가
- [ ] 모든 Write Route Handler에 `writeAudit` 호출이 있는가
- [ ] `meta` 필드에 PII가 포함되지 않는가
- [ ] `writeAudit` 실패가 요청 실패로 전파되는가
- [ ] 7-year 이내 audit row 삭제 시도가 있는가
- [ ] EU 데이터 residency 분기가 작동하는가
- [ ] ANTHROPIC_API_KEY가 enterprise tier인가
