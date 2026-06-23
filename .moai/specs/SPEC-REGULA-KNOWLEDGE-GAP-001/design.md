# SPEC-REGULA-KNOWLEDGE-GAP-001 — Design Document

> DDD ANALYZE phase 산출물. 기존 코드베이스 분석 기반 구현 계획.
> 통합 지점: gap-replay.ts, consult.ts, permissions.ts, schema.ts.

---

## 1. Data Model

### 1.1 New Tables

#### `unanswered_queue` (미답변 큐)

```typescript
// lib/db/schema.ts
export const unansweredQueue = pgTable('unanswered_queue', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id).notNull(),
  conversationId: uuid('conversation_id').references(() => conversations.id).notNull(),
  messageId: uuid('message_id').references(() => messages.id).notNull(),
  redactedQuestion: text('redacted_question').notNull(),
  redactionHash: text('redaction_hash').notNull(), // SHA-256 of original question
  gapReason: gapReasonEnum('gap_reason').notNull(),
  clusterId: text('cluster_id'), // Similar questions group
  githubIssueNumber: integer('github_issue_number'),
  classification: gapClassificationEnum('classification'),
  status: gapStatusEnum('status').notNull().default('open'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at'),
});

// Indexes for common queries
export const unansweredQueueOrgIdx = index('idx_unanswered_queue_org', unansweredQueue.orgId);
export const unansweredQueueStatusIdx = index('idx_unanswered_queue_status', unansweredQueue.status);
export const unansweredQueueClusterIdx = index('idx_unanswered_queue_cluster', unansweredQueue.clusterId);
```

**Columns (18 total):**
- `id`: UUID primary key
- `org_id`: FK → organizations.id (RLS basis)
- `conversation_id`: FK → conversations.id
- `message_id`: FK → messages.id
- `redacted_question`: PII/영업비밀 제거된 질문 원문
- `redaction_hash`: SHA-256 hash (original question → redaction 검증)
- `gap_reason`: ENUM (low_confidence/low_citation/no_results/policy_blocked)
- `cluster_id`: TEXT (유사 질문 그룹 ID)
- `github_issue_number`: INTEGER (GitHub Issue #)
- `classification`: ENUM (ra_project_gap/md_process_gap/external_regulation_needed/bug)
- `status`: ENUM (open/classified/resolved)
- `created_at`: TIMESTAMPTZ
- `resolved_at`: TIMESTAMPTZ

**RLS Policy:**
- inherits `organizations` org isolation (Row Level Security)
- SELECT/INSERT/UPDATE governed by `org_id` membership

### 1.2 Schema Extensions

#### `messages.knowledge_gap_required` (NEW COLUMN)

```typescript
// lib/db/schema.ts - messages table extension
knowledgeGapRequired: boolean('knowledge_gap_required').notNull().default(false),
```

**Purpose:** Separate flag from `expertReviewRequired` (REQ-KNOWLEDGE-GAP-003). Distinguishes expert review gating from knowledge gap tracking.

### 1.3 New Enums

```typescript
// lib/db/schema.ts
export const gapReasonEnum = pgEnum('gap_reason', [
  'low_confidence',   // confidence score < threshold
  'low_citation',    // citation coverage < 80%
  'no_results',       // search returned 0 chunks
  'policy_blocked',   // LLM generation failed / policy restriction
]);

export const gapStatusEnum = pgEnum('gap_status', [
  'open',        // Initial state after detection
  'classified',  // RA 담당자 분류 완료
  'resolved',    // 폐쇄 루프 검증 통과
]);

export const gapClassificationEnum = pgEnum('gap_classification', [
  'ra_project_gap',           // RA 프로젝트 SOP 누락
  'md_process_gap',           // MD 제조/등록 프로세스 누락
  'external_regulation_needed', // 외부 규정 원문 필요
  'bug',                      // 제품 버그
]);
```

### 1.4 Audit Actions Extension

```typescript
// lib/db/schema.ts - auditActionEnum extension
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'knowledge_gap_created';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'knowledge_gap_classified';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'knowledge_gap_digest_sent';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'knowledge_gap_resolved';
```

---

## 2. Detection Signal Definition

### 2.1 Four Gap Conditions

#### Condition 1: Low Confidence

**Location:** `lib/ai/consult.ts` (line ~246)
```typescript
const confidenceScore = calculateConfidence({ chunkScores, citedCount, totalSentences });
const confidenceLevel = getConfidenceLevel(confidenceScore);
// Detection: confidenceLevel === 'low'
```

**Threshold:** `confidenceScore < 0.5` → `gap_reason: 'low_confidence'`

#### Condition 2: Low Citation Coverage

**Location:** `lib/ai/consult.ts` (line ~370)
```typescript
const uncitedViolationCount = violations.filter((v) => v.type === 'CLAIM_UNCITED').length;
const citationCoverageBelow80 = totalSentences > 0 && uncitedViolationCount / totalSentences > 0.2;
// Detection: citationCoverageBelow80 === true
```

**Threshold:** citation coverage < 80% → `gap_reason: 'low_citation'`

#### Condition 3: No Search Results

**Location:** `lib/ai/consult.ts` (line ~98, retrieval result)
```typescript
const topChunks = await parallelRetrieveAndMerge(rewrittenQuery, intent, input.locale);
// Detection: topChunks.length === 0
```

**Threshold:** search returned 0 chunks → `gap_reason: 'no_results'`

#### Condition 4: Policy Blocked

**Location:** `lib/ai/consult.ts` (line ~220)
```typescript
const llmFailed = true; // LLM generation unavailable
// Detection: llmFailed === true
```

**Threshold:** LLM generation failed / policy restriction → `gap_reason: 'policy_blocked'`

### 2.2 Detection Flow

```
consult.ts (Stage 7: Post-process)
  │
  ├─> Calculate confidence (low_confidence?)
  │
  ├─> Check citation coverage (low_citation?)
  │
  ├─> Check chunk count (no_results?)
  │
  └─> Check LLM status (policy_blocked?)
       │
       └─> IF ANY TRUE → detectKnowledgeGap()
                         ├─> redactQuestion()
                         ├─> unanswered_queue.insert()
                         └─> messages.knowledge_gap_required = true
```

---

## 3. Loop Flow Diagram (Text)

```
QUERY (user question)
   │
   ▼
[RAG Pipeline - consult.ts]
   │
   ├─> 4-Condition Detection (confidence/citation/results/policy)
   │   │
   │   └─> IF GAP DETECTED
   │       │
   │       ▼
   │   [unanswered_queue.insert()]
   │       ├─> redactQuestion (PII/영업비밀 제거)
   │       ├─> redaction_hash (SHA-256)
   │       ├─> gap_reason ENUM
   │       └─> status='open'
   │
   ├─> [Clustering - embedding similarity]
   │   │
   │   ├─> IF similar gap exists (cluster_id match)
   │   │   └─> appendGitHubIssue() (comment append)
   │   │
   │   └─> ELSE (new cluster)
   │       └─> createGitHubIssue()
   │           ├─> Labels: knowledge-gap, ra-auto, needs-classification
   │           ├─> Body: 질문 요약, 실패 원인, 누락 출처 후보
   │           └─> Metadata: conversation_id, message_id, redaction_hash
   │
   ├─> [RA Classification - knowledge-gap UI]
   │   │
   │   ├─> RA 담당자 분류 (4개 카테고리)
   │   │   ├─> ra_project_gap
   │   │   ├─> md_process_gap
   │   │   ├─> external_regulation_needed
   │   │   └─> bug
   │   │
   │   └─> status='classified'
   │       └─> audit_logs: knowledge_gap_classified
   │
   ├─> [Daily Digest - 08:00 scheduler]
   │   │
   │   ├─> 전날 미답변 요약 (top topics, 긴급도, SLA)
   │   └─> audit_logs: knowledge_gap_digest_sent (발송 실패 시)
   │
   ▼
[KB Augmentation - document ingestion]
   │
   └─> [Delta-Sync - corpus_sync_runs]
       │
       └─> [gap-replay.ts: triggerGapReplay()]
           │
           ├─> matchedGapIds[] (vector similarity)
           │
           ├─> replayGapTest(queueId)
           │   │
           │   ├─> Re-run failed eval scenario
           │   └─> Check: citation 포함 답변?
           │
           └─> IF PASSED
               ├─> unanswered_queue.status='resolved'
               ├─> resolved_at=NOW()
               ├─> GitHub Issue comment (증거 문서 + replay 결과)
               └─> audit_logs: knowledge_gap_resolved
```

---

## 4. Integration Contract with gap-replay.ts

### 4.1 Existing Stub Interface

**File:** `lib/radar/delta-sync/gap-replay.ts`

```typescript
export interface GapReplayInput {
  crawlerName: string;
  matchedGapIds?: string[];
  ingestionRunId?: string;
}

export interface GapReplayResult {
  triggered: boolean;
  gapIds: string[];
  replayOutcome?: 'pending' | 'passed' | 'failed';
}

export function shouldTriggerGapReplay(input: GapReplayInput): boolean;
export async function triggerGapReplay(input: GapReplayInput): Promise<GapReplayResult>;
```

**Current Behavior:** Stub returns `{ triggered, gapIds, replayOutcome: 'pending' }`

### 4.2 #35 Implementation Contract

**Phase 3 (T3.2): Complete the stub**

```typescript
// lib/knowledge-gap/replay.ts (new module)
export async function replayGapTest(queueId: string): Promise<{
  passed: boolean;
  answerWithCitations: string;
  sources: SourceItem[];
}> {
  // 1. Load unanswered_queue item
  // 2. Retrieve original question (redacted)
  // 3. Re-run consult pipeline
  // 4. Check: citation 포함 답변?
  // 5. Return result
}

// lib/radar/delta-sync/gap-replay.ts (existing file, #35 completion)
export async function triggerGapReplay(input: GapReplayInput): Promise<GapReplayResult> {
  const gapIds = input.matchedGapIds ?? [];
  if (gapIds.length === 0) {
    return { triggered: false, gapIds: [] };
  }

  // #35: Actual replay execution
  const results = await Promise.all(
    gapIds.map(async (gapId) => {
      const result = await replayGapTest(gapId);
      if (result.passed) {
        await markGapResolved(gapId, result);
      }
      return { gapId, passed: result.passed };
    })
  );

  return {
    triggered: true,
    gapIds,
    replayOutcome: results.every((r) => r.passed) ? 'passed' : 'failed',
  };
}
```

**Calling Pattern (delta-sync):**

```typescript
// lib/radar/delta-sync/detector.ts (hypothetical caller)
const matchedGapIds = await findMatchingGaps(newDocumentEmbedding);
if (shouldTriggerGapReplay({ crawlerName: 'kfda', matchedGapIds })) {
  await triggerGapReplay({ crawlerName: 'kfda', matchedGapIds, ingestionRunId });
}
```

### 4.3 Gap Resolution Side-Effects

**When replay passes:**
1. `unanswered_queue.status = 'resolved'`
2. `unanswered_queue.resolved_at = NOW()`
3. GitHub Issue comment:
   - 증거 문서 (sources)
   - Replay 결과 (answer with citations)
4. `audit_logs` entry: `action = 'knowledge_gap_resolved'`

---

## 5. Acceptance Criteria Traceability

| AC # | Criterion | Task Mapping |
|------|-----------|--------------|
| AC-01 | 4개 조건 각각 gap 생성 | T0.3, T1.1, T1.4 |
| AC-02 | PII/영업비밀 redaction + hash | T1.2 |
| AC-03 | 유사 질문 클러스터링 | T2.1 |
| AC-04 | RA 분류 (4개 카테고리) + audit | T4.1, T4.3 |
| AC-05 | 일일 08:00 Digest + 실패 audit | T5.1, T5.2 |
| AC-06 | Ingestion 후 replay → resolved | T3.1, T3.2, T3.3 |
| AC-07 | 4종 이벤트 audit 기록 | T0.4, T4.1, T5.2, T3.3 |
| AC-08 | 권한 없는 사용자 차단 | T0.7 |

---

## 6. Existing Code Integration Points

### 6.1 Primary Integration: gap-replay.ts

**File:** `/home/abyz-lab/work/workspace-github/holee9/ra-med-bot/lib/radar/delta-sync/gap-replay.ts`
**Lines:** 1-59 (entire file)
**Purpose:** Stub left for #35. Delta-sync calls this when document ingestion completes.
**#35 Action:** Complete `triggerGapReplay()` to execute actual replay tests and resolve gaps.

### 6.2 Detection Hook Point: consult.ts

**File:** `/home/abyz-lab/work/workspace-github/holee9/ra-med-bot/lib/ai/consult.ts`
**Lines:** 200-400 (Stage 7: Post-process phase)
**Purpose:** RAG pipeline post-process where confidence/citation calculated.
**#35 Action:** Insert gap detection call after line 298 (after sources emitted, before structured blocks).

### 6.3 Permissions Reference: permissions.ts

**File:** `/home/abyz-lab/work/workspace-github/holee9/ra-med-bot/lib/auth/permissions.ts`
**Lines:** 1-187 (entire file)
**Purpose:** RBAC matrix.
**#35 Action:** Add 3 new permissions: `knowledgegap.classify`, `knowledgegap.view`, `knowledgegap.replay`.

### 6.4 Schema Pattern Reference: schema.ts

**File:** `/home/abyz-lab/work/workspace-github/holee9/ra-med-bot/lib/db/schema.ts`
**Lines:** 115 (audit_action enum), 380 (messages table), 665 (audit_logs table)
**Purpose:** Single source of truth for data model.
**#35 Action:**
- Add 3 enums: `gapReasonEnum`, `gapStatusEnum`, `gapClassificationEnum`
- Add `messages.knowledge_gapRequired` column
- Add `unanswered_queue` table definition

### 6.5 Migration Pattern Reference

**File:** `/home/abyz-lab/work/workspace-github/holee9/ra-med-bot/migrations/0065_delta_sync.sql`
**Lines:** 1-71 (entire file)
**Purpose:** Recent migration pattern (enum + table + audit_actions + indexes).
**#35 Action:** Create `0066_knowledge_gap.sql` following this pattern.

---

## 7. Technical Constraints

### 7.1 Redaction Reuse

**Constraint:** Do NOT invent new redaction algorithm.
**Implementation:** Wrap existing PII/영업비밀 redaction utility (project memory: E2E Env, existing patterns).
**Reference:** Search existing codebase for redaction utilities before implementing.

### 7.2 GitHub API Integration

**Required:** GitHub repo context for Issue creation.
**Implementation:** Use existing GitHub client (if any) or install `@octokit/rest`.
**Labels:** `knowledge-gap`, `ra-auto`, `needs-classification` (mandatory per AC-07).

### 7.3 Clustering Algorithm

**Approach:** Embedding-based similarity (cosine similarity ≥ 0.85).
**Storage:** `cluster_id` as TEXT hash of centroid embedding.
**Fallback:** If no similar gap found (threshold < 0.85), create new cluster.

### 7.4 Digest Scheduling

**Scheduler:** Vercel Cron or internal `node-cron`.
**Time:** Daily 08:00 KST.
**Failure Mode:** If digest send fails, write audit log (`knowledge_gap_digest_sent` with error meta).

---

## 8. Testing Strategy

### 8.1 Characterization Tests (PRESERVE Phase)

**Target:** `lib/ai/consult.ts`
**Purpose:** Preserve existing RAG pipeline behavior before adding gap detection.
**Tests:**
- `test_characterize_consult_confidence_calculation`
- `test_characterize_consult_citation_enforcement`
- `test_characterize_consert_llm_failure_handling`

### 8.2 Integration Tests (IMPROVE Phase)

**Target:** `lib/knowledge-gap/*` + API routes
**Tests:**
- `test_detect_gap_low_confidence`
- `test_detect_gap_low_citation`
- `test_detect_gap_no_results`
- `test_detect_gap_policy_blocked`
- `test_cluster_similar_gaps`
- `test_github_issue_create_new`
- `test_github_issue_append_existing`
- `test_replay_gap_test_pass`
- `test_mark_gap_resolved`

### 8.3 E2E Tests (Phase 5)

**Target:** Full loop flow
**Tests:**
- `test_knowledge_gap_full_loop`: Query → Gap → Issue → Classify → Ingest → Replay → Resolve

---

## 9. Open Questions / Blockers

**None identified.** All integration points are well-defined:
- gap-replay.ts stub exists with clear interface
- consult.ts hook point identified (line ~298)
- permissions pattern established
- schema migration pattern referenced
- GitHub Issue API requirements clear

---

## 10. Migration File Specification

**File:** `migrations/0066_knowledge_gap.sql`

**Structure:**

```sql
-- 1. pgEnum additions
CREATE TYPE gap_reason AS ENUM ('low_confidence', 'low_citation', 'no_results', 'policy_blocked');
CREATE TYPE gap_status AS ENUM ('open', 'classified', 'resolved');
CREATE TYPE gap_classification AS ENUM ('ra_project_gap', 'md_process_gap', 'external_regulation_needed', 'bug');

-- 2. messages table extension
ALTER TABLE messages ADD COLUMN knowledge_gap_required BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. unanswered_queue table creation
CREATE TABLE unanswered_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  message_id UUID NOT NULL REFERENCES messages(id),
  redacted_question TEXT NOT NULL,
  redaction_hash TEXT NOT NULL,
  gap_reason gap_reason NOT NULL,
  cluster_id TEXT,
  github_issue_number INTEGER,
  classification gap_classification,
  status gap_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- 4. Indexes
CREATE INDEX idx_unanswered_queue_org ON unanswered_queue(org_id);
CREATE INDEX idx_unanswered_queue_status ON unanswered_queue(status);
CREATE INDEX idx_unanswered_queue_cluster ON unanswered_queue(cluster_id);

-- 5. audit_action enum extension
ALTER TYPE audit_action ADD VALUE 'knowledge_gap_created';
ALTER TYPE audit_action ADD VALUE 'knowledge_gap_classified';
ALTER TYPE audit_action ADD VALUE 'knowledge_gap_digest_sent';
ALTER TYPE audit_action ADD VALUE 'knowledge_gap_resolved';

-- 6. RLS policies (inherited from organizations)
ALTER TABLE unanswered_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY unanswered_queue_org_policy ON unanswered_queue
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));
```

---

Version: 1.0.0
Created: 2026-06-23
Author: manager-ddd (ANALYZE phase)
SPEC: SPEC-REGULA-KNOWLEDGE-GAP-001
Issue: #35
