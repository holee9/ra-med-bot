---
spec_id: SPEC-REGULA-RELEASE-HARDENING-001
title: Research — Verified Current State for Release Hardening
version: 0.1.0
created: 2026-05-04
---

# Research — Verified Current State

본 문서는 SPEC-REGULA-RELEASE-HARDENING-001 작성 시점에 코드베이스를 직접 분석하여 검증한 결함의 근거를 기록한다. 모든 인용은 실제 파일 라인을 grep/read 로 확인했다.

## H-1. Dashboard Stats — Stub 확인

### 파일: `app/api/ra/dashboard/route.ts`

전체 10라인 중 핵심:

```typescript
// @MX:NOTE [AUTO] GET /api/ra/dashboard — dashboard stats stub.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-019)

import { withPermission } from '../../../../lib/auth/with-permission';

export const GET = withPermission('dashboard.view', async (_req, _ctx, session) => {
  // Stub: return basic org context. Full stats query will be added in a later phase.
  return Response.json({ orgId: session.user.organizationId, stats: {} });
});
```

### 파일: `app/(app)/dashboard/page.tsx`

```typescript
function valueFromStats(stats: unknown, key: string): string {
  if (!stats || typeof stats !== 'object') return '0';
  const direct = (stats as Record<string, unknown>)[key];
  if (direct !== undefined) return String(direct);
  const nested = (stats as { stats?: Record<string, unknown> }).stats?.[key];
  return nested !== undefined ? String(nested) : '0';
}

// ...

const cards = [
  { label: '상담', value: valueFromStats(dashboard.data, 'totalConversations') },
  { label: '프로젝트', value: String(projects.data?.length ?? 0) },
  { label: '전문가 검토', value: valueFromStats(dashboard.data, 'pendingReviews') },
  { label: '규제 업데이트', value: String(updateCount) },
];
```

**현재 동작**: `stats: {}` 반환 → `valueFromStats` 가 `'0'` 반환 → 모든 dashboard 카드에 0 표시.

**기대 동작**: API가 `{ totalConversations, expertReviews, pendingReviews, totalProjects }` 반환.

---

## H-2. Knowledge Base — Hardcoded 확인

### 파일: `app/(app)/knowledge/page.tsx` (전체 43라인)

```typescript
const sourceGroups = [
  {
    title: '공식 규제 기관',
    sources: ['FDA', 'EU MDR', 'MFDS', 'NMPA', 'PMDA'],
  },
  {
    title: '국제 표준',
    sources: ['ISO 13485', 'IEC 62304', 'ISO 14971'],
  },
  {
    title: '사내 지식',
    sources: ['Internal SOPs', 'MD-process', 'ra-project'],
  },
];

export default function KnowledgePage() {
  return (
    <section className="...">
      ...
      <div className="grid gap-3 md:grid-cols-3">
        {sourceGroups.map((group) => (
          ...
```

**현재 동작**: 완전히 hardcoded. API 호출 없음.

### 관련 API: `app/api/ra/sources/[id]/route.ts` (이미 존재)

```typescript
export const GET = withPermission('conversation.view', async (_req, ctx) => {
  // ...
  const [source] = await db.select().from(sources).where(eq(sources.id, id)).limit(1);
  // returns single source by id with sections
});
```

**부재**: `GET /api/ra/sources` (list endpoint)는 없음. 신규 라우트 생성 필요.

---

## H-3. Console.* in Production — 27건 / 15개 파일 확인

검색 결과: `console.(log|warn|error)` 호출이 `app/`, `lib/`, `workers/` 경로의 15개 파일에서 27건 발생.

| 파일 | 횟수 | PII 위험 |
|---|---|---|
| `lib/ai/structured-blocks.ts` | 6 | High (assistant 응답 처리) |
| `lib/ingest/pii/presidio.ts` | 1 | Critical (PII 검출 입력) |
| `lib/ingest/pii/workers-ai.ts` | 1 | Critical |
| `lib/ai/consult.ts` | 2 | Critical (RAG 8-step 입출력) |
| `lib/ai/merge.ts` | 2 | High |
| `app/api/ra/consult/route.ts` | 1 | Critical (사용자 query 처리) |
| `app/api/ra/updates/[id]/route.ts` | 1 | Medium |
| `lib/notifications/admin-quarantine.ts` | 1 | Medium |
| `lib/inngest/docingest/email-received.ts` | 1 | High |
| `lib/radar/notifier.ts` | 2 | Medium |
| `lib/radar/notifier-channels/slack.ts` | 2 | Medium |
| `lib/radar/notifier-channels/email.ts` | 3 | Medium |
| `workers/radar-score-consumer.ts` | 2 | Medium |
| `workers/radar-notify-consumer.ts` | 1 | Medium |
| `workers/radar-classify-consumer.ts` | 1 | Medium |

총 27건. Issue #29 와 일치.

**의존성 확인**: `package.json` 의존성에 Sentry SDK, Langfuse SDK 가 이미 포함되어 있음 (RELEASE-001 §3 references). 신규 logger library 추가 불필요.

---

## H-4. TODO/Placeholder — 9개 파일 확인

검색 결과: `TODO|FIXME|placeholder` 패턴이 `app/`, `lib/`, `workers/` 의 9개 파일에 존재.

| 파일 | 종류 | 비고 |
|---|---|---|
| `lib/ai/hybrid-router.ts` | TODO | Vectorize runtime 미구현 |
| `lib/external/eu-ectd.ts` | placeholder | EU eCTD mTLS 통합 미구현 |
| `lib/external/fda-estar.ts` | placeholder | FDA eSTAR mTLS 통합 미구현 |
| `lib/db/schema.ts` | TODO | (확인 필요) |
| `lib/inngest/docingest/upload-processed.ts` | TODO | (확인 필요) |
| `lib/ingest/pii/regex.ts` | TODO | (확인 필요) |
| `lib/ingest/pii/redaction-map.ts` | TODO | (확인 필요) |
| `lib/workflows/common/template-engine.ts` | TODO | (확인 필요) |
| `lib/radar/notifier-channels/email.ts` | TODO | (확인 필요) |

추가로 `tests/e2e/fixtures/msw-sse.ts` 의 MSW handler TODO가 별도 존재.

본 SPEC RUN 단계에서 9개 파일 각각의 TODO 정확한 컨텍스트를 추가 분석하여 (a) 구현, (b) feature flag 격리, (c) deferred SPEC 발행 중 하나를 선택한다.

---

## H-5. Citation E2E Skip — 확인

### 파일: `tests/e2e/citation-click.spec.ts` (4개 test, 모두 skip 상태)

```typescript
test('clicking a citation block opens the DocViewer panel', async ({ page }) => {
  test.skip(!!NEEDS_SERVER, NEEDS_SERVER ?? '');
  test.skip(true, 'Requires authenticated session — run with PLAYWRIGHT_AUTH_STATE set');
  // ...
});
```

4개 테스트 모두 라인 14, 36, 65, 91 에서 `test.skip(true, ...)` 호출.

### 관련 커밋: `ae48d12 fix(e2e): citation-click 테스트에 인증 세션 필요 skip 추가`

LAUNCH-001 Phase 6 실행 중 발견된 auth 세션 부재로 임시 skip이 추가됨. fixture 구성이 후속 작업으로 남음.

### Playwright config 확인 필요

`playwright.config.ts` 에 storage state fixture path가 설정되어 있는지 확인. 없는 경우 `globalSetup` 추가 필요.

---

## H-6. Workflow Executor Mock — 확인

### 파일: `lib/workflows/submission-drafter/executor.ts`

```typescript
// @MX:ANCHOR: [AUTO] executeStep — public API boundary for step execution in 510(k) workflow
// @MX:REASON: fan_in >= 3: workflow runner, tests, and future async worker all call this

/** Mock implementation of step execution for the submission drafter workflow. */
export async function executeStep(step: string, _ctx: StepExecutionContext): Promise<StepResult> {
  const completedAt = new Date().toISOString();

  switch (step) {
    case 'device_classification':
      return {
        stepName: step,
        output: { classification: 'Class II', regulatoryPath: '510(k)' },
        confidenceScores: [{ source: 'llm', score: 0.92, weight: 1 }],
        completedAt,
      };
    // ... all other cases also return hardcoded mock data
```

**현재 동작**: `device_classification`, `predicate_search`, `substantial_equivalence` 모두 hardcoded 응답. 실제 LLM 호출 없음.

3개 워크플로우 (submission-drafter, audit-response, indication-impact) 모두 동일한 mock 패턴.

### 결정 (사용자 컨텍스트로부터)

> "Add 'Beta' badge to UI + clear 'experimental' disclosure. No real LLM implementation in 1st release."

본 SPEC은 mock 구현을 유지하되:
1. UI에 명시적 Beta 표기
2. API 응답에 `_mock: true` 플래그
3. audit_logs 에 mock_data 태깅

으로 사용자 오인 위험을 차단한다.

### 워크플로우 페이지: `app/(app)/workflows/page.tsx` (29라인)

```typescript
// @MX:NOTE [AUTO] WorkflowsPage — lists all available regulatory workflows.
// Server component: no client state, displays mock/static data from WORKFLOW_REGISTRY.
// @MX:SPEC SPEC-REGULA-WORKFLOWS-001 (M6)

import { WorkflowCard } from '@/components/workflows/WorkflowCard';
import { WORKFLOW_REGISTRY } from '@/lib/workflows/registry';

export default function WorkflowsPage() {
  return (
    <section className="mx-auto flex max-w-content flex-col gap-6">
      <header>
        <h1 className="font-serif text-3xl text-brand-800">Regulatory Workflows</h1>
        <p className="mt-2 text-sm text-ink-600">Automated regulatory document generation</p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {WORKFLOW_REGISTRY.map((workflow) => (
          <WorkflowCard
            key={workflow.id}
            title={workflow.title}
            description={workflow.description}
            href={workflow.href}
            stepCount={workflow.stepCount}
          />
        ))}
      </div>
    </section>
  );
}
```

**현재 동작**: `WorkflowCard` 에 Beta 배지나 disclosure 없음. 일반 카드와 시각적으로 구분 불가.

---

## 의존성 SPEC 매핑

| 본 SPEC 그룹 | 관련 기존 SPEC | 관계 |
|---|---|---|
| Group A (Dashboard) | SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-019) | 본 SPEC이 ENTERPRISE-019 stub을 완성 |
| Group B (Knowledge) | SPEC-REGULA-CHAT-001 (REQ-CHAT-044, sources API 정의) | sources [id] route는 CHAT-001 산출물; list endpoint를 본 SPEC에서 추가 |
| Group C (Console) | Issue #29 | 직접 close 대상 |
| Group D (TODO) | Issue #27 | 직접 close 대상; deferred SPEC 발행 시 신규 SPEC ID 생성 |
| Group E (E2E) | SPEC-REGULA-LAUNCH-001 (REQ-LAUNCH-019) | LAUNCH-019 잔여 작업 (auth fixture) |
| Group F (Workflow) | SPEC-REGULA-WORKFLOWS-001 (M6) | mock 구현 그대로 유지하되 UI 시그널 추가 |

---

## RELEASE-001 정합성 확인

`.moai/specs/SPEC-REGULA-RELEASE-001/spec.md` §2 In Scope 에 명시:

> Release hardening issues #26~#30.

#27 (TODO/placeholder), #29 (console.*) 는 본 SPEC의 Group D, C와 직접 매핑.

§1 릴리즈 차단 근거에도 다음 명시:

> - production 경로에 TODO/placeholder/deferred integration 흔적 존재.
> - runtime 경로에 직접 `console.*` 출력 존재.

본 SPEC은 RELEASE-001 의 1차 릴리즈 범위 lock 내에서 P1 하드닝을 담당한다.

---

## 변경 영향 추정

| 그룹 | 영향 범위 (파일 수) | 회귀 위험 | 테스트 커버리지 |
|---|---|---|---|
| A | 1-2 (route + hook type) | Low | API 응답 shape 단위 테스트 |
| B | 2-3 (route + page + hook) | Low | API 단위 + page 컴포넌트 테스트 |
| C | 15 (console 호출 파일) + 1 (logger) | Medium (silent regression) | 로거 단위 테스트, PII grep |
| D | 9-10 (TODO 파일) + feature flag util | Low (격리) | feature flag 동작 단위 테스트 |
| E | 1 (spec 파일) + 1 (fixture) + config | Low | E2E itself |
| F | 5+ (badge/banner/cards/executors/audit) | Low | 시각적 검증 + mock flag 단위 테스트 |

---

## 결론

본 SPEC은 **신규 비즈니스 기능 0건**, **품질·정직성 결함 28건 해소**로 명확하게 정의된다. RELEASE-GATE-001 (P0) 완료 후 즉시 RUN 가능하며, 그룹별 병렬 진행으로 머지 충돌을 최소화할 수 있다.
