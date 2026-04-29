---
document_id: RESEARCH-REGULA-DOCINGEST-001
spec_id: SPEC-REGULA-DOCINGEST-001
phase: 8
created: 2026-04-22
author: manager-spec
depends_on:
  - SPEC-REGULA-FOUNDATION-001 (v0.4.0) — 13-table baseline, audit_logs pgEnum, pgvector, source_sections
  - SPEC-REGULA-BREADTH-001 (v0.2.0) — 5-corpus retriever pattern (lib/ai/retrievers/*.ts), intentToCorpora router, Cohere Rerank merge
  - SPEC-REGULA-ENTERPRISE-001 (v0.2.0) — RBAC 4-role x 2-scope, withPermission wrapper, writeAudit completeness CI gate
  - SPEC-REGULA-LAUNCH-001 (v0.1.0) — Launch readiness LR-001 ~ 025
  - SPEC-REGULA-CLOUDFLARE-001 (병렬 작성 중) — R2 object storage, Vectorize index, Email Workers, pii-redact utility
handoff_sections:
  - §4 (tech stack, storage)
  - §5 (directory structure)
  - §11 (APIs)
  - §12 (data model)
  - §16 (security, 21 CFR Part 11)
  - §17 (compliance)
  - §20 (roadmap, 확장 Phase)
summary: |
  Phase 8은 조직이 보유한 **인증 문서 및 제출 자료**를 Regula 시스템에 안전하게
  수집·분류·인덱싱하여 RAG retrieval의 확장 대상으로 편입시킨다. 공개 규제 코퍼스
  (Phase 2 FDA, Phase 4 EU MDR·MFDS·NMPA·PMDA·Internal SOP)와 구분되는 **조직 내부
  민감 문서**를 취급하므로, (a) HIPAA Safe Harbor 18 identifier PII redaction, (b)
  tenant-level isolation (Postgres RLS + pgvector WHERE filter), (c) Role × Document-
  class × Project ACL 매트릭스, (d) 모든 document access 의 audit_logs 기록 완결
  — 4개 축이 Day-1 요구사항이다.

  본 research.md는 SPEC 작성 전 8개 문서 클래스의 구조 분석, PII redaction 엔진
  비교, Postgres RLS 구현 전략, document_chunks 스키마 설계, ingestion source
  별 OAuth/API 제약, HIPAA 18-identifier 목록, 21 CFR 807.87 / MEDDEV 2.7/1 rev4
  섹션 구조를 총괄한다. SPEC v0.1.0은 본 research를 근거로 60~80개 REQ-DOC 요구
  사항을 생성한다.
---

# Research — SPEC-REGULA-DOCINGEST-001 (Phase 8 Document Ingestion)

## 0. 리서치 범위

본 연구 문서는 다음 6개 축을 심층 분석한다:

1. **문서 유형 분류 체계** — 8 class 정의, 실제 FDA/EU MDR 샘플 구조
2. **PII redaction 엔진** — Presidio(Microsoft) vs Workers AI vs 커스텀 regex
3. **Postgres RLS + pgvector 통합** — tenant isolation 구현 패턴
4. **document_chunks 스키마 설계** — FOUNDATION source_sections 시그니처 호환
5. **Ingestion source별 제약** — Google Drive / SharePoint / Dropbox / Email Workers / 수동 업로드
6. **규제 문서 섹션 구조** — 21 CFR 807.87, MEDDEV 2.7/1 rev4, MDR Annex II, ISO 13485

Phase 8은 **민감 데이터 취급 SPEC의 특수성**으로 인해 연구량이 큰 편이며, Phase 2
(FDA corpus, 공개 데이터)·Phase 4(EU MDR 등 공개)·Phase 5(관측성, 감사 확장)보다
도메인 지식 의존도가 높다. 본 연구는 이후 구현팀(regula-corpus-ingestion +
regula-compliance-qa + regula-backend 공동)이 세부 결정 없이 곧바로 코드 작성할 수
있도록 명세 수준으로 상세화한다.

---

## 1. 8 Document Class 상세 정의

### 1.1 문서 분류 체계 개요

공개 규제 코퍼스는 "외부 규제 당국이 발행한 문서"(FDA Guidance, CFR, EU MDR 원문 등)
이며 Phase 2·Phase 4에서 처리한다. 이와 대조적으로 Phase 8이 취급하는 **조직 내부
문서**는 다음 8 class로 완전 분할된다. 각 class는 (a) 고유 ACL 기본값, (b) 고유
chunking 전략, (c) 고유 metadata schema, (d) 고유 PII sensitivity level을 가진다.

| # | class enum | Korean label | 대표 문서 | ACL 기본 | PII 민감도 |
|---|-----------|------------|----------|---------|---------|
| 1 | `issued_certificate` | 취득 인증서 | FDA 510(k) clearance letter, CE Certificate of Conformity, MFDS 허가서, ISO 13485 certificate | 전사 read | Low |
| 2 | `submission_success` | 성공 제출자료 | 승인된 510(k) dossier 원본, EU MDR Technical Documentation (Annex II+III), MFDS 허가 dossier | org + 담당 project | High |
| 3 | `submission_inprogress` | 심사중 dossier | 제출 준비 중 510(k), 보완 요구 응답 draft | 담당 project만 | High |
| 4 | `clinical_report` | 임상 평가·성능 보고 | CER (Clinical Evaluation Report), PER (Performance Evaluation Report), CSR (Clinical Study Report) | org + project (PHI 제거 필수) | **Critical (PHI)** |
| 5 | `checklist_template` | 체크리스트·템플릿 | GSPR checklist, Essential Requirements checklist, Declaration of Conformity template | 전사 read | Low |
| 6 | `surveillance_report` | 시판 후 감시 보고 | PMS Plan, PSUR (EU MDR Art. 86), MDR Report (FDA), MDV report (MFDS) | org + project | High (환자 ID 포함 빈도) |
| 7 | `internal_sop` | 내부 SOP·QMS | QMS SOP (ISO 13485), Risk Management Plan (ISO 14971), Change Control procedure | 전사 read | Medium (직원 ID 포함) |
| 8 | `audit_response` | 외부 감사 대응 | FDA 483 Observations 응답, MDSAP CAPA, TÜV notified body audit response | admin + ra-lead only | Critical (사건 민감도) |

### 1.2 Class별 섹션 구조 (chunking 전략 근거)

#### 1.2.1 `issued_certificate` — 짧은 본문, 풍부한 메타데이터

인증서는 1~3 페이지 문서로, **본문 자체는 전문 검색보다 메타데이터 기반 조회가
더 가치있다**. 예시 (FDA 510(k) clearance letter):

```
DEPARTMENT OF HEALTH & HUMAN SERVICES
Food and Drug Administration

Date: [YYYY-MM-DD]
Company: [APPLICANT NAME]
Device Name: [DEVICE TRADE NAME]
510(k) Number: K123456
Regulation Number: 21 CFR 888.3027
Regulation Name: [CLASSIFICATION NAME]
Regulatory Class: Class II
Product Code: [PRODUCT CODE]

Dear [APPLICANT]:
We have reviewed your Section 510(k) premarket notification...
[본문 3~5 paragraphs, standard boilerplate]
```

**chunking 전략**: 단일 chunk (전체 본문) + metadata-heavy `metadata_json`:
```json
{
  "device_name": "Example Device",
  "fda_k_number": "K123456",
  "regulation_number": "21 CFR 888.3027",
  "regulatory_class": "II",
  "product_code": "ABC",
  "decision_date": "2024-01-15",
  "decision_type": "substantially_equivalent"
}
```

retrieval 시 metadata filter (fda_k_number, device_name)이 주 경로이며, 본문 임베딩은 fallback.

#### 1.2.2 `submission_success` — 21 CFR 807.87 7-Element 구조

510(k) submission dossier는 21 CFR 807.87이 규정하는 7개 element로 구성:

1. Device name (Device Trade Name, Common Name, Classification Name)
2. Establishment registration number
3. Device class (I, II, III)
4. Action taken to comply with performance standards
5. Proposed labels, labeling, advertisements
6. Statement of substantial equivalence (predicate device comparison)
7. 510(k) Summary (or Statement)

**chunking 전략**: element별 split (하나의 document_id 아래 7개 논리적 section).
각 element는 추가로 page-break 또는 heading 기반으로 50~200 토큰 단위 chunking.

추가 권장 섹션 (FDA 가이던스 기반):
- Indications for Use statement
- Device description
- Substantial Equivalence discussion (predicate device table)
- Performance testing summary
- Sterilization and shelf life
- Biocompatibility
- Software documentation level

```typescript
// lib/ingest/chunkers/submission-510k.ts
export const FDA_510K_SECTIONS = [
  'device_name',
  'establishment_registration',
  'device_class',
  'performance_standards',
  'labeling',
  'substantial_equivalence',
  '510k_summary',
  'indications_for_use',
  'device_description',
  'performance_testing',
  'sterilization',
  'biocompatibility',
  'software_documentation',
] as const;
```

#### 1.2.3 `clinical_report` — MEDDEV 2.7/1 rev4 CER 구조

EU MDR이 CER에 요구하는 섹션 (MEDDEV 2.7/1 rev4 Annex A1 기반):

1. Scope (device description, intended purpose)
2. Clinical evaluation strategy (literature + clinical investigation + post-market data)
3. Identification of relevant clinical data
4. Appraisal of clinical data (methodological quality, relevance)
5. Analysis of clinical data (benefit-risk)
6. Conclusions on safety and performance
7. Overall conclusion

**chunking 전략**: 7 섹션 heading-based split. 임상 데이터 appraisal 테이블은 별도
metadata 보존 (논문 PMID 리스트, 환자 N, outcome measures).

**PHI (Protected Health Information) 경고**: CER은 임상 시험 abstract를 직접 인용
하는 경우가 많고, 드물게 환자 식별자가 원 보고서에서 유출된 사례가 존재. Phase 8
PII 레이어는 CER class에 대해 `strict_phi_mode = true`로 동작.

#### 1.2.4 `internal_sop` — QMS SOP 구조

ISO 13485 기반 QMS SOP는 일반적으로 다음 메타데이터를 가진다:

```yaml
document_id: SOP-CC-001
title: Change Control Procedure
revision: 3
effective_date: 2026-01-01
approver: [role, not name]
supersedes: SOP-CC-001 rev 2
related_documents:
  - SOP-DC-001 (Document Control)
  - SOP-RM-001 (Risk Management)
```

**chunking 전략**: 3-part split:
- Header (title, revision, dates) → 1 chunk, heavy metadata
- Revision history → 1 chunk (audit trail가치)
- Body (Purpose, Scope, Responsibilities, Procedure, References) → 섹션별 chunk

#### 1.2.5 `audit_response` — 483 응답 구조

FDA 483 Observations 응답은 엄격한 구조:

```
Observation #1: [FDA가 작성한 관찰 내용]

Response:
  Immediate Action: [즉각 조치 및 완료 일자]
  Root Cause Analysis: [근본 원인]
  Corrective Action: [CAPA plan]
  Preventive Action: [재발 방지]
  Completion Evidence: [첨부 문서 reference]
  Target Completion Date: YYYY-MM-DD
  Responsible Party: [role/title, not name]
```

**chunking 전략**: Observation별 split (1 document = N observations = N chunks).
ACL은 가장 엄격한 수준 (admin + ra-lead only) — 483 content는 **상장 기업의
경우 FDA가 공개하므로 반드시 비밀은 아니지만**, 조직 내부 response strategy는
민감.

### 1.3 PII Sensitivity 매트릭스

각 class별 PII redaction 정책은 3 레벨로 적용:

| 민감도 레벨 | 정책 | 대상 Class |
|-----------|-----|----------|
| Low | SSN / 신용카드 / 이메일만 redact | issued_certificate, checklist_template |
| Medium | HIPAA Safe Harbor 18 identifier 전체 | internal_sop |
| High | 18 identifier + 환자 initial + drug brand mention | submission_success, submission_inprogress, surveillance_report |
| Critical (PHI) | High + date shifting + location generalization | clinical_report, audit_response |

---

## 2. PII Redaction 엔진 비교

### 2.1 HIPAA Safe Harbor 18 Identifier 전체 목록

HIPAA Privacy Rule §164.514(b)(2) "Safe Harbor" method는 de-identification을 위해
다음 18개 identifier의 제거를 요구한다:

1. Names
2. Geographic subdivisions smaller than state (street, city, county, precinct, ZIP — 3-digit ZIP 이하로 일반화)
3. Dates (other than year) directly related to individual (birth date, admission, discharge, death, exact age if > 89)
4. Telephone numbers
5. Fax numbers
6. Email addresses
7. Social security numbers
8. Medical record numbers
9. Health plan beneficiary numbers
10. Account numbers
11. Certificate/license numbers
12. Vehicle identifiers and serial numbers, including license plate numbers
13. Device identifiers and serial numbers (의료기기 serial number! — Phase 8 특별 주의)
14. Web URLs
15. IP addresses
16. Biometric identifiers (fingerprints, voiceprints)
17. Full-face photographic images and any comparable images
18. Any other unique identifying number, characteristic, or code

**Phase 8 특별 주의: #13 Device identifier** — 의료기기 RA 문서에서 `Device Serial
Number: SN-123456`은 legitimate 정보(제조 추적)이므로 redact하면 안 되는 경우와
redact해야 하는 경우가 혼재. 정책:

- 인증서(issued_certificate), 제조 추적 문서 → **보존**
- 환자 증례(case report), 사용 incident 보고서 → **redact**

이 구분은 document class + section context를 함께 고려한다. `lib/ingest/pii/policy-
by-class.ts`에서 class별 redaction rule set 분기.

### 2.2 Presidio (Microsoft) — 1순위 후보

**장점:**
- Microsoft 오픈소스 (github.com/microsoft/presidio, MIT license, 18k+ stars)
- 50+ PII entity type 기본 지원 (PERSON, EMAIL, US_SSN, PHONE, CREDIT_CARD, IBAN, US_DRIVER_LICENSE 등)
- spaCy 기반 NLP + regex + checksum 조합
- Python · JavaScript(Experimental) 지원
- Custom recognizer 확장 가능 (의료기기 serial number 같은 도메인별 패턴 추가)
- anonymization + de-anonymization 양방향 지원 → redaction_map 구현 가능

**단점:**
- Python 런타임 (Next.js Vercel serverless와 불일치)
- spaCy 모델 메모리 점유 (en_core_web_lg ~700MB)
- 한국어 지원 제한 (spaCy 한국어 모델 품질 낮음 — ko_core_news_lg 정확도 FRENCH 수준)
- 초기 로딩 시간 ~5s (cold start)

**배치 전략:**
- Cloudflare Worker 내 Python Worker 사용 불가 → **별도 AWS Lambda 또는 Google Cloud Run 컨테이너** 배포
- 또는 Inngest step으로 Docker 컨테이너 호출 (presidio-anonymizer REST API)

### 2.3 Workers AI (Cloudflare) — 2순위 / Fallback

**Cloudflare Workers AI 제공 모델 중 PII 관련:**
- `@cf/meta/llama-guard-3-8b` — safety classification
- `@cf/microsoft/piidetection-gliner-pii-base` (2026년 1월 GA) — PII entity NER

**장점:**
- Cloudflare edge 내 호환 (CLOUDFLARE SPEC의 R2 + Vectorize와 동일 환경)
- latency 낮음 (~100ms)
- 별도 인프라 불필요
- 비용 predictable (Workers AI pricing)

**단점:**
- Custom recognizer 없음 (의료기기 serial number 전용 패턴 불가)
- 출력이 span만 반환, anonymization 로직은 별도 구현 필요
- 한국어 지원 모델 선택지 제한
- Presidio 대비 entity coverage 작음

### 2.4 하이브리드 전략 (Decision)

**Technical Decision #2 결정 근거:**

```
┌─────────────────────────────┐
│  Ingestion source           │
│  (Google Drive/S3/Email)    │
└─────────────┬───────────────┘
              │ raw bytes to R2
              ▼
┌─────────────────────────────┐
│  Text extraction            │
│  (pdf-parse, mammoth for    │
│   docx, unzip for zip)      │
└─────────────┬───────────────┘
              ▼
┌─────────────────────────────┐
│  Layer 1: Regex fast-path   │
│  (SSN, email, phone, URL)   │
│  — 100ms, catches 60% PII   │
└─────────────┬───────────────┘
              ▼
┌─────────────────────────────┐
│  Layer 2: Workers AI PII    │
│  (GLiNER base model)        │
│  — 300ms, catches PERSON,   │
│     DATE, ORG, LOC          │
└─────────────┬───────────────┘
              ▼
┌─────────────────────────────┐
│  Layer 3: Presidio          │
│  (separate Lambda/Cloud Run)│
│  — class-specific policy    │
│  — medical identifier       │
│     custom recognizers      │
└─────────────┬───────────────┘
              ▼
┌─────────────────────────────┐
│  Redaction map persistence  │
│  (redaction_maps table)     │
│  — original_token → hash    │
└─────────────────────────────┘
```

Phase 8 초기(MVP): Layer 1 + Layer 2만. Layer 3(Presidio)은 `critical_phi_mode=true`
document class에만 적용 (clinical_report, audit_response).

### 2.5 Redaction Map 저장 전략

redaction_map 자체가 PII 공격 표면이다. 공격 시나리오:

1. 공격자가 `redaction_maps` 테이블 접근 권한 획득
2. `original_token` 컬럼 열람 → 원본 PII 재구성

**보호 전략:**

- redaction_maps 테이블은 **별도 Postgres schema** (e.g., `private`)에 위치
- `app_role`에서 `private.redaction_maps` 권한 REVOKE
- 권한 있는 role (`pii_admin_role`)만 SELECT 가능
- RLS로 `authorized_roles` 컬럼 검증
- `original_token`은 AES-256-GCM 암호화 후 저장 (symmetric key = `PII_MAP_KEY` env)
- access 시 반드시 audit_logs에 `redaction_map.access` action 기록 (새 enum 값)

---

## 3. Postgres RLS + pgvector 통합

### 3.1 tenant isolation 요구

Phase 8 문서는 `org_id` (tenant ID)에 의해 완벽히 격리되어야 한다. 공격 시나리오:

- SQL injection 또는 application bug로 WHERE 절 누락
- 조직 A의 RA가 조직 B의 내부 SOP 검색 결과를 획득
- GDPR Art. 32 (Security of processing) 위반 + BAA (Business Associate Agreement) 위반

**application-layer filter만으로는 불충분** — DB-level 강제 필요.

### 3.2 Postgres RLS (Row-Level Security) 기본

RLS 활성화:
```sql
ALTER TABLE organization_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON organization_documents
  FOR ALL
  TO app_role
  USING (org_id = current_setting('app.current_org_id')::uuid);
```

Postgres 세션 변수 `app.current_org_id`는 connection pooler에서 Auth.js 세션 기반
초기화:

```typescript
// lib/db/client.ts (Phase 8 확장)
export async function withTenantScope<T>(
  orgId: string,
  fn: (db: DrizzleClient) => Promise<T>
): Promise<T> {
  return await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_org_id', ${orgId}, true)`);
    return await fn(tx);
  });
}
```

모든 org-scoped 쿼리는 `withTenantScope` 래퍼 필수.

### 3.3 pgvector WHERE filter 강제

pgvector 인덱스 검색도 RLS 적용:

```sql
-- document_chunks 테이블
CREATE INDEX idx_document_chunks_embedding
  ON document_chunks
  USING hnsw (content_embedding vector_cosine_ops);

ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_chunks_isolation ON document_chunks
  FOR SELECT
  TO app_role
  USING (
    document_id IN (
      SELECT id FROM organization_documents
      WHERE org_id = current_setting('app.current_org_id')::uuid
    )
  );
```

**주의**: RLS policy는 pgvector의 HNSW 인덱스 사용을 일부 제한할 수 있다.
Postgres 15+ + pgvector 0.7+에서는 partial index + RLS 조합 테스트 필요
(benchmarking Phase 8 Run에서 수행).

### 3.4 BREADTH Retriever 패턴과 정합

BREADTH의 5 retriever는 다음 시그니처:

```typescript
// lib/ai/retrievers/fda.ts (Phase 2)
export interface RetrieverResult {
  chunks: Array<{
    id: string;
    content: string;
    source: { id: string; title: string; url?: string };
    score: number;
    metadata: Record<string, unknown>;
  }>;
  total: number;
}

export async function fdaRetrieve(
  query: string,
  options: { topK: number; filter?: unknown }
): Promise<RetrieverResult>;
```

Phase 8은 동일 시그니처를 따르는 새 retriever 추가:

```typescript
// lib/ai/retrievers/internal-docs.ts (Phase 8)
export async function internalDocsRetrieve(
  query: string,
  options: {
    topK: number;
    orgId: string;              // 필수 (tenant isolation)
    userId: string;             // ACL 계산에 필요
    projectScope?: string;      // optional project filter
    allowedClasses?: DocClass[]; // ACL 기반 class 필터
  }
): Promise<RetrieverResult>;
```

`options.orgId`를 `withTenantScope`로 연결하고, `options.allowedClasses`는
`computeAllowedClasses(userId, role)`로 사전 계산.

### 3.5 intentToCorpora 확장

BREADTH의 `lib/ai/router.ts`는 다음 매핑을 가진다:

```typescript
const intentToCorpora: Record<Intent, CorpusId[]> = {
  fda_guidance: ['fda'],
  eu_compliance: ['eu_mdr'],
  korea_approval: ['mfds'],
  china_approval: ['nmpa'],
  japan_approval: ['pmda'],
  sop_lookup: ['internal_sops'],
  // ...
};
```

Phase 8 확장 (Technical Decision #7):
```typescript
const intentToCorpora: Record<Intent, CorpusId[]> = {
  fda_guidance: ['fda', 'org_fda_submissions'],  // 공개 + 조직
  eu_compliance: ['eu_mdr', 'org_eu_cer'],
  korea_approval: ['mfds', 'org_mfds_submissions'],
  china_approval: ['nmpa', 'org_nmpa_submissions'],
  japan_approval: ['pmda', 'org_pmda_submissions'],
  sop_lookup: ['internal_sops', 'org_sops'],
  past_submission_reuse: ['org_fda_submissions', 'org_eu_cer'],  // 새 intent
  audit_response_drafting: ['org_audit_responses'],  // admin/ra-lead만
  // ...
};
```

공개·조직 corpus 병행 검색 시 citation 출력에서 출처 구분:
- 공개: `[FDA] 21 CFR 820.30 — Design Controls`
- 조직: `[Org · Our Submission K999001] Device XYZ — Indications for Use`

citation UI에서 `org:` prefix 또는 별도 아이콘으로 시각 구분.

---

## 4. document_chunks 스키마 설계

### 4.1 FOUNDATION source_sections 시그니처

FOUNDATION v0.4.0의 `source_sections` 테이블 (REQ-FND-044a/b/c):

```typescript
// lib/db/schema.ts (FOUNDATION)
export const sourceSections = pgTable('source_sections', {
  id: uuid('id').defaultRandom().primaryKey(),
  sourceId: uuid('source_id').notNull().references(() => sources.id),
  sectionPath: text('section_path').notNull(),
  contentText: text('content_text').notNull(),
  contentEmbedding: vector('content_embedding', { dimensions: 1536 }),
  pageNumber: integer('page_number'),
  offset: integer('offset'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
```

Phase 8 `document_chunks`는 **시그니처 호환**이면서 **조직 격리 + ACL + 버전 관리**
를 추가한 확장 테이블:

### 4.2 organization_documents 스키마

```typescript
// lib/db/schema-docingest.ts (Phase 8 신규)
import { pgTable, uuid, text, jsonb, timestamp, integer, vector, index, pgEnum } from 'drizzle-orm/pg-core';
import { organizations, users } from './schema';

export const docClassEnum = pgEnum('doc_class', [
  'issued_certificate',
  'submission_success',
  'submission_inprogress',
  'clinical_report',
  'checklist_template',
  'surveillance_report',
  'internal_sop',
  'audit_response',
]);

export const docStatusEnum = pgEnum('doc_status', [
  'pending',       // R2 upload 완료, text extraction 대기
  'extracting',    // text extraction 진행 중
  'redacting',     // PII redaction 진행 중
  'chunking',      // chunking + embedding 진행 중
  'indexed',       // 검색 가능 상태
  'failed',        // 처리 실패 (meta_json에 에러 정보)
  'quarantine',    // PII 처리 이상으로 격리 (human review 대기)
  'archived',      // 더 이상 검색 대상 아님 (보관만)
]);

export const docSourceEnum = pgEnum('doc_source', [
  'google_drive',
  'sharepoint',
  'dropbox',
  'email_workers',
  'manual_upload',
  'regulatory_portal',
]);

export const organizationDocuments = pgTable('organization_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  docClass: docClassEnum('doc_class').notNull(),
  title: text('title').notNull(),
  language: text('language').notNull().default('en'),  // ISO 639-1
  originalFileR2Key: text('original_file_r2_key').notNull(),
  redactedFileR2Key: text('redacted_file_r2_key'),  // null until redaction done
  fileSizeBytes: integer('file_size_bytes').notNull(),
  fileMimeType: text('file_mime_type').notNull(),
  fileHashSha256: text('file_hash_sha256').notNull(),  // dedup key
  source: docSourceEnum('source').notNull(),
  sourceMetaJson: jsonb('source_meta_json').notNull().default({}),
  // sourceMetaJson example:
  // { google_drive_file_id: '...', google_drive_modified_at: '...', shared_by: 'user@example.com' }
  metadataJson: jsonb('metadata_json').notNull().default({}),
  // metadataJson example for 510(k):
  // { fda_k_number: 'K123456', device_name: '...', decision_date: '...', product_code: '...' }
  uploadedBy: uuid('uploaded_by').notNull().references(() => users.id),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow().notNull(),
  status: docStatusEnum('status').notNull().default('pending'),
  version: integer('version').notNull().default(1),  // 개정 추적
  supersedesDocId: uuid('supersedes_doc_id'),  // 이전 버전 참조
  projectId: uuid('project_id'),  // optional 프로젝트 연결
  indexedAt: timestamp('indexed_at', { withTimezone: true }),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('org_documents_org_idx').on(table.orgId),
  classIdx: index('org_documents_class_idx').on(table.orgId, table.docClass),
  statusIdx: index('org_documents_status_idx').on(table.status),
  hashIdx: index('org_documents_hash_idx').on(table.orgId, table.fileHashSha256),
  projectIdx: index('org_documents_project_idx').on(table.orgId, table.projectId),
}));
```

### 4.3 document_chunks 스키마

```typescript
export const documentChunks = pgTable('document_chunks', {
  id: uuid('id').defaultRandom().primaryKey(),
  documentId: uuid('document_id').notNull().references(() => organizationDocuments.id, { onDelete: 'cascade' }),
  chunkIndex: integer('chunk_index').notNull(),
  contentText: text('content_text').notNull(),  // redacted 버전
  contentEmbedding: vector('content_embedding', { dimensions: 1536 }),
  sectionPath: text('section_path').notNull(),  // e.g., "substantial_equivalence/predicate_comparison"
  pageNumber: integer('page_number'),
  offset: integer('offset'),  // 원본 파일 내 byte offset
  tokenCount: integer('token_count').notNull(),
  metadataJson: jsonb('metadata_json').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  docIdx: index('doc_chunks_doc_idx').on(table.documentId),
  uniqueChunkIdx: unique().on(table.documentId, table.chunkIndex),
  // HNSW index for semantic search (separate migration for Postgres 16+)
}));
```

### 4.4 document_access_policies 스키마

```typescript
export const documentAccessPolicies = pgTable('document_access_policies', {
  id: uuid('id').defaultRandom().primaryKey(),
  documentId: uuid('document_id').notNull().references(() => organizationDocuments.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),  // admin/ra-lead/ra-member/viewer (reference but not FK — Phase 5 enum 재사용)
  projectScope: uuid('project_scope'),  // null = org-wide
  action: text('action').notNull(),  // 'read' | 'reference' | 'draft_reuse'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  docRoleIdx: index('doc_access_doc_role_idx').on(table.documentId, table.role),
}));
```

ACL 계산 알고리즘 (`lib/acl/document-acl.ts`):
1. user의 role 조회 (ENTERPRISE pgEnum)
2. user의 project 소속 조회
3. `document_access_policies` 쿼리 with (documentId, role IN (user.role), OR projectScope IN (user.projects))
4. action matrix 반환: `{ read: boolean, reference: boolean, draft_reuse: boolean }`

### 4.5 redaction_maps 스키마 (private schema)

```sql
CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE private.redaction_maps (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES public.organization_documents(id) ON DELETE CASCADE,
  original_token_encrypted bytea NOT NULL,  -- AES-256-GCM
  redacted_token text NOT NULL,              -- e.g., [PERSON_1], [DATE_2026_04_15]
  entity_type text NOT NULL,                 -- PERSON, DATE, SSN, EMAIL 등
  start_offset integer NOT NULL,
  end_offset integer NOT NULL,
  authorized_roles text[] NOT NULL DEFAULT ARRAY[]::text[],  -- admin, pii_admin
  created_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON private.redaction_maps FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM app_role;
GRANT USAGE ON SCHEMA private TO pii_admin_role;
GRANT SELECT ON private.redaction_maps TO pii_admin_role;

ALTER TABLE private.redaction_maps ENABLE ROW LEVEL SECURITY;

CREATE POLICY pii_admin_only ON private.redaction_maps
  FOR SELECT
  TO pii_admin_role
  USING (
    current_setting('app.current_role', true) = ANY(authorized_roles)
  );
```

---

## 5. Ingestion Source별 제약 분석

### 5.1 Google Drive (OAuth 2.0)

**API 문서:** Google Drive API v3

**필수 scope:**
- `https://www.googleapis.com/auth/drive.readonly` (읽기 전용)
- `https://www.googleapis.com/auth/drive.metadata.readonly` (메타데이터만 조회하는 경우)

**Rate limit:**
- Queries per 100 seconds: 1,000 (기본)
- Queries per day: 1,000,000,000

**구현 요점:**
- OAuth 2.0 installed application flow (refresh_token 저장)
- `files.list` API로 특정 폴더 (`folderId`) 하위 파일 열거
- `files.get` API로 파일 내용 다운로드 (바이너리)
- `files.watch` API로 webhook 기반 변경 감지 (권장)
- 변경 감지가 불가한 경우 `pageToken` 기반 changelog 폴링

**보안:**
- Client secret은 Cloudflare Workers Secrets에 저장
- OAuth refresh_token은 `organizations` 테이블에 AES-256-GCM 암호화 저장 (새 컬럼 `gdrive_refresh_token_encrypted`)
- 각 organization별 독립적 OAuth 승인

**Phase 8 초기 범위:**
- MVP: 관리자가 지정한 단일 폴더만 sync
- 확장: 복수 폴더, 서브폴더 재귀

### 5.2 SharePoint (Microsoft Graph API)

**API 문서:** Microsoft Graph API v1.0

**필수 scope:**
- `Sites.Read.All` 또는 `Sites.Selected`
- `Files.Read.All`

**Rate limit:**
- Per app per tenant per minute: 10,000
- Per user per minute: 1,200

**구현 요점:**
- Microsoft Graph SDK (TypeScript: `@microsoft/microsoft-graph-client`)
- Site ID / Drive ID 조회 → Items 열거
- `delta` query로 변경 감지 (효율적)
- Certificate-based auth 권장 (client secret 대신)

**특이점:**
- SharePoint metadata (author, modified, tags) 풍부 → `source_meta_json` 반영
- 사내 DRM 적용 파일은 decrypt 불가 (skip)

### 5.3 Dropbox (OAuth 2.0)

**API 문서:** Dropbox API v2

**필수 scope:**
- `files.content.read`
- `files.metadata.read`

**Rate limit:**
- Per user per hour: 1,200 (기본)

**구현 요점:**
- `/2/files/list_folder` + `/2/files/list_folder/continue` 페이징
- `/2/files/list_folder/longpoll` 변경 감지
- Team folder 접근은 Dropbox Business Team API 별도 필요

**우선순위:** MVP 이후 (Google Drive + SharePoint + Email Workers 먼저)

### 5.4 Email Workers (Cloudflare)

**문서:** Cloudflare Email Workers (CLOUDFLARE SPEC 참조)

**용도:** 전용 메일함 (e.g., `submissions@regula.example.com`)으로 받은 첨부 파일
자동 ingest

**구현 요점:**
- Cloudflare Email Worker가 이메일 수신 → MIME parse → 첨부 파일 R2 업로드 → Inngest 트리거
- 발신자 검증 필수 (SPF/DKIM/DMARC)
- 발신자를 organization user와 매칭 (email domain 또는 allow-list)
- 첨부 파일 유형 화이트리스트: PDF, DOCX, XLSX, ZIP (안티 멀웨어 스캔 필수)

**보안:**
- 발신자가 org user가 아닐 경우 `quarantine` status로 저장 + admin 알림
- ZIP bomb 방지: 압축 해제 전 size 검증 (> 500MB reject)
- 매크로 Word 문서 reject

### 5.5 Manual Upload (관리자 포털)

**엔드포인트:** `POST /api/admin/documents/upload`

**흐름:**
1. 관리자가 `app/(app)/admin/documents/upload/page.tsx`에서 파일 선택
2. 클라이언트가 R2 presigned URL 요청 (CLOUDFLARE SPEC의 R2 API)
3. 직접 R2 업로드 (browser → R2)
4. 업로드 완료 후 `POST /api/admin/documents` 메타데이터 등록
5. 서버가 Inngest 트리거 (text extraction → redaction → chunking)

**보안:**
- RBAC: admin + ra-lead만 접근
- CSRF: Auth.js 세션 토큰 검증
- File size 제한: 500MB per file (MVP)
- MIME type 검증 + magic bytes 검증

### 5.6 Regulatory Portal (FDA ESG, EMA CESP) — 후속 (Out of Scope)

FDA Electronic Submissions Gateway (ESG), EMA Common European Submission Portal
(CESP) 등으로부터 제출한 자료의 자동 미러링. 이는 Cloudflare Browser Rendering +
정부 포털 로그인 자동화 필요. Phase 8 out of scope.

---

## 6. Chunking 전략 상세

### 6.1 유형별 chunker 파일 배치

```
lib/ingest/chunkers/
├── index.ts                    # chunker registry by doc_class
├── base.ts                     # 공통 유틸 (token 카운팅, overlap 처리)
├── submission-510k.ts          # 21 CFR 807.87 7 elements + FDA 가이던스 추가 섹션
├── submission-eu-mdr.ts        # MDR Annex II + III 구조
├── submission-mfds.ts          # MFDS 허가 dossier 구조
├── cer-meddev.ts               # MEDDEV 2.7/1 rev4 CER
├── per.ts                      # IVDR Performance Evaluation Report
├── csr-ich-e3.ts               # ICH E3 CSR (Study Report)
├── certificate.ts              # issued_certificate (단일 chunk + metadata-heavy)
├── checklist-template.ts       # GSPR/ER 체크리스트 (항목별 chunk)
├── pms-psur.ts                 # PMS Plan / PSUR
├── mdr-report.ts               # FDA MDR report (incident 분할)
├── sop-iso13485.ts             # QMS SOP 3-part split
├── fda-483-response.ts         # FDA 483 observation별 분할
├── mdsap-capa.ts               # MDSAP CAPA 분할
└── generic.ts                  # fallback: heading-based + fixed-size
```

### 6.2 공통 chunking 파라미터

- **최대 chunk size:** 512 tokens (retriever context 여유 확보)
- **overlap:** 64 tokens (섹션 경계 정보 보존)
- **최소 chunk size:** 64 tokens (너무 작은 조각 방지)
- **embedding model:** OpenAI `text-embedding-3-small` (1536 dim, FOUNDATION 결정)

### 6.3 섹션 경계 탐지 품질 목표

Technical Decision #6에 따라 class별 전용 chunker 유지. 품질 측정:

```
section_boundary_accuracy = (correctly_split_sections / total_sections)
```

목표:
- `submission_success` (510(k)): ≥ 90%
- `clinical_report` (CER): ≥ 85%
- `internal_sop`: ≥ 95% (구조가 표준화)
- `certificate`: 100% (단일 chunk)

측정 방법: manual labeled 20 샘플/class, Phase 6 LAUNCH eval에서 통합 테스트.

### 6.4 OCR 전략 (deferred)

초기 MVP는 **텍스트 PDF만** 지원. 이미지 PDF (scanned documents)는 `status=quarantine`
으로 저장 후 admin 알림. Phase 9 이후 OCR 도입 시 후보:

- Cloudflare Workers AI `@cf/microsoft/table-transformer-v1.1-all` (table extraction)
- AWS Textract (별도 Lambda, Medical/PDF-specific)
- Google Document AI (Medical entity extraction)

Phase 8 SPEC에서는 명시적으로 Out of Scope 처리.

---

## 7. 21 CFR 807.87 / MEDDEV 2.7/1 rev4 / ISO 13485 레퍼런스

### 7.1 21 CFR 807.87 — 510(k) 내용 요건

원문 (21 CFR 807.87):
```
§807.87 Information required in a premarket notification submission.
Each premarket notification submission shall contain the following:

(a) The device name, including the trade or proprietary name,
    the common or usual name, and the classification name...
(b) The establishment registration number...
(c) The class in which the device is classified...
(d) Action taken by the person required to submit...
(e) Proposed labels, labeling...
(f) Statement that the device is substantially equivalent...
(g) 510(k) summary...
(h) Statement of compliance with current good manufacturing practice...
```

### 7.2 MEDDEV 2.7/1 rev4 — CER 평가 방법

MEDDEV 2.7/1 rev4 Appendix A 7개 주요 stage:
1. Scope definition
2. Identification of pertinent data
3. Appraisal of pertinent data
4. Analysis of the clinical data
5. Finalization of the clinical evaluation report
6. Post-market clinical follow-up (PMCF) plan
7. Update plan

### 7.3 ISO 13485:2016 — QMS 구조

ISO 13485 QMS Section:
- 4 Quality Management System (General, Documentation)
- 5 Management Responsibility
- 6 Resource Management
- 7 Product Realization
- 8 Measurement, Analysis, and Improvement

---

## 8. 기술 결정 요약 (Decision Log)

| # | 결정 | 선택 | 탈락안 | 근거 | 재평가 조건 |
|---|-----|-----|-------|-----|----------|
| 1 | 문서 저장소 | **Cloudflare R2** (CLOUDFLARE SPEC 기반) | AWS S3 | 생태계 통합, zero egress, Workers AI + Vectorize 동일 벤더 | R2 latency P95 > 500ms 또는 availability < 99.9% 시 S3 대체 |
| 2 | PII redact 엔진 | **Layer 1 regex + Layer 2 Workers AI GLiNER + Layer 3 Presidio** (condition-based) | 단일 Presidio | edge 내 Workers AI 우선, 민감 class에만 Presidio Lambda | GLiNER 정확도 < 95% 시 Presidio 전면 확대 |
| 3 | OCR 도입 시점 | **Phase 9 이후** | 초기 포함 | 복잡도 분리, MVP는 텍스트 PDF만 | 이미지 PDF 요청량 > 20% 시 Phase 9 우선화 |
| 4 | 문서 tenant isolation | **Postgres RLS + pgvector WHERE filter** | application-layer only | DB-level 강제, SQL injection 방어 | RLS + HNSW 성능 저하 > 50% 시 partial index 튜닝 |
| 5 | 문서 chunking 모델 | **type별 전용 chunker** | 단일 general chunker | 규제 문서 구조 보존, section boundary accuracy 목표 달성 | chunker 유지 비용이 retrieval 정확도 향상 대비 비효율적이면 fallback generic 확대 |
| 6 | 접근 audit | **모든 read도 audit_logs 기록** | sampling | Part 11 strict 해석, 감사 추적 완전성 | 일일 audit row > 1M 시 Phase 9에서 append-only partition 분할 |
| 7 | intent router 확장 | **기존 6 intent에 public + org corpus 병행 매핑 + 2 신 intent (past_submission_reuse, audit_response_drafting)** | 새 SPEC router 분리 | BREADTH router 재사용, citation prefix로 구분 | router cross-corpus merge latency > 800ms 시 intent 분기 |
| 8 | ingestion 트리거 | **Inngest step function** | Vercel Queue / 직접 호출 | FOUNDATION 결정 #2 (Inngest) 재사용, idempotent upsert 보증 | Inngest step 한도(25 steps) 초과 시 Trigger.dev 재평가 |
| 9 | dedup key | **sha256 hash(file_content)** | filename only | bit-identical 중복만 제거, 개정판은 version 증가로 별도 row | hash collision 비현실적 |
| 10 | redaction map encryption | **AES-256-GCM with env key PII_MAP_KEY** | plaintext + RLS only | 암호화 + RLS 이중 방어 | KMS 도입 시 envelope encryption으로 전환 |

---

## 9. REQ-DOC 그룹 예상 분포 (SPEC에서 확정)

| 그룹 | 범위 | 예상 REQ 수 | 주요 모듈 |
|-----|----|----------|---------|
| A | Document classification & type system | 10 | docClassEnum, class validation |
| B | Ingestion sources | 15 | google-drive.ts, sharepoint.ts, email-workers.ts, manual-upload.ts |
| C | PII redaction pipeline | 10 | pii/regex.ts, pii/workers-ai.ts, pii/presidio.ts |
| D | Document schema migration | 10 | schema-docingest.ts, migrations, RLS policies |
| E | Chunking strategies | 10 | chunkers/submission-510k.ts 등 |
| F | ACL matrix | 10 | document-acl.ts, document_access_policies |
| G | Retrieval integration | 7 | internal-docs.ts, router.ts 확장 |
| H | Admin UI | 6 | app/(app)/admin/documents/* |
| **합계** | | **~78** | |

---

## 10. Non-Obvious Constraints 매트릭스 Phase 8 기여

Phase 8이 CLAUDE.md의 7개 Non-Obvious Constraints에 기여하는 바:

| # | Constraint | Phase 8 기여 |
|---|----------|----------|
| 1 | Citation 강제 | **확장** — 조직 문서도 citation 대상, `data-source` 값에 `org:` prefix 규약 도입, `[Org · Our Submission K999001]` 형식 |
| 2 | SSE 다단계 | 간접 — retriever 변경만, SSE 프로토콜 자체 불변 |
| 3 | Expert-review 게이팅 | **확장** — 조직 문서 retrieval 결과가 confidence 계산에 가중치 상승(신뢰도 가정). PHI 문서 class 재인용 시 강제 expert-review flag |
| 4 | Audit 기록 | **완전 wiring** — FOUNDATION audit_action enum에 선제 선언된 `document.access`, `document.upload`, `document.redact`, `document.chunk`, `document.search`, `redaction_map.access` 전부 wiring |
| 5 | Serif 타이포 | 무영향 |
| 6 | ko/en 이중언어 | 관리자 포털 UI에 적용 (한국어 우선) |
| 7 | noindex | **강화** — 관리자 포털 `/admin/*` 는 추가 `noarchive, nosnippet` 메타 + middleware에서 non-admin 차단 |

---

## 11. 위험 (Risks)

| ID | Risk | 영향도 | 완화 전략 |
|---|------|------|---------|
| R-DOC-01 | PII redaction 누락 → 법적 책임 | Critical | 3-layer redaction, 정기 sampling audit, `critical_phi_mode` 강제 |
| R-DOC-02 | tenant isolation 우회 (SQL injection) | Critical | RLS + pgvector RLS + integration test (red team) |
| R-DOC-03 | redaction_maps 테이블 자체 유출 | High | AES-256-GCM + RLS + pii_admin_role 분리 + audit 기록 |
| R-DOC-04 | Google Drive / SharePoint OAuth rate limit | Medium | exponential backoff + 재시도 + Inngest step retry |
| R-DOC-05 | 대용량 submission (>500MB) 처리 시간 | Medium | R2 streaming upload + chunked extraction + Inngest long-running step |
| R-DOC-06 | 문서 분류 오분류 (8-class accuracy) | Medium | MVP는 사용자 수동 분류 UI, Phase 9에서 ML classifier 추가 |
| R-DOC-07 | 조직 간 document cross-reference 오류 | Critical | 모든 retrieval은 `withTenantScope` 필수, 정적 분석 CI gate (ESLint custom rule) |
| R-DOC-08 | OCR 미지원으로 중요 문서 누락 | Medium | quarantine status + admin 대시보드 알림, Phase 9 OCR 계획 명시 |
| R-DOC-09 | 개정판 관리 실패 (supersedes 체인 누락) | Medium | version 컬럼 + supersedes_doc_id + UI에서 "최신 버전만" 기본 표시 |
| R-DOC-10 | 관측성 누락 (Sentry/Langfuse에 PII 전송) | Critical | ENTERPRISE SPEC의 audit_logs ↔ 관측성 엄격 분리 원칙 적용, PII-free 보증 |

---

## 12. 의존 SPEC과의 인터페이스

### 12.1 FOUNDATION (v0.4.0) 의존

- `audit_logs.action` pgEnum: 6 신규 action 값 추가 예정 (document.*, redaction_map.*)
- `organizations` 테이블: `gdrive_refresh_token_encrypted`, `sharepoint_tenant_id` 등 OAuth state 컬럼 확장
- `users` 테이블: 변경 없음
- `source_sections` 테이블: **영향 없음** — 공개 corpus용 유지, 조직 문서는 별도 `document_chunks`

### 12.2 BREADTH (v0.2.0) 의존

- `lib/ai/router.ts`: intent 매핑 확장 (public + org corpus 병행)
- `lib/ai/merge.ts`: Cohere Rerank 호출 시 org chunk 포함 가능하게 시그니처 확장
- `lib/ai/retrievers/internal-sops.ts`: **deprecate 후보** — BREADTH의 공개 SOP와 Phase 8의 조직 SOP 구분 필요. 재명명: `internal-sops.ts` → `published-sops.ts`, `org-sops.ts` 신규

### 12.3 ENTERPRISE (v0.2.0) 의존

- `lib/auth/with-permission.ts`: Phase 8 Route Handler 전체 래핑
- `lib/auth/rbac.ts`: admin/ra-lead/ra-member/viewer 4-role 재사용 + 새 권한 `document:upload`, `document:read`, `document:read_unredacted`, `document:admin`
- audit-completeness CI gate: Phase 8 Handler 자동 포함

### 12.4 LAUNCH (v0.1.0) 의존

- Phase 6 LLM eval harness에 Phase 8 조직 문서 retrieval 품질 평가 회귀 추가
- Playwright E2E: 관리자 포털 업로드 → 검색 흐름 테스트 1종 추가

### 12.5 CLOUDFLARE (병렬 작성 중)

- R2 bucket: `regula-org-documents-{env}` (org별 prefix)
- Vectorize index: document_chunks embedding (또는 pgvector 유지)
- Email Workers: 전용 메일함 처리
- `lib/cloudflare/r2.ts`: R2 SDK wrapper
- `lib/cloudflare/pii-redact.ts`: Workers AI PII 엔트리

**상호 의존**: Phase 8은 CLOUDFLARE SPEC의 R2 + Email Workers + (optional) Vectorize
를 전제로 한다. CLOUDFLARE SPEC이 pgvector 유지를 선택하면 Phase 8은 `document_chunks`
테이블만으로 충분하며, Vectorize 도입을 선택하면 Phase 8은 pgvector + Vectorize
dual-write 전략을 Phase 9로 이관한다.

---

## 13. Launch Readiness 기여

LAUNCH SPEC의 launch_readiness_checklist (LR-001 ~ 025)에 Phase 8 관련 항목 예상:

| LR ID 예상 | 항목 | 검증 방법 |
|---------|-----|---------|
| LR-DOC-01 | PII redaction recall ≥ 99% for HIPAA 18 identifier | test set 500 샘플 자동 평가 |
| LR-DOC-02 | Document type classifier accuracy ≥ 95% (MVP는 사용자 수동 분류이므로 skip 가능) | human-labeled 100 샘플 |
| LR-DOC-03 | Tenant isolation 0 leak | red team integration test (교차 org 접근 시도) |
| LR-DOC-04 | Every document access audit logged within 1s | audit_logs row count 증분 자동 assertion |
| LR-DOC-05 | Redaction map access restricted to pii_admin_role | integration test (app_role으로 접근 시도 → 거부 확인) |

---

## 14. 정리

본 research는 Phase 8 SPEC 작성을 위한 모든 정보를 집약한다. 다음 8개 파일 구성은
구현 단계(regula-corpus-ingestion + regula-backend + regula-compliance-qa 협업)에서
곧바로 수행 가능하다:

1. `lib/db/schema-docingest.ts` — 4 테이블 추가
2. `migrations/00XX_docingest.sql` — schema + RLS + private schema
3. `lib/ingest/sources/` — 5 source handlers
4. `lib/ingest/pii/` — 3-layer redaction
5. `lib/ingest/chunkers/` — 14 class-specific chunkers + 1 generic
6. `lib/acl/document-acl.ts` — ACL matrix
7. `lib/ai/retrievers/internal-docs.ts` — 새 retriever
8. `app/(app)/admin/documents/` — 3 관리자 페이지

SPEC v0.1.0은 본 research 기반으로 REQ-DOC-001 ~ 078 (약 78개) 요구사항을 생성하며,
8개 그룹(A~H)으로 분할 관리한다.

---

*End of Research — SPEC-REGULA-DOCINGEST-001 v0.1.0*
