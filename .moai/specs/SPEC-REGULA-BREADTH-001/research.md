---
id: SPEC-REGULA-BREADTH-001
doc_type: research
created: 2026-04-22
updated: 2026-04-22
spec_version: 0.1.0
author: manager-spec
phase: 4
---

# Research — SPEC-REGULA-BREADTH-001 (Phase 4 Breadth)

본 문서는 `spec.md`의 EARS 요구사항(REQ-BREADTH-NNN)과 기술 결정의 **근거 기록**이다. 후속 Phase 5 Enterprise Hardening 및 Phase 6 Quality & Launch 감사 시 참조된다.

---

## 조사 배경

Regula Phase 4는 handoff §20 Roadmap의 **"Breadth"** 블록으로, Phase 1(Foundation 스캐폴딩) → Phase 2(Chat core + 단일 FDA 코퍼스) → Phase 3(Structured blocks) 순서를 거친 이후, **제품을 "진짜 사용 가능한 SaaS"로 만드는 확장** 단계이다.

Phase 4에서 다뤄야 할 범위는 세 축으로 정리된다:

1. **8개 view 확충**: handoff §7.1~§7.11 중 Phase 1~3에서 스텁으로만 존재하거나 아예 없었던 7개 화면(Home 확장, History, Templates, Knowledge Base, Regulatory Updates, Dashboard, Onboarding Modal)을 실데이터·실기능으로 구현
2. **RAG 코퍼스 5종 추가**: Phase 2는 FDA 단일 코퍼스만 와이어되어 있음(handoff §20 "minimal RAG pipeline wired to one corpus (FDA)"). Phase 4에서 EU MDR, MFDS(한국), NMPA(중국), PMDA(일본), 내부 SOP를 추가하고 intent classifier + router로 질문 → 적절 코퍼스 라우팅
3. **Project switching**: handoff §9.4 "Sidebar project click → currentProjectId Zustand 갱신 → 모든 후속 질의에 `projectId` 포함 → RAG retriever가 내부 문서 가중치 조정 + RightContextPanel 헤더 반영"

후속 보강이 **어려운** 제약은 이 Phase에서는 상대적으로 적다(Phase 1에서 schema·audit·citation 기반을 확보했기 때문). 다만 **audit_logs 모든 API 기록**(Non-Obvious Constraint #4)과 **한/영 이중언어 first-class**(#6)는 본 Phase 신규 API/페이지 전반에 일관 적용되어야 하며, 이 제약을 지금 놓치면 Phase 5 Enterprise(RBAC + 전체 감사)에서 대규모 수정이 필요해진다.

---

## 입력 handoff 섹션 상세 해석

### §7.3 Home view 확장 (Phase 1 스켈레톤 → Phase 4 실데이터)

**Phase 1 상태 (REQ-FND-016):** `app/(app)/page.tsx` 정적 placeholder.

**Phase 4 요구:**
- **Hero**: `무엇을 <em>검토</em>해 드릴까요?` serif 48px + 최신 규제 데이터 날짜(오늘 날짜, mono 포맷)
- **Quick grid (4 cards, 2x2 desktop)**: 아이콘 + 제목 + 설명. 클릭 시 `/chat`으로 이동하며 composer에 해당 질문 프리필. (프리필 전달 메커니즘: Zustand `ui.pendingQuestion` 또는 URL search param `?q=...`)
- **최근 질의 (4개)**: `useConversations({ limit: 4, sort: 'created_at desc' })` 호출 결과. 각 row는 message icon + 질문 + `프로젝트 · 시간 · N citations` 메타. 클릭 시 `/history/{id}` 또는 `/chat?conversationId={id}` 재진입.
- **빠른 템플릿 (3-card preview)**: `useTemplates({ limit: 3, sort: 'usage_count desc' })`. 전체 목록은 `/templates`.

**해석 결정:** "Quick grid"의 4개 샘플 질문은 hardcoded가 아니라 **handoff §7.3에 열거된 예시 기반 seed 테이블**(`home_quick_cards`)이 필요. 그러나 Phase 1 schema에는 이 테이블이 없다. **해석 1**: seed 4개 질문을 `lib/seeds/homeQuickCards.ts` 상수로 처리(DB 테이블 추가 안 함). Phase 5/6에서 관리자가 편집 가능한 테이블로 승격. 이 해석은 FOUNDATION의 scope discipline과 일치하며, Phase 4 schema drift를 막는다.

### §7.5 History view

**기능:**
- Header: `상담 이력` serif 32px + 카운트 subtitle (`총 1,284건`)
- Filter chips: `전체 / 진행중 / 보관` (conversations.status 매핑: `active` / in-progress / `archived`)
- Search box: 제목 또는 질문 내용 검색 (`q` param → API 풀텍스트 검색)
- List: 단일 카드 컨테이너, row 간 `border-b border-subtle` (handoff "subtle border")
- 각 row: 32x32 message icon tile + serif 16px 질문 + 메타 (`프로젝트명 · 상대 시간 · N citations`) + hover chevron

**예상 데이터 볼륨:** RA 전문가가 하루 10건 상담 × 250일 × 2년 = **5,000건/user**. 조직 단위로는 10,000건+ 쉽게 초과. **반드시 가상화 필요.**

**해석 결정 — 가상화 라이브러리:** handoff §10.2에 TanStack Query를 명시했으나 가상화 라이브러리는 미명시. 후보:
- **TanStack Virtual** (공식 TanStack 생태계) — Query와 동일 팀, 동일 패턴, cursor 기반 pagination 자연스러움
- **react-window** (Brian Vaughn) — 성숙도 높으나 별도 패키지

→ **TanStack Virtual 채택**. 근거: 생태계 통일성 + `useInfiniteQuery` + `useVirtualizer` 조합이 handoff §10.2 패턴과 직결.

### §7.6 Templates view

**기능:**
- Header: `템플릿` + description
- 3-column grid, `grid-template-columns: repeat(auto-fill, minmax(260px, 1fr))`
- 각 card: tinted icon tile + title + description + footer (`mono region tag | uses count`)
- 클릭 시 `/api/ra/templates/[id]/download` 호출 → 브라우저가 파일 다운로드

**다운로드 포맷 결정:**
- handoff §11.6 원문: `Returns .docx or .pdf binary`. 둘 중 어느 쪽인지 미명시.
- RA 실무 관행: **규제 제출은 PDF 고정, 편집용은 DOCX 필요**. 제출본과 draft는 둘 다 필요하므로 **둘 다 지원**.
- API 파라미터: `GET /api/ra/templates/[id]/download?format=pdf|docx`. 기본값 `pdf`.

**스토리지:**
- Phase 1에서 `templates.file_key` 컬럼 확보(S3/R2 object key). Phase 4는 이 key를 사용해 signed URL 생성 후 stream.
- **해석 결정 — 실제 템플릿 파일 업로드 메커니즘**: 관리자 UI는 Out of Scope (Phase 5). Phase 4는 seed 스크립트(`scripts/seed-templates.ts`)로 S3/R2에 샘플 DOCX/PDF 업로드하고 `templates` row INSERT.

### §7.7 Knowledge Base (Sources)

**기능:**
- Header: `지식 베이스`
- 그룹화: `공식 규제 기관 / 국제 표준 / 사내 지식` (sources.type enum 매핑: `Regulation`/`Guidance` → "공식 규제 기관", `Standard` → "국제 표준", `Industry` → "국제 표준" subgroup, `Internal` → "사내 지식")
- 각 source card: 아이콘 + 이름 + count badge (연결된 chunk 수 = `COUNT(source_sections WHERE source_id = ...)`) + description + `Synced · 2분 전` status pill

**해석 결정 — "Synced · 2분 전" 데이터 출처:**
- Phase 1 schema에는 `sources.last_synced_at` 컬럼이 없다. `created_at`만 있음.
- **해석 2**: Phase 4에서 **schema 변경 없이** `regulatory_updates.published_at` MAX per source_id를 join하여 "가장 최근 업데이트 시각"을 표시. 또는 hardcoded "실시간"으로 표시하고 Phase 5 수집 워커 합류 시 실제 값 연결.
- → **옵션 2 채택 (Phase 5 보강)**: Phase 4는 `sources.created_at` 기준으로 "등록 N일 전"만 표시. "Synced" 문구는 handoff UI 원문 유지하되 실제 값은 Phase 5 Inngest 수집 잡 연동 시 채움.

**필터링:**
- 지역 필터 (US/EU/KR/CN/JP/GLOBAL) — `sources.region` 컬럼
- 타입 필터 — `sources.type` enum

### §7.8 Regulatory Updates

**기능:**
- Header: `규제 업데이트`
- Vertical card list. 각 card:
  - Left accent border 3px: `severity = 'critical'` → amber, else brand-400
  - Meta row: region chip (mono, brand-50) + mono date + optional `HIGH IMPACT` tag
  - Serif 18px title
  - `영향 제품군: <bold product list>` — `regulatory_updates.affected_product_types[]` 표시
  - Actions: `영향도 분석` (sparkle) + `원문 보기` (file) 버튼

**`영향도 분석` 버튼 동작:**
- handoff §12 schema에 `regulatory_updates.impact_analysis_text` 컬럼이 이미 있음 (Phase 1에서 nullable 확보, Phase 4 LLM 생성).
- Phase 4 스코프: 버튼 클릭 시 **미리 생성된 `impact_analysis_text`를 modal로 표시**. 실시간 LLM 호출은 Phase 5. 이유: 수천 건 reg updates × 사용자 every click마다 LLM 호출 시 비용 폭발.
- **해석 결정**: Phase 4는 "pre-generated impact analysis on ingestion" 전략. Inngest 수집 잡(Phase 5)이 새 regulatory_update 수집 시 즉시 LLM으로 impact_analysis_text 생성. Phase 4는 seed에서 미리 생성된 text 사용.

**Personalization (handoff §11.7 "Feed personalized by user's products"):**
- 사용자의 프로젝트 `target_markets[]`와 `regulatory_updates.affected_product_types[]` 교집합 기반 필터
- 비어있으면 전체 표시 (온보딩 미완료 사용자)

### §7.9 Dashboard

**기능:**
- Header + 기간 subtitle (`이번 달` / `지난 30일` 토글)
- **Stat grid (4 cards)**:
  - 이번 달 질의 수 + delta vs 지난 달
  - citation 포함률 (`COUNT(message_sources) / COUNT(messages WHERE role='assistant')`)
  - 평균 confidence score
  - expert review 플래그 수
- **질의 유형별 분포 (2fr 컬럼)**: horizontal bar chart, intent classifier 결과 분포 (regulation-lookup / strategy / comparison / etc.)
- **규제 소스 커버리지 (1fr 컬럼)**: dot + label + count rows — 코퍼스별 message_sources 참조 빈도
- **팀 최근 활동 (full-width card)**: 최근 10건 audit_logs (action ∈ `llm.call`, resource_type = 'conversation') + avatar

**해석 결정 — 집계 쿼리 성능:**
- `audit_logs`는 append-only 대용량 테이블 (예상 수백만 row/년). Dashboard 매 진입마다 `SELECT COUNT(*) FROM audit_logs WHERE created_at > ...` 스캔 시 P95 심각 악화.
- **해석 3**: Phase 4는 **read replica + covered index** 전략. `CREATE INDEX ON audit_logs (created_at, action)` 추가. 캐시 레이어(TanStack Query `staleTime: 5min`)로 중복 조회 차단.
- Phase 5에서 Materialized View(`audit_logs_hourly_stats`) 도입 예정. Phase 4는 직접 쿼리로 시작.

**ACL (handoff §11.9 "Respects ACL (manager vs. member)"):**
- Phase 4는 organization scope만 적용 (현재 사용자가 속한 org의 데이터만). 세분화된 manager/member 구분은 Phase 5.
- API: `GET /api/ra/dashboard` → WHERE 절에 `organization_id = currentUser.organization_id` 하드 적용.

### §7.11 Onboarding Modal

**기능:**
- 4-step modal, 520px wide, centered, full-screen backdrop
- Step 1: 환영합니다 — shield icon
- Step 2: 출처 중심 (citation 원칙 설명) — book icon
- Step 3: 프로젝트 컨텍스트 — folder icon
- Step 4: 안전 장치 (전문가 검토) — alert icon
- Bottom bar: step dots (active expanded 18px) · `건너뛰기` · `다음 →`
- 완료 시 `localStorage.setItem('regula_onboarded', '1')`

**진입 조건:**
- `ui.onboardingDone === false` (Zustand, persist middleware 사용)
- Server-side 판단 불가 (localStorage 기반) → 첫 render 후 client-side check
- **해석 결정**: `users.theme_pref`처럼 DB 컬럼으로 persist할 수도 있으나, Phase 1 schema에 `users.onboarded_at` 없음. Phase 4는 localStorage only로 단순화. Phase 5에서 cross-device 지원 시 DB로 이관.

### §9.4 Project context switching

**핵심 시나리오:**
1. 사용자가 Sidebar의 `프로젝트 섹션` 항목 클릭
2. Zustand `ui.currentProjectId` 갱신
3. RightContextPanel 헤더가 새 프로젝트 정보로 업데이트
4. 이후 `/chat`에서 POST /api/ra/consult 시 `projectId` 자동 포함
5. RAG retriever가 해당 프로젝트의 target_markets에 따라 내부 문서 가중치 조정

**Concurrency 위험 — 해석 결정 4:**
- 사용자가 스트리밍 중에 프로젝트 전환하면?
- **해석 4**: **in-flight 스트림은 유지**, **새 질의만** 새 projectId 적용. 이유: 이미 스트리밍 중인 답변을 중단하면 사용자 혼란 + audit 기록 일관성 문제.
- 구현: `useStreamingAnswer` 훅은 훅 호출 시점의 projectId를 snapshot으로 캡처. 전환 후 새 Composer submit은 새 snapshot.
- 대안(탈락): 전환 시 AbortController로 중단 → 사용자 경험 악화.

### §10.1 Global Zustand 확장

**Phase 1 대비 추가 필요 필드:**
- `currentProjectId: string | null` — 현재 프로젝트 (Phase 1에서 이미 명시되어 있음, Phase 4에서 실제 사용)
- `recentProjects: string[]` — 최근 선택 5개 (Sidebar 우선 표시용)
- `pendingQuestion: string | null` — Home quick grid → Chat 전환 시 프리필 (다이나믹 전달)
- `rightPanelCollapsed: boolean` — 우측 context panel 접기 토글 (1100px 이상에서만 활성)

**해석 결정 — persist 전략:**
- `currentProjectId`, `recentProjects`, `rightPanelCollapsed`: localStorage persist (세션 넘어서 유지)
- `pendingQuestion`: volatile only (세션 내 transient)
- Zustand `persist` middleware 사용, `partialize`로 선택적 persist.

### §10.2 TanStack Query hooks

Phase 4 신규 구현 목록:
- `useConversations(filters)` → GET /api/ra/conversations
- `useConversation(id)` → GET /api/ra/conversations/[id]
- `useProjects()` → GET /api/ra/projects
- `useProject(id)` → GET /api/ra/projects/[id]
- `useTemplates()` → GET /api/ra/templates
- `useSources(filters)` → GET /api/ra/sources (목록, 개별 조회는 Phase 2에서 이미 구현)
- `useUpdates()` → GET /api/ra/updates (infinite query)
- `useDashboardStats()` → GET /api/ra/dashboard

**Query keys 네이밍 규약:**
- `['conversations', filters]`, `['conversation', id]`, `['projects']`, ...
- Invalidation: 새 conversation 생성 시 `queryClient.invalidateQueries(['conversations'])`

### §11.2 ~ §11.9 API endpoints

8개 API endpoint의 Zod 스키마는 handoff §11에 상세 부재 (FOUNDATION Technical Decision #4 "Phase 4에서 결정"). 본 Phase research에서 명시:

**/api/ra/conversations (§11.2):**
```ts
// Request (query params)
{ projectId?: string, status?: 'active'|'archived', q?: string,
  cursor?: string, limit?: number = 20 }
// Response
{ items: ConversationSummary[], nextCursor: string|null }
// ConversationSummary
{ id, title, status, projectId, projectName?, createdAt,
  lastMessageAt, messageCount, citationCount }
```

**/api/ra/conversations/[id] (§11.3):**
```ts
// Response
{ id, title, status, createdAt, project, messages: Message[] }
// Message (Phase 2/3 blocks 포함)
{ id, role, contentProse, confidenceLevel, confidenceScore,
  durationMs, expertReviewRequired, sources, blocks, createdAt }
```

**/api/ra/conversations/[id]/feedback (§11.4):**
```ts
// Request
{ messageId: string, rating: 'up'|'down', comment?: string }
// Response
{ success: true, feedbackId }
// Side effect: audit_logs INSERT with action='message.feedback'
```

**/api/ra/sources/[id] (§11.5):**
```ts
// Query params: ?offset=N (anchor-based deep link)
// Response
{ id, orgLabel, title, year, type, region, url, sections: SourceSection[] }
// SourceSection
{ id, anchor, heading, text }
// anchor-based deep link: source_sections.anchor UNIQUE(source_id, anchor) 활용
```

**/api/ra/templates (§11.6 list):**
```ts
// Query params: ?region=...&category=...
// Response
{ items: Template[] }
```

**/api/ra/templates/[id]/download (§11.6 download):**
```ts
// Query params: ?format=pdf|docx (기본 pdf)
// Response: binary stream, Content-Type: application/pdf or application/vnd.openxmlformats-officedocument.wordprocessingml.document
// Side effect: templates.usage_count++ + audit_logs INSERT with action='template.download'
```

**/api/ra/updates (§11.7):**
```ts
// Query params: ?cursor=...&limit=20
// Personalization: WHERE affected_product_types && currentUser.projects.target_markets
// Response
{ items: RegulatoryUpdate[], nextCursor: string|null }
```

**/api/ra/dashboard (§11.9):**
```ts
// Query params: ?period=30d|90d|180d (기본 30d)
// Response
{
  period, stats: { queries, citationRate, avgConfidence, expertFlags },
  intentDistribution: [{ label, count, percentage }],
  sourceCoverage: [{ sourceId, orgLabel, count }],
  recentActivity: [{ actorName, action, resourceType, createdAt }],
  deltas: { queriesDelta: +18, ... }
}
```

**/api/ra/projects + /api/ra/projects/[id]:**
- handoff §11에 명시 안 됨 (지식 누락). FOUNDATION "Out of Scope"로 이관됨. Phase 4에서 결정:
- **CRUD 스코프**: list / detail / create / update. Delete는 감사 이슈로 Phase 5 (soft delete 도입 시기).
- Zod 스키마:
```ts
// POST /api/ra/projects
{ name: string, deviceClass?: string, targetMarkets: string[],
  color?: string, submissionDate?: string }
// PATCH /api/ra/projects/[id]
{ name?, deviceClass?, targetMarkets?, color?, submissionDate?, status? }
```

### 5개 RAG 코퍼스 특성 비교

Phase 2는 FDA 단일 코퍼스를 `lib/ai/retrievers/fda.ts`로 구현했다고 가정. Phase 4는 5개 추가 retriever를 **공통 인터페이스**로 구현:

```ts
// lib/ai/retrievers/types.ts (Phase 2에서 이미 정의되었을 것으로 가정)
interface CorpusRetriever {
  id: CorpusId;
  label: string;
  search(query: string, options: SearchOptions): Promise<RetrievedChunk[]>;
}
```

| 코퍼스 | 언어 | 문서 형식 | 예상 크기 | 주요 특징 | 도전 과제 |
|---|---|---|---|---|---|
| FDA (Phase 2 완료) | 영어 | PDF + HTML (ecfr.gov) | 수천~수만 문서 | 구조화 양호, 영어 모델 최적화 | (완료) |
| EU MDR | 영어 (공식 번역 22개 언어) | PDF (EUR-Lex) | 수백~수천 문서 | 표·부록 풍부 | 표 OCR 품질 |
| MFDS (한국) | 한국어 | HTML (mfds.go.kr) + HWP 일부 | 수천 문서 | 한글 조사·어미 처리 필요 | HWP parser, 한국어 embedding 품질 |
| NMPA (중국) | 중국어 (간체) | HTML (nmpa.gov.cn) | 수천 문서 | 정부 서버 접속 제한 가능 | 중국어 tokenization, crawler 정책 |
| PMDA (일본) | 일본어 | PDF + HTML (pmda.go.jp) | 수천 문서 | 한자·가나 혼용, 표 많음 | 일본어 tokenization |
| 내부 SOP | 한/영 혼재 | DOCX / PDF (조직 업로드) | 수십~수백 문서 | 조직별 격리 필수 | RBAC (Phase 5), hash chunking |

**Embedding 모델 결정 — 해석 5:**
- handoff §11.1에 specific embedding 모델 미명시.
- 후보: `text-embedding-3-large` (OpenAI) vs `cohere-embed-multilingual-v3.0`
- **해석 5**: **Cohere `embed-multilingual-v3.0` 채택** (1024 dim). 근거: (1) 한/중/일 다국어 성능 > OpenAI, (2) 이미 Phase 2에서 Cohere Rerank 사용 중이라면 동일 벤더로 통합.
- Phase 1 schema는 `vector(1536)` 컬럼. **변경 영향**: Phase 1 schema 수정 불가(이미 audit). **대안**: `sources.embedding`, `source_sections.embedding` 컬럼은 현재 `vector(1536)` 유지. Cohere 1024-dim → zero-pad to 1536 or re-migrate to vector(1024). **결정 deferred**: Phase 2가 실제 선택한 모델에 맞추고, 불일치 시 Phase 4 Decision Point 1로 명시하여 regula-architect가 결정.

### Intent Classifier (handoff §11.1 Step 1)

**prompt 설계:**
```
You are a query classifier for a medical device regulatory affairs chatbot.
Classify the user's question into ONE of these intents:
- regulation-lookup: 특정 규정 조문 찾기 ("IEC 62304 § 5.2는?")
- strategy: 전략적 조언 ("FDA 510(k) 제출을 위해 필요한 문서는?")
- comparison: 여러 관할권 비교 ("MDR vs FDA 임상 요건 차이는?")
- timeline: 일정·단계 ("EU MDR 전환 기간은?")
- template: 템플릿·양식 요청
- update: 최신 업데이트 질의
Return ONLY the intent ID, no explanation.

Question: {{query}}
Locale: {{locale}}
```

**모델:** Claude Haiku (handoff §11.1 명시).

**Corpus routing 매핑:**
```ts
const intentToCorpora: Record<Intent, CorpusId[]> = {
  'regulation-lookup': ['fda', 'eu-mdr', 'mfds', 'nmpa', 'pmda'],
  'strategy': ['fda', 'eu-mdr', 'mfds', 'internal-sops'],
  'comparison': ['fda', 'eu-mdr', 'mfds', 'nmpa', 'pmda'], // 전체
  'timeline': ['fda', 'eu-mdr', 'mfds'],
  'template': [], // 별도 templates 쿼리
  'update': [], // 별도 regulatory_updates 쿼리
};
```

**프로젝트 context override:**
- `currentProjectId`가 있으면 해당 프로젝트의 `target_markets`에 포함된 region만 우선:
  - target_markets가 `['US', 'KR']` → `['fda', 'mfds', 'internal-sops']`로 축소 (EU/CN/JP는 background 낮은 weight)

### Parallel Retrieval + Merge

**병렬 호출 전략:**
```ts
const corpora = intentToCorpora[intent];
const results = await Promise.all(
  corpora.map(c => retrievers[c].search(query, { limit: 10 }))
);
// merge + rerank
const merged = mergeAndRerank(results.flat(), { topK: 8 });
```

**성능 목표:** 5개 코퍼스 병렬 P95 ≤ 800ms (handoff §18 "P95 end-to-end < 4s" 중 retrieval 부분).

**Rerank:** Cohere Rerank v3 (Phase 2에서 이미 도입) — 각 코퍼스 top-10 → 병합 50개 → rerank top-8.

---

## TanStack Virtual 적용 전략

### History 페이지 (REQ-BREADTH-H)

```ts
// 1. useInfiniteQuery로 cursor pagination
const query = useInfiniteQuery({
  queryKey: ['conversations', filters],
  queryFn: ({ pageParam }) => fetch(`/api/ra/conversations?cursor=${pageParam}`).then(r => r.json()),
  getNextPageParam: (last) => last.nextCursor,
  initialPageParam: null,
});

// 2. Flatten pages
const rows = query.data?.pages.flatMap(p => p.items) ?? [];

// 3. TanStack Virtual
const virtualizer = useVirtualizer({
  count: rows.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 72, // card height + border
  overscan: 5,
});

// 4. Trigger next page on near-bottom
const lastItem = virtualizer.getVirtualItems().at(-1);
useEffect(() => {
  if (lastItem && lastItem.index >= rows.length - 5 && query.hasNextPage) {
    query.fetchNextPage();
  }
}, [lastItem]);
```

**성능 목표:** 10,000 rows 스크롤 시 FPS ≥ 55 (handoff §15 Performance).

### Knowledge Base (REQ-BREADTH-K)

- 그룹화 레이아웃이므로 flat virtualization 부적합
- **전략**: 그룹 헤더 + flattened rows 구조로 변환 → `rangeExtractor`로 그룹 헤더 sticky 처리
- 또는 각 그룹별 독립 Virtualizer (그룹 수가 3개로 제한되므로 가능)

---

## 추가 데이터 페처 (audit_logs 제약)

**Non-Obvious Constraint #4 적용 — 모든 신규 API가 audit_logs에 기록:**

| API | action | resource_type | 트리거 시점 |
|---|---|---|---|
| GET /api/ra/conversations | `conversations.list` | `conversation` | 각 요청마다 |
| GET /api/ra/conversations/[id] | `conversation.view` | `conversation` | 각 요청마다 |
| POST /api/ra/conversations/[id]/feedback | `message.feedback` | `message` | 각 요청마다 |
| GET /api/ra/sources/[id] | `source.access` | `source` | (Phase 2에서 이미 정의) |
| GET /api/ra/templates/[id]/download | `template.download` | `template` | 성공 시 |
| GET /api/ra/updates | `updates.list` | `regulatory_update` | 각 요청마다 (batch) |
| GET /api/ra/dashboard | `dashboard.view` | `organization` | 각 요청마다 |
| GET /api/ra/projects | `projects.list` | `project` | 각 요청마다 |
| POST /api/ra/projects | `project.create` | `project` | 성공 시 |
| PATCH /api/ra/projects/[id] | `project.update` | `project` | 성공 시 |

**Enum 확장:** FOUNDATION REQ-FND-049는 `'llm.call'`, `'source.access'`, `'expert_review.flag'` 3개만 정의. Phase 4에서 **다음 action enum 값 추가 필요**:
- `conversations.list`, `conversation.view`, `message.feedback`, `template.download`, `updates.list`, `dashboard.view`, `projects.list`, `project.create`, `project.update`

**해석 결정 6 — enum 확장 경로:**
- FOUNDATION REQ-FND-049는 string type에 union (TypeScript level). DB 레벨은 `action text NOT NULL`이므로 **DB migration 불필요**.
- Phase 4에서 `lib/audit.ts`의 TypeScript union 확장만으로 처리.
- 추후 Phase 5에서 `action` 컬럼을 pgEnum으로 승격하는 migration은 별도 SPEC.

---

## i18n 제약 (Non-Obvious Constraint #6)

Phase 4 페이지는 모두 **한국어 UI 기본**, 영어 override는 Phase 5 런타임 스위처에서 제공.

**Phase 4 범위:**
- 모든 UI 문자열을 `/i18n/ko/breadth.json` 파일에 집중 (추후 Phase 5에서 key-based 스위처 도입 용이)
- 또는 Phase 4는 hardcoded Korean, Phase 5에서 i18n 라이브러리(next-intl) 도입 시 일괄 추출
- **해석 결정 7**: Phase 4는 hardcoded Korean. Phase 5 도입 시 영향 범위를 `app/(app)/**/*.tsx` 및 `components/**/*.tsx`로 명시. 추가 복잡도 없음.

**API 응답의 locale:**
- handoff §11.1 `locale: 'ko'|'en'` 파라미터는 `/api/ra/consult` 전용. 다른 API는 locale 무관 (DB raw data 반환).
- 예외: `/api/ra/updates`의 `title`은 원문 언어(영/한/중/일 혼재). 번역은 Phase 5.

---

## 프로젝트 전환 concurrency 심층 분석

**시나리오 A (단순):** 프로젝트 전환 후 새 질의.
- 동작: `ui.currentProjectId` 갱신 → 새 Composer submit 시 자동 반영. 이슈 없음.

**시나리오 B (복잡):** 프로젝트 전환 후 **이전 history 페이지 조회 중**.
- 동작: History는 `?projectId=` 필터를 URL에 가질 수 있음. Zustand 변경이 URL 변경을 유발하면 → page reload? 또는 `router.replace()`?
- **해석 결정 8**: URL `?projectId=` 변경은 **명시적 사용자 액션**(filter chip 클릭)에만 반영. Sidebar project switching은 **currentProjectId만 Zustand에 갱신**, URL filter는 독립. 이유: 사용자가 여러 프로젝트 history를 교차 조회하는 경우 URL filter를 유지해야 함.

**시나리오 C (고위험):** 스트리밍 중 프로젝트 전환.
- 해석 4 (위)에서 이미 명시: in-flight 스트림 유지, 새 질의만 반영.

**시나리오 D:** Composer 입력 중 프로젝트 전환.
- handoff §9.4 암시적 요구 + Non-Obvious Constraint #6 "로케일 전환 시 전체 페이지 리로드 없이 대화 유지"와 유사 원칙
- **해석 결정 9**: Composer 입력 텍스트는 **Zustand pendingQuestion에 독립 저장**(currentProjectId와 분리). 프로젝트 전환이 입력 내용에 영향 주지 않음.

---

## Dashboard 집계 쿼리 성능 실험 데이터

Phase 4 예상 데이터 볼륨 (1년차 말):
- Users: ~500
- Organizations: ~20
- Conversations: ~300,000 (500 × 250 × 2.4)
- Messages: ~1,500,000 (avg 5 msg/conv)
- Message_sources: ~6,000,000 (avg 4 sources/assistant msg)
- Audit_logs: ~15,000,000 (모든 API + 스트리밍 이벤트)

**Dashboard 쿼리 1 — 이번 달 질의 수:**
```sql
SELECT COUNT(*) FROM audit_logs
WHERE action = 'llm.call'
  AND created_at > date_trunc('month', now())
  AND organization_id = $1;
```
- Index `(created_at, action)` 활용 시 P95 ~ 20ms (15M 로우 중 100K 스캔)

**Dashboard 쿼리 2 — 질의 유형별 분포:**
- intent 태그는 현재 schema에 없음. 추가 필요?
- **해석 결정 10**: Phase 1 schema에 `messages.intent` 컬럼 없음. Phase 4에서 **JSON meta_json에 저장**(`messages.block_json`은 assistant role만 쓰이므로 `meta_json` 별도 추가 필요). 또는 `audit_logs.meta_json` 활용 (`meta_json->>'intent'`).
- → **audit_logs 활용**: `llm.call` 이벤트의 meta_json에 `{intent: 'regulation-lookup', model: 'sonnet-4.5', tokens: ...}` 기록. Dashboard 쿼리: `SELECT meta_json->>'intent' AS intent, COUNT(*) FROM audit_logs GROUP BY intent`.
- 인덱스: `CREATE INDEX ON audit_logs USING gin (meta_json jsonb_path_ops)` 또는 expression index on `(meta_json->>'intent')`.

---

## 기술 선택 근거

### 결정 1: 가상화 라이브러리 — TanStack Virtual vs react-window

**선택: TanStack Virtual**
- TanStack 생태계 통일(Query + Virtual)로 패턴 일관성
- `useInfiniteQuery` + `useVirtualizer` 조합이 handoff §10.2 패턴과 직결
- SSR 대응 우수 (`useEffect` dependency 명확)
- **탈락: react-window** — 성숙도 높으나 생태계 분리 overhead

### 결정 2: Intent Classifier — Haiku vs Regex

**선택: Claude Haiku**
- handoff §11.1 명시 — 논쟁 여지 없음
- 한/중/일 다국어 처리 자연
- 비용: 입력 ~100 tokens × Haiku 가격 ~ $0.0001/호출, 하루 10K 호출 시 $30/일 허용 가능
- **탈락: Regex 휴리스틱** — 한국어 형태소 처리 복잡 + 신규 intent 추가 시 유지보수 악화

### 결정 3: 코퍼스 선택 메커니즘

**선택: Intent → intentToCorpora 정적 매핑 + 프로젝트 target_markets 필터**
- 투명성 우수 (디버깅 용이)
- Phase 5에서 A/B test 및 학습형 router로 진화 가능
- **탈락: 단일 hybrid search (모든 코퍼스 동시)** — 한/영/중/일 혼합 시 embedding similarity 왜곡

### 결정 4: 프로젝트 전환 — 페이지 리로드 vs Zustand only

**선택: Zustand 갱신 only, 페이지 리로드 금지**
- handoff §9.4 원문 "All subsequent questions include `projectId`" — 현재 페이지에는 영향 최소
- 스트리밍 중 전환 시 UX 보호 (해석 4)
- **탈락: 리로드** — Composer 입력 소실 + 스트리밍 강제 중단

### 결정 5: 템플릿 다운로드 포맷 — PDF only vs DOCX only vs 둘 다

**선택: 둘 다 (기본 PDF)**
- RA 실무: PDF = 제출본 (서명 잠금), DOCX = draft 편집
- 스토리지 부담 2배이나 템플릿 수 제한적 (~수백)
- **탈락: 단일 포맷** — 둘 중 하나 빠지면 실사용 불가

### 결정 6: Dashboard 집계 — 직접 쿼리 vs Materialized View

**선택: Phase 4는 직접 쿼리 + 인덱스 + Query 캐싱. MV는 Phase 5.**
- Phase 4 데이터 볼륨 ~1.5M messages → 인덱스 있으면 P95 허용 수준
- Materialized View는 refresh 전략·스테일 데이터 표시 UX 이슈가 있어 별도 설계 필요
- **탈락: 즉시 MV 도입** — 과도한 설계, YAGNI

---

## handoff 디자인 디코딩 (screenshot 참조)

### Home screenshot (01-home.png)
- Hero의 brand-700 italic `검토` 강조가 시각 중심
- Quick grid 카드의 tinted icon square (brand-50 bg)
- 최근 질의 row의 `프로젝트명` 컬러 dot (project.color)

### History screenshot (06-history.png)
- 단일 card container (shadow-sm, radius 12px)
- Row 간 border-b border-subtle
- hover chevron 출현 (opacity 0 → 1, 120ms)

### Templates screenshot (04-templates.png)
- 3-col grid, tinted icon tile (radius 8px, bg brand-50 or amber-50 per category)
- Mono region tag footer

### Updates screenshot (05-updates.png)
- Left border 3px accent (amber-500 for HIGH IMPACT)
- `HIGH IMPACT` tag: amber-100 bg, amber-700 text, mono 10px

### Knowledge Base screenshot (07-knowledge-base.png)
- Grouped headers (uppercase, tracked)
- Status pill: green dot + "Synced · 2분 전"

### Dashboard screenshot (03-dashboard.png)
- Stat card: uppercase label, serif 32px value, delta 11px with arrow icon
- Horizontal bar chart: label + bar (bg brand-200, fill brand-600) + mono count
- Dot list: colored dot + label + mono count

---

## 의존성 검증

### 상위 SPEC 정합성
- **SPEC-REGULA-FOUNDATION-001 v0.3.0**: 13 tables schema 확보, audit_logs append-only, `source_sections` UNIQUE(source_id, anchor). Phase 4는 schema 변경 없이 진행 가능.
- **SPEC-REGULA-CHAT-001 (Phase 2)**: `/api/ra/consult` SSE 핸들러, useStreamingAnswer 훅, message_sources 데이터 기록 확보. Phase 4 History 페이지는 기록된 conversations를 읽기만 함.
- **SPEC-REGULA-STRUCTURED-001 (Phase 3)**: message_blocks (`prose`, `checklist`, `comparison`, `timeline`, `sources`, `related`) 6종 block_type 활용. Phase 4 conversation detail view에서 재렌더링.

### 외부 의존성
- Inngest (FOUNDATION 결정 #2) — Phase 4는 실제 job 구현 없음 (Phase 5). 단, **regulatory_updates 테이블의 impact_analysis_text seed**는 Phase 4 배포 전 수동 생성 필요.
- Cohere API (Rerank) — Phase 2에서 이미 사용 중 가정.
- S3/R2 object storage — Phase 4 templates 파일 업로드용 (seed script). 환경변수 `S3_*` 추가.

---

## 후속 Phase handoff 포인트

### Phase 5 Enterprise에서 확장할 Phase 4 산출물
1. **Intent classifier**: Phase 4 정적 매핑 → Phase 5 학습형 router (regula-architect 설계)
2. **Dashboard**: 직접 쿼리 → Materialized View + Langfuse 통합
3. **Onboarding**: localStorage → users.onboarded_at DB 컬럼 이관 (cross-device)
4. **Project deletion**: Phase 4는 미지원 → Phase 5 soft delete 도입
5. **RBAC**: Phase 4는 organization scope only → Phase 5 manager/member 구분 + project ACL
6. **규제 업데이트 수집 자동화**: Phase 4는 seed only → Phase 5 Inngest crawler job
7. **전문가 검토 워크플로우 API/UI**: Phase 4는 Out of Scope → Phase 5 구현
8. **i18n 런타임 스위처**: Phase 4는 hardcoded Korean → Phase 5 next-intl 도입

### Phase 6 Quality & Launch에서 추가할 것
1. Playwright e2e: 모든 8 views + 프로젝트 전환 + API CRUD
2. 로드 테스트: Dashboard 집계 쿼리 10x 사용자 시뮬레이션
3. LLM eval: intent classifier 정확도 eval set (handoff §17.2)

---

## 위험 프로파일

| 위험 | 가능성 | 영향 | 대응 |
|---|---|---|---|
| 5개 코퍼스 품질 편차 (FDA 풍부 vs MFDS 부족) | High | 사용자가 한국 질문을 했는데 MFDS 결과 부족 → fallback으로 FDA 영어 결과가 top | Phase 4 UI에서 "결과 부족 시 원본 언어 안내" 표시. Phase 5에서 코퍼스 보강. |
| 프로젝트 전환 시 이전 스트림 취소 누수 (AbortController leak) | Medium | 메모리 누수, 네트워크 대역 낭비 | `useStreamingAnswer` 훅에서 unmount cleanup 철저. Vitest로 cleanup 검증. |
| Dashboard 집계 쿼리 성능 (audit_logs 스캔) | Medium | P95 > 2s | 인덱스 `(created_at, action)` + TanStack Query `staleTime: 5min` + Phase 5 MV 도입 |
| Intent classifier 오분류 (드물게 `comparison` → `regulation-lookup`으로) | Medium | 검색 결과 품질 저하 (최악의 경우) | Phase 6 eval set 구축. 오분류율 < 5% 목표. |
| 템플릿 파일 스토리지 비용 | Low | 월 ~$50 추가 | S3 Intelligent-Tiering. 큰 파일은 pre-compress. |
| 한국어 embedding 품질 (Cohere multilingual) | Medium | MFDS 검색 품질 저하 | Phase 4에서 샘플 10개 질문으로 벤치마크. 실패 시 multilingual-e5-large fallback. |
| 가상화 라이브러리 React 19 호환성 | Low | 빌드 실패 | TanStack Virtual v3.11+는 React 19 지원 확인. |
| 프로젝트 CRUD가 Phase 1 schema 변경 없이 구현 가능한가 | Low | schema migration 발생 | FOUNDATION schema 검토 완료 — 가능. `projects` 테이블에 이미 모든 컬럼 존재. |
| 기존 Phase 2/3 API와의 충돌 (예: `useConversation(id)` 중복 구현) | Low | 중복 코드 | Phase 4 착수 시 regula-architect가 기존 hooks 점검 후 확장. |

---

## Phase 4 스코프 매트릭스 (Non-Obvious Constraints × REQ-BREADTH)

FOUNDATION에서 정의한 7개 Non-Obvious Constraints 중 Phase 4에서 새롭게 적용/강화되는 제약:

| # | Constraint | Phase 4 관련 REQ | 상태 |
|---|---|---|---|
| 1 | 모든 LLM 주장에 inline citation | — | Phase 2에서 적용 완료, Phase 4는 렌더링만 (conversation detail) |
| 2 | SSE 다단계 스트리밍 | — | Phase 2 완료, Phase 4는 프로젝트 context 추가만 |
| 3 | Expert-review 자동 게이팅 | — | Phase 2 완료, Phase 4는 History에 `expert_review_required` 플래그 표시만 |
| 4 | **21 CFR Part 11 audit_logs** | **REQ-BREADTH-AX 그룹 (모든 API)** | **본 Phase 핵심 제약 — 10개 API 모두 writeAudit 호출** |
| 5 | Serif/Sans 타이포그래피 | REQ-BREADTH 전반 (Home serif 48px, History serif 32px/16px, Dashboard 통계 serif 32px) | 자연 상속 (tokens.css + Tailwind `font-serif`) |
| 6 | **한/영 이중언어** | **REQ-BREADTH UI 그룹 (모든 화면 한국어 hardcoded)** | **본 Phase 적용** |
| 7 | Auth 뒤 전역 noindex | — | FOUNDATION metadata 상속, Phase 4는 override 없음 |

---

## 완결성 검증

본 research.md가 spec.md에서 결정한 50+ REQ-BREADTH의 근거를 모두 포함하는지 체크:

- [x] 8 views 각각의 handoff 섹션 매핑
- [x] 10개 API endpoint의 Zod 스키마 방향
- [x] 5개 신규 RAG retriever + router
- [x] Project switching concurrency 분석 (시나리오 A~D)
- [x] TanStack Virtual 적용 전략
- [x] Onboarding persist 전략
- [x] Dashboard 집계 쿼리 설계
- [x] audit_logs action enum 확장 경로
- [x] i18n hardcoded Korean 결정
- [x] 5개 코퍼스 특성 비교
- [x] Intent classifier prompt 설계
- [x] 후속 Phase handoff 포인트
- [x] Risk 매트릭스

Phase 4 SPEC 작성 준비 완료.
